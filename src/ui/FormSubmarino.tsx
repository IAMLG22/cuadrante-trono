// Configuración del submarino: qué varales interiores trabajan y cuántas personas van en cada uno.

import type { ConfigTrono } from '../geometria/tipos';
import { LETRAS, varalesSubmarino } from '../geometria/trono';
import { fmt } from '../io/tablas';
import { Grupo, Num } from './campos';

interface Props {
  config: ConfigTrono;
  cambiar: (f: (c: ConfigTrono) => void) => void;
}

export function FormSubmarino({ config: c, cambiar }: Props) {
  const n = c.varales.numero;
  const interiores = Array.from({ length: n - 2 }, (_, k) => k + 1);
  const elegidos = new Set(varalesSubmarino(c));
  const total = elegidos.size * c.submarino.porVaral;
  const alternar = (v: number) =>
    cambiar((c) => {
      const s = new Set(c.submarino.varales.filter((x) => x > 0 && x < n - 1));
      if (s.has(v)) s.delete(v); else s.add(v);
      c.submarino.varales = [...s].sort((a, b) => a - b);
    });
  return (
    <div class="formulario">
      <Grupo titulo="Varales trabajables">
        <p class="dato-calculado">
          Marca los varales interiores en los que va gente debajo de la mesa. Con {n} varales pueden trabajar como mucho {n - 2}
          {' '}({LETRAS[1]} a {LETRAS[n - 2]}).
        </p>
        <div class="varales-trabajables" role="group" aria-label="Varales trabajables">
          {interiores.map((v) => (
            <button type="button" class={`varal-chip${elegidos.has(v) ? ' activo' : ''}`} aria-pressed={elegidos.has(v)} onClick={() => alternar(v)}>
              {LETRAS[v]}
            </button>
          ))}
        </div>
        <Num etiqueta="Personas por varal" entero min={0} max={20} valor={c.submarino.porVaral}
          ayuda={c.submarino.porVaral > 0 ? `Una cada ${fmt(c.mesa.largo / c.submarino.porVaral, 2)} m a lo largo de la mesa.` : undefined}
          onCambio={(v) => cambiar((c) => (c.submarino.porVaral = v))} />
        <p class="dato-calculado">
          {total > 0
            ? <>Submarino: <strong>{total} puestos</strong> ({[...elegidos].map((v) => LETRAS[v]).join(', ')}).</>
            : 'Sin submarino.'}
        </p>
      </Grupo>
      <Grupo titulo="Cómo se rellena">
        <p class="dato-calculado">
          Sus puestos se rellenan como el resto: arrastrando a la gente en el cuadrante o con «Rellenar huecos», que pone
          debajo a quien mejor encaje por altura. A los que hayas colocado tú, los respeta.
        </p>
        <p class="dato-calculado">
          En el cálculo, la gente del submarino apoya en la mesa y carga como cualquier otro: cuanta más gente haya debajo,
          menos llevan los demás. En el cuadrante aparecen dentro de la mesa, en la columna de su varal (C-S1, C-S2…).
        </p>
      </Grupo>
    </div>
  );
}
