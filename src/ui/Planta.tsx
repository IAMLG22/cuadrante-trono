// Planta del trono en SVG: mesa, varales, quitacimbres y puestos coloreados por carga.
// - Modo «Mover»: se arrastra un puesto sobre otro para intercambiarlos.
// - Modo «Puestos clave»: al tocar un puesto se marca o desmarca como clave.

import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { fmt, NOMBRE_CLASE, type ClaseCarga, type Vista } from '../io/tablas';
import { mismoDestino, useArrastre, type Destino, type Origen } from './arrastre';

const CLASES: ClaseCarga[] = ['bien', 'baja', 'alta', 'nocarga'];

export type ModoPlanta = 'mover' | 'claves';

export function Leyenda() {
  return (
    <div class="leyenda">
      {CLASES.map((c) => (
        <span><i class={`muestra c-${c}`} />{NOMBRE_CLASE[c]}</span>
      ))}
      <span><i class="muestra anillo" />Clave</span>
    </div>
  );
}

interface Props {
  v: Vista;
  resaltados: Set<string>;
  modo: ModoPlanta;
  setModo: (m: ModoPlanta) => void;
  onClave: (codigo: string) => void;
  onMover: (o: Origen, d: Destino) => void;
  onPrevisualizar: (o: Origen, d: Destino | null) => void;
  herramientas?: ComponentChildren;
}

export function Planta({ v, resaltados, modo, setModo, onClave, onMover, onPrevisualizar, herramientas }: Props) {
  const t = v.trono;
  const [sel, setSel] = useState<string | null>(null);
  // Orientación automática según el ancho disponible, salvo que se gire a mano
  const [giro, setGiro] = useState<'auto' | 'h' | 'v'>('auto');
  const [ancho, setAncho] = useState(0);
  const marco = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = marco.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setAncho(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const horizontal = giro === 'h' || (giro === 'auto' && ancho >= 900);

  const arr = useArrastre({
    alSoltar: (o, d) => { if (modo === 'mover' && 'puesto' in d) onMover(o, d); },
    alPrevisualizar: (o, d) => onPrevisualizar(o, d && 'puesto' in d ? d : null),
    alPulsar: (o) => {
      if (!('puesto' in o)) return;
      const p = t.puestos.find((q) => q.ref === o.puesto);
      if (modo === 'claves') { if (p) onClave(p.codigo); }
      else setSel(sel === o.puesto ? null : o.puesto);
    },
  });

  const c = t.config;
  const L = c.mesa.largo, B = c.mesa.ancho;
  const xPuntaDel = L / 2 + c.varales.largoDelante, xPuntaDet = -L / 2 - c.varales.largoDetras;
  const xMax = xPuntaDel + c.varales.cabezas.delante.longitud, xMin = xPuntaDet - c.varales.cabezas.detras.longitud;
  const m = 0.75;
  // Proyección: horizontal = delante a la derecha (A arriba); vertical = delante arriba (A a la izquierda)
  const P = (x: number, y: number): [number, number] => (horizontal ? [x, -y] : [-y, -x]);
  const vb = horizontal
    ? [xMin - m, -B / 2 - m, xMax - xMin + 2 * m, B + 2 * m]
    : [-B / 2 - m, -xMax - m, B + 2 * m, xMax - xMin + 2 * m];
  const linea = (x1: number, y1: number, x2: number, y2: number) => {
    const [a, b] = P(x1, y1), [cc, d] = P(x2, y2);
    return { x1: a, y1: b, x2: cc, y2: d };
  };
  const [mx, my] = P(L / 2, B / 2);
  const [mx2, my2] = P(-L / 2, -B / 2);
  const [fx, fy] = P(xMax + 0.62, 0);
  const [fx2, fy2] = P(xMax + 0.12, 0);
  const ficha = sel ? v.porPuesto.find((f) => f.puesto.ref === sel && f.hdt) : null;
  const r = v.resultado;

  return (
    <div class={`planta modo-${modo}`}>
      <div class="barra-planta">
        <div class="segmentado" role="radiogroup" aria-label="Modo de la planta">
          <button type="button" role="radio" aria-checked={modo === 'mover'} class={modo === 'mover' ? 'activo' : ''} onClick={() => setModo('mover')}>Mover</button>
          <button type="button" role="radio" aria-checked={modo === 'claves'} class={modo === 'claves' ? 'activo' : ''} onClick={() => setModo('claves')}>
            Puestos clave <span class="contador">{t.puestos.filter((p) => p.clave).length}</span>
          </button>
        </div>
        <div class="herramientas">
          {herramientas}
          <button type="button" class="icono" title="Girar la planta" aria-label="Girar la planta" onClick={() => setGiro(horizontal ? 'v' : 'h')}>⤾</button>
        </div>
      </div>
      <p class="pista">
        {modo === 'claves' ? 'Toca los puestos que consideres clave.' : 'Arrastra un puesto sobre otro para intercambiarlos. Toca uno para ver su ficha.'}
      </p>

      <div class="lienzo-marco" ref={marco}>
        <div class={`lienzo ${horizontal ? 'horizontal' : 'vertical'}`}>
          <svg viewBox={vb.join(' ')} role="img" aria-label="Planta del trono">
            <defs>
              <marker id="punta" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" class="punta-flecha" />
              </marker>
            </defs>
            <rect class="mesa" x={Math.min(mx, mx2)} y={Math.min(my, my2)} width={Math.abs(mx - mx2)} height={Math.abs(my - my2)} rx={0.06} />
            {t.yVarales.map((y, i) => {
              const [ax, ay] = P(xMax + 0.32, y);
              const [bx, by] = P(xMin - 0.32, y);
              return (
                <g>
                  <line class="varal" {...linea(xPuntaDet, y, xPuntaDel, y)} />
                  {c.varales.cabezas.delante.longitud > 0 && <line class="cabeza" {...linea(xPuntaDel, y, xMax, y)} />}
                  {c.varales.cabezas.detras.longitud > 0 && <line class="cabeza" {...linea(xMin, y, xPuntaDet, y)} />}
                  <text class="letra" x={ax} y={ay}>{t.letras[i]}</text>
                  <text class="letra" x={bx} y={by}>{t.letras[i]}</text>
                </g>
              );
            })}
            {c.quitacimbres.activo && [xPuntaDel - c.quitacimbres.distDelante, xPuntaDet + c.quitacimbres.distDetras].map((x) => (
              <line class="quitacimbre" {...linea(x, t.yVarales[0], x, t.yVarales[t.nVarales - 1])} />
            ))}
            <line class="flecha" x1={fx2} y1={fy2} x2={fx} y2={fy} marker-end="url(#punta)" />
            {v.porPuesto.map((f) => {
              const p = f.puesto;
              const [x, y] = P(p.x, p.y);
              const o = { puesto: p.ref };
              const clases = ['puesto', `c-${f.clase}`, p.clave ? 'clave' : '', sel === p.ref ? 'sel' : '',
                mismoDestino(arr.objetivo, o) ? 'objetivo' : '', resaltados.has(p.ref) ? 'resaltado' : ''];
              return (
                <g class={clases.join(' ')} data-puesto={p.ref}
                  onPointerDown={(e) => arr.empezar(e as unknown as PointerEvent, o, f.hdt ? `${f.hdt.nombre} · ${fmt(f.hdt.hombro)} cm` : '')}
                  role="button" tabIndex={0}
                  aria-label={`${p.codigo}${f.hdt ? `: ${f.hdt.nombre}` : ', vacío'}${f.carga !== null ? `, ${fmt(f.carga)} kg` : ''}${p.clave ? ', puesto clave' : ''}`}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' && e.key !== ' ') return;
                    e.preventDefault();
                    if (modo === 'claves') onClave(p.codigo);
                    else setSel(p.ref);
                  }}>
                  {resaltados.has(p.ref) && <circle class="halo" cx={x} cy={y} r={0.27} />}
                  {p.clave && <circle class="aro" cx={x} cy={y} r={0.215} />}
                  <circle class="disco" cx={x} cy={y} r={0.16} />
                  <text x={x} y={y}>{p.codigo}</text>
                </g>
              );
            })}
          </svg>
        </div>

        {ficha && ficha.hdt && (
          <div class="ficha" aria-live="polite">
            <button type="button" class="icono cerrar" aria-label="Cerrar ficha" onClick={() => setSel(null)}>×</button>
            <span class="ficha-codigo">
              {ficha.puesto.codigo}
              {ficha.puesto.clave && <span class="ficha-clave">clave</span>}
            </span>
            <span class="ficha-nombre">{ficha.hdt.nombre}</span>
            {ficha.carga !== null && r && (
              <span class={`ficha-carga t-${ficha.clase}`}>{fmt(ficha.carga)} kg <small>{fmt((100 * ficha.carga) / r.cargaIdeal, 0)} %</small></span>
            )}
            <span class="ficha-dato">
              Hombro {fmt(ficha.hdt.hombro)} cm{r && ficha.carga !== null ? ` · ideal aquí ${fmt(r.hombroIdealCm[ficha.puesto.idx])} cm` : ''}
            </span>
            <span class="ficha-dato">Confianza {ficha.hdt.confianza}</span>
          </div>
        )}
      </div>

      <div class="pie-planta">{r && <Leyenda />}</div>
      {arr.fantasma}
    </div>
  );
}
