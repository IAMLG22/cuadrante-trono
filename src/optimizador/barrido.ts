// Paso 3: barrer la familia de objetivos a·x + c·flecha y asignar por rango
// (los más altos donde el objetivo es mayor), respetando las parejas espejo.

import type { Trono } from '../geometria/tipos';
import { costeCabeceo, costeCargas, costeConfianza, type Evaluador } from './coste';
import { alabeoLineal, cabeceoLineal, fuerzasLineales, type Lineal } from './linealizado';

/** Unidad de simetría: pareja espejo [izquierda, derecha] o puesto único en el eje. */
export type Unidad = [number] | [number, number];

export function unidadesSimetria(t: Trono): Unidad[] {
  const u: Unidad[] = [];
  for (const p of t.puestos) {
    if (p.espejo === p.idx) u.push([p.idx]);
    else if (p.y > 0) u.push([p.idx, p.espejo]);
  }
  return u;
}

/**
 * Asigna por rango: `personas` son índices de la cuadrilla ordenados de más alto a más bajo.
 * En cada pareja espejo se alterna qué lado lleva al más alto para no generar alabeo.
 */
export function asignarPorRango(unidades: Unidad[], objetivo: ArrayLike<number>, personas: number[], N: number): Int32Array {
  const orden = unidades
    .map((u, k) => ({ u, k, o: Math.round(objetivo[u[0]] * 1e7) }))
    .sort((a, b) => b.o - a.o || a.k - b.k);
  const asig = new Int32Array(N);
  let r = 0, alterna = false;
  for (const { u } of orden) {
    if (u.length === 1) asig[u[0]] = personas[r++];
    else {
      const p1 = personas[r++], p2 = personas[r++];
      asig[u[0]] = alterna ? p2 : p1;
      asig[u[1]] = alterna ? p1 : p2;
      alterna = !alterna;
    }
  }
  return asig;
}

export interface Candidata {
  asig: Int32Array;
  coste: number;
}

export function barrer(
  t: Trono, lin: Lineal, ev: Evaluador, unidades: Unidad[], perfil: Float64Array,
  alturasM: Float64Array, personas: number[], reservas: number[], fijo?: Int32Array,
): Candidata {
  const N = t.puestos.length;
  const xs = t.puestos.map((p) => p.x);
  const ordenadas = [...personas].sort((a, b) => alturasM[b] - alturasM[a]);
  const cs = [0.6, 0.8, 0.9, 1, 1.1, 1.2, 1.4];
  const am = Math.max(ev.aMax, 0.002);
  const as = Array.from({ length: 9 }, (_, i) => -am + (2 * am * i) / 8);
  const obj = new Float64Array(N);
  const s = new Float64Array(N);
  const F = new Float64Array(N);
  let mejor: Candidata | null = null;
  for (const c of cs) {
    for (const a of as) {
      for (let i = 0; i < N; i++) obj[i] = c * perfil[i] + a * xs[i];
      const asig = asignarPorRango(unidades, obj, ordenadas, N);
      if (fijo) for (let i = 0; i < N; i++) if (fijo[i] >= 0) asig[i] = fijo[i];
      for (let i = 0; i < N; i++) s[i] = alturasM[asig[i]];
      fuerzasLineales(lin, s, F);
      const coste = costeCargas(ev, F) + costeCabeceo(ev, cabeceoLineal(lin, s), alabeoLineal(lin, s)) + costeConfianza(ev, asig, reservas);
      if (!mejor || coste < mejor.coste) mejor = { asig, coste };
    }
  }
  return mejor!;
}
