// Cuadrante tipo «tier list»: a la izquierda la cuadrilla, a la derecha los varales (A…H)
// con sus puestos 1…N. Se arrastra a cada HdT a su sitio (o se toca a alguien y luego el puesto).

import type { ComponentChildren } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import type { HdT } from '../geometria/tipos';
import { fmt, type FilaPuesto, type Vista } from '../io/tablas';
import { mismoDestino, useArrastre, type Destino, type Origen } from './arrastre';

export type ModoCuadrante = 'colocar' | 'claves';

interface Props {
  v: Vista;
  cuadrilla: HdT[];
  resaltados: Set<string>;
  modo: ModoCuadrante;
  setModo: (m: ModoCuadrante) => void;
  onMover: (o: Origen, d: Destino) => void;
  onPrevisualizar: (o: Origen, d: Destino | null) => void;
  onClave: (codigo: string) => void;
  herramientas?: ComponentChildren;
}

/** «Antonio García López» → «Antonio García». */
export const nombreCorto = (n: string) => n.split(/\s+/).slice(0, 2).join(' ');

export function Confianza({ n }: { n: number }) {
  return (
    <span class={`conf conf-${n}`} title={`Confianza ${n}`} aria-label={`Confianza ${n}`}>
      {'●'.repeat(n)}<span class="conf-vacia">{'●'.repeat(3 - n)}</span>
    </span>
  );
}

type Orden = 'hombro' | 'nombre' | 'confianza';

export function Cuadrante({ v, cuadrilla, resaltados, modo, setModo, onMover, onPrevisualizar, onClave, herramientas }: Props) {
  const [elegido, setElegido] = useState<Origen | null>(null);
  const [filtro, setFiltro] = useState('');
  const [verTodos, setVerTodos] = useState(false);
  const [orden, setOrden] = useState<Orden>('hombro');

  const t = v.trono;
  const ubicacion = useMemo(() => {
    const m = new Map<number, FilaPuesto>();
    for (const f of v.porPuesto) if (f.hdt) m.set(f.hdt.id, f);
    return m;
  }, [v]);

  const mover = (o: Origen, d: Destino) => { setElegido(null); if (modo === 'colocar') onMover(o, d); };
  const arr = useArrastre({
    alSoltar: mover,
    alPrevisualizar: onPrevisualizar,
    alPulsar: (o) => {
      if (modo === 'claves') {
        if ('puesto' in o) { const p = t.puestos.find((q) => q.ref === o.puesto); if (p) onClave(p.codigo); }
        return;
      }
      // Tocar a alguien y luego tocar el destino
      if (elegido && !mismoDestino(elegido, o)) {
        if ('puesto' in o) return mover(elegido, o);
        if ('hdt' in o && 'puesto' in elegido) return mover(elegido, { zona: 'lista' });
      }
      const vacio = 'puesto' in o && !v.porPuesto.find((f) => f.puesto.ref === o.puesto)?.hdt;
      setElegido(mismoDestino(elegido, o) || vacio ? null : o);
    },
  });

  const lista = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    let l = cuadrilla.filter((h) => (verTodos || !ubicacion.has(h.id)) && (!q || h.nombre.toLowerCase().includes(q)));
    l = [...l].sort((a, b) =>
      orden === 'hombro' ? b.hombro - a.hombro || a.nombre.localeCompare(b.nombre, 'es')
        : orden === 'nombre' ? a.nombre.localeCompare(b.nombre, 'es')
          : b.confianza - a.confianza || b.hombro - a.hombro);
    return l;
  }, [cuadrilla, ubicacion, filtro, verTodos, orden]);

  const sinColocar = cuadrilla.length - ubicacion.size;
  const esObjetivo = (d: Destino) => mismoDestino(arr.objetivo, d);
  const esElegido = (o: Origen) => mismoDestino(elegido, o);
  const nf = t.filasDelante, nc = t.config.puestos.costerosPorLado;
  const matriz = useMemo(() => {
    const m: (FilaPuesto | null)[][] = Array.from({ length: t.numeroMax }, () => Array(t.nVarales).fill(null));
    for (const f of v.filas) m[f.puesto.numero - 1][f.puesto.varal] = f;
    return m;
  }, [v]);

  // Bloque de la mesa: una columna por varal interior; en los trabajables, sus puestos de submarino
  const bloqueMesa = () => {
    if (v.submarino.length === 0) return <div class="mesa-bloque">Mesa</div>;
    return (
      <div class="mesa-bloque con-submarino" style={{ gridTemplateColumns: `repeat(${t.nVarales - 2}, minmax(0, 1fr))` }}>
        <span class="rotulo-submarino">Submarino</span>
        {Array.from({ length: t.nVarales - 2 }, (_, k) => {
          const varal = k + 1;
          const propios = v.submarino.filter((f) => f.puesto.varal === varal).sort((a, b) => a.puesto.numero - b.puesto.numero);
          return <div class="columna-submarino">{propios.map((f) => celda(f))}</div>;
        })}
      </div>
    );
  };

  const celda = (f: FilaPuesto) => {
    const o = { puesto: f.puesto.ref };
    const clases = ['celda', `c-${f.clase}`, f.puesto.clave ? 'clave' : '', resaltados.has(f.puesto.ref) ? 'resaltado' : '',
      esObjetivo(o) ? 'objetivo' : '', esElegido(o) ? 'elegido' : ''];
    return (
      <div class={clases.join(' ')} data-puesto={f.puesto.ref} tabIndex={0} role="button"
        aria-label={`${f.puesto.codigo}: ${f.hdt ? `${f.hdt.nombre}, ${fmt(f.hdt.hombro)} cm` : 'vacío'}${f.carga !== null ? `, ${fmt(f.carga)} kg` : ''}`}
        onPointerDown={(e) => {
          if (modo === 'colocar' && f.hdt) arr.empezar(e as unknown as PointerEvent, o, nombreCorto(f.hdt.nombre));
          else arr.empezar(e as unknown as PointerEvent, o, '');
        }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); arrPulsar(o); } }}>
        <span class="c-codigo">{f.puesto.codigo}</span>
        {f.hdt && (
          <>
            <span class="c-nombre">{nombreCorto(f.hdt.nombre)}</span>
            <span class="c-datos">{fmt(f.hdt.hombro)} <Confianza n={f.hdt.confianza} /></span>
            {f.carga !== null && <span class={`c-carga t-${f.clase}`}>{fmt(f.carga, 0)} kg</span>}
          </>
        )}
      </div>
    );
  };
  // Accesible con teclado: Enter hace lo mismo que tocar
  const arrPulsar = (o: Origen) => {
    const fake = { button: 0, pointerType: 'mouse', clientX: 0, clientY: 0, preventDefault() {} } as unknown as PointerEvent;
    arr.empezar(fake, o, '');
    window.dispatchEvent(new PointerEvent('pointerup'));
  };

  return (
    <div class={`tablero modo-${modo}`}>
      <aside class="gente" data-zona="lista" aria-label="Cuadrilla">
        <div class="gente-cabecera">
          <strong>Cuadrilla</strong>
          <span class="nota">{sinColocar} sin colocar</span>
        </div>
        <input type="search" placeholder="Buscar" value={filtro} onInput={(e) => setFiltro(e.currentTarget.value)} />
        <div class="gente-filtros">
          <div class="segmentado pequeno">
            <button type="button" class={!verTodos ? 'activo' : ''} onClick={() => setVerTodos(false)}>Sin colocar</button>
            <button type="button" class={verTodos ? 'activo' : ''} onClick={() => setVerTodos(true)}>Todos</button>
          </div>
          <select value={orden} aria-label="Ordenar" onChange={(e) => setOrden(e.currentTarget.value as Orden)}>
            <option value="hombro">Por hombro</option>
            <option value="nombre">Por nombre</option>
            <option value="confianza">Por confianza</option>
          </select>
        </div>
        <ul class="gente-lista">
          {lista.map((h) => {
            const donde = ubicacion.get(h.id);
            const o = { hdt: h.id };
            return (
              <li class={`persona${donde ? ' colocada' : ''}${esElegido(o) ? ' elegido' : ''}`} data-hdt={h.id}
                tabIndex={0} role="button" aria-label={`${h.nombre}, ${fmt(h.hombro)} cm, confianza ${h.confianza}`}
                onPointerDown={(e) => arr.empezar(e as unknown as PointerEvent, o, nombreCorto(h.nombre))}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); arrPulsar(o); } }}>
                <span class="p-nombre">{h.nombre}</span>
                <span class="p-datos">
                  {donde && <span class="p-donde">{donde.puesto.codigo}</span>}
                  <span class="p-hombro">{fmt(h.hombro)}</span>
                  <Confianza n={h.confianza} />
                </span>
              </li>
            );
          })}
          {lista.length === 0 && <li class="vacio-lista">{sinColocar === 0 ? 'Todos colocados' : 'Nadie coincide'}</li>}
        </ul>
      </aside>

      <section class="mesa-trabajo">
        <div class="barra-planta">
          <div class="segmentado" role="radiogroup" aria-label="Modo">
            <button type="button" role="radio" aria-checked={modo === 'colocar'} class={modo === 'colocar' ? 'activo' : ''} onClick={() => setModo('colocar')}>Colocar</button>
            <button type="button" role="radio" aria-checked={modo === 'claves'} class={modo === 'claves' ? 'activo' : ''} onClick={() => setModo('claves')}>
              Puestos clave <span class="contador">{t.puestos.filter((p) => p.clave).length}</span>
            </button>
          </div>
          <div class="herramientas">{herramientas}</div>
        </div>
        <p class="pista">
          {modo === 'claves'
            ? 'Toca los puestos que consideres clave (anillo dorado).'
            : elegido
              ? 'Ahora toca el puesto donde quieres ponerlo (o la lista para quitarlo).'
              : 'Arrastra a cada HdT a su puesto, o tócalo y luego toca el puesto. Arrastra un puesto a la lista para dejarlo libre.'}
        </p>
        <div class="rejilla-varales">
          <table class="cuadrante">
            <thead>
              <tr><th class="n" />{t.letras.map((l) => <th>{l}</th>)}</tr>
            </thead>
            <tbody>
              {[
                ...matriz.slice(0, nf),
                ...(nc === 0 && v.submarino.length > 0 ? [null] : []),
                ...matriz.slice(nf),
              ].map((fila) => {
                if (fila === null) {
                  return (
                    <tr class="z-mesa limite">
                      <th class="n" />
                      <td class="cortado" />
                      <td class="hueco-mesa" colSpan={t.nVarales - 2}>{bloqueMesa()}</td>
                      <td class="cortado" />
                    </tr>
                  );
                }
                const i = matriz.indexOf(fila);
                const numero = i + 1;
                const zona = numero <= nf ? 'delante' : numero <= nf + nc ? 'mesa' : 'detras';
                const limite = numero === nf + 1 || numero === nf + nc + 1 ? ' limite' : '';
                return (
                  <tr class={`z-${zona}${limite}`}>
                    <th class="n">{numero}</th>
                    {fila.map((f, vIdx) => {
                      if (f) return <td>{celda(f)}</td>;
                      // Interior de la mesa: un único bloque
                      if (zona === 'mesa' && vIdx === 1 && numero === nf + 1) {
                        return <td class="hueco-mesa" colSpan={t.nVarales - 2} rowSpan={nc}>{bloqueMesa()}</td>;
                      }
                      if (zona === 'mesa' && vIdx > 0 && vIdx < t.nVarales - 1) return null;
                      return <td class="cortado" />;
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      {arr.fantasma}
    </div>
  );
}
