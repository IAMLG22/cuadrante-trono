// Lista ordenable de puestos, tabla por varal (para imprimir) y lista de reserva.

import { useState } from 'preact/hooks';
import { fmt, matrizPorVaral, ordenPuesto, type FilaPuesto, type Vista } from '../io/tablas';

type Columna = 'puesto' | 'nombre' | 'hombro' | 'confianza' | 'carga';

const COLUMNAS: [Columna, string][] = [
  ['puesto', 'Puesto'], ['nombre', 'Nombre'], ['hombro', 'Hombro'], ['confianza', 'Confianza'], ['carga', 'Carga'],
];

function comparar(col: Columna) {
  const num = (x: number | null | undefined) => x ?? -Infinity;
  return (a: FilaPuesto, b: FilaPuesto): number => {
    switch (col) {
      case 'puesto': return ordenPuesto(a.puesto, b.puesto) || num(b.hdt?.hombro) - num(a.hdt?.hombro);
      case 'nombre': return (a.hdt?.nombre ?? '￿').localeCompare(b.hdt?.nombre ?? '￿', 'es');
      case 'hombro': return num(a.hdt?.hombro) - num(b.hdt?.hombro);
      case 'confianza': return num(a.hdt?.confianza) - num(b.hdt?.confianza);
      case 'carga': return num(a.carga) - num(b.carga);
    }
  };
}

export function Lista({ v }: { v: Vista }) {
  const [col, setCol] = useState<Columna>('puesto');
  const [asc, setAsc] = useState(true);
  const filas = [...v.porPuesto].sort(comparar(col));
  if (!asc) filas.reverse();
  return (
    <div class="tabla-desplazable alta">
      <table class="tabla lista">
        <thead>
          <tr>
            {COLUMNAS.map(([c, t]) => (
              <th class={c === 'hombro' || c === 'confianza' || c === 'carga' ? 'num' : ''} aria-sort={col === c ? (asc ? 'ascending' : 'descending') : 'none'}>
                <button type="button" class="orden" onClick={() => (col === c ? setAsc(!asc) : (setCol(c), setAsc(true)))}>
                  {t} {col === c ? (asc ? '▲' : '▼') : ''}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr class={`${f.puesto.clave ? 'fila-clave' : ''}${f.hdt ? '' : ' fila-vacia'}`}>
              <td class="codigo">{f.puesto.codigo}</td>
              <td>{f.hdt?.nombre ?? 'Vacío'}</td>
              <td class="num">{f.hdt ? fmt(f.hdt.hombro) : ''}</td>
              <td class="num">{f.hdt?.confianza ?? ''}</td>
              <td class={`num carga c-${f.clase}`}>{f.carga !== null ? `${fmt(f.carga)} kg` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PorVaral({ v, conCarga = true }: { v: Vista; conCarga?: boolean }) {
  const m = matrizPorVaral(v);
  const t = v.trono;
  return (
    <table class="tabla por-varal">
      <thead>
        <tr><th class="n">Nº</th>{t.letras.map((l) => <th>{l}</th>)}</tr>
      </thead>
      <tbody>
        {m.map((fila, i) => (
          <tr>
            <th class="n">{i + 1}</th>
            {fila.map((f) =>
              !f ? <td class="cortado">—</td> : (
                <td class={f.puesto.clave ? 'clave' : ''}>
                  <span class="nombre">{f.hdt?.nombre ?? ''}</span>
                  {f.hdt && (
                    <span class="detalle">
                      {fmt(f.hdt.hombro)} cm · C{f.hdt.confianza}
                      {conCarga && f.carga !== null && <> · {fmt(f.carga, 0)} kg</>}
                    </span>
                  )}
                </td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Listas({ v }: { v: Vista }) {
  return (
    <div class="listas">
      <section>
        <h3>Reserva ({v.reservas.length})</h3>
        <table class="tabla">
          <thead><tr><th>Nombre</th><th class="num">Hombro</th><th class="num">Confianza</th></tr></thead>
          <tbody>
            {v.reservas.map((h) => (
              <tr><td>{h.nombre}</td><td class="num">{fmt(h.hombro)}</td><td class="num">{h.confianza}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
