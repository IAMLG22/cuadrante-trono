// Resolución exacta con contacto, reformulada en el espacio de los puestos.
//
// Con todos en contacto: w = w0 + k·G·h, con G = T·K⁻¹·Tᵀ (K incluye todos los muelles).
// Un HdT que no llega al varal equivale a uno cuyo hombro «acompaña» al varal (h̃ᵢ = wᵢ, fuerza nula).
// Para el conjunto inactivo I basta resolver un sistema pequeño:
//   (I − k·G_II)·w_I = w0_I + k·G_IA·h_A
// Es la misma solución que el modelo completo, pero cada evaluación cuesta O(N²) en lugar de
// factorizar la matriz de rigidez entera. Se usa para recalcular al momento al arrastrar puestos.

import { cholesky, resolverCholesky } from './lineal';
import { DOF_A, DOF_B, DOF_Z0, evaluar, K_PERSONA, sumarMuelle, type Modelo } from './modelo';

/** Respuesta lineal de una magnitud: valor = base + Σ g_i·h̃_i + mom·(pendiente·W·h_cdg). */
interface Respuesta {
  base: number;
  g: Float64Array;
  mom: number;
}

export interface SolverRapido {
  N: number;
  G: Float64Array;
  w0: Float64Array;
  /** Desplazamiento de cada puesto por unidad de momento de cabeceo. */
  wMom: Float64Array;
  z0: Respuesta;
  a: Respuesta;
  b: Respuesta;
  puntas: Respuesta[];
  xPuntas: Float64Array;
  yPuntas: Float64Array;
  momentoCdg: number;
}

export interface SolucionRapida {
  w: Float64Array;
  F: Float64Array;
  activos: Uint8Array;
  iteraciones: number;
  z0: number;
  cabeceo: number;
  alabeo: number;
  /** Flecha de cada punta respecto a la prolongación de la mesa (m). */
  flechas: Float64Array;
}

export function precalcularRapido(m: Modelo): SolverRapido {
  const n = m.ndof, N = m.T.length, k = K_PERSONA;
  const K = Float64Array.from(m.K0);
  for (const t of m.T) sumarMuelle(K, n, t, k);
  const Lc = cholesky(K, n);
  const u0 = resolverCholesky(Lc, n, m.f0);
  const eA = new Float64Array(n);
  eA[DOF_A] = 1;
  const uM = resolverCholesky(Lc, n, eA);

  const respuesta = (dof: number): Respuesta => ({ base: u0[dof], g: new Float64Array(N), mom: uM[dof] });
  const z0 = respuesta(DOF_Z0), a = respuesta(DOF_A), b = respuesta(DOF_B);
  const puntas = m.puntas.map((p) => respuesta(p.dofW));
  const G = new Float64Array(N * N);
  const rhs = new Float64Array(n);
  for (let i = 0; i < N; i++) {
    rhs.fill(0);
    const t = m.T[i];
    for (let c = 0; c < t.dofs.length; c++) rhs[t.dofs[c]] += t.coefs[c];
    const z = resolverCholesky(Lc, n, rhs);
    for (let j = 0; j < N; j++) G[j * N + i] = evaluar(m.T[j], z);
    z0.g[i] = k * z[DOF_Z0];
    a.g[i] = k * z[DOF_A];
    b.g[i] = k * z[DOF_B];
    m.puntas.forEach((p, q) => (puntas[q].g[i] = k * z[p.dofW]));
  }
  return {
    N, G,
    w0: Float64Array.from(m.T, (t) => evaluar(t, u0)),
    wMom: Float64Array.from(m.T, (t) => evaluar(t, uM)),
    z0, a, b, puntas,
    xPuntas: Float64Array.from(m.puntas, (p) => p.x),
    yPuntas: Float64Array.from(m.puntas, (p) => p.y),
    momentoCdg: m.momentoCdg,
  };
}

/** Resuelve un sistema pequeño denso (Gauss con pivoteo parcial). */
function resolverPequeno(A: Float64Array, r: number, b: Float64Array): Float64Array {
  for (let c = 0; c < r; c++) {
    let piv = c;
    for (let i = c + 1; i < r; i++) if (Math.abs(A[i * r + c]) > Math.abs(A[piv * r + c])) piv = i;
    if (piv !== c) {
      for (let j = 0; j < r; j++) { const t = A[c * r + j]; A[c * r + j] = A[piv * r + j]; A[piv * r + j] = t; }
      const t = b[c]; b[c] = b[piv]; b[piv] = t;
    }
    const d = A[c * r + c];
    for (let i = c + 1; i < r; i++) {
      const f = A[i * r + c] / d;
      if (f === 0) continue;
      for (let j = c; j < r; j++) A[i * r + j] -= f * A[c * r + j];
      b[i] -= f * b[c];
    }
  }
  const x = new Float64Array(r);
  for (let i = r - 1; i >= 0; i--) {
    let s = b[i];
    for (let j = i + 1; j < r; j++) s -= A[i * r + j] * x[j];
    x[i] = s / A[i * r + i];
  }
  return x;
}

/**
 * Igual que `resolverContacto` (mismas opciones de cuesta), pero en O(N²) por iteración.
 * `h`: hombros (m). `xs`: x de cada puesto (para la pendiente).
 */
export function resolverRapido(
  s: SolverRapido, h: ArrayLike<number>, op: { pendiente?: number; conCdg?: boolean; xs?: ArrayLike<number> } = {},
): SolucionRapida {
  const { N, G } = s, k = K_PERSONA;
  const pend = op.pendiente ?? 0;
  const mom = pend !== 0 && op.conCdg ? pend * s.momentoCdg : 0;
  const hh = new Float64Array(N);
  for (let i = 0; i < N; i++) hh[i] = h[i] + (pend !== 0 ? pend * op.xs![i] : 0);
  const wb = new Float64Array(N); // parte que no depende de los hombros
  for (let i = 0; i < N; i++) wb[i] = s.w0[i] + mom * s.wMom[i];

  let activos = new Uint8Array(N).fill(1);
  const w = new Float64Array(N);
  const ht = new Float64Array(N); // hombros efectivos h̃
  let it = 0;
  for (; it < 100; it++) {
    const I: number[] = [];
    for (let i = 0; i < N; i++) if (!activos[i]) I.push(i);
    const r = I.length;
    if (r === N) throw new Error('El trono no queda apoyado: ningún hombre de trono llega al varal.');
    // w_I a partir del sistema pequeño
    for (let i = 0; i < N; i++) ht[i] = activos[i] ? hh[i] : 0;
    if (r > 0) {
      const A = new Float64Array(r * r);
      const bb = new Float64Array(r);
      for (let p = 0; p < r; p++) {
        const fila = I[p] * N;
        let sum = 0;
        for (let j = 0; j < N; j++) sum += G[fila + j] * ht[j];
        bb[p] = wb[I[p]] + k * sum;
        for (let q = 0; q < r; q++) A[p * r + q] = (p === q ? 1 : 0) - k * G[fila + I[q]];
      }
      const wI = resolverPequeno(A, r, bb);
      for (let p = 0; p < r; p++) ht[I[p]] = wI[p];
    }
    let cambios = 0;
    const nuevos = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      const fila = i * N;
      let sum = 0;
      for (let j = 0; j < N; j++) sum += G[fila + j] * ht[j];
      w[i] = wb[i] + k * sum;
      nuevos[i] = hh[i] - w[i] > 0 ? 1 : 0;
      if (nuevos[i] !== activos[i]) cambios++;
    }
    activos = nuevos;
    if (cambios === 0) break;
    // Los que vuelven a estar activos recuperan su hombro en la siguiente vuelta
  }
  const evalR = (rsp: Respuesta) => {
    let v = rsp.base + mom * rsp.mom;
    for (let i = 0; i < N; i++) v += rsp.g[i] * ht[i];
    return v;
  };
  const z0 = evalR(s.z0), a = evalR(s.a), b = evalR(s.b);
  const F = new Float64Array(N);
  for (let i = 0; i < N; i++) F[i] = activos[i] ? k * (hh[i] - w[i]) : 0;
  const flechas = Float64Array.from(s.puntas, (p, q) => evalR(p) - (z0 + a * s.xPuntas[q] + b * s.yPuntas[q]));
  return { w, F, activos, iteraciones: it + 1, z0, cabeceo: a, alabeo: b, flechas };
}
