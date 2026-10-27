// Guardado de los datos en localStorage.

import type { ConfigOptimizador, ConfigTrono, HdT } from '../geometria/tipos';
import { CONFIANZA_POR_DEFECTO, construirTrono, filasAutomaticas } from '../geometria/trono';
import { cuadrillaEjemplo, optimizadorPorDefecto, tronoEjemplo } from './ejemplo';
import { asignacionDesdeResultado, type Asignacion } from './tablas';

const CLAVE = 'cuadrante-trono-v1';

export interface Estado {
  config: ConfigTrono;
  opt: ConfigOptimizador;
  cuadrilla: HdT[];
  /** Si el trono o la cuadrilla siguen siendo los de ejemplo. */
  ejemploTrono: boolean;
  ejemploCuadrilla: boolean;
  /** Lo que ha colocado el capataz en el cuadrante. */
  asignacion: Asignacion;
  /** Si ya se ha pulsado «Comprobar»: desde entonces la revisión se actualiza sola. */
  comprobado: boolean;
}

export function estadoEjemplo(): Estado {
  return {
    config: tronoEjemplo(),
    opt: optimizadorPorDefecto(),
    cuadrilla: cuadrillaEjemplo(),
    ejemploTrono: true,
    ejemploCuadrilla: true,
    asignacion: {},
    comprobado: false,
  };
}

export function cargarEstado(): Estado {
  try {
    const txt = localStorage.getItem(CLAVE);
    if (!txt) return estadoEjemplo();
    const e = JSON.parse(txt) as Estado & { resultado?: { datos: { config: ConfigTrono; opt: ConfigOptimizador }; resultado: { asignacion: number[] } } | null };
    if (!e.config || !e.cuadrilla || !e.opt) return estadoEjemplo();
    // Completar campos que puedan faltar en datos guardados por versiones anteriores
    const base = estadoEjemplo();
    e.opt = { ...base.opt, ...e.opt, confianza: { ...CONFIANZA_POR_DEFECTO, ...e.opt.confianza } };
    // Campos añadidos en versiones posteriores
    e.config.varales.separaciones ??= null;
    e.config.varales.cabezas ??= { delante: { peso: 0, longitud: 0 }, detras: { peso: 0, longitud: 0 } };
    e.config.manto ??= { activo: false, peso: 250, distanciaFinal: 0.5, reparto: 'final', apoyo: 'mesa' };
    e.config.manto.apoyo ??= 'mesa';
    e.config.submarino ??= { varales: [], porVaral: 4 };
    // Antes las filas podían ser «automáticas» (null) según primera fila y separación
    const pu = e.config.puestos as typeof e.config.puestos & { distPrimeraFila?: number; separacionFilas?: number };
    if (pu.filasDelante === null || pu.filasDelante === undefined) pu.filasDelante = filasAutomaticas(e.config.varales.largoDelante, pu.distPrimeraFila ?? 0.3, pu.separacionFilas ?? 0.45);
    if (pu.filasDetras === null || pu.filasDetras === undefined) pu.filasDetras = filasAutomaticas(e.config.varales.largoDetras, pu.distPrimeraFila ?? 0.3, pu.separacionFilas ?? 0.45);
    delete pu.distPrimeraFila;
    delete pu.separacionFilas;
    e.comprobado ??= false;
    if (!e.asignacion) {
      e.asignacion = {};
      // Versión anterior: el cuadrante calculado se convierte en lo colocado
      if (e.resultado) {
        try {
          const t = construirTrono(e.resultado.datos.config, e.resultado.datos.opt.confianza);
          e.asignacion = asignacionDesdeResultado(t, e.resultado.resultado.asignacion);
          e.comprobado = true;
        } catch { /* se ignora */ }
      }
    }
    delete e.resultado;
    // Si seguían siendo los datos de ejemplo, se sustituyen por el ejemplo actual
    if (e.ejemploTrono) e.config = tronoEjemplo();
    if (e.ejemploCuadrilla) {
      const nueva = cuadrillaEjemplo();
      if (JSON.stringify(nueva) !== JSON.stringify(e.cuadrilla)) {
        e.cuadrilla = nueva;
        e.asignacion = {};
        e.comprobado = false;
      }
    }
    return e;
  } catch {
    return estadoEjemplo();
  }
}

export function guardarEstado(e: Estado) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(e));
  } catch {
    // Sin almacenamiento disponible (modo privado, cuota…): la app sigue funcionando.
  }
}
