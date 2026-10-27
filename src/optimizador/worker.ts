// Web Worker: comprueba al momento lo que el capataz coloca y, si se le pide, rellena los
// huecos con el optimizador (con barra de progreso).

import type { ConfigOptimizador, ConfigTrono, HdT, Trono } from '../geometria/tipos';
import { construirTrono } from '../geometria/trono';
import { construirModelo, type Modelo } from '../fem/modelo';
import { precalcularRapido, type SolverRapido } from '../fem/rapido';
import { estudiarVarales, type EstudioVarales } from './longitud';
import { calcularCuadrante, evaluarAsignacion, type Resultado } from './optimizar';

export type MensajeEntrada =
  | { tipo: 'rellenar'; config: ConfigTrono; cuadrilla: HdT[]; opt: ConfigOptimizador; colocados: number[] }
  | { tipo: 'evaluar'; id: number; config: ConfigTrono; cuadrilla: HdT[]; opt: ConfigOptimizador; asignacion: number[] }
  | { tipo: 'longitud'; config: ConfigTrono; cuadrilla: HdT[] };

export type MensajeSalida =
  | { tipo: 'progreso'; fraccion: number; texto: string }
  | { tipo: 'resultado'; resultado: Resultado }
  | { tipo: 'evaluado'; id: number; resultado: Resultado }
  | { tipo: 'longitud'; estudio: EstudioVarales }
  | { tipo: 'error'; mensaje: string; id?: number };

const enviar = (m: MensajeSalida) => (self as unknown as Worker).postMessage(m);

// El modelo se reutiliza mientras no cambien la geometría ni los puestos clave.
let cache: { clave: string; t: Trono; m: Modelo; rapido: SolverRapido } | null = null;

self.onmessage = (e: MessageEvent<MensajeEntrada>) => {
  const d = e.data;
  if (d.tipo === 'evaluar') {
    try {
      const clave = JSON.stringify([d.config, d.opt.confianza.puestosClave]);
      if (!cache || cache.clave !== clave) {
        const t = construirTrono(d.config, d.opt.confianza);
        const m = construirModelo(t);
        cache = { clave, t, m, rapido: precalcularRapido(m) };
      }
      enviar({ tipo: 'evaluado', id: d.id, resultado: evaluarAsignacion(d.config, d.cuadrilla, d.opt, d.asignacion, cache) });
    } catch (err) {
      enviar({ tipo: 'error', id: d.id, mensaje: err instanceof Error ? err.message : String(err) });
    }
    return;
  }
  if (d.tipo === 'longitud') {
    try {
      const estudio = estudiarVarales(d.config, d.cuadrilla, (fraccion) => enviar({ tipo: 'progreso', fraccion, texto: 'Probando largos de varal…' }));
      enviar({ tipo: 'longitud', estudio });
    } catch (err) {
      enviar({ tipo: 'error', mensaje: err instanceof Error ? err.message : String(err) });
    }
    return;
  }
  let ultimo = -1;
  try {
    const resultado = calcularCuadrante(d.config, d.cuadrilla, d.opt, (fraccion, texto) => {
      if (fraccion - ultimo >= 0.01 || fraccion >= 1) {
        ultimo = fraccion;
        enviar({ tipo: 'progreso', fraccion, texto });
      }
    }, d.colocados);
    enviar({ tipo: 'resultado', resultado });
  } catch (err) {
    enviar({ tipo: 'error', mensaje: err instanceof Error ? err.message : String(err) });
  }
};
