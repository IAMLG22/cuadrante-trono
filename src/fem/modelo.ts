// Modelo estructural estático del trono.
// - Mesa: sólido rígido con 3 GDL (z0, cabeceo a, alabeo b): w = z0 + a·x + b·y.
// - Varales fuera de la mesa: vigas de Euler-Bernoulli en voladizo empotradas en la mesa,
//   con nodo en cada fila, en el quitacimbre y en la punta. GDL por nodo: (w, θ = dw/dx).
// - Quitacimbres: vigas transversales (eje y) que unen los nodos de todos los varales,
//   con un giro propio φ = dw/dy en cada unión.
// - Cada HdT es un muelle unilateral de rigidez K_PERSONA entre su hombro y el varal.

import type { Trono } from '../geometria/tipos';
import { cdgManto, EXPONENTE_MANTO, longitudManto } from '../geometria/trono';

export const K_PERSONA = 20_000; // N/m (fija, no se muestra en la interfaz)
export const GRAV = 9.81;

export const DOF_Z0 = 0;
export const DOF_A = 1;
export const DOF_B = 2;

/** Combinación lineal de GDL globales: w = Σ coef·u[dof]. */
export interface Combinacion {
  dofs: number[];
  coefs: number[];
}

export interface Punta {
  varal: number;
  lado: 'delante' | 'detras';
  x: number;
  y: number;
  dofW: number;
}

export interface Modelo {
  ndof: number;
  /** Rigidez de la estructura sin personas (ndof×ndof, fila mayor). */
  K0: Float64Array;
  /** Cargas exteriores (N, + hacia arriba): pesos propios y mesa. */
  f0: Float64Array;
  /** Para cada puesto, cómo se obtiene el desplazamiento del varal en su posición. */
  T: Combinacion[];
  puntas: Punta[];
  pesoTotalN: number;
  /** W·h_cdg (N·m): momento de vuelco por unidad de pendiente. */
  momentoCdg: number;
}

const rigida = (x: number, y: number): Combinacion => ({ dofs: [DOF_Z0, DOF_A, DOF_B], coefs: [1, x, y] });
const libre = (d: number): Combinacion => ({ dofs: [d], coefs: [1] });

/** Suma una viga de 2 nodos (GDL locales w1, θ1, w2, θ2) con carga repartida q (N/m, + arriba). */
/** Nodos y pesos de Gauss-Legendre de 4 puntos en [0, 1] (exacto hasta grado 7). */
const GAUSS4: [number, number][] = [
  [0.5 - 0.4305681557970263, 0.17392742256872692], [0.5 - 0.1699905217924281, 0.32607257743127307],
  [0.5 + 0.1699905217924281, 0.32607257743127307], [0.5 + 0.4305681557970263, 0.17392742256872692],
];

/**
 * Cargas nodales consistentes (w1, θ1, w2, θ2) de una carga repartida q(ξ) (N/m, + arriba) que
 * actúa solo entre ξa y ξb de un elemento de longitud l (ξ ∈ [0, 1] desde el nodo 1).
 */
function cargaConsistente(l: number, xa: number, xb: number, q: (xi: number) => number): number[] {
  const f = [0, 0, 0, 0];
  const h = xb - xa;
  for (const [t, peso] of GAUSS4) {
    const xi = xa + t * h;
    const N = [1 - 3 * xi ** 2 + 2 * xi ** 3, l * (xi - 2 * xi ** 2 + xi ** 3), 3 * xi ** 2 - 2 * xi ** 3, l * (-(xi ** 2) + xi ** 3)];
    const qq = q(xi) * l * h * peso;
    for (let i = 0; i < 4; i++) f[i] += N[i] * qq;
  }
  return f;
}

function sumarViga(K: Float64Array, f: Float64Array, n: number, loc: Combinacion[], EI: number, l: number, q: number) {
  const c = EI / l ** 3;
  const ke = [
    [12, 6 * l, -12, 6 * l],
    [6 * l, 4 * l * l, -6 * l, 2 * l * l],
    [-12, -6 * l, 12, -6 * l],
    [6 * l, 2 * l * l, -6 * l, 4 * l * l],
  ];
  const fe = [(q * l) / 2, (q * l * l) / 12, (q * l) / 2, (-q * l * l) / 12];
  for (let i = 0; i < 4; i++) {
    const ci = loc[i];
    for (let a = 0; a < ci.dofs.length; a++) {
      const gi = ci.dofs[a], wi = ci.coefs[a];
      f[gi] += wi * fe[i];
      for (let j = 0; j < 4; j++) {
        const cj = loc[j];
        for (let b = 0; b < cj.dofs.length; b++) {
          K[gi * n + cj.dofs[b]] += wi * cj.coefs[b] * c * ke[i][j];
        }
      }
    }
  }
}

export function construirModelo(t: Trono): Modelo {
  const c = t.config;
  const L = c.mesa.largo;
  const n = t.nVarales;
  const EI = t.seccion.EI;
  const qVaral = -t.seccion.kgPorMetro * GRAV;

  // 1) Nodos de cada voladizo. Clave: distancia desde el borde de la mesa redondeada a mm.
  type Lado = { lado: 'delante' | 'detras'; signo: number; largo: number; dFilas: number[]; dQuita: number | null };
  const lados: Lado[] = [
    { lado: 'delante', signo: 1, largo: c.varales.largoDelante, dFilas: t.dFilasDelante, dQuita: c.quitacimbres.activo ? c.varales.largoDelante - c.quitacimbres.distDelante : null },
    { lado: 'detras', signo: -1, largo: c.varales.largoDetras, dFilas: t.dFilasDetras, dQuita: c.quitacimbres.activo ? c.varales.largoDetras - c.quitacimbres.distDetras : null },
  ];
  const redondear = (d: number) => Math.round(d * 1000);
  const distanciasLado = lados.map((ld) => {
    const set = new Map<number, number>();
    for (const d of [...ld.dFilas, ...(ld.dQuita !== null ? [ld.dQuita] : []), ld.largo]) {
      if (d > 1e-6) set.set(redondear(d), d);
    }
    return [...set.values()].sort((a, b) => a - b);
  });

  let ndof = 3;
  // nodoDof[lado][varal] : Map distancia(mm) -> índice del GDL w (θ = w+1)
  const nodoDof: Map<number, number>[][] = lados.map(() => Array.from({ length: n }, () => new Map()));
  for (let s = 0; s < 2; s++) {
    for (let v = 0; v < n; v++) {
      for (const d of distanciasLado[s]) {
        nodoDof[s][v].set(redondear(d), ndof);
        ndof += 2;
      }
    }
  }
  // Giros propios de los quitacimbres
  const phiDof: number[][] = [[], []];
  if (t.seccionQuitacimbre) {
    for (let s = 0; s < 2; s++) for (let v = 0; v < n; v++) phiDof[s].push(ndof++);
  }

  const K0 = new Float64Array(ndof * ndof);
  const f0 = new Float64Array(ndof);

  // 2) Vigas de los voladizos
  for (let s = 0; s < 2; s++) {
    const ld = lados[s];
    const xBorde = (ld.signo * L) / 2;
    for (let v = 0; v < n; v++) {
      const y = t.yVarales[v];
      let prevW = rigida(xBorde, y);
      let prevT: Combinacion = { dofs: [DOF_A], coefs: [1] };
      let prevD = 0;
      for (const d of distanciasLado[s]) {
        const dw = nodoDof[s][v].get(redondear(d))!;
        const w = libre(dw), th = libre(dw + 1);
        const l = d - prevD;
        // Ordenar los nodos por x creciente (en el lado de detrás el nodo nuevo queda a menor x)
        const loc = ld.signo > 0 ? [prevW, prevT, w, th] : [w, th, prevW, prevT];
        sumarViga(K0, f0, ndof, loc, EI, l, qVaral);
        prevW = w; prevT = th; prevD = d;
      }
    }
  }

  // 3) Quitacimbres
  if (t.seccionQuitacimbre) {
    const q = t.seccionQuitacimbre;
    const EIq = q.EI;
    const qq = -q.kgPorMetro * GRAV;
    for (let s = 0; s < 2; s++) {
      const dq = lados[s].dQuita!;
      // y creciente = de H (v = n-1) hacia A (v = 0)
      for (let v = n - 1; v > 0; v--) {
        const l = t.yVarales[v - 1] - t.yVarales[v];
        const w1 = libre(nodoDof[s][v].get(redondear(dq))!);
        const w2 = libre(nodoDof[s][v - 1].get(redondear(dq))!);
        sumarViga(K0, f0, ndof, [w1, libre(phiDof[s][v]), w2, libre(phiDof[s][v - 1])], EIq, l, qq);
      }
    }
  }

  // 3b) Cabezas de varal: su peso cuelga de la punta, con el centro a media cabeza más allá.
  // Equivale a una fuerza en la punta más un momento P·l/2.
  for (let s = 0; s < 2; s++) {
    const ld = lados[s];
    const cab = s === 0 ? c.varales.cabezas.delante : c.varales.cabezas.detras;
    if (!(cab.peso > 0)) continue;
    const P = cab.peso * GRAV;
    const xPunta = ld.signo * (L / 2 + ld.largo);
    for (let v = 0; v < n; v++) {
      const dw = nodoDof[s][v].get(redondear(ld.largo));
      const w = dw !== undefined ? libre(dw) : rigida(xPunta, t.yVarales[v]);
      const th: Combinacion = dw !== undefined ? libre(dw + 1) : { dofs: [DOF_A], coefs: [1] };
      for (let a = 0; a < w.dofs.length; a++) f0[w.dofs[a]] -= P * w.coefs[a];
      const mom = -ld.signo * P * (cab.longitud / 2);
      for (let a = 0; a < th.dofs.length; a++) f0[th.dofs[a]] += mom * th.coefs[a];
    }
  }

  // 3c) Manto: densidad g(s) = W·(p+1)/Lm·(s/Lm)^p, con s la distancia hacia atrás desde la
  // cabeza de la Virgen (x = −s). Sobre la mesa actúa como carga rígida; fuera de ella se
  // reparte por igual entre los varales traseros con cargas consistentes (integración de Gauss).
  if (c.manto.activo && c.manto.peso > 0 && longitudManto(c) > 0 && c.manto.apoyo === 'mesa') {
    // La estructura cuelga de la mesa: su peso entero, aplicado en su centro de gravedad (x = −s̄)
    const W = c.manto.peso * GRAV;
    f0[DOF_Z0] -= W;
    f0[DOF_A] += W * cdgManto(c);
  } else if (c.manto.activo && c.manto.peso > 0 && longitudManto(c) > 0) {
    const W = c.manto.peso * GRAV;
    const Lm = longitudManto(c);
    const pe = EXPONENTE_MANTO[c.manto.reparto];
    const g = (s: number) => (s < 0 || s > Lm ? 0 : (W * (pe + 1)) / Lm * (s / Lm) ** pe);
    // Parte sobre la mesa (s de 0 a L/2): fuerza y momento sobre el sólido rígido
    const sMesa = Math.min(Lm, L / 2);
    const Fm = W * (sMesa / Lm) ** (pe + 1);
    const Mm = W * (pe + 1) / (pe + 2) * Lm * (sMesa / Lm) ** (pe + 2); // ∫ g·s ds
    f0[DOF_Z0] -= Fm;
    f0[DOF_A] += Mm; // carga hacia abajo en x = −s ⇒ −P·x = +P·s
    // Parte sobre los voladizos traseros
    if (Lm > L / 2) {
      for (let v = 0; v < n; v++) {
        let prevW = rigida(-L / 2, t.yVarales[v]);
        let prevT: Combinacion = { dofs: [DOF_A], coefs: [1] };
        let prevD = 0;
        for (const d of distanciasLado[1]) {
          const dw = nodoDof[1][v].get(redondear(d))!;
          const w = libre(dw), th = libre(dw + 1);
          const l = d - prevD;
          // ξ desde el nodo de menor x (el más alejado de la mesa): s(ξ) = L/2 + d − ξ·l
          const sDe = (xi: number) => L / 2 + d - xi * l;
          const xiIni = Math.max(0, (L / 2 + d - Lm) / l);
          if (xiIni < 1) {
            const fe = cargaConsistente(l, xiIni, 1, (xi) => -g(sDe(xi)) / n);
            const loc = [w, th, prevW, prevT];
            for (let i = 0; i < 4; i++) {
              for (let a = 0; a < loc[i].dofs.length; a++) f0[loc[i].dofs[a]] += fe[i] * loc[i].coefs[a];
            }
          }
          prevW = w; prevT = th; prevD = d;
        }
      }
    }
  }

  // 4) Mesa, palio y tramos de varal bajo la mesa: en el centro de la mesa
  const p = t.pesos;
  f0[DOF_Z0] -= (p.mesa + p.palio + p.varalesBajoMesa) * GRAV;

  // 5) Transformación puesto -> desplazamiento del varal
  const T: Combinacion[] = t.puestos.map((q) => {
    if (q.zona === 'delante' || q.zona === 'detras') {
      const s = q.zona === 'delante' ? 0 : 1;
      const d = Math.abs(q.x) - L / 2;
      return libre(nodoDof[s][q.varal].get(redondear(d))!);
    }
    return rigida(q.x, q.y);
  });

  const puntas: Punta[] = [];
  for (let s = 0; s < 2; s++) {
    const ld = lados[s];
    for (let v = 0; v < n; v++) {
      puntas.push({
        varal: v, lado: ld.lado, x: ld.signo * (L / 2 + ld.largo), y: t.yVarales[v],
        dofW: nodoDof[s][v].get(redondear(ld.largo))!,
      });
    }
  }

  const momentoCdg = p.total * GRAV * p.alturaCdg;
  return { ndof, K0, f0, T, puntas, pesoTotalN: p.total * GRAV, momentoCdg };
}

/** Desplazamiento del varal en un puesto. */
export function evaluar(c: Combinacion, u: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < c.dofs.length; i++) s += c.coefs[i] * u[c.dofs[i]];
  return s;
}

/** Suma k·t·tᵀ a K (n×n) para el puesto con combinación t. */
export function sumarMuelle(K: Float64Array, n: number, c: Combinacion, k: number) {
  for (let i = 0; i < c.dofs.length; i++) {
    for (let j = 0; j < c.dofs.length; j++) {
      K[c.dofs[i] * n + c.dofs[j]] += k * c.coefs[i] * c.coefs[j];
    }
  }
}
