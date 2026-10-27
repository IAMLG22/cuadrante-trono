// Paso 2: modelo linealizado con todos en contacto.
// K·u = f0 + k·Tᵀ·s   ⇒   w = T·u = w0 + k·G·s,   G = T·K⁻¹·Tᵀ
// F = k·(s − w) = k·(s − w0 − k·G·s)
// Se precalcula una sola vez; evaluar una asignación cuesta O(N²) y un intercambio O(N).

import { K_PERSONA, type Modelo } from '../fem/modelo';
import { precalcularRapido, type SolverRapido } from '../fem/rapido';

export interface Lineal {
  N: number;
  /** G (N×N, simétrica, fila mayor). */
  G: Float64Array;
  w0: Float64Array;
  /** Cabeceo: a = a0 + Σ ga_i·s_i */
  a0: number;
  ga: Float64Array;
  /** Alabeo: b = b0 + Σ gb_i·s_i */
  b0: number;
  gb: Float64Array;
}

/** El modelo linealizado es parte del solver rápido (misma G). */
export function linealDesdeRapido(r: SolverRapido): Lineal {
  return { N: r.N, G: r.G, w0: r.w0, a0: r.a.base, ga: r.a.g, b0: r.b.base, gb: r.b.g };
}

export function precalcularLineal(m: Modelo): Lineal {
  return linealDesdeRapido(precalcularRapido(m));
}

/** Fuerzas lineales (N) para alturas s (m). */
export function fuerzasLineales(l: Lineal, s: ArrayLike<number>, F = new Float64Array(l.N)): Float64Array {
  const { N, G, w0 } = l, k = K_PERSONA;
  for (let i = 0; i < N; i++) {
    let gs = 0;
    const r = i * N;
    for (let j = 0; j < N; j++) gs += G[r + j] * s[j];
    F[i] = k * (s[i] - w0[i] - k * gs);
  }
  return F;
}

export function cabeceoLineal(l: Lineal, s: ArrayLike<number>): number {
  let a = l.a0;
  for (let i = 0; i < l.N; i++) a += l.ga[i] * s[i];
  return a;
}

export function alabeoLineal(l: Lineal, s: ArrayLike<number>): number {
  let b = l.b0;
  for (let i = 0; i < l.N; i++) b += l.gb[i] * s[i];
  return b;
}
