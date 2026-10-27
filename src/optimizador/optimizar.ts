// Orquestación del método completo:
// 1) perfil ideal, 2) linealización, 3) barrido, 4) intercambios,
// 5) comprobación con el modelo exacto con contacto, 6) selección de reservas.

import { ErrorApoyo, perfilIdeal } from '../fem/contacto';
import { precalcularRapido, resolverRapido, type SolucionRapida, type SolverRapido } from '../fem/rapido';
import { construirModelo, GRAV, K_PERSONA, type Modelo } from '../fem/modelo';
import type { ConfigOptimizador, ConfigTrono, HdT, Trono } from '../geometria/tipos';
import { construirTrono } from '../geometria/trono';
import { barrer, unidadesSimetria, type Unidad } from './barrido';
import { crearEvaluador } from './coste';
import { refinar } from './intercambios';
import { linealDesdeRapido } from './linealizado';

export class ErrorCuadrilla extends Error {}

export interface ResumenCarga {
  desviacionTipica: number;
  min: number;
  max: number;
  p10: number;
  p90: number;
  dentro25: number;
  noLlegan: number;
}

export interface Cuesta {
  pendiente: number;
  alturaCdg: number;
  /** Carga media (kg) de la fila más exterior de delante y de detrás, y total por zonas. */
  filas: { caso: 'llano' | 'subiendo' | 'bajando'; delante: number; detras: number; zonaDelante: number; zonaDetras: number }[];
}

export interface Resultado {
  /** Para cada puesto, el id del HdT (−1 si está vacío). */
  asignacion: number[];
  /** Puestos sin nadie. */
  vacios: number;
  reservas: number[];
  cargasKg: number[];
  /** Hombro que haría que cada puesto cargase justo lo ideal (cm). */
  hombroIdealCm: number[];
  pesoTotal: number;
  cargaIdeal: number;
  resumen: ResumenCarga;
  inclinacionGrados: number;
  alabeoGrados: number;
  flechaDelanteMm: number;
  flechaDetrasMm: number;
  cuesta: Cuesta;
  confianza: {
    clave: number;
    claveConf3: number;
    claveConf2: number;
    claveConf1: number;
    claveVacios: number;
    conf1EnClave: string[];
  };
  /** Mismo cálculo sin tener en cuenta la confianza (si la prioridad es > 0). */
  sinConfianza: ResumenCarga & { claveConf3: number } | null;
  iteracionesContacto: number;
  tiempoMs: number;
  /** Huella de los datos con los que se calculó. */
  huella: string;
}

export type Progreso = (fraccion: number, texto: string) => void;

interface Interno {
  asig: Int32Array;
  reservas: number[];
}

function percentil(ordenado: number[], p: number): number {
  if (ordenado.length === 0) return 0;
  const x = (ordenado.length - 1) * p;
  const i = Math.floor(x), f = x - i;
  return ordenado[i] + (ordenado[Math.min(i + 1, ordenado.length - 1)] - ordenado[i]) * f;
}

export function resumirCargas(cargasKg: number[], idealKg: number): ResumenCarga {
  const o = [...cargasKg].sort((a, b) => a - b);
  const media = o.reduce((a, b) => a + b, 0) / o.length;
  const sd = Math.sqrt(o.reduce((a, b) => a + (b - media) ** 2, 0) / o.length);
  return {
    desviacionTipica: sd,
    min: o[0],
    max: o[o.length - 1],
    p10: percentil(o, 0.1),
    p90: percentil(o, 0.9),
    dentro25: o.filter((c) => Math.abs(c - idealKg) <= 0.25 * idealKg).length,
    noLlegan: o.filter((c) => c <= 1e-9).length,
  };
}

/** Pasos 2–4 y 6 con una prioridad de confianza dada. */
function optimizarInterno(
  t: Trono, m: Modelo, rapido: SolverRapido, cuadrilla: HdT[], op: ConfigOptimizador, progreso: Progreso, p0: number, p1: number,
  fijo: Int32Array,
): Interno {
  const N = t.puestos.length;
  const FidN = m.pesoTotalN / N;
  const alturasM = Float64Array.from(cuadrilla, (h) => h.hombro / 100);
  const perfil = perfilIdeal(m, FidN).w;
  const lin = linealDesdeRapido(rapido);
  const ev = crearEvaluador(t, cuadrilla, op, FidN);
  // Solo se reparten los puestos libres; si en una pareja espejo hay uno fijado, el otro va suelto.
  const unidades = unidadesSimetria(t).flatMap((u): Unidad[] => {
    const libres = u.filter((i) => fijo[i] < 0);
    return libres.length === u.length ? [u] : libres.length === 1 ? [[libres[0]]] : [];
  });
  const marcaFijo = Uint8Array.from(fijo, (p) => (p >= 0 ? 1 : 0));
  const yaColocados = new Set(Array.from(fijo).filter((p) => p >= 0));
  const libresN = N - yaColocados.size;
  const tolParejaM = op.tolParejaCm / 100;
  const tramo = (a: number, b: number) => (f: number) => progreso(p0 + (p1 - p0) * (a + (b - a) * f), 'Buscando el mejor cuadrante…');

  // Subconjuntos candidatos: quitar t de los más altos y R − t de los más bajos.
  // A igualdad de altura se prefiere dejar de reserva a los de menor confianza.
  const idx = cuadrilla.map((_, i) => i).filter((i) => !yaColocados.has(i));
  const R = idx.length - libresN;
  if (R < 0) throw new ErrorCuadrilla(`Faltan ${-R} HdT para cubrir los ${libresN} puestos libres.`);
  const asc = [...idx].sort((a, b) => alturasM[a] - alturasM[b] || cuadrilla[a].confianza - cuadrilla[b].confianza);
  const desc = [...idx].sort((a, b) => alturasM[b] - alturasM[a] || cuadrilla[a].confianza - cuadrilla[b].confianza);
  const nCand = Math.min(R + 1, 9);
  const ts = [...new Set(Array.from({ length: nCand }, (_, i) => (nCand === 1 ? 0 : Math.round((i * R) / (nCand - 1)))))];
  const candidatos = ts.map((tAltos) => {
    const fuera = new Set([...desc.slice(0, tAltos), ...asc.slice(0, R - tAltos)]);
    return { personas: idx.filter((i) => !fuera.has(i)), reservas: [...fuera] };
  });

  const itCorto = Math.max(2000, Math.floor(op.iteraciones / 6));
  const fraccionCand = candidatos.length > 1 ? 0.35 : 0;
  let mejor: { asig: Int32Array; reservas: number[]; coste: number } | null = null;
  candidatos.forEach((c, k) => {
    const b = barrer(t, lin, ev, unidades, perfil, alturasM, c.personas, c.reservas, fijo);
    let r = { asig: b.asig, reservas: c.reservas, coste: b.coste };
    if (candidatos.length > 1) {
      r = refinar(t, lin, ev, alturasM, b.asig, c.reservas, {
        iteraciones: itCorto, tolParejaM, semilla: 1000 + k, fijo: marcaFijo,
        progreso: tramo((fraccionCand * k) / candidatos.length, (fraccionCand * (k + 1)) / candidatos.length),
      });
    }
    if (!mejor || r.coste < mejor.coste) mejor = r;
  });
  const m0 = mejor!;
  const fin = refinar(t, lin, ev, alturasM, m0.asig, m0.reservas, {
    iteraciones: op.iteraciones, tolParejaM, semilla: 12345, progreso: tramo(fraccionCand, 1), fijo: marcaFijo,
  });
  return fin.coste <= m0.coste ? fin : m0;
}

export function huellaDatos(c: ConfigTrono, cuadrilla: HdT[], op: ConfigOptimizador): string {
  const s = JSON.stringify([c, cuadrilla, op]);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16);
}

/**
 * Reparte la cuadrilla en los puestos. `colocados` (id de HdT por puesto, −1 = libre) son los
 * que el capataz ya ha puesto a mano: se respetan y solo se rellenan los huecos.
 */
export function calcularCuadrante(
  c: ConfigTrono, cuadrilla: HdT[], op: ConfigOptimizador, progreso: Progreso = () => {}, colocados?: number[],
): Resultado {
  const inicio = performance.now();
  const t = construirTrono(c, op.confianza);
  const N = t.puestos.length;
  const indice = new Map(cuadrilla.map((h, i) => [h.id, i]));
  const fijo = Int32Array.from(t.puestos, (p) => indice.get(colocados?.[p.idx] ?? -1) ?? -1);
  if (cuadrilla.length < N) {
    const faltan = N - cuadrilla.length;
    throw new ErrorCuadrilla(`Faltan ${faltan} hombre${faltan === 1 ? '' : 's'} de trono: hay ${N} puestos y la cuadrilla tiene ${cuadrilla.length}.`);
  }
  progreso(0, 'Montando el modelo estructural…');
  const m = construirModelo(t);
  const FidN = m.pesoTotalN / N;
  const idealKg = FidN / GRAV;

  progreso(0.01, 'Precalculando el modelo linealizado…');
  const rapido = precalcularRapido(m);
  const conConf = op.prioridadConfianza > 0;
  const principal = optimizarInterno(t, m, rapido, cuadrilla, op, progreso, 0.02, conConf ? 0.6 : 0.92, fijo);

  // Paso 5: comprobación con el modelo exacto con contacto
  progreso(conConf ? 0.6 : 0.92, 'Comprobando con el modelo exacto…');
  let sinConfianza: Resultado['sinConfianza'] = null;
  if (conConf) {
    const base = optimizarInterno(t, m, rapido, cuadrilla, { ...op, prioridadConfianza: 0 }, progreso, 0.62, 0.95, fijo);
    const hb = Float64Array.from(base.asig, (p) => cuadrilla[p].hombro / 100);
    const sb = resolverRapido(rapido, hb);
    sinConfianza = {
      ...resumirCargas(Array.from(sb.F, (F) => F / GRAV), idealKg),
      claveConf3: t.puestos.filter((p) => p.clave && cuadrilla[base.asig[p.idx]].confianza === 3).length,
    };
  }
  progreso(0.96, 'Comprobando la cuesta…');
  const analisis = analizar(t, m, rapido, cuadrilla, principal.asig, principal.reservas);
  progreso(1, 'Listo');
  return { ...analisis, sinConfianza, tiempoMs: performance.now() - inicio, huella: huellaDatos(c, cuadrilla, op) };
}

/**
 * Comprueba con el modelo exacto una asignación hecha a mano. `asignacion`: id de HdT por
 * puesto, −1 si el puesto está vacío. Los que no están colocados quedan como reserva.
 */
export function evaluarAsignacion(
  c: ConfigTrono, cuadrilla: HdT[], op: ConfigOptimizador, asignacion: number[],
  modelo?: { t: Trono; m: Modelo; rapido: SolverRapido },
): Resultado {
  const inicio = performance.now();
  const t = modelo?.t ?? construirTrono(c, op.confianza);
  const m = modelo?.m ?? construirModelo(t);
  const rapido = modelo?.rapido ?? precalcularRapido(m);
  const indice = new Map(cuadrilla.map((h, i) => [h.id, i]));
  const asig = Int32Array.from(asignacion, (id) => indice.get(id) ?? -1);
  const usados = new Set(asig);
  const reservas = cuadrilla.map((_, i) => i).filter((i) => !usados.has(i));
  const analisis = analizar(t, m, rapido, cuadrilla, asig, reservas);
  return { ...analisis, sinConfianza: null, tiempoMs: performance.now() - inicio, huella: huellaDatos(c, cuadrilla, op) };
}

type Analisis = Omit<Resultado, 'sinConfianza' | 'tiempoMs' | 'huella'>;

/** Cargas, resumen, cuesta y confianza de una asignación (índices de la cuadrilla). */
function analizar(t: Trono, m: Modelo, rapido: SolverRapido, cuadrilla: HdT[], asig: Int32Array, reservas: number[]): Analisis {
  const N = t.puestos.length;
  const FidN = m.pesoTotalN / N;
  const idealKg = FidN / GRAV;
  const ocupados = t.puestos.filter((p) => asig[p.idx] >= 0);
  if (ocupados.length < Math.min(N, 8)) throw new ErrorApoyo('Coloca más gente para poder comprobar el reparto.');
  // Un puesto vacío es un hombro muy por debajo del varal: nunca llega y no carga.
  const h = Float64Array.from(asig, (p) => (p >= 0 ? cuadrilla[p].hombro / 100 : -10));
  const xs = t.puestos.map((p) => p.x);
  const sol = resolverRapido(rapido, h);
  if (![sol.z0, sol.cabeceo, sol.alabeo].every((x) => Number.isFinite(x) && Math.abs(x) < 10)) {
    throw new ErrorApoyo('Con la gente colocada el trono no se sostiene: coloca a más HdT repartidos por todo el trono.');
  }
  const cargasKg = Array.from(sol.F, (F) => F / GRAV);
  const cuesta = calcularCuesta(t, rapido, h, xs, sol);
  const flechas = sol.flechas;
  const media = (lado: 'delante' | 'detras') => {
    const v = m.puntas.map((p, i) => (p.lado === lado ? flechas[i] : NaN)).filter((x) => !Number.isNaN(x));
    return (v.reduce((a, b) => a + b, 0) / v.length) * 1000;
  };
  const claves = t.puestos.filter((p) => p.clave);
  const confDe = (p: { idx: number }) => (asig[p.idx] >= 0 ? cuadrilla[asig[p.idx]].confianza : 0);
  const hombroIdealCm = Array.from(sol.w, (w) => (w + FidN / K_PERSONA) * 100);
  return {
    asignacion: Array.from(asig, (p) => (p >= 0 ? cuadrilla[p].id : -1)),
    vacios: N - ocupados.length,
    reservas: reservas.map((p) => cuadrilla[p].id),
    cargasKg,
    hombroIdealCm,
    pesoTotal: t.pesos.total,
    cargaIdeal: idealKg,
    resumen: resumirCargas(ocupados.map((p) => cargasKg[p.idx]), idealKg),
    inclinacionGrados: (Math.atan(sol.cabeceo) * 180) / Math.PI,
    alabeoGrados: (Math.atan(sol.alabeo) * 180) / Math.PI,
    flechaDelanteMm: media('delante'),
    flechaDetrasMm: media('detras'),
    cuesta,
    confianza: {
      clave: claves.length,
      claveConf3: claves.filter((p) => confDe(p) === 3).length,
      claveConf2: claves.filter((p) => confDe(p) === 2).length,
      claveConf1: claves.filter((p) => confDe(p) === 1).length,
      claveVacios: claves.filter((p) => confDe(p) === 0).length,
      conf1EnClave: claves.filter((p) => confDe(p) === 1).map((p) => p.codigo),
    },
    iteracionesContacto: sol.iteraciones,
  };
}

export const PENDIENTE_CUESTA = 0.05;

function calcularCuesta(t: Trono, rapido: SolverRapido, h: Float64Array, xs: number[], llano: SolucionRapida): Cuesta {
  const n1 = t.puestos.filter((p) => p.zona === 'delante' && p.numero === 1).map((p) => p.idx);
  const nU = t.puestos.filter((p) => p.zona === 'detras' && p.numero === t.numeroMax).map((p) => p.idx);
  const zD = t.puestos.filter((p) => p.zona === 'delante').map((p) => p.idx);
  const zT = t.puestos.filter((p) => p.zona === 'detras').map((p) => p.idx);
  const media = (F: Float64Array, ids: number[]) => (ids.length ? ids.reduce((a, i) => a + F[i], 0) / ids.length / GRAV : 0);
  const suma = (F: Float64Array, ids: number[]) => ids.reduce((a, i) => a + F[i], 0) / GRAV;
  const fila = (caso: 'llano' | 'subiendo' | 'bajando', s: SolucionRapida) => ({
    caso, delante: media(s.F, n1), detras: media(s.F, nU), zonaDelante: suma(s.F, zD), zonaDetras: suma(s.F, zT),
  });
  const sube = resolverRapido(rapido, h, { pendiente: PENDIENTE_CUESTA, xs, conCdg: true });
  const baja = resolverRapido(rapido, h, { pendiente: -PENDIENTE_CUESTA, xs, conCdg: true });
  return {
    pendiente: PENDIENTE_CUESTA,
    alturaCdg: t.pesos.alturaCdg,
    filas: [fila('llano', llano), fila('subiendo', sube), fila('bajando', baja)],
  };
}

