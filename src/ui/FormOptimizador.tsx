import type { ConfigOptimizador } from '../geometria/tipos';
import { optimizadorPorDefecto } from '../io/ejemplo';
import { Casilla, Grupo, Num } from './campos';

interface Props {
  opt: ConfigOptimizador;
  cambiar: (f: (o: ConfigOptimizador) => void) => void;
}

export function FormOptimizador({ opt, cambiar }: Props) {
  return (
    <div class="formulario">
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
          <button type="button" class="secundario" onClick={() => cambiar((o) => Object.assign(o, optimizadorPorDefecto()))}>Restaurar valores por defecto</button>
        </div>
      </Grupo>
    </div>
  );
}
