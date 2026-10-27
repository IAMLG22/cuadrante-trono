// Apartado «Configuración»: pantalla completa para el trono, la cuadrilla y la confianza.

import type { ConfigOptimizador, ConfigTrono, HdT, Trono } from '../geometria/tipos';
import { FormCuadrilla } from './FormCuadrilla';
import { FormOptimizador } from './FormOptimizador';
import { FormSubmarino } from './FormSubmarino';
import { FormTrono } from './FormTrono';
import { Histograma } from './Histograma';
import { VistaTrono } from './VistaTrono';

export type PestanaConfig = 'trono' | 'submarino' | 'cuadrilla' | 'confianza';

interface Props {
  pestana: PestanaConfig;
  setPestana: (p: PestanaConfig) => void;
  config: ConfigTrono;
  cambiarConfig: (f: (c: ConfigTrono) => void) => void;
  trono: Trono | null;
  errores: string[];
  cuadrilla: HdT[];
  cambiarCuadrilla: (c: HdT[]) => void;
  cargarCuadrillaEjemplo: () => void;
  opt: ConfigOptimizador;
  cambiarOpt: (f: (o: ConfigOptimizador) => void) => void;
  esEjemploTrono: boolean;
  esEjemploCuadrilla: boolean;
  cargarTronoEjemplo: () => void;
  borrarTodo: () => void;
  elegirClaves: () => void;
}

export function Configuracion(p: Props) {
  const nPuestos = p.trono?.puestos.length ?? 0;
  const nSub = p.trono?.puestos.filter((q) => q.zona === 'submarino').length ?? 0;
  const pestanas: [PestanaConfig, string][] = [
    ['trono', 'Trono'], ['submarino', nSub ? `Submarino · ${nSub}` : 'Submarino'],
    ['cuadrilla', `Cuadrilla · ${p.cuadrilla.length}`], ['confianza', 'Confianza'],
  ];
  return (
    <div class="configuracion">
      <div class="config-cabecera">
        <nav class="pestanas" role="tablist">
          {pestanas.map(([k, t]) => (
            <button type="button" role="tab" aria-selected={p.pestana === k} class={p.pestana === k ? 'activa' : ''} onClick={() => p.setPestana(k)}>{t}</button>
          ))}
        </nav>
        <div class="config-acciones">
          {p.pestana === 'trono' && (
            <button type="button" class="enlace" onClick={p.cargarTronoEjemplo}>{p.esEjemploTrono ? 'Trono de ejemplo' : 'Volver al trono de ejemplo'}</button>
          )}
          <button type="button" class="enlace" onClick={p.borrarTodo}>Borrar todo</button>
        </div>
      </div>

      {p.errores.length > 0 && <div class="aviso mal">{p.errores.map((e) => <p>{e}</p>)}</div>}

      {p.pestana === 'trono' && (
        <div class="config-trono">
          <div class="config-formularios">
            {p.esEjemploTrono && <p class="nota">Es un trono de ejemplo: cambia las medidas por las del tuyo. Todo se guarda solo en este navegador.</p>}
            <FormTrono config={p.config} cambiar={p.cambiarConfig} nPuestos={nPuestos} />
          </div>
          <aside class="config-vista">
            {p.trono ? <VistaTrono t={p.trono} /> : <p class="vacio">Corrige los datos para ver el trono.</p>}
          </aside>
        </div>
      )}

      {p.pestana === 'submarino' && (
        <div class="config-trono">
          <div class="config-formularios">
            <FormSubmarino config={p.config} cambiar={p.cambiarConfig} />
          </div>
          <aside class="config-vista">
            {p.trono ? <VistaTrono t={p.trono} /> : <p class="vacio">Corrige los datos para ver el trono.</p>}
          </aside>
        </div>
      )}

      {p.pestana === 'cuadrilla' && (
        <div class="config-cuadrilla">
          <aside class="config-vista">
            <Histograma cuadrilla={p.cuadrilla} />
          </aside>
          <div class="config-formularios">
            <FormCuadrilla cuadrilla={p.cuadrilla} nPuestos={nPuestos} esEjemplo={p.esEjemploCuadrilla}
              cambiar={p.cambiarCuadrilla} cargarEjemplo={p.cargarCuadrillaEjemplo} />
          </div>
        </div>
      )}

      {p.pestana === 'confianza' && (
        <div class="config-confianza">
          <FormOptimizador opt={p.opt} cambiar={p.cambiarOpt} nClave={p.trono?.puestos.filter((q) => q.clave).length ?? 0} elegirEnPlanta={p.elegirClaves} />
        </div>
      )}
    </div>
  );
}
