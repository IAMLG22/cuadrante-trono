// ¿Son óptimos los varales? Se alargan o acortan a la vez los voladizos de delante y de detrás (la
// misma cantidad, para no descompensar el trono), se monta el trono, se coloca una cuadrilla con
// las mismas alturas que la tuya como pide la física y se calcula con el modelo exacto cuánto
// carga cada uno. Alargar baja la carga «ideal» (hay más gente), pero si las filas nuevas no
// llegan a cargar, los que más llevan siguen llevando lo mismo.

import { aKg, perfilIdeal } from '../fem/contacto';
import { precalcularRapido, resolverRapido } from '../fem/rapido';
import { construirModelo } from '../fem/modelo';
import type { ConfigTrono, HdT } from '../geometria/tipos';
import { construirTrono, separacionFilas, validarConfig } from '../geometria/trono';

export type Lado = 'delante' | 'detras';

export interface PuntoLongitud {
  /** Largo del voladizo de delante (el de detrás cambia lo mismo). */
  largo: number;
  largoDetras: number;
  filas: number;
  filasDetras: number;
  puestos: number;
  pesoKg: number;
  /** Peso entre el número de puestos. */
  idealKg: number;
  maxKg: number;
  /** Media del 10 % que más carga. */
  altosKg: number;
  /** Media de las filas de las puntas (delante y detrás). */
  puntaKg: number;
  /** Personas que llevan menos de la mitad de lo ideal. */
  acompanan: number;
}

export type Veredicto = 'corto' | 'optimo' | 'largo';

export interface EstudioVarales {
  actual: number;
  actualDetras: number;
  /** Punto calculado con el largo actual. */
  puntoActual: PuntoLongitud;
  puntos: PuntoLongitud[];
  /** Largo más corto con el que los que más cargan llevan lo mínimo (con margen de TOLERANCIA_KG). */
  recomendado: PuntoLongitud;
  /** Kilos de más que llevan los que más cargan con el largo actual frente al recomendado. */
  sobranKg: number;
  veredicto: Veredicto;
}

/** Por debajo de esta fracción de lo ideal, la fila de la punta «acompaña» más que carga. */
export const FRACCION_PUNTA = 0.5;
const PASO = 0.25;
/** Diferencias menores que esta (kg) en lo que llevan los que más cargan no se tienen en cuenta. */
export const TOLERANCIA_KG = 1;

function cuantil(ordenado: number[], p: number): number {
  const x = (ordenado.length - 1) * p;
  const i = Math.floor(x), f = x - i;
  return ordenado[i] + (ordenado[Math.min(i + 1, ordenado.length - 1)] - ordenado[i]) * f;
}
const medianaDe = (v: number[]) => cuantil([...v].sort((a, b) => a - b), 0.5);

/** Alturas de hombro (m) con las que se puede contar: del 5 % más bajo al 5 % más alto. */
export function rangoCuadrilla(cuadrilla: HdT[]): { min: number; mediana: number; max: number } {
  const o = cuadrilla.map((h) => h.hombro / 100).sort((a, b) => a - b);
  return { min: cuantil(o, 0.05), mediana: cuantil(o, 0.5), max: cuantil(o, 0.95) };
}

/** Configuración con otro largo en un lado, manteniendo la separación entre filas. */
export function conLargo(c: ConfigTrono, lado: Lado, largo: number): ConfigTrono {
  const d: ConfigTrono = JSON.parse(JSON.stringify(c));
  const actual = lado === 'delante' ? c.varales.largoDelante : c.varales.largoDetras;
  const filas = lado === 'delante' ? c.puestos.filasDelante : c.puestos.filasDetras;
  const sep = filas > 0 ? separacionFilas(actual, filas) : 0.45;
  const nuevas = Math.max(1, Math.round(largo / sep));
  if (lado === 'delante') { d.varales.largoDelante = largo; d.puestos.filasDelante = nuevas; }
  else { d.varales.largoDetras = largo; d.puestos.filasDetras = nuevas; }
  return d;
}

/** Alarga (o acorta, si es negativo) los dos voladizos la misma cantidad. */
export function conAlargue(c: ConfigTrono, delta: number): ConfigTrono {
  return conLargo(conLargo(c, 'delante', c.varales.largoDelante + delta), 'detras', c.varales.largoDetras + delta);
}

/** Cargas con la cuadrilla colocada a la altura que pide cada puesto (dentro de las que hay). */
export function evaluarLargo(c: ConfigTrono, cuadrilla: HdT[]): PuntoLongitud {
  const t = construirTrono(c);
  const m = construirModelo(t);
  const N = t.puestos.length;
  const Fid = m.pesoTotalN / N;
  // Hombro que pide cada puesto (salvo una constante): cada uno recibe justo lo que pide, pero sin
  // salirse de las alturas que de verdad hay (del 5 % más bajo al 5 % más alto). La constante se
  // elige como haría un buen capataz: la que deja más bajo al 10 % que más carga.
  const w = perfilIdeal(m, Fid).w;
  const { min, mediana, max } = rangoCuadrilla(cuadrilla);
  const base = mediana - medianaDe(Array.from(w));
  const rapido = precalcularRapido(m);
  const nAltos = Math.max(1, Math.round(N / 10));
  let kg: number[] = [];
  let mejor = Infinity;
  for (let d = -0.08; d <= 0.08 + 1e-9; d += 0.01) {
    const h = Float64Array.from(w, (x) => Math.min(max, Math.max(min, x + base + d)));
    const prueba = Array.from(resolverRapido(rapido, h).F, aKg);
    const altos = [...prueba].sort((a, b) => b - a).slice(0, nAltos).reduce((a, b) => a + b, 0);
    if (altos < mejor - 1e-9) { mejor = altos; kg = prueba; }
  }
  const idealKg = aKg(Fid);
  const desc = [...kg].sort((a, b) => b - a);
  const punta = t.puestos.filter((p) => (p.zona === 'delante' && p.numero === 1) || (p.zona === 'detras' && p.numero === t.numeroMax));
  return {
    largo: c.varales.largoDelante,
    largoDetras: c.varales.largoDetras,
    filas: c.puestos.filasDelante,
    filasDetras: c.puestos.filasDetras,
    puestos: N,
    pesoKg: t.pesos.total,
    idealKg,
    maxKg: desc[0],
    altosKg: desc.slice(0, nAltos).reduce((a, b) => a + b, 0) / nAltos,
    puntaKg: punta.length ? punta.reduce((s, p) => s + kg[p.idx], 0) / punta.length : 0,
    acompanan: t.puestos.filter((p) => kg[p.idx] < FRACCION_PUNTA * idealKg).length,
  };
}

/** Alargues a estudiar (m): del voladizo más corto en 1,5 m hasta 2 m más (al menos 6 m), cada 25 cm. */
export function alarguesAEstudiar(c: ConfigTrono): number[] {
  const corto = Math.min(c.varales.largoDelante, c.varales.largoDetras);
  const largo = Math.max(c.varales.largoDelante, c.varales.largoDetras);
  const desde = Math.ceil((1.5 - corto) / PASO - 1e-9) * PASO;
  const hasta = Math.max(6 - largo, 2);
  const r: number[] = [];
  for (let d = desde; d <= hasta + 1e-9; d += PASO) r.push(Math.round(d * 100) / 100);
  if (!r.some((d) => Math.abs(d) < 1e-9)) r.push(0);
  return r.sort((a, b) => a - b);
}

export function estudiarVarales(c: ConfigTrono, cuadrilla: HdT[], progreso: (f: number) => void = () => {}): EstudioVarales {
  const deltas = alarguesAEstudiar(c);
  const puntos: PuntoLongitud[] = [];
  let puntoActual: PuntoLongitud | null = null;
  deltas.forEach((d, k) => {
    const cfg = Math.abs(d) < 1e-9 ? c : conAlargue(c, d);
    if (validarConfig(cfg).length === 0) {
      try {
        const pt = evaluarLargo(cfg, cuadrilla);
        puntos.push(pt);
        if (cfg === c) puntoActual = pt;
      } catch { /* sin apoyo: se omite */ }
    }
    progreso((k + 1) / deltas.length);
  });
  const actualPt: PuntoLongitud = puntoActual ?? evaluarLargo(c, cuadrilla);
  const minimo = Math.min(...puntos.map((p) => p.altosKg));
  const recomendado = puntos.find((p) => p.altosKg <= minimo + TOLERANCIA_KG) ?? actualPt;
  const sobranKg = Math.max(0, actualPt.altosKg - minimo);
  const actual = c.varales.largoDelante;
  const veredicto: Veredicto =
    sobranKg <= TOLERANCIA_KG ? 'optimo' : actual > recomendado.largo ? 'largo' : 'corto';
  return { actual, actualDetras: c.varales.largoDetras, puntoActual: actualPt, puntos, recomendado, sobranKg, veredicto };
}
