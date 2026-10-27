// Calculadora «¿Son óptimos tus varales?»: alarga o acorta a la vez los voladizos de delante y de
// detrás con una cuadrilla de tus mismas alturas y dice si eso quitaría kilos a los que más cargan.

import { useEffect, useRef, useState } from 'preact/hooks';
import type { ConfigTrono, HdT } from '../geometria/tipos';
import { fmt } from '../io/tablas';
import { conAlargue, FRACCION_PUNTA, rangoCuadrilla, type EstudioVarales, type PuntoLongitud } from '../optimizador/longitud';
import type { MensajeEntrada, MensajeSalida } from '../optimizador/worker';

interface Props {
  config: ConfigTrono;
  cuadrilla: HdT[];
  hayErrores: boolean;
  cambiar: (f: (c: ConfigTrono) => void) => void;
}

const m = (v: number) => `${fmt(v, 2)} m`;
const kg = (v: number) => `${fmt(v)} kg`;

export function LargoVarales({ config, cuadrilla, hayErrores, cambiar }: Props) {
  const [estudio, setEstudio] = useState<EstudioVarales | null>(null);
  const [progreso, setProgreso] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const worker = useRef<Worker | null>(null);
  const pocos = cuadrilla.length < 8;

  useEffect(() => {
    if (hayErrores || pocos) return;
    const t = setTimeout(() => {
      worker.current?.terminate();
      const w = new Worker(new URL('../optimizador/worker.ts', import.meta.url), { type: 'module' });
      worker.current = w;
      setProgreso(0);
      setError(null);
      w.onmessage = (e: MessageEvent<MensajeSalida>) => {
        const d = e.data;
        if (d.tipo === 'progreso') { setProgreso(d.fraccion); return; }
        w.terminate();
        worker.current = null;
        setProgreso(null);
        if (d.tipo === 'longitud') setEstudio(d.estudio);
        else if (d.tipo === 'error') setError(d.mensaje);
      };
      w.postMessage({ tipo: 'longitud', config, cuadrilla } satisfies MensajeEntrada);
    }, 400);
    return () => clearTimeout(t);
  }, [config, cuadrilla, hayErrores, pocos]);
  useEffect(() => () => worker.current?.terminate(), []);

  const rango = pocos ? null : rangoCuadrilla(cuadrilla);
  const aplicar = (delta: number) =>
    cambiar((c) => {
      const d = conAlargue(c, delta);
      c.varales = d.varales;
      c.puestos = d.puestos;
    });

  return (
    <div class="largo-varales">
      <section class="tarjeta explicacion-largo">
        <h3>¿Son óptimos tus varales?</h3>
        <p>
          Alargar los varales mete más gente y baja la carga «ideal» (el peso entre el número de personas), pero el varal es
          un voladizo que cede: cuanto más largo, más alto tiene que ir el hombro en la punta. Cuando tu cuadrilla no tiene
          gente tan alta, las filas nuevas acompañan pero no cargan, y los que más llevan siguen llevando lo mismo o más.
        </p>
        <p class="nota">
          Se prueba cada largo con tu trono y una cuadrilla de tus mismas alturas
          {rango && <> (hombros de {fmt(rango.min * 100, 0)} a {fmt(rango.max * 100, 0)} cm)</>}, colocada como pide la física,
          alargando o acortando lo mismo delante y detrás y manteniendo la separación entre filas. Lo que se compara es lo que lleva el 10 % que más carga.
        </p>
      </section>

      {hayErrores && <p class="vacio">Corrige los datos del trono para hacer el cálculo.</p>}
      {!hayErrores && pocos && <p class="vacio">Añade la cuadrilla (al menos 8 personas con su altura de hombro) para hacer el cálculo.</p>}
      {error && <div class="aviso mal">{error}</div>}
      {progreso !== null && (
        <div class="progreso-largo" role="progressbar" aria-label="Probando largos de varal" aria-valuenow={Math.round(progreso * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div class="barra" style={{ width: `${Math.round(progreso * 100)}%` }} />
          <span>Probando largos de varal… {Math.round(progreso * 100)} %</span>
        </div>
      )}

      {!hayErrores && !pocos && estudio && (
        <div class={`lado-largo${progreso !== null ? ' recalculando' : ''}`}>
          <Veredicto e={estudio} aplicar={() => aplicar(estudio.recomendado.largo - estudio.actual)} />
          <Grafica e={estudio} />
        </div>
      )}
    </div>
  );
}

/** «4,50 m», o «4,50 / 4,00 m» si delante y detrás no son iguales. */
const largos = (p: { largo: number; largoDetras: number }) =>
  Math.abs(p.largo - p.largoDetras) < 1e-9 ? m(p.largo) : `${fmt(p.largo, 2)} / ${fmt(p.largoDetras, 2)} m`;
const filas = (p: PuntoLongitud) => (p.filas === p.filasDetras ? `${p.filas} filas` : `${p.filas} + ${p.filasDetras} filas`);

function Veredicto({ e, aplicar }: { e: EstudioVarales; aplicar: () => void }) {
  const a = e.puntoActual, r = e.recomendado;
  const titulo = e.veredicto === 'optimo' ? 'Óptimo' : e.veredicto === 'largo' ? 'Más largo de lo que aprovechas' : 'Se queda corto';
  const dif = r.puestos - a.puestos;
  return (
    <section class={`tarjeta veredicto-largo v-${e.veredicto}`}>
      <h3>Voladizos{Math.abs(e.actual - e.actualDetras) < 1e-9 ? '' : ' (delante / detrás)'} · {largos({ largo: e.actual, largoDetras: e.actualDetras })}</h3>
      <p class="sello-veredicto">{titulo}</p>
      {e.veredicto === 'optimo' ? (
        <p>Con {largos(a)} ({filas(a)}) los que más cargan llevan {kg(a.altosKg)}. Ni alargando ni acortando bajaría de forma apreciable.</p>
      ) : (
        <p>
          Con <strong>{largos(r)}</strong> ({filas(r)}, {dif === 0 ? 'la misma gente' : `${Math.abs(dif)} personas ${dif > 0 ? 'más' : 'menos'}`}) los que más cargan
          llevarían <strong>{kg(e.sobranKg)} menos</strong>: {kg(r.altosKg)} en vez de {kg(a.altosKg)}.
        </p>
      )}
      <dl class="cifras-largo">
        <div><dt>Carga ideal</dt><dd>{kg(a.idealKg)}</dd></div>
        <div><dt>10 % que más carga</dt><dd>{kg(a.altosKg)}</dd></div>
        <div><dt>Filas de las puntas</dt><dd>{kg(a.puntaKg)}</dd></div>
        <div><dt>Acompañan</dt><dd>{a.acompanan}</dd></div>
      </dl>
      <p class="nota">«Acompañan»: personas que llevan menos de la mitad de lo ideal.</p>
      {e.veredicto !== 'optimo' && (
        <button type="button" class="secundario" onClick={aplicar}>Usar {largos(r)} y {filas(r)}</button>
      )}
    </section>
  );
}

type Serie = { clave: keyof PuntoLongitud; nombre: string; clase: string };
const SERIES: Serie[] = [
  { clave: 'altosKg', nombre: '10 % que más carga', clase: 'altos' },
  { clave: 'idealKg', nombre: 'Carga ideal', clase: 'ideal' },
  { clave: 'puntaKg', nombre: 'Filas de las puntas', clase: 'punta' },
];

function Grafica({ e }: { e: EstudioVarales }) {
  const [hover, setHover] = useState<number | null>(null);
  const p = e.puntos;
  const x0 = p[0].largo, x1 = p[p.length - 1].largo;
  const yMaxDato = Math.max(...p.map((q) => Math.max(q.altosKg, q.idealKg, q.puntaKg)));
  const paso = yMaxDato > 80 ? 20 : 10;
  const yMax = Math.ceil(yMaxDato / paso) * paso;
  const W = 560, H = 240, mi = 40, md = 14, ms = 18, mb = 34;
  const px = (x: number) => mi + ((x - x0) / (x1 - x0 || 1)) * (W - mi - md);
  const py = (v: number) => ms + (1 - v / yMax) * (H - ms - mb);
  const ruta = (k: keyof PuntoLongitud) => p.map((q, i) => `${i ? 'L' : 'M'}${px(q.largo).toFixed(1)},${py(q[k] as number).toFixed(1)}`).join(' ');
  const ticksX = p.filter((q) => Math.abs(q.largo * 2 - Math.round(q.largo * 2)) < 1e-9).map((q) => q.largo);
  const q = hover !== null ? p[hover] : null;
  return (
    <figure class="perfil grafica-largo">
      <figcaption>
        Kilos por persona según el largo de los voladizos
        <span class="leyenda-perfil">
          {SERIES.map((s) => <span><i class={`trazo s-${s.clase}`} />{s.nombre}</span>)}
        </span>
      </figcaption>
      <div class="perfil-lienzo">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Carga por persona según el largo de los voladizos"
          onPointerLeave={() => setHover(null)}
          onPointerMove={(ev) => {
            const r = (ev.currentTarget as SVGSVGElement).getBoundingClientRect();
            const xv = ((ev.clientX - r.left) / r.width) * W;
            let mejor = 0;
            p.forEach((pt, i) => { if (Math.abs(px(pt.largo) - xv) < Math.abs(px(p[mejor].largo) - xv)) mejor = i; });
            setHover(mejor);
          }}>
          {Array.from({ length: yMax / paso + 1 }, (_, i) => i * paso).map((v) => (
            <g class="rejilla-graf">
              <line x1={mi} x2={W - md} y1={py(v)} y2={py(v)} />
              <text x={mi - 6} y={py(v)}>{v}</text>
            </g>
          ))}
          {ticksX.map((x) => <text class="eje-x" x={px(x)} y={H - mb + 14}>{fmt(x, 1)}</text>)}
          <text class="eje-titulo fin" x={W - md} y={H - 4}>{Math.abs(e.actual - e.actualDetras) < 1e-9 ? 'largo de cada voladizo (m)' : 'largo del voladizo de delante (m)'}</text>
          <text class="eje-titulo" x={mi} y={10}>kg</text>
          <line class="marca-largo recomendado" x1={px(e.recomendado.largo)} x2={px(e.recomendado.largo)} y1={ms} y2={H - mb} />
          <line class="marca-largo actual" x1={px(e.actual)} x2={px(e.actual)} y1={ms} y2={H - mb} />
          <text class="rotulo-largo" x={px(e.actual)} y={ms - 5}>actual</text>
          {Math.abs(e.recomendado.largo - e.actual) > 0.3 && (
            <text class="rotulo-largo recomendado" x={px(e.recomendado.largo)} y={ms - 5}>recomendado</text>
          )}
          {SERIES.map((s) => <path class={`linea-largo s-${s.clase}`} d={ruta(s.clave)} />)}
          {p.map((pt, i) => <circle class={`marca-perfil${hover === i ? ' activa' : ''}`} cx={px(pt.largo)} cy={py(pt.altosKg)} r={hover === i ? 4.5 : 3} />)}
          {q && <line class="cursor-perfil" x1={px(q.largo)} x2={px(q.largo)} y1={ms} y2={H - mb} />}
        </svg>
        {q && (
          <div class="tooltip-perfil" style={{ left: `${Math.min(85, Math.max(15, (px(q.largo) / W) * 100))}%` }}>
            <strong>{largos(q)} · {filas(q)} · {q.puestos} puestos</strong>
            <span>10 % que más carga: {kg(q.altosKg)}</span>
            <span>Carga ideal: {kg(q.idealKg)}</span>
            <span>Filas de las puntas: {kg(q.puntaKg)}</span>
            <span>Acompañan (&lt; {fmt(FRACCION_PUNTA * 100, 0)} % ideal): {q.acompanan}</span>
          </div>
        )}
      </div>
      <details class="tabla-largo">
        <summary>Ver tabla</summary>
        <div class="tabla-desplazable">
          <table class="tabla">
            <thead><tr><th>Largo</th><th>Filas</th><th>Puestos</th><th>Ideal</th><th>10 % que más carga</th><th>Punta</th><th>Acompañan</th></tr></thead>
            <tbody>
              {p.map((pt) => (
                <tr class={Math.abs(pt.largo - e.actual) < 1e-9 ? 'fila-actual' : ''}>
                  <td>{largos(pt)}</td><td>{filas(pt)}</td><td>{pt.puestos}</td><td>{kg(pt.idealKg)}</td>
                  <td>{kg(pt.altosKg)}</td><td>{kg(pt.puntaKg)}</td><td>{pt.acompanan}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
