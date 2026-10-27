// Revisión de un cuadrante colocado a mano: lista de problemas para el panel de errores.

import type { ConfigOptimizador, HdT, Trono } from '../geometria/tipos';
import type { Resultado } from './optimizar';

export type Nivel = 'error' | 'aviso' | 'bien';

export interface Problema {
  nivel: Nivel;
  titulo: string;
  detalle?: string;
  /** Referencias de los puestos afectados (para resaltarlos). */
  puestos: string[];
}

const kg = (x: number) => `${x.toLocaleString('es-ES', { maximumFractionDigits: 0 })} kg`;
const lista = (xs: string[], max = 8) => (xs.length > max ? `${xs.slice(0, max).join(', ')} y ${xs.length - max} más` : xs.join(', '));

/** Por debajo de esta inclinación (grados, negativa) se considera que el trono va picado. */
export const UMBRAL_PICADO_GRADOS = 0.05;

/** Umbral de diferencia de carga dentro de una fila (fracción de la carga ideal). */
export const UMBRAL_FILA = 0.6;

export function revisar(t: Trono, r: Resultado, cuadrilla: HdT[], opt: ConfigOptimizador): Problema[] {
  const porId = new Map(cuadrilla.map((h) => [h.id, h]));
  const ideal = r.cargaIdeal;
  const ocupado = (i: number) => r.asignacion[i] >= 0;
  const nombre = (i: number) => porId.get(r.asignacion[i])?.nombre ?? '';
  const ref = (i: number) => t.puestos[i].ref;
  const etiqueta = (i: number) => t.puestos[i].codigo;
  const p: Problema[] = [];

  // Puestos sin cubrir
  const vacios = t.puestos.filter((q) => !ocupado(q.idx));
  if (vacios.length) {
    const faltaGente = cuadrilla.length < t.puestos.length;
    p.push({
      nivel: 'aviso',
      titulo: `${vacios.length} puesto${vacios.length === 1 ? '' : 's'} sin cubrir`,
      detalle: faltaGente
        ? `La cuadrilla tiene ${cuadrilla.length} HdT para ${t.puestos.length} puestos.`
        : lista(vacios.map((q) => q.codigo)),
      puestos: vacios.map((q) => q.ref),
    });
  }

  const ocupados = t.puestos.filter((q) => ocupado(q.idx));
  const noLlegan = ocupados.filter((q) => r.cargasKg[q.idx] <= 1e-6);
  if (noLlegan.length) {
    p.push({
      nivel: 'error',
      titulo: `${noLlegan.length} no llega${noLlegan.length === 1 ? '' : 'n'} al varal`,
      detalle: lista(noLlegan.map((q) => `${etiqueta(q.idx)} (${nombre(q.idx)})`)),
      puestos: noLlegan.map((q) => q.ref),
    });
  }
  const altas = ocupados.filter((q) => r.cargasKg[q.idx] > 1.25 * ideal).sort((a, b) => r.cargasKg[b.idx] - r.cargasKg[a.idx]);
  if (altas.length) {
    p.push({
      nivel: 'error',
      titulo: `${altas.length} carga${altas.length === 1 ? '' : 'n'} de más`,
      detalle: lista(altas.map((q) => `${etiqueta(q.idx)} ${kg(r.cargasKg[q.idx])}`)) + ` (ideal ${kg(ideal)})`,
      puestos: altas.map((q) => q.ref),
    });
  }
  const bajas = ocupados.filter((q) => r.cargasKg[q.idx] > 1e-6 && r.cargasKg[q.idx] < 0.75 * ideal).sort((a, b) => r.cargasKg[a.idx] - r.cargasKg[b.idx]);
  if (bajas.length) {
    p.push({
      nivel: 'aviso',
      titulo: `${bajas.length} carga${bajas.length === 1 ? '' : 'n'} poco`,
      detalle: lista(bajas.map((q) => `${etiqueta(q.idx)} ${kg(r.cargasKg[q.idx])}`)),
      puestos: bajas.map((q) => q.ref),
    });
  }

  // Filas descompensadas (las 8 de una misma fila)
  const filas = new Map<number, number[]>();
  for (const q of ocupados) if (q.fila > 0) filas.set(q.fila, [...(filas.get(q.fila) ?? []), q.idx]);
  const malas: { fila: number; min: number; max: number; ids: number[] }[] = [];
  for (const [fila, ids] of filas) {
    const c = ids.map((i) => r.cargasKg[i]);
    const min = Math.min(...c), max = Math.max(...c);
    if (max - min > UMBRAL_FILA * ideal) malas.push({ fila, min, max, ids });
  }
  if (malas.length) {
    malas.sort((a, b) => a.fila - b.fila);
    p.push({
      nivel: 'aviso',
      titulo: `${malas.length} fila${malas.length === 1 ? '' : 's'} descompensada${malas.length === 1 ? '' : 's'}`,
      detalle: lista(malas.map((m) => `fila ${m.fila} (${kg(m.min)}–${kg(m.max)})`), 5),
      puestos: malas.flatMap((m) => m.ids.map(ref)),
    });
  }

  // Inclinación y alabeo
  if (Math.abs(r.inclinacionGrados) > opt.inclinacionMaxGrados + 1e-3) {
    p.push({
      nivel: 'error',
      titulo: `El trono va inclinado ${r.inclinacionGrados.toLocaleString('es-ES', { maximumFractionDigits: 2 })}°`,
      detalle: `${r.inclinacionGrados > 0 ? 'La parte delantera' : 'La parte trasera'} queda más alta. Máximo permitido: ${opt.inclinacionMaxGrados}°.`,
      puestos: [],
    });
  } else if (r.inclinacionGrados < -UMBRAL_PICADO_GRADOS) {
    p.push({
      nivel: 'aviso',
      titulo: `El trono va picado ${r.inclinacionGrados.toLocaleString('es-ES', { maximumFractionDigits: 2 })}°`,
      detalle: 'La delantera queda más baja que la trasera: pasa gente más alta hacia delante.',
      puestos: [],
    });
  }
  if (Math.abs(r.alabeoGrados) > 0.1) {
    p.push({
      nivel: 'aviso',
      titulo: `El trono se alabea ${r.alabeoGrados.toLocaleString('es-ES', { maximumFractionDigits: 2 })}°`,
      detalle: `El lado ${r.alabeoGrados > 0 ? 'izquierdo' : 'derecho'} queda más alto: iguala las parejas izquierda–derecha.`,
      puestos: [],
    });
  }

  // Confianza en los puestos clave
  const claves = t.puestos.filter((q) => q.clave && ocupado(q.idx));
  const conf = (i: number) => porId.get(r.asignacion[i])?.confianza ?? 0;
  const c1 = claves.filter((q) => conf(q.idx) === 1);
  if (c1.length) {
    p.push({
      nivel: 'error',
      titulo: `Confianza 1 en ${c1.length} puesto${c1.length === 1 ? '' : 's'} clave`,
      detalle: lista(c1.map((q) => `${q.codigo} (${nombre(q.idx)})`)),
      puestos: c1.map((q) => q.ref),
    });
  }
  const c2 = claves.filter((q) => conf(q.idx) === 2);
  if (c2.length) {
    p.push({
      nivel: 'aviso',
      titulo: `Confianza 2 en ${c2.length} puesto${c2.length === 1 ? '' : 's'} clave`,
      detalle: lista(c2.map((q) => q.codigo)),
      puestos: c2.map((q) => q.ref),
    });
  }

  // Cuesta: la fila exterior que se descarga demasiado
  for (const f of r.cuesta.filas) {
    if (f.caso === 'llano') continue;
    const peor = Math.min(f.delante, f.detras);
    if (peor < 0.5 * ideal) {
      const lado = f.delante < f.detras ? 'fila 1' : `fila ${t.numeroMax}`;
      p.push({
        nivel: 'aviso',
        titulo: `${f.caso === 'subiendo' ? 'Subiendo' : 'Bajando'} una cuesta, la ${lado} se queda en ${kg(peor)}`,
        detalle: 'Media de la fila más exterior con una pendiente del 5 %.',
        puestos: [],
      });
    }
  }

  if (!p.some((x) => x.nivel !== 'bien')) {
    p.push({ nivel: 'bien', titulo: 'Todo en orden', detalle: 'Nadie se queda sin cargar ni carga de más.', puestos: [] });
  }
  const orden: Record<Nivel, number> = { error: 0, aviso: 1, bien: 2 };
  return p.sort((a, b) => orden[a.nivel] - orden[b.nivel]);
}
