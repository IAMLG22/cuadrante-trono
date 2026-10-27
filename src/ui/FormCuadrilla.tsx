import { useState } from 'preact/hooks';
import type { HdT } from '../geometria/tipos';
import { importarCuadrilla, numero } from '../io/csv';
import { fmt } from '../io/tablas';

interface Props {
  cuadrilla: HdT[];
  nPuestos: number;
  esEjemplo: boolean;
  cambiar: (c: HdT[]) => void;
  cargarEjemplo: () => void;
}

const renumerar = (c: HdT[]) => c.map((h, i) => ({ ...h, id: i + 1 }));

export function FormCuadrilla({ cuadrilla, nPuestos, esEjemplo, cambiar, cargarEjemplo }: Props) {
  const [pegado, setPegado] = useState('');
  const [avisos, setAvisos] = useState<string[]>([]);
  const [filtro, setFiltro] = useState('');

  const importar = (texto: string) => {
    const r = importarCuadrilla(texto);
    if (r.cuadrilla.length === 0) {
      setAvisos(['No se ha podido leer ningún HdT. Revisa que las columnas sean: Nombre, Altura de hombro (cm), Confianza (1–3).', ...r.avisos]);
      return;
    }
    cambiar(renumerar(r.cuadrilla));
    setAvisos([`Importados ${r.cuadrilla.length} HdT.`, ...r.avisos]);
    setPegado('');
  };

  const hombros = cuadrilla.map((h) => h.hombro);
  const porConf = [1, 2, 3].map((k) => cuadrilla.filter((h) => h.confianza === k).length);
  const diferencia = cuadrilla.length - nPuestos;
  const editar = (id: number, f: (h: HdT) => HdT) => cambiar(cuadrilla.map((h) => (h.id === id ? f(h) : h)));
  const visibles = filtro ? cuadrilla.filter((h) => h.nombre.toLowerCase().includes(filtro.toLowerCase())) : cuadrilla;

  return (
    <div class="formulario">
      <div class={`estado-cuadrilla ${diferencia < 0 ? 'mal' : 'bien'}`}>
        <strong>{cuadrilla.length} HdT</strong> para <strong>{nPuestos} puestos</strong>
        {diferencia < 0 && <> · Faltan {-diferencia}</>}
        {diferencia > 0 && <> · {diferencia} quedarán de reserva</>}
        {esEjemplo && <span class="etiqueta-ejemplo">Datos de ejemplo</span>}
      </div>
      {cuadrilla.length > 0 && (
        <p class="dato-calculado">
          Hombros de {fmt(Math.min(...hombros))} a {fmt(Math.max(...hombros))} cm · Confianza 3: {porConf[2]} · 2: {porConf[1]} · 1: {porConf[0]}
        </p>
      )}

      <details class="tarjeta plegable" open={esEjemplo}>
        <summary>Importar cuadrilla</summary>
        <div class="bloque">
          <p class="ayuda">
            Columnas: <strong>Nombre</strong>, <strong>Altura de hombro (cm)</strong>, <strong>Confianza (1–3)</strong>.
            Puedes copiar las tres columnas desde Excel y pegarlas aquí, o abrir un archivo CSV. La importación sustituye a la cuadrilla actual.
          </p>
          <textarea rows={5} placeholder={'Nombre\tHombro\tConfianza\nJuan Pérez\t155,5\t3'} value={pegado} onInput={(e) => setPegado(e.currentTarget.value)} />
          <div class="botones">
            <button type="button" disabled={!pegado.trim()} onClick={() => importar(pegado)}>Importar lo pegado</button>
            <label class="boton">
              Abrir CSV…
              <input type="file" accept=".csv,.txt,.tsv,text/csv,text/plain" hidden
                onChange={async (e) => {
                  const f = e.currentTarget.files?.[0];
                  if (f) importar(await f.text());
                  e.currentTarget.value = '';
                }} />
            </label>
            <button type="button" class="secundario" onClick={cargarEjemplo}>Cargar cuadrilla de ejemplo</button>
          </div>
          {avisos.length > 0 && (
            <ul class="avisos">
              {avisos.slice(0, 12).map((a) => <li>{a}</li>)}
              {avisos.length > 12 && <li>… y {avisos.length - 12} avisos más.</li>}
            </ul>
          )}
        </div>
      </details>

      <div class="barra-lista">
        <input type="search" placeholder="Buscar por nombre" value={filtro} onInput={(e) => setFiltro(e.currentTarget.value)} />
        <button type="button" onClick={() => cambiar(renumerar([...cuadrilla, { id: 0, nombre: `HdT ${cuadrilla.length + 1}`, hombro: 125, confianza: 2 }]))}>
          Añadir HdT
        </button>
        <button type="button" class="secundario" disabled={cuadrilla.length === 0}
          onClick={() => confirm('¿Borrar toda la cuadrilla?') && cambiar([])}>Vaciar</button>
      </div>
      <div class="tabla-desplazable alta">
        <table class="tabla editable">
          <thead>
            <tr><th>Nombre</th><th>Hombro (cm)</th><th>Conf.</th><th aria-label="Quitar" /></tr>
          </thead>
          <tbody>
            {visibles.map((h) => (
              <tr key={h.id}>
                <td><input type="text" value={h.nombre} aria-label="Nombre" onChange={(e) => editar(h.id, (x) => ({ ...x, nombre: e.currentTarget.value }))} /></td>
                <td>
                  <input type="text" inputMode="decimal" class="corto" aria-label="Hombro" value={String(h.hombro).replace('.', ',')}
                    onChange={(e) => {
                      const v = numero(e.currentTarget.value);
                      if (v > 50 && v < 250) editar(h.id, (x) => ({ ...x, hombro: v }));
                      else e.currentTarget.value = String(h.hombro).replace('.', ',');
                    }} />
                </td>
                <td>
                  <select value={h.confianza} aria-label="Confianza" onChange={(e) => editar(h.id, (x) => ({ ...x, confianza: Number(e.currentTarget.value) as 1 | 2 | 3 }))}>
                    <option value={3}>3</option><option value={2}>2</option><option value={1}>1</option>
                  </select>
                </td>
                <td><button type="button" class="icono" title="Quitar" onClick={() => cambiar(renumerar(cuadrilla.filter((x) => x.id !== h.id)))}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
