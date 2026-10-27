// Vista preparada para imprimir: solo aparece al imprimir (ver estilos @media print).

import { fmt, type Vista } from '../io/tablas';
import { Listas, PorVaral } from './Tablas';

export function Impresion({ v, esEjemplo }: { v: Vista; esEjemplo: boolean }) {
  const r = v.resultado;
  const c = v.trono.config;
  return (
    <div class="solo-imprimir">
      <h1>Cuadrante de trono {esEjemplo && <small>(datos de ejemplo)</small>}</h1>
      <p>
        {new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })} · Mesa {fmt(c.mesa.largo, 2)} × {fmt(c.mesa.ancho, 2)} m ·{' '}
        {v.trono.nVarales} varales · {v.porPuesto.length} puestos
        {r && (
          <> · {fmt(r.pesoTotal, 0)} kg · ideal {fmt(r.cargaIdeal)} kg/persona · carga {fmt(r.resumen.min)}–{fmt(r.resumen.max)} kg ·
            {' '}{r.resumen.dentro25} dentro de ±25 % · {r.resumen.noLlegan} no llegan · inclinación {fmt(r.inclinacionGrados, 2)}°</>
        )}
      </p>
      <h2>Cuadrante</h2>
      <PorVaral v={v} conCarga={false} />
      <Listas v={v} />
    </div>
  );
}
