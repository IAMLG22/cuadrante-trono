// Resolución exacta con contacto unilateral (conjunto activo iterativo) y perfil ideal.

import { cholesky, ErrorSingular, resolverCholesky } from './lineal';
import { DOF_A, DOF_B, DOF_Z0, evaluar, GRAV, K_PERSONA, sumarMuelle, type Modelo } from './modelo';

export interface Solucion {
  u: Float64Array;
  /** Posición del varal en cada puesto (m). */
  w: Float64Array;
  /** Fuerza de cada HdT (N, ≥ 0). */
  F: Float64Array;
  activos: Uint8Array;
  iteraciones: number;
  z0: number;
  cabeceo: number; // a (rad, + = delante arriba)
  alabeo: number; // b (rad, + = izquierda arriba)
}

export interface OpcionesContacto {
  /** Pendiente del terreno (tanto por uno, + = subiendo, la parte delantera más alta). */
  pendiente?: number;
  /** Si es true, se añade el momento W·pendiente·h_cdg. */
  conCdg?: boolean;
  /** x de cada puesto (necesario si hay pendiente). */
  xs?: ArrayLike<number>;
  maxIter?: number;
}

export class ErrorApoyo extends Error {}

/**
 * Resuelve el equilibrio con las alturas de hombro `h` (m, una por puesto).
 * F = k·(h − w) si es positivo, 0 si el varal no llega al hombro.
 */
export function resolverContacto(m: Modelo, h: ArrayLike<number>, op: OpcionesContacto = {}): Solucion {
  const n = m.ndof, N = m.T.length;
  const s = op.pendiente ?? 0;
  const hh = new Float64Array(N);
  for (let i = 0; i < N; i++) hh[i] = h[i] + (s !== 0 ? s * op.xs![i] : 0);
  const fExt = Float64Array.from(m.f0);
  if (s !== 0 && op.conCdg) fExt[DOF_A] += s * m.momentoCdg;

  let activos = new Uint8Array(N).fill(1);
  let u = new Float64Array(n);
  const w = new Float64Array(N);
  const maxIter = op.maxIter ?? 100;
  let it = 0;
  for (; it < maxIter; it++) {
    const K = Float64Array.from(m.K0);
    const f = Float64Array.from(fExt);
    for (let i = 0; i < N; i++) {
      if (!activos[i]) continue;
      sumarMuelle(K, n, m.T[i], K_PERSONA);
      const t = m.T[i];
      for (let a = 0; a < t.dofs.length; a++) f[t.dofs[a]] += K_PERSONA * hh[i] * t.coefs[a];
    }
    try {
      u = resolverCholesky(cholesky(K, n), n, f);
    } catch (e) {
      if (e instanceof ErrorSingular) throw new ErrorApoyo('El trono no queda apoyado: hay demasiados hombres de trono sin llegar al varal.');
      throw e;
    }
    const nuevos = new Uint8Array(N);
    let cambios = 0;
    for (let i = 0; i < N; i++) {
      w[i] = evaluar(m.T[i], u);
      nuevos[i] = hh[i] - w[i] > 0 ? 1 : 0;
      if (nuevos[i] !== activos[i]) cambios++;
    }
    activos = nuevos;
    if (cambios === 0) break;
  }
  const F = new Float64Array(N);
  for (let i = 0; i < N; i++) F[i] = activos[i] ? K_PERSONA * (hh[i] - w[i]) : 0;
  return { u, w, F, activos, iteraciones: it + 1, z0: u[DOF_Z0], cabeceo: u[DOF_A], alabeo: u[DOF_B] };
}

/**
 * Paso 1 del método: con la mesa fija y todos cargando lo ideal, flecha de los voladizos
 * en cada puesto (0 en la mesa). Devuelve también la flecha de cada punta.
 */
export function perfilIdeal(m: Modelo, cargaIdealN: number): { w: Float64Array; puntas: Float64Array } {
  const n = m.ndof, N = m.T.length;
  const r = n - 3; // GDL libres: todos menos z0, a, b
  const K = new Float64Array(r * r);
  for (let i = 0; i < r; i++) for (let j = 0; j < r; j++) K[i * r + j] = m.K0[(i + 3) * n + (j + 3)];
  const f = new Float64Array(r);
  for (let i = 0; i < r; i++) f[i] = m.f0[i + 3];
  for (const t of m.T) {
    for (let a = 0; a < t.dofs.length; a++) if (t.dofs[a] >= 3) f[t.dofs[a] - 3] += cargaIdealN * t.coefs[a];
  }
  const ur = resolverCholesky(cholesky(K, r), r, f);
  const u = new Float64Array(n);
  u.set(ur, 3);
  const w = new Float64Array(N);
  for (let i = 0; i < N; i++) w[i] = evaluar(m.T[i], u);
  return { w, puntas: Float64Array.from(m.puntas, (p) => u[p.dofW]) };
}

/** Flecha de cada punta respecto a la prolongación rígida de la mesa (m, + hacia arriba). */
export function flechasPuntas(m: Modelo, sol: Solucion): Float64Array {
  return Float64Array.from(m.puntas, (p) => sol.u[p.dofW] - (sol.z0 + sol.cabeceo * p.x + sol.alabeo * p.y));
}

export const aKg = (N: number) => N / GRAV;
