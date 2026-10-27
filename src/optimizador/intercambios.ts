// Pasos 4 y 6: refinar con intercambios entre personas de altura parecida.
// Movimientos (todos respetan las parejas espejo):
//  - intercambio de parejas completas entre dos unidades espejo (4 puestos),
//  - intercambio de dos personas sueltas, si la pareja resultante sigue igualada,
//  - sustituir a alguien por un reserva de altura parecida.
// Cada movimiento actualiza las fuerzas en O(N) con la matriz G.

import { K_PERSONA } from '../fem/modelo';
import type { Trono } from '../geometria/tipos';
import { costeCabeceo, costeCargas, costeConfianza, type Evaluador } from './coste';
import { alabeoLineal, cabeceoLineal, fuerzasLineales, type Lineal } from './linealizado';

export interface OpcionesRefino {
  iteraciones: number;
  tolParejaM: number;
  semilla: number;
  /** Puestos que el capataz ya ha colocado: el optimizador no los toca. */
  fijo?: Uint8Array;
  progreso?: (fraccion: number) => void;
}

export interface Refinado {
  asig: Int32Array;
  reservas: number[];
  coste: number;
}

export function refinar(
  t: Trono, lin: Lineal, ev: Evaluador, alturasM: Float64Array,
  asigInicial: Int32Array, reservasIniciales: number[], op: OpcionesRefino,
): Refinado {
  const N = lin.N, G = lin.G, k = K_PERSONA, k2 = k * k;
  const espejo = Int32Array.from(t.puestos, (p) => p.espejo);
  const asig = Int32Array.from(asigInicial);
  const nPersonas = alturasM.length;
  const pos = new Int32Array(nPersonas).fill(-2);
  for (let i = 0; i < N; i++) pos[asig[i]] = i;
  for (const r of reservasIniciales) pos[r] = -1;
  const pool = [...asig, ...reservasIniciales].sort((a, b) => alturasM[a] - alturasM[b]);
  const rango = new Int32Array(nPersonas);
  pool.forEach((p, r) => (rango[p] = r));

  const s = Float64Array.from(asig, (p) => alturasM[p]);
  let F = fuerzasLineales(lin, s);
  let Ft = new Float64Array(N);
  let a = cabeceoLineal(lin, s);
  let b = alabeoLineal(lin, s);
  let cC = costeCargas(ev, F);
  let cConf = costeConfianza(ev, asig, reservasIniciales);
  let total = cC + cConf + costeCabeceo(ev, a, b);

  let mejor = total;
  const mejorAsig = Int32Array.from(asig);
  const mejorPos = Int32Array.from(pos);

  let semilla = op.semilla >>> 0;
  const rnd = () => {
    semilla = (semilla + 0x6d2b79f5) >>> 0;
    let x = semilla;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };

  const T0 = (total / N) * 0.02;
  const cs = new Int32Array(4); // puestos que cambian
  const cp = new Int32Array(4); // persona nueva en cada uno
  const dh = new Float64Array(4);
  const tol = op.tolParejaM;
  const informe = Math.max(1, Math.floor(op.iteraciones / 50));

  for (let it = 0; it < op.iteraciones; it++) {
    if (op.progreso && it % informe === 0) op.progreso(it / op.iteraciones);
    const i = Math.floor(rnd() * N);
    if (op.fijo?.[i]) continue;
    const p = asig[i];
    let nc = 0;
    let q = -1;
    if (espejo[i] !== i && rnd() < 0.03) {
      // Cambiar de lado la pareja
      const j = espejo[i];
      if (op.fijo?.[j]) continue;
      q = asig[j];
      cs[0] = i; cp[0] = q; cs[1] = j; cp[1] = p; nc = 2;
    } else {
      const W = rnd() < 0.85 ? 6 : 25;
      const d = 1 + Math.floor(rnd() * W);
      let rq = rango[p] + (rnd() < 0.5 ? -d : d);
      if (rq < 0 || rq >= pool.length) continue;
      q = pool[rq];
      const j = pos[q];
      if (j >= 0 && op.fijo?.[j]) continue;
      if (j < 0) {
        cs[0] = i; cp[0] = q; nc = 1;
      } else if (rnd() < 0.5 && espejo[i] !== i && espejo[j] !== j && j !== espejo[i] && !op.fijo?.[espejo[i]] && !op.fijo?.[espejo[j]]) {
        const mi = espejo[i], mj = espejo[j];
        cs[0] = i; cp[0] = q; cs[1] = j; cp[1] = p;
        cs[2] = mi; cp[2] = asig[mj]; cs[3] = mj; cp[3] = asig[mi]; nc = 4;
      } else {
        cs[0] = i; cp[0] = q; cs[1] = j; cp[1] = p; nc = 2;
      }
    }

    // Altura nueva de un puesto tras el movimiento
    const hNueva = (slot: number) => {
      for (let c = 0; c < nc; c++) if (cs[c] === slot) return alturasM[cp[c]];
      return s[slot];
    };
    let valido = true;
    for (let c = 0; c < nc && valido; c++) {
      const sl = cs[c], m = espejo[sl];
      if (m === sl) continue;
      const antes = Math.abs(s[sl] - s[m]);
      if (Math.abs(hNueva(sl) - hNueva(m)) > Math.max(tol, antes) + 1e-9) valido = false;
    }
    if (!valido) continue;

    let da = 0, db = 0, dConf = 0;
    for (let c = 0; c < nc; c++) {
      dh[c] = alturasM[cp[c]] - s[cs[c]];
      da += lin.ga[cs[c]] * dh[c];
      db += lin.gb[cs[c]] * dh[c];
      if (ev.clave[cs[c]]) dConf += ev.penalClave[cp[c]] - ev.penalClave[asig[cs[c]]];
    }
    if (nc === 1) dConf += ev.penalReserva[p] - ev.penalReserva[q];
    // ΔF = k·Δs − k²·G·Δs
    for (let m = 0; m < N; m++) {
      let g = 0;
      const r = m * N;
      for (let c = 0; c < nc; c++) g += G[r + cs[c]] * dh[c];
      Ft[m] = F[m] - k2 * g;
    }
    for (let c = 0; c < nc; c++) Ft[cs[c]] += k * dh[c];

    const cCn = costeCargas(ev, Ft);
    const an = a + da, bn = b + db;
    const totalN = cCn + cConf + dConf + costeCabeceo(ev, an, bn);
    const delta = totalN - total;
    const temp = T0 * (1 - it / op.iteraciones) ** 2;
    if (delta < 0 || (temp > 0 && rnd() < Math.exp(-delta / temp))) {
      for (let c = 0; c < nc; c++) {
        s[cs[c]] = alturasM[cp[c]];
        asig[cs[c]] = cp[c];
        pos[cp[c]] = cs[c];
      }
      if (nc === 1) pos[p] = -1;
      const tmp = F; F = Ft; Ft = tmp;
      a = an; b = bn; cC = cCn; cConf += dConf; total = totalN;
      if (total < mejor - 1e-12) {
        mejor = total;
        mejorAsig.set(asig);
        mejorPos.set(pos);
      }
    }
  }
  const reservas: number[] = [];
  for (let p = 0; p < nPersonas; p++) if (mejorPos[p] === -1) reservas.push(p);
  // Coste recalculado desde cero (evita la deriva numérica de las actualizaciones)
  const sf = Float64Array.from(mejorAsig, (p) => alturasM[p]);
  const Ff = fuerzasLineales(lin, sf);
  const coste = costeCargas(ev, Ff) + costeConfianza(ev, mejorAsig, reservas) + costeCabeceo(ev, cabeceoLineal(lin, sf), alabeoLineal(lin, sf));
  op.progreso?.(1);
  return { asig: mejorAsig, reservas, coste };
}
