import type { ConfigOptimizador } from '../geometria/tipos';
import { optimizadorPorDefecto } from '../io/ejemplo';
import { Casilla, Grupo, Num } from './campos';

interface Props {
  opt: ConfigOptimizador;
  cambiar: (f: (o: ConfigOptimizador) => void) => void;
  nClave: number;
  elegirEnPlanta: () => void;
}

const NIVELES = ['Nada', 'Poca', 'Media', 'Alta', 'Máxima'];

export function nivelConfianza(p: number) {
  return NIVELES[Math.round(p * 4)];
}

export function FormOptimizador({ opt, cambiar, nClave, elegirEnPlanta }: Props) {
  const c = opt.confianza;
  return (
    <div class="formulario">
      <Grupo titulo="Confianza del capataz">
        <div class="explicacion">
          <p>
            Cada HdT tiene una confianza de <strong>1 a 3</strong> (3 = máxima, lo que el capataz se fía de él).
          </p>
          <ul>
            <li>
              <strong>Puestos clave:</strong> los que tú elijas en la planta. En ellos el programa pone a la gente de más confianza
              (preferentemente confianza 3).{c.puestosClave === null && <> Mientras no elijas, se sugieren las 2 filas más exteriores de delante y de detrás y los costeros de las cuatro esquinas.</>}
            </li>
            <li>Los HdT de confianza 1 deben ir preferentemente en puestos interiores (cualquiera que no sea clave).</li>
            <li>Si sobra gente, a igualdad de reparto se deja de reserva antes a los de menor confianza.</li>
          </ul>
          <p>
            Con el control de abajo decides cuánto reparto de carga estás dispuesto a sacrificar por respetar la confianza.
            En el resultado verás cómo queda el reparto con y sin tenerla en cuenta.
          </p>
        </div>
        <label class="campo ancho">
          <span class="etiqueta">
            Prioridad de la confianza frente al reparto de carga: <strong>{nivelConfianza(opt.prioridadConfianza)}</strong>
          </span>
          <input type="range" min={0} max={1} step={0.25} value={opt.prioridadConfianza}
            onInput={(e) => cambiar((o) => (o.prioridadConfianza = Number(e.currentTarget.value)))} />
          <span class="escala">{NIVELES.map((n) => <span>{n}</span>)}</span>
        </label>
      </Grupo>

      <Grupo titulo={`Puestos clave (${nClave})`}>
        <p class="dato-calculado">
          {c.puestosClave === null ? "Sugerencia automática: 2 filas exteriores y esquinas." : "Elegidos por ti."} Tócalos en la planta para marcarlos o desmarcarlos.
        </p>
        <div class="botones">
          <button type="button" onClick={elegirEnPlanta}>Elegir en la planta</button>
          {c.puestosClave !== null && (
            <button type="button" class="secundario" onClick={() => cambiar((o) => (o.confianza.puestosClave = null))}>Volver a la sugerencia</button>
          )}
        </div>
        <Num etiqueta="Penalización confianza 2 en puesto clave" min={0} valor={c.penalConf2} onCambio={(v) => cambiar((o) => (o.confianza.penalConf2 = v))} />
        <Num etiqueta="Penalización confianza 1 en puesto clave" min={0} valor={c.penalConf1} onCambio={(v) => cambiar((o) => (o.confianza.penalConf1 = v))}
          ayuda="Relativas: con prioridad máxima, 1 equivale a desviarse 1,5 veces la carga ideal." />
      </Grupo>

      <Grupo titulo="Cálculo">
        <Num etiqueta="Inclinación delante-detrás máxima" unidad="°" min={0} max={10} valor={opt.inclinacionMaxGrados} onCambio={(v) => cambiar((o) => (o.inclinacionMaxGrados = v))} />
        <Casilla etiqueta="Permitir que vaya picado si reparte mejor" valor={opt.permitirPicado}
          onCambio={(v) => cambiar((o) => (o.permitirPicado = v))} />
        <p class="dato-calculado">
          Picado = la delantera más baja que la trasera. Por defecto nunca va picado; con voladizos distintos
          (por ejemplo, más largo detrás) nivelarlo puede costar reparto.
        </p>
        <Num etiqueta="Iteraciones de intercambio" entero min={0} max={1000000} valor={opt.iteraciones} onCambio={(v) => cambiar((o) => (o.iteraciones = v))} />
        <Num etiqueta="Diferencia máxima de hombro en una pareja espejo" unidad="cm" min={0} valor={opt.tolParejaCm} onCambio={(v) => cambiar((o) => (o.tolParejaCm = v))}
          ayuda="El trono se asigna por parejas izquierda-derecha para que no se alabee." />
        <div class="botones">
          <button type="button" class="secundario" onClick={() => cambiar((o) => Object.assign(o, optimizadorPorDefecto(), { confianza: { ...optimizadorPorDefecto().confianza, puestosClave: o.confianza.puestosClave } }))}>Restaurar valores por defecto</button>
        </div>
      </Grupo>
    </div>
  );
}
