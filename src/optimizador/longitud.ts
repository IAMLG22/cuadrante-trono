// ¿Son óptimos los varales? Se alargan o acortan a la vez los voladizos de delante y de detrás (la
// misma cantidad, para no descompensar el trono) y, para cada largo, se colocan muchas cuadrillas
// simuladas a partir de la cuadrilla tipo del trono: la gente cambia de un año a otro, y el largo
// de los varales tiene que servir para un año normal, uno de gente alta y uno de gente baja.
// En cada cuadrilla, cada puesto recibe a la persona cuya altura más se acerca a la que pide, y se
// calcula con el modelo exacto cuánto carga cada uno. Alargar baja la carga «ideal» (hay más
// gente), pero si las filas nuevas no llegan a cargar, los que más llevan siguen llevando lo mismo.

import { aKg, perfilIdeal } from '../fem/contacto';
import { precalcularRapido, resolverRapido, type SolverRapido } from '../fem/rapido';
import { construirModelo } from '../fem/modelo';
import type { ConfigTrono, CuadrillaTipo, HdT, Trono } from '../geometria/tipos';
import { construirTrono, separacionFilas, validarConfig } from '../geometria/trono';
import { aleatorio, normal, TALLAS_EJEMPLO } from '../io/ejemplo';
import { numero } from '../io/csv';

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
  /** Media del 10 % que más carga: mediana entre las cuadrillas simuladas… */
  altosKg: number;
  /** …y lo que sale en un año bueno (percentil 10) y en uno malo (percentil 90). */
  altosP10: number;
  altosP90: number;
  /** Media de las filas de las puntas (delante y detrás), mediana entre cuadrillas. */
  puntaKg: number;
  /** Personas que llevan menos de la mitad de lo ideal, mediana entre cuadrillas. */
  acompanan: number;
  /** Fracción de las cuadrillas simuladas que no tienen gente para todos los puestos. */
  faltaGente: number;
}

export type Veredicto = 'corto' | 'optimo' | 'largo';

export interface EstudioVarales {
  actual: number;
  actualDetras: number;
  /** Punto calculado con el largo actual. */
  puntoActual: PuntoLongitud;
  puntos: PuntoLongitud[];
  /** Largo recomendado: bueno en un año normal y el que menos se resiente en un año malo. */
  recomendado: PuntoLongitud;
  /** Kilos de más que llevan, en un año normal, los que más cargan con el largo actual frente al recomendado. */
  sobranKg: number;
  veredicto: Veredicto;
  /** Cuadrilla tipo usada: tamaño, media y rango (cm). */
  tipo: { disponibles: number; media: number; p5: number; p95: number; simulaciones: number };
}

/** Por debajo de esta fracción de lo ideal, una persona «acompaña» más que carga. */
export const FRACCION_PUNTA = 0.5;
const PASO = 0.25;
/** Diferencias menores que esta (kg) en lo que llevan los que más cargan no se tienen en cuenta. */
export const TOLERANCIA_KG = 1;
/** Cuadrillas simuladas por estudio. */
export const SIMULACIONES = 12;

function cuantil(ordenado: ArrayLike<number>, p: number): number {
  const x = (ordenado.length - 1) * p;
  const i = Math.floor(x), f = x - i;
  return ordenado[i] + (ordenado[Math.min(i + 1, ordenado.length - 1)] - ordenado[i]) * f;
}
const ordenar = (v: ArrayLike<number>) => Float64Array.from(v).sort();
const medianaDe = (v: ArrayLike<number>) => cuantil(ordenar(v), 0.5);

// ---------------------------------------------------------------- cuadrilla tipo

export function cuadrillaTipoPorDefecto(): CuadrillaTipo {
  return { origen: 'ejemplo', media: 152.5, desviacion: 3.5, min: 146, max: 164, historico: '', disponibles: null, variacionCm: 2 };
}

/** Alturas de hombro (cm) leídas de un texto pegado: una o varias listas, separadas como sea. */
export function leerAlturas(texto: string): number[] {
  const r: number[] = [];
  for (const trozo of texto.match(/\d+(?:[.,]\d+)?/g) ?? []) {
    let v = numero(trozo);
    if (v > 0 && v < 3) v *= 100; // venía en metros
    if (v >= 100 && v <= 220) r.push(v);
  }
  return r;
}

/** Alturas (cm) de la cuadrilla tipo, según de dónde se saquen. */
export function alturasTipo(tipo: CuadrillaTipo, cuadrilla: HdT[]): number[] {
  switch (tipo.origen) {
    case 'actual':
      return cuadrilla.map((h) => h.hombro);
    case 'historico':
      return leerAlturas(tipo.historico);
    case 'parametros': {
      // Normal recortada a [min, max], siempre la misma (semilla fija)
      const r = aleatorio(7);
      const lo = Math.min(tipo.min, tipo.max), hi = Math.max(tipo.min, tipo.max);
      return Array.from({ length: 500 }, () => Math.min(hi, Math.max(lo, tipo.media + tipo.desviacion * normal(r))));
    }
    case 'ejemplo':
    default:
      // La forma de una cuadrilla de Málaga (la del ejemplo), la mitad en ,0 y la mitad en ,5
      return Object.entries(TALLAS_EJEMPLO).flatMap(([cm, n]) => Array.from({ length: n }, (_, k) => Number(cm) + (k % 2) * 0.5));
  }
}

/**
 * Cuadrillas simuladas (alturas en m, ordenadas). Cada una sale de la tipo cambiando la altura
 * media (repartida por igual entre −variación y +variación, para cubrir años altos y bajos), lo
 * dispersas que están las alturas (±10 %) y cuánta gente viene (±6 %).
 */
export function simularCuadrillas(alturasCm: number[], disponibles: number, variacionCm: number, n = SIMULACIONES, semilla = 2026): Float64Array[] {
  const media = alturasCm.reduce((a, b) => a + b, 0) / alturasCm.length;
  return Array.from({ length: n }, (_, k) => {
    const r = aleatorio(semilla + 97 * k);
    const desplazamiento = n === 1 ? 0 : -variacionCm + (2 * variacionCm * k) / (n - 1);
    const escala = 1 + 0.1 * Math.max(-2, Math.min(2, normal(r)));
    const m = Math.max(1, Math.round(disponibles * (1 + 0.06 * Math.max(-2, Math.min(2, normal(r))))));
    const h = new Float64Array(m);
    for (let i = 0; i < m; i++) {
      const x = alturasCm[Math.floor(r() * alturasCm.length)];
      h[i] = Math.round((media + (x - media) * escala + desplazamiento) * 2) / 2 / 100;
    }
    return h.sort();
  });
}

// ---------------------------------------------------------------- un largo de varal

/** Configuración con otro largo en un lado, manteniendo la separación entre filas. */
export function conLargo(c: ConfigTrono, lado: Lado, largo: number): ConfigTrono {
  const d: ConfigTrono = JSON.parse(JSON.stringify(c));
  const actual = lado === 'delante' ? c.varales.largoDelante : c.varales.largoDetras;
  const filas = lado === 'delante' ? c.puestos.filasDelante : c.puestos.filasDetras;
  const sep = filas > 0 ? separacionFilas(actual, filas) : 0.45;
  largo = Math.round(largo * 1000) / 1000;
  const nuevas = Math.max(1, Math.round(largo / sep));
  if (lado === 'delante') { d.varales.largoDelante = largo; d.puestos.filasDelante = nuevas; }
  else { d.varales.largoDetras = largo; d.puestos.filasDetras = nuevas; }
  return d;
}

/** Alarga (o acorta, si es negativo) los dos voladizos la misma cantidad. */
export function conAlargue(c: ConfigTrono, delta: number): ConfigTrono {
  return conLargo(conLargo(c, 'delante', c.varales.largoDelante + delta), 'detras', c.varales.largoDetras + delta);
}

interface Largo {
  c: ConfigTrono;
  t: Trono;
  rapido: SolverRapido;
  /** Hombro que pide cada puesto, salvo una constante (m). */
  w: Float64Array;
  idealKg: number;
  /** Puestos de las filas de las puntas. */
  punta: number[];
}

function prepararLargo(c: ConfigTrono): Largo {
  const t = construirTrono(c);
  const m = construirModelo(t);
  const Fid = m.pesoTotalN / t.puestos.length;
  return {
    c, t, rapido: precalcularRapido(m), w: perfilIdeal(m, Fid).w, idealKg: aKg(Fid),
    punta: t.puestos.filter((p) => (p.zona === 'delante' && p.numero === 1) || (p.zona === 'detras' && p.numero === t.numeroMax)).map((p) => p.idx),
  };
}

/**
 * Coloca la cuadrilla `gente` (alturas en m, ordenadas) con los puestos pidiendo `w + nivel`:
 * primero los puestos que más se apartan de lo normal, cada uno con la persona libre más cercana a
 * lo que pide. Si falta gente, se quedan vacíos los puestos de las puntas (como haría el capataz).
 * Devuelve el hombro de cada puesto (−10 m si vacío).
 */
export function colocar(w: Float64Array, nivel: number, gente: Float64Array): Float64Array {
  const N = w.length, M = gente.length;
  const h = new Float64Array(N).fill(-10);
  const pide = Float64Array.from(w, (x) => x + nivel);
  let orden = Array.from({ length: N }, (_, i) => i);
  if (M < N) {
    // Sin gente para todos: fuera los que más altura piden (las puntas)
    orden.sort((a, b) => pide[b] - pide[a]);
    orden = orden.slice(N - M);
  }
  const centro = medianaDe(gente);
  orden.sort((a, b) => Math.abs(pide[b] - centro) - Math.abs(pide[a] - centro));
  // Persona libre más cercana: dos «siguiente libre» (a la derecha y a la izquierda) con compresión de caminos
  const der = Int32Array.from({ length: M + 1 }, (_, i) => i);
  const izq = Int32Array.from({ length: M + 1 }, (_, i) => i); // izq[i + 1] ↔ persona i; 0 = ninguna
  const buscar = (p: Int32Array, i: number) => {
    let r = i;
    while (p[r] !== r) r = p[r];
    while (p[i] !== r) { const s = p[i]; p[i] = r; i = s; }
    return r;
  };
  for (const i of orden) {
    let lo = 0, hi = M;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (gente[mid] < pide[i]) lo = mid + 1; else hi = mid; }
    const d = buscar(der, lo); // primera libre ≥ lo (M = ninguna)
    const z = buscar(izq, lo) - 1; // última libre < lo (−1 = ninguna)
    const j = d >= M ? z : z < 0 ? d : pide[i] - gente[z] <= gente[d] - pide[i] ? z : d;
    h[i] = gente[j];
    der[j] = j + 1;
    izq[j + 1] = j;
  }
  return h;
}

interface Simulado { altos: number; punta: number; acompanan: number; falta: boolean }

/** Cargas de una cuadrilla en un largo, con el nivel que deja más bajo al 10 % que más carga. */
function simular(L: Largo, gente: Float64Array): Simulado {
  const N = L.w.length;
  const base = medianaDe(gente) - medianaDe(L.w);
  const nAltos = Math.max(1, Math.round(Math.min(N, gente.length) / 10));
  const probar = (d: number) => {
    const h = colocar(L.w, base + d, gente);
    const kg = Float64Array.from(resolverRapido(L.rapido, h).F, aKg);
    const desc = Float64Array.from(kg).sort().reverse();
    let altos = 0;
    for (let i = 0; i < nAltos; i++) altos += desc[i];
    return { altos: altos / nAltos, kg, h };
  };
  // Nivel: búsqueda gruesa cada 3 cm y luego fina, a 1,5 cm del mejor
  let mejor = { d: 0, r: probar(0) };
  for (const d of [-0.03, 0.03]) { const r = probar(d); if (r.altos < mejor.r.altos) mejor = { d, r }; }
  for (const d of [mejor.d - 0.015, mejor.d + 0.015]) { const r = probar(d); if (r.altos < mejor.r.altos) mejor = { d, r }; }
  const { kg, h } = mejor.r;
  const ocupados = Array.from({ length: N }, (_, i) => i).filter((i) => h[i] > -1);
  const ideal = L.idealKg * N / Math.max(1, ocupados.length);
  const punta = L.punta.filter((i) => h[i] > -1);
  return {
    altos: mejor.r.altos,
    punta: punta.length ? punta.reduce((s, i) => s + kg[i], 0) / punta.length : 0,
    acompanan: ocupados.filter((i) => kg[i] < FRACCION_PUNTA * ideal).length,
    falta: gente.length < N,
  };
}

function resumir(L: Largo, sims: Simulado[]): PuntoLongitud {
  const altos = ordenar(sims.map((s) => s.altos));
  return {
    largo: L.c.varales.largoDelante,
    largoDetras: L.c.varales.largoDetras,
    filas: L.c.puestos.filasDelante,
    filasDetras: L.c.puestos.filasDetras,
    puestos: L.t.puestos.length,
    pesoKg: L.t.pesos.total,
    idealKg: L.idealKg,
    altosKg: cuantil(altos, 0.5),
    altosP10: cuantil(altos, 0.1),
    altosP90: cuantil(altos, 0.9),
    puntaKg: medianaDe(sims.map((s) => s.punta)),
    acompanan: Math.round(medianaDe(sims.map((s) => s.acompanan))),
    faltaGente: sims.filter((s) => s.falta).length / sims.length,
  };
}

// ---------------------------------------------------------------- estudio completo

/**
 * Alargues a estudiar (m), cada 25 cm: desde 1,5 m menos que ahora (sin bajar de 1,5 m de voladizo)
 * hasta 2 m más (y al menos hasta 6 m).
 */
export function alarguesAEstudiar(c: ConfigTrono): number[] {
  const corto = Math.min(c.varales.largoDelante, c.varales.largoDetras);
  const largo = Math.max(c.varales.largoDelante, c.varales.largoDetras);
  const desde = Math.max(-1.5, Math.ceil((1.5 - corto) / PASO - 1e-9) * PASO);
  const hasta = Math.max(6 - largo, 2);
  const r: number[] = [];
  for (let k = 0; desde + k * PASO <= hasta + 1e-9; k++) r.push(Math.round((desde + k * PASO) * 100) / 100);
  if (!r.some((d) => Math.abs(d) < 1e-9)) r.push(0);
  return r.sort((a, b) => a - b);
}

/**
 * Elige el largo: entre los que, en un año normal (mediana), quedan a menos de TOLERANCIA_KG del
 * mejor y no suelen quedarse sin gente, el que menos se resiente en un año malo (percentil 90);
 * a igualdad (±0,5 kg), el más corto.
 */
export function elegirRecomendado(puntos: PuntoLongitud[]): PuntoLongitud {
  const viables = puntos.filter((p) => p.faltaGente <= 0.5);
  const lista = viables.length ? viables : puntos;
  const minimo = Math.min(...lista.map((p) => p.altosKg));
  const candidatos = lista.filter((p) => p.altosKg <= minimo + TOLERANCIA_KG);
  const peorMin = Math.min(...candidatos.map((p) => p.altosP90));
  return candidatos.filter((p) => p.altosP90 <= peorMin + 0.5).sort((a, b) => a.largo - b.largo)[0];
}

/** Gente que suele haber y cuadrillas simuladas (las mismas en todos los largos y en todos los workers). */
function prepararSimulacion(cuadrilla: HdT[], tipo: CuadrillaTipo) {
  const alturas = alturasTipo(tipo, cuadrilla);
  if (alturas.length < 8) throw new Error('La cuadrilla tipo necesita al menos 8 alturas de hombro.');
  const disponibles = Math.max(8, Math.round(tipo.disponibles ?? (cuadrilla.length || alturas.length)));
  const cuadrillas = simularCuadrillas(alturas, disponibles, Math.max(0, tipo.variacionCm));
  const o = ordenar(alturas);
  const resumen = { disponibles, media: alturas.reduce((a, b) => a + b, 0) / alturas.length, p5: cuantil(o, 0.05), p95: cuantil(o, 0.95), simulaciones: cuadrillas.length };
  return { cuadrillas, resumen };
}

/** Estudia solo los alargues `deltas` (para repartir el trabajo entre varios workers). */
export function estudiarLargos(
  c: ConfigTrono, cuadrilla: HdT[], tipo: CuadrillaTipo, deltas: number[], progreso: (f: number) => void = () => {},
): PuntoLongitud[] {
  const { cuadrillas } = prepararSimulacion(cuadrilla, tipo);
  const puntos: PuntoLongitud[] = [];
  deltas.forEach((d, k) => {
    const cfg = Math.abs(d) < 1e-9 ? c : conAlargue(c, d);
    if (validarConfig(cfg).length === 0) {
      try {
        const L = prepararLargo(cfg);
        puntos.push(resumir(L, cuadrillas.map((g) => simular(L, g))));
      } catch { /* sin apoyo: se omite */ }
    }
    progreso((k + 1) / deltas.length);
  });
  return puntos;
}

/** Junta los puntos de todos los largos y da el veredicto. */
export function componerEstudio(c: ConfigTrono, cuadrilla: HdT[], tipo: CuadrillaTipo, puntos: PuntoLongitud[]): EstudioVarales {
  const ordenados = [...puntos].sort((a, b) => a.largo - b.largo);
  const actual = c.varales.largoDelante;
  const actualPt = ordenados.find((p) => Math.abs(p.largo - actual) < 1e-6);
  if (!actualPt) throw new Error('No se ha podido calcular el trono con el largo actual.');
  const recomendado = elegirRecomendado(ordenados);
  const sobranKg = Math.max(0, actualPt.altosKg - recomendado.altosKg);
  const veredicto: Veredicto =
    sobranKg <= TOLERANCIA_KG && actualPt.faltaGente <= 0.5 ? 'optimo' : actual > recomendado.largo ? 'largo' : 'corto';
  return {
    actual, actualDetras: c.varales.largoDetras, puntoActual: actualPt, puntos: ordenados, recomendado, sobranKg, veredicto,
    tipo: prepararSimulacion(cuadrilla, tipo).resumen,
  };
}

export function estudiarVarales(
  c: ConfigTrono, cuadrilla: HdT[], tipo: CuadrillaTipo, progreso: (f: number) => void = () => {},
): EstudioVarales {
  return componerEstudio(c, cuadrilla, tipo, estudiarLargos(c, cuadrilla, tipo, alarguesAEstudiar(c), progreso));
}
