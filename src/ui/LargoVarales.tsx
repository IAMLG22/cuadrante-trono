// Calculadora «¿Son óptimos tus varales?»: alarga o acorta a la vez los voladizos de delante y de
// detrás y, para cada largo, coloca muchas cuadrillas simuladas a partir de la cuadrilla tipo del
// trono (la gente cambia de un año a otro). Dice qué largo funciona en un año normal y cuál
// aguanta mejor un año malo.

import { useEffect, useRef, useState } from 'preact/hooks';
import type { ConfigTrono, CuadrillaTipo, HdT, OrigenTipo } from '../geometria/tipos';
import { fmt } from '../io/tablas';
import {
  alarguesAEstudiar, alturasTipo, componerEstudio, conAlargue, FRACCION_PUNTA, leerAlturas, type EstudioVarales, type PuntoLongitud,
} from '../optimizador/longitud';
import type { MensajeEntrada, MensajeSalida } from '../optimizador/worker';
import { Grupo, Num, Sel } from './campos';

interface Props {
  config: ConfigTrono;
  cuadrilla: HdT[];
  tipo: CuadrillaTipo;
  cambiarTipo: (f: (t: CuadrillaTipo) => void) => void;
  hayErrores: boolean;
  cambiar: (f: (c: ConfigTrono) => void) => void;
}

const m = (v: number) => `${fmt(v, 2)} m`;
const kg = (v: number) => `${fmt(v)} kg`;
const pc = (v: number) => `${fmt(v * 100, 0)} %`;

const ORIGENES: [OrigenTipo, string][] = [
  ['ejemplo', 'Cuadrilla tipo de Málaga'],
  ['actual', 'Tu cuadrilla de este año'],
  ['historico', 'Cuadrillas de otros años'],
  ['parametros', 'Media y dispersión'],
];

export function LargoVarales({ config, cuadrilla, tipo, cambiarTipo, hayErrores, cambiar }: Props) {
  const [estudio, setEstudio] = useState<EstudioVarales | null>(null);
  const [progreso, setProgreso] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const workers = useRef<Worker[]>([]);
  const nTipo = alturasTipo(tipo, cuadrilla).length;
  const pocos = nTipo < 8;
  const parar = () => { for (const w of workers.current) w.terminate(); workers.current = []; };

  // Los largos se reparten entre varios workers en paralelo; al acabar todos, se junta el estudio
  useEffect(() => {
    if (hayErrores || pocos) return;
    const t = setTimeout(() => {
      parar();
      const deltas = alarguesAEstudiar(config);
      const n = Math.max(1, Math.min(deltas.length, (navigator.hardwareConcurrency || 4) - 1, 6));
      const trozos = Array.from({ length: n }, (_, k) => deltas.filter((_, i) => i % n === k));
      const avance = trozos.map(() => 0);
      const puntos: PuntoLongitud[] = [];
      let pendientes = n;
      setProgreso(0);
      setError(null);
      workers.current = trozos.map((trozo, k) => {
        const w = new Worker(new URL('../optimizador/worker.ts', import.meta.url), { type: 'module' });
        w.onmessage = (e: MessageEvent<MensajeSalida>) => {
          const d = e.data;
          if (d.tipo === 'progreso') {
            avance[k] = d.fraccion * trozo.length;
            setProgreso(avance.reduce((a, b) => a + b, 0) / deltas.length);
            return;
          }
          w.terminate();
          if (d.tipo === 'error') { parar(); setProgreso(null); setError(d.mensaje); return; }
          if (d.tipo !== 'longitud') return;
          puntos.push(...d.puntos);
          if (--pendientes > 0) return;
          workers.current = [];
          setProgreso(null);
          try { setEstudio(componerEstudio(config, cuadrilla, tipo, puntos)); } catch (x) { setError(x instanceof Error ? x.message : String(x)); }
        };
        w.postMessage({ tipo: 'longitud', config, cuadrilla, cuadrillaTipo: tipo, deltas: trozo } satisfies MensajeEntrada);
        return w;
      });
    }, 600);
    return () => clearTimeout(t);
  }, [config, cuadrilla, tipo, hayErrores, pocos]);
  useEffect(() => parar, []);

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
          un voladizo que cede: cuanto más largo, más alto tiene que ir el hombro en la punta. Cuando no hay gente tan alta,
          las filas nuevas acompañan pero no cargan, y los que más llevan siguen llevando lo mismo o más.
        </p>
        <p class="nota">
          Como la cuadrilla cambia de un año a otro, cada largo se prueba con {estudio?.tipo.simulaciones ?? 'varias'} cuadrillas
          simuladas a partir de la cuadrilla tipo: más altas, más bajas, con más o menos gente. Se alarga o acorta lo mismo
          delante y detrás, manteniendo la separación entre filas, y se compara lo que lleva el 10 % que más carga.
        </p>
      </section>

      <FormTipo tipo={tipo} cambiar={cambiarTipo} cuadrilla={cuadrilla} estudio={estudio} nTipo={nTipo} />

      {hayErrores && <p class="vacio">Corrige los datos del trono para hacer el cálculo.</p>}
      {!hayErrores && pocos && <p class="vacio">La cuadrilla tipo necesita al menos 8 alturas de hombro.</p>}
      {error && <div class="aviso mal">{error}</div>}
      {progreso !== null && (
        <div class="progreso-largo" role="progressbar" aria-label="Probando largos de varal" aria-valuenow={Math.round(progreso * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div class="barra" style={{ width: `${Math.round(progreso * 100)}%` }} />
          <span>Probando largos de varal con distintas cuadrillas… {Math.round(progreso * 100)} %</span>
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

function FormTipo({ tipo, cambiar, cuadrilla, estudio, nTipo }: {
  tipo: CuadrillaTipo; cambiar: (f: (t: CuadrillaTipo) => void) => void; cuadrilla: HdT[]; estudio: EstudioVarales | null; nTipo: number;
}) {
  const leidas = tipo.origen === 'historico' ? leerAlturas(tipo.historico).length : 0;
  return (
    <div class="formulario tipo-largo">
      <Grupo titulo="Cuadrilla de un año normal">
        <Sel<OrigenTipo> etiqueta="Alturas de hombro" valor={tipo.origen} opciones={ORIGENES} onCambio={(v) => cambiar((t) => (t.origen = v))} />
        {tipo.origen === 'parametros' && (
          <>
            <Num etiqueta="Media" unidad="cm" min={100} max={220} valor={tipo.media} onCambio={(v) => cambiar((t) => (t.media = v))} />
            <Num etiqueta="Dispersión" unidad="cm" min={0} max={20} valor={tipo.desviacion} onCambio={(v) => cambiar((t) => (t.desviacion = v))}
              ayuda="Desviación típica: dos de cada tres están a menos de esta distancia de la media." />
            <Num etiqueta="El más bajo" unidad="cm" min={100} max={220} valor={tipo.min} onCambio={(v) => cambiar((t) => (t.min = v))} />
            <Num etiqueta="El más alto" unidad="cm" min={100} max={220} valor={tipo.max} onCambio={(v) => cambiar((t) => (t.max = v))} />
          </>
        )}
        {tipo.origen === 'historico' && (
          <label class="campo ancho">
            <span class="etiqueta">Alturas de hombro de otros años (cm)</span>
            <textarea rows={5} placeholder={'Pega aquí las alturas de varias cuadrillas, de Excel o como sea:\n152,5\n149\n156,5…'}
              value={tipo.historico} onChange={(e) => { const v = e.currentTarget.value; cambiar((t) => (t.historico = v)); }} />
            <small class="ayuda">{leidas} alturas leídas. Juntar varios años da la cuadrilla más realista.</small>
          </label>
        )}
        {tipo.origen === 'ejemplo' && (
          <p class="dato-calculado">La forma de una cuadrilla de Málaga: algunos de 1,46–1,47, muchos de 1,48–1,49, el grueso entre 1,49 y 1,55 y unos cuantos por encima.</p>
        )}
        {tipo.origen === 'actual' && (
          <p class="dato-calculado">Las alturas de tu cuadrilla de este año ({cuadrilla.length} HdT). Úsala si crees que es representativa.</p>
        )}
      </Grupo>
      <Grupo titulo="De un año a otro">
        <Num etiqueta="Gente que suele haber" entero min={8} max={2000} valor={tipo.disponibles ?? cuadrilla.length}
          onCambio={(v) => cambiar((t) => (t.disponibles = v))}
          ayuda={tipo.disponibles === null ? 'Ahora, tantos como en tu cuadrilla.' : <button type="button" class="enlace" onClick={() => cambiar((t) => (t.disponibles = null))}>Usar los de tu cuadrilla ({cuadrilla.length})</button>} />
        <Num etiqueta="La altura media cambia hasta" unidad="± cm" min={0} max={10} valor={tipo.variacionCm} onCambio={(v) => cambiar((t) => (t.variacionCm = v))}
          ayuda="Lo que puede subir o bajar la media entre un año de gente alta y uno de gente baja." />
        {estudio && (
          <p class="dato-calculado">
            Cuadrilla tipo: {nTipo} alturas, media {fmt(estudio.tipo.media)} cm, la mayoría entre {fmt(estudio.tipo.p5)} y {fmt(estudio.tipo.p95)} cm.
          </p>
        )}
      </Grupo>
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
        <p>
          Con {largos(a)} ({filas(a)}), en un año normal los que más cargan llevan {kg(a.altosKg)}, y en uno malo hasta {kg(a.altosP90)}.
          Ni alargando ni acortando mejoraría de forma apreciable.
        </p>
      ) : (
        <p>
          Con <strong>{largos(r)}</strong> ({filas(r)}, {dif === 0 ? 'la misma gente' : `${Math.abs(dif)} personas ${dif > 0 ? 'más' : 'menos'}`}),
          en un año normal los que más cargan llevarían <strong>{kg(r.altosKg)}</strong> en vez de {kg(a.altosKg)}, y en uno malo
          {' '}{kg(r.altosP90)} en vez de {kg(a.altosP90)}.
        </p>
      )}
      {a.faltaGente > 0.1 && (
        <p class="aviso-gente">Con el largo actual, {pc(a.faltaGente)} de los años simulados no hay gente para cubrir los {a.puestos} puestos.</p>
      )}
      <dl class="cifras-largo">
        <div><dt>Carga ideal</dt><dd>{kg(a.idealKg)}</dd></div>
        <div><dt>10 % que más carga</dt><dd>{kg(a.altosKg)}</dd></div>
        <div><dt>Año bueno – año malo</dt><dd>{fmt(a.altosP10, 0)}–{fmt(a.altosP90, 0)} kg</dd></div>
        <div><dt>Filas de las puntas</dt><dd>{kg(a.puntaKg)}</dd></div>
      </dl>
      <p class="nota">Año normal = la mediana de las cuadrillas simuladas; año bueno y malo, el 10 % mejor y peor.</p>
      {e.veredicto !== 'optimo' && (
        <button type="button" class="secundario" onClick={aplicar}>Usar {largos(r)} y {filas(r)}</button>
      )}
    </section>
  );
}

type Serie = { clave: keyof PuntoLongitud; nombre: string; clase: string };
const SERIES: Serie[] = [
  { clave: 'altosKg', nombre: '10 % que más carga (año normal)', clase: 'altos' },
  { clave: 'idealKg', nombre: 'Carga ideal', clase: 'ideal' },
  { clave: 'puntaKg', nombre: 'Filas de las puntas', clase: 'punta' },
];

function Grafica({ e }: { e: EstudioVarales }) {
  const [hover, setHover] = useState<number | null>(null);
  const p = e.puntos;
  const x0 = p[0].largo, x1 = p[p.length - 1].largo;
  const yMaxDato = Math.max(...p.map((q) => Math.max(q.altosP90, q.idealKg, q.puntaKg)));
  const paso = yMaxDato > 80 ? 20 : 10;
  const yMax = Math.ceil(yMaxDato / paso) * paso;
  const W = 560, H = 250, mi = 40, md = 14, ms = 22, mb = 34;
  const px = (x: number) => mi + ((x - x0) / (x1 - x0 || 1)) * (W - mi - md);
  const py = (v: number) => ms + (1 - v / yMax) * (H - ms - mb);
  const ruta = (k: keyof PuntoLongitud) => p.map((q, i) => `${i ? 'L' : 'M'}${px(q.largo).toFixed(1)},${py(q[k] as number).toFixed(1)}`).join(' ');
  const banda = [...p.map((q) => `${px(q.largo).toFixed(1)},${py(q.altosP90).toFixed(1)}`), ...[...p].reverse().map((q) => `${px(q.largo).toFixed(1)},${py(q.altosP10).toFixed(1)}`)].join(' ');
  // Una marca cada medio metro, caigan o no en un largo estudiado
  const ticksX = Array.from({ length: Math.floor(x1 * 2) - Math.ceil(x0 * 2) + 1 }, (_, i) => (Math.ceil(x0 * 2) + i) / 2);
  // Desde qué largo, la mitad de los años o más no hay gente para todos los puestos
  const sinGente = p.find((q) => q.faltaGente > 0.5);
  const q = hover !== null ? p[hover] : null;
  return (
    <figure class="perfil grafica-largo">
      <figcaption>
        Kilos por persona según el largo de los voladizos
        <span class="leyenda-perfil">
          {SERIES.map((s) => <span><i class={`trazo s-${s.clase}`} />{s.nombre}</span>)}
          <span><i class="muestra-banda" />Año bueno – año malo</span>
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
          {sinGente && (
            <g>
              <rect class="zona-sin-gente" x={px(sinGente.largo)} y={ms} width={W - md - px(sinGente.largo)} height={H - ms - mb} />
              <text class="rotulo-sin-gente" x={W - md - 4} y={H - mb - 6}>falta gente la mayoría de años</text>
            </g>
          )}
          {Array.from({ length: yMax / paso + 1 }, (_, i) => i * paso).map((v) => (
            <g class="rejilla-graf">
              <line x1={mi} x2={W - md} y1={py(v)} y2={py(v)} />
              <text x={mi - 6} y={py(v)}>{v}</text>
            </g>
          ))}
          {ticksX.map((x) => <text class="eje-x" x={px(x)} y={H - mb + 14}>{fmt(x, 1)}</text>)}
          <text class="eje-titulo fin" x={W - md} y={H - 4}>{Math.abs(e.actual - e.actualDetras) < 1e-9 ? 'largo de cada voladizo (m)' : 'largo del voladizo de delante (m)'}</text>
          <text class="eje-titulo" x={mi} y={12}>kg</text>
          <polygon class="banda-largo" points={banda} />
          <line class="marca-largo recomendado" x1={px(e.recomendado.largo)} x2={px(e.recomendado.largo)} y1={ms} y2={H - mb} />
          <line class="marca-largo actual" x1={px(e.actual)} x2={px(e.actual)} y1={ms} y2={H - mb} />
          <text class="rotulo-largo" x={px(e.actual)} y={ms - 6}>actual</text>
          {Math.abs(e.recomendado.largo - e.actual) > 0.3 && (
            <text class="rotulo-largo recomendado" x={px(e.recomendado.largo)} y={ms - 6}>recomendado</text>
          )}
          {SERIES.map((s) => <path class={`linea-largo s-${s.clase}`} d={ruta(s.clave)} />)}
          {p.map((pt, i) => <circle class={`marca-perfil${hover === i ? ' activa' : ''}`} cx={px(pt.largo)} cy={py(pt.altosKg)} r={hover === i ? 4.5 : 3} />)}
          {q && <line class="cursor-perfil" x1={px(q.largo)} x2={px(q.largo)} y1={ms} y2={H - mb} />}
        </svg>
        {q && (
          <div class="tooltip-perfil" style={{ left: `${Math.min(82, Math.max(18, (px(q.largo) / W) * 100))}%` }}>
            <strong>{largos(q)} · {filas(q)} · {q.puestos} puestos</strong>
            <span>10 % que más carga: {kg(q.altosKg)} (de {fmt(q.altosP10, 0)} a {fmt(q.altosP90, 0)} kg)</span>
            <span>Carga ideal: {kg(q.idealKg)}</span>
            <span>Filas de las puntas: {kg(q.puntaKg)}</span>
            <span>Acompañan (&lt; {fmt(FRACCION_PUNTA * 100, 0)} % ideal): {q.acompanan}</span>
            {q.faltaGente > 0 && <span>Años sin gente para todos: {pc(q.faltaGente)}</span>}
          </div>
        )}
      </div>
      <details class="tabla-largo">
        <summary>Ver tabla</summary>
        <div class="tabla-desplazable">
          <table class="tabla">
            <thead>
              <tr><th>Largo</th><th>Filas</th><th>Puestos</th><th>Ideal</th><th>10 % que más carga</th><th>Año bueno – malo</th><th>Punta</th><th>Sin gente</th></tr>
            </thead>
            <tbody>
              {p.map((pt) => (
                <tr class={Math.abs(pt.largo - e.actual) < 1e-9 ? 'fila-actual' : ''}>
                  <td>{largos(pt)}</td><td>{filas(pt)}</td><td>{pt.puestos}</td><td>{kg(pt.idealKg)}</td>
                  <td>{kg(pt.altosKg)}</td><td>{fmt(pt.altosP10, 0)}–{fmt(pt.altosP90, 0)} kg</td><td>{kg(pt.puntaKg)}</td><td>{pc(pt.faltaGente)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
