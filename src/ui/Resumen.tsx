import type { ComponentChildren } from 'preact';
import type { Resultado } from '../optimizador/optimizar';
import { fmt, type Vista } from '../io/tablas';
import { nivelConfianza } from './FormOptimizador';

function Cifra({ etiqueta, valor, nota, tono }: { etiqueta: string; valor: ComponentChildren; nota?: ComponentChildren; tono?: 'bien' | 'mal' }) {
  return (
    <div class={`cifra${tono ? ` ${tono}` : ''}`}>
      <span class="cifra-etiqueta">{etiqueta}</span>
      <span class="cifra-valor">{valor}</span>
      {nota && <span class="cifra-nota">{nota}</span>}
    </div>
  );
}

export function Resumen({ v, prioridad, inclinacionMax }: { v: Vista; prioridad: number; inclinacionMax: number }) {
  const r = v.resultado!, s = r.resumen;
  const N = v.porPuesto.length - r.vacios;
  const c = r.confianza;
  const nombreCaso = { llano: 'Llano', subiendo: 'Subiendo 5 %', bajando: 'Bajando 5 %' } as const;
  const llano = r.cuesta.filas[0];
  const dif = (x: number, base: number, dec = 1) => `${x >= base ? '+' : '−'}${fmt(Math.abs(x - base), dec)}`;
  return (
    <div class="resumen">
      <section>
        <h3>Reparto</h3>
        <div class="cifras">
          <Cifra etiqueta="Peso total" valor={`${fmt(r.pesoTotal, 0)} kg`} nota={`${N} puestos`} />
          <Cifra etiqueta="Ideal por persona" valor={`${fmt(r.cargaIdeal)} kg`} />
          <Cifra etiqueta="Mínima – máxima" valor={`${fmt(s.min)} – ${fmt(s.max)} kg`} />
          <Cifra etiqueta="P10 – P90" valor={`${fmt(s.p10)} – ${fmt(s.p90)} kg`} nota={`Desviación típica ${fmt(s.desviacionTipica)} kg`} />
          <Cifra etiqueta="Dentro de ±25 %" valor={`${s.dentro25} / ${N}`} nota={`${fmt((100 * s.dentro25) / N, 0)} %`} />
          <Cifra etiqueta="No llegan al varal" valor={s.noLlegan} tono={s.noLlegan > 0 ? 'mal' : undefined} />
        </div>
      </section>

      <section>
        <h3>Trono</h3>
        <div class="cifras">
          <Cifra etiqueta="Inclinación" valor={`${fmt(r.inclinacionGrados, 2)}°`}
            nota={r.inclinacionGrados > 0.005 ? 'Delante más alto' : r.inclinacionGrados < -0.005 ? 'Detrás más alto' : 'Nivelado'}
            tono={Math.abs(r.inclinacionGrados) > inclinacionMax + 0.005 ? 'mal' : undefined} />
          <Cifra etiqueta="Alabeo" valor={`${fmt(r.alabeoGrados, 3)}°`} nota="Izquierda – derecha" />
          <Cifra etiqueta="Flecha en la punta" valor={`${fmt(r.flechaDelanteMm, 0)} / ${fmt(r.flechaDetrasMm, 0)} mm`} nota="Delante / detrás, hacia arriba" />
        </div>
      </section>

      <section>
        <h3>Confianza</h3>
        <div class="cifras">
          <Cifra etiqueta="Clave con confianza 3" valor={`${c.claveConf3} / ${c.clave}`} nota={`Conf. 2: ${c.claveConf2} · Conf. 1: ${c.claveConf1}`} />
          <Cifra etiqueta="Confianza 1 en puestos clave" valor={c.conf1EnClave.length ? c.conf1EnClave.join(', ') : 'Ninguno'}
            tono={c.conf1EnClave.length ? 'mal' : undefined} />
          <Cifra etiqueta="Prioridad" valor={nivelConfianza(prioridad)} />
        </div>
        {r.sinConfianza && (
          <p class="nota">
            Sin tener en cuenta la confianza: desviación típica {fmt(r.sinConfianza.desviacionTipica)} kg (ahora {fmt(s.desviacionTipica)}),
            {' '}{r.sinConfianza.dentro25} dentro de ±25 % (ahora {s.dentro25}) y {r.sinConfianza.claveConf3} puestos clave con confianza 3 (ahora {c.claveConf3}).
          </p>
        )}
      </section>

      <section>
        <h3>En cuesta</h3>
        <p class="nota">Pendiente del 5 %, centro de gravedad a {fmt(r.cuesta.alturaCdg, 2)} m sobre los varales.</p>
        <div class="tabla-desplazable">
          <table class="tabla">
            <thead>
              <tr><th /><th class="num">Fila 1</th><th class="num">Fila {v.trono.numeroMax}</th><th class="num">Voladizo delantero</th><th class="num">Voladizo trasero</th></tr>
            </thead>
            <tbody>
              {r.cuesta.filas.map((f) => (
                <tr>
                  <th>{nombreCaso[f.caso]}</th>
                  <td class="num">{fmt(f.delante)} kg{f.caso !== 'llano' && <small> {dif(f.delante, llano.delante)}</small>}</td>
                  <td class="num">{fmt(f.detras)} kg{f.caso !== 'llano' && <small> {dif(f.detras, llano.detras)}</small>}</td>
                  <td class="num">{fmt(f.zonaDelante, 0)} kg{f.caso !== 'llano' && <small> {dif(f.zonaDelante, llano.zonaDelante, 0)}</small>}</td>
                  <td class="num">{fmt(f.zonaDetras, 0)} kg{f.caso !== 'llano' && <small> {dif(f.zonaDetras, llano.zonaDetras, 0)}</small>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <p class="nota pie">Fila 1 y fila {v.trono.numeroMax}: carga media de la fila más exterior. Calculado en {fmt(r.tiempoMs / 1000, 2)} s.</p>
    </div>
  );
}

/** Cifras esenciales encima de la planta. Con `antes` muestra la diferencia de la vista previa. */
export function Indicadores({ r, antes }: { r: Resultado; antes?: Resultado | null }) {
  const s = r.resumen, N = r.cargasKg.length;
  const d = (x: number, y: number | undefined, dec = 1, mejorSiBaja = true) => {
    if (y === undefined || Math.abs(x - y) < 10 ** -dec / 2) return null;
    const mejor = mejorSiBaja ? x < y : x > y;
    return <span class={`delta ${mejor ? 'mejor' : 'peor'}`}>{x > y ? '+' : '−'}{fmt(Math.abs(x - y), dec)}</span>;
  };
  const a = antes ?? undefined;
  return (
    <div class={`indicadores${antes ? ' previa' : ''}`} aria-live="polite">
      <Cifra etiqueta="Ideal" valor={`${fmt(r.cargaIdeal)} kg`} />
      <Cifra etiqueta="Desviación" valor={<>{fmt(s.desviacionTipica)} kg{d(s.desviacionTipica, a?.resumen.desviacionTipica)}</>} />
      <Cifra etiqueta="Dentro de ±25 %" valor={<>{s.dentro25}/{N}{d(s.dentro25, a?.resumen.dentro25, 0, false)}</>} />
      <Cifra etiqueta="No llegan" valor={<>{s.noLlegan}{d(s.noLlegan, a?.resumen.noLlegan, 0)}</>} tono={s.noLlegan > 0 ? 'mal' : undefined} />
      <Cifra etiqueta="Clave con conf. 3" valor={<>{r.confianza.claveConf3}/{r.confianza.clave}{d(r.confianza.claveConf3, a?.confianza.claveConf3, 0, false)}</>} />
      <Cifra etiqueta="Inclinación" valor={`${fmt(r.inclinacionGrados, 2)}°`} />
    </div>
  );
}
