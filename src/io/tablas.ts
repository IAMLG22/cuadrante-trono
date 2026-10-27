// Vista del cuadrante y tablas compartidas por la interfaz, el CSV, el Excel y la impresión.

import type { ConfigOptimizador, ConfigTrono, HdT, Puesto, Trono } from '../geometria/tipos';
import { construirTrono } from '../geometria/trono';
import type { Resultado } from '../optimizador/optimizar';

/** vacio = nadie en el puesto; pendiente = colocado pero aún sin comprobar. */
export type ClaseCarga = 'nocarga' | 'baja' | 'bien' | 'alta' | 'vacio' | 'pendiente';

export const NOMBRE_CLASE: Record<ClaseCarga, string> = {
  bien: 'Óptima',
  baja: 'Por debajo',
  alta: 'De más',
  nocarga: 'No llega',
  vacio: 'Vacío',
  pendiente: 'Sin comprobar',
};

export function claseCarga(kg: number, ideal: number): ClaseCarga {
  if (kg < 0.05) return 'nocarga';
  if (kg < 0.75 * ideal) return 'baja';
  if (kg > 1.25 * ideal) return 'alta';
  return 'bien';
}

export interface DatosCalculo {
  config: ConfigTrono;
  cuadrilla: HdT[];
  opt: ConfigOptimizador;
}

/** Lo que ha colocado el capataz: referencia de puesto (A1, S3…) → id de HdT. */
export type Asignacion = Record<string, number>;

export interface FilaPuesto {
  puesto: Puesto;
  hdt: HdT | null;
  /** Carga en kg, o null si el puesto está vacío o sin comprobar. */
  carga: number | null;
  clase: ClaseCarga;
}

export interface Vista {
  trono: Trono;
  /** Fila por índice de puesto. */
  porPuesto: FilaPuesto[];
  /** Puestos numerados de los varales (sin el submarino). */
  filas: FilaPuesto[];
  /** Puestos del submarino, por varal y orden. */
  submarino: FilaPuesto[];
  /** HdT sin colocar, de más alto a más bajo. */
  reservas: HdT[];
  resultado: Resultado | null;
}

export function construirVista(d: DatosCalculo, asig: Asignacion, r: Resultado | null, trono?: Trono): Vista {
  const t = trono ?? construirTrono(d.config, d.opt.confianza);
  const porId = new Map(d.cuadrilla.map((h) => [h.id, h]));
  const usados = new Set<number>();
  const porPuesto = t.puestos.map((p): FilaPuesto => {
    const hdt = porId.get(asig[p.ref]) ?? null;
    if (hdt) usados.add(hdt.id);
    // Solo se usa la carga si el resultado corresponde a lo que hay ahora en ese puesto
    const vale = !!hdt && !!r && r.asignacion[p.idx] === hdt.id;
    const carga = vale ? r!.cargasKg[p.idx] : null;
    return { puesto: p, hdt, carga, clase: !hdt ? 'vacio' : carga === null ? 'pendiente' : claseCarga(carga, r!.cargaIdeal) };
  });
  return {
    trono: t,
    porPuesto,
    filas: porPuesto.filter((f) => f.puesto.zona !== 'submarino'),
    submarino: porPuesto.filter((f) => f.puesto.zona === 'submarino'),
    reservas: d.cuadrilla.filter((h) => !usados.has(h.id)).sort((a, b) => b.hombro - a.hombro),
    resultado: r,
  };
}

/** Asignación por índice de puesto (id o −1), como la usa el modelo. */
export function asignacionPorIndice(t: Trono, asig: Asignacion): number[] {
  return t.puestos.map((p) => asig[p.ref] ?? -1);
}

/** Pasa un resultado del optimizador (ids por índice) a referencias de puesto. */
export function asignacionDesdeResultado(t: Trono, ids: number[]): Asignacion {
  const a: Asignacion = {};
  t.puestos.forEach((p) => { if (ids[p.idx] >= 0) a[p.ref] = ids[p.idx]; });
  return a;
}

/** Orden natural de puestos: por varal y número. */
export const ordenPuesto = (a: Puesto, b: Puesto) =>
  Number(a.zona === 'submarino') - Number(b.zona === 'submarino') || a.varal - b.varal || a.numero - b.numero;

export const fmt = (v: number, dec = 1) => v.toLocaleString('es-ES', { minimumFractionDigits: dec, maximumFractionDigits: dec });

type Celda = string | number | null;

export function tablaCuadrante(v: Vista): Celda[][] {
  const filas: Celda[][] = [['Puesto', 'Nombre', 'Hombro (cm)', 'Confianza', 'Carga (kg)']];
  for (const f of [...v.filas].sort((a, b) => ordenPuesto(a.puesto, b.puesto))) {
    filas.push([f.puesto.codigo, f.hdt?.nombre ?? '(vacío)', f.hdt?.hombro ?? null, f.hdt?.confianza ?? null, f.carga]);
  }
  for (const f of v.submarino) filas.push([`Submarino ${f.puesto.codigo}`, f.hdt?.nombre ?? '(vacío)', f.hdt?.hombro ?? null, f.hdt?.confianza ?? null, f.carga]);
  for (const h of v.reservas) filas.push(['Reserva', h.nombre, h.hombro, h.confianza, null]);
  return filas;
}

/** Celda de la vista por varal: null si el varal está «cortado» por la mesa en ese número. */
export function matrizPorVaral(v: Vista): (FilaPuesto | null)[][] {
  const t = v.trono;
  const m: (FilaPuesto | null)[][] = Array.from({ length: t.numeroMax }, () => Array(t.nVarales).fill(null));
  for (const f of v.filas) m[f.puesto.numero - 1][f.puesto.varal] = f;
  return m;
}

export function tablaPorVaral(v: Vista): Celda[][] {
  const filas: Celda[][] = [['Nº', ...v.trono.letras]];
  matrizPorVaral(v).forEach((fila, i) => {
    filas.push([i + 1, ...fila.map((f) => (!f ? '— mesa —' : f.hdt ? `${f.hdt.nombre} (${fmt(f.hdt.hombro)})` : ''))]);
  });
  return filas;
}

export function tablaReserva(v: Vista): Celda[][] {
  return [['Nombre', 'Hombro (cm)', 'Confianza'], ...v.reservas.map((h) => [h.nombre, h.hombro, h.confianza])];
}

export function tablaResumen(v: Vista): Celda[][] {
  const r = v.resultado;
  const N = v.porPuesto.length;
  if (!r) return [['Dato', 'Valor'], ['Puestos', N], ['Sin comprobar', '']];
  const s = r.resumen;
  const filas: Celda[][] = [
    ['Dato', 'Valor'],
    ['Peso total (kg)', r.pesoTotal],
    ['Puestos', N],
    ['Puestos vacíos', r.vacios],
    ['Carga ideal por persona (kg)', r.cargaIdeal],
    ['Carga mínima (kg)', s.min],
    ['Carga máxima (kg)', s.max],
    ['P10 (kg)', s.p10],
    ['P90 (kg)', s.p90],
    ['Desviación típica (kg)', s.desviacionTipica],
    ['Dentro de ±25 %', s.dentro25],
    ['No llegan al varal', s.noLlegan],
    ['Inclinación delante-detrás (°)', r.inclinacionGrados],
    ['Alabeo (°)', r.alabeoGrados],
    ['Flecha punta delantera (mm)', r.flechaDelanteMm],
    ['Flecha punta trasera (mm)', r.flechaDetrasMm],
    ['Puestos clave', r.confianza.clave],
    ['Puestos clave con confianza 3', r.confianza.claveConf3],
    ['Confianza 1 en puestos clave', r.confianza.conf1EnClave.join(', ') || 'Ninguno'],
  ];
  for (const c of r.cuesta.filas) {
    filas.push([`Fila 1, carga media (${c.caso}) (kg)`, c.delante]);
    filas.push([`Última fila, carga media (${c.caso}) (kg)`, c.detras]);
  }
  return filas;
}
