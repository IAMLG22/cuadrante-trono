// Función objetivo, en kg² para que todos los términos sean comparables.
//  - Reparto: Σ (carga − ideal)², el doble si la carga queda por debajo de lo ideal y
//    un recargo fuerte si el HdT no llega al varal (fuerza lineal negativa).
//  - Filas: varianza de las cargas dentro de cada fila transversal (las 8 de una fila).
//  - Confianza: penalización por HdT de confianza 2 o 1 en puestos clave.
//  - Inclinación: penalización si el cabeceo supera el máximo.
//  - Alabeo: término cuadrático que lo empuja a cero (simetría izquierda-derecha).

import { GRAV } from '../fem/modelo';
import type { ConfigOptimizador, HdT, Trono } from '../geometria/tipos';

export const PESO_DEFECTO = 2; // multiplicador si la carga queda por debajo de la ideal
export const PESO_NO_CARGA = 10; // recargo si el HdT no llega al varal
export const PESO_FILAS = 0.5;
/** A prioridad máxima, un confianza 2 en un puesto clave «cuesta» lo mismo que una desviación de 1,5 × la carga ideal. */
export const ESCALA_CONFIANZA = 1.5;

export interface Evaluador {
  N: number;
  FidN: number;
  filas: Int32Array[];
  /** Penalización (kg²) de cada HdT (por índice en la cuadrilla) en un puesto clave. */
  penalClave: Float64Array;
  /** Penalización (kg²) de cada HdT si queda de reserva (desempate). */
  penalReserva: Float64Array;
  clave: Uint8Array;
  aMax: number;
  permitirPicado: boolean;
}

export function crearEvaluador(t: Trono, cuadrilla: HdT[], op: ConfigOptimizador, FidN: number): Evaluador {
  const N = t.puestos.length;
  const porFila = new Map<number, number[]>();
  for (const p of t.puestos) {
    if (p.fila < 0) continue;
    if (!porFila.has(p.fila)) porFila.set(p.fila, []);
    porFila.get(p.fila)!.push(p.idx);
  }
  const P = op.prioridadConfianza * ESCALA_CONFIANZA * (FidN / GRAV);
  const P2 = P * P;
  const c = op.confianza;
  const penalClave = Float64Array.from(cuadrilla, (h) => (h.confianza === 3 ? 0 : h.confianza === 2 ? c.penalConf2 : c.penalConf1) * P2);
  const penalReserva = Float64Array.from(cuadrilla, (h) => (h.confianza === 3 ? 0.5 : h.confianza === 2 ? 0.25 : 0));
  return {
    N, FidN,
    filas: [...porFila.values()].map((f) => Int32Array.from(f)),
    penalClave, penalReserva,
    clave: Uint8Array.from(t.puestos, (p) => (p.clave ? 1 : 0)),
    aMax: Math.tan((op.inclinacionMaxGrados * Math.PI) / 180),
    permitirPicado: op.permitirPicado ?? false,
  };
}

/** Coste del reparto de cargas (incluye filas). F en N. */
export function costeCargas(e: Evaluador, F: ArrayLike<number>): number {
  const inv = 1 / GRAV;
  let c = 0;
  for (let i = 0; i < e.N; i++) {
    const d = (F[i] - e.FidN) * inv;
    c += d < 0 ? PESO_DEFECTO * d * d : d * d;
    if (F[i] < 0) {
      const f = F[i] * inv;
      c += PESO_NO_CARGA * f * f;
    }
  }
  for (const fila of e.filas) {
    let m = 0;
    for (let j = 0; j < fila.length; j++) m += F[fila[j]];
    m /= fila.length;
    let v = 0;
    for (let j = 0; j < fila.length; j++) {
      const d = (F[fila[j]] - m) * inv;
      v += d * d;
    }
    c += PESO_FILAS * v;
  }
  return c;
}

/** kg² por rad² de alabeo: 0,05° de alabeo «cuesta» como una desviación de ~9 kg. */
export const PESO_ALABEO = 1e8;

/** kg² por (fracción de la inclinación máxima)² al pasarse del máximo. */
export const PESO_INCLINACION = 1e5;
/**
 * Ir «picado» (delantera más baja) se trata como una restricción: aunque reparta mejor, solo se
 * acepta si el capataz lo permite. Con este peso, ir picado cuesta más que cualquier mejora del reparto.
 */
export const PESO_PICADO = 1e7;

/** Coste de la inclinación (cabeceo a y alabeo b, en rad; a > 0 = delantera más alta). */
export function costeCabeceo(e: Evaluador, a: number, b = 0): number {
  const escala = Math.max(e.aMax, 1e-4);
  let c = PESO_ALABEO * b * b;
  if (Math.abs(a) > e.aMax) c += PESO_INCLINACION * ((Math.abs(a) - e.aMax) / escala) ** 2;
  if (a < 0 && !e.permitirPicado) c += PESO_PICADO * (a / escala) ** 2;
  return c;
}

/** Término de confianza para una asignación completa (puesto → índice de HdT). */
export function costeConfianza(e: Evaluador, asig: ArrayLike<number>, reservas: ArrayLike<number>): number {
  let c = 0;
  for (let i = 0; i < e.N; i++) if (e.clave[i]) c += e.penalClave[asig[i]];
  for (let j = 0; j < reservas.length; j++) c += e.penalReserva[reservas[j]];
  return c;
}
