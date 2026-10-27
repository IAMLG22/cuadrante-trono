// Panel de revisión: aparece al pulsar «Comprobar» y se actualiza solo al mover a la gente.

import type { Resultado } from '../optimizador/optimizar';
import type { Problema } from '../optimizador/revision';
import { fmt } from '../io/tablas';

interface Props {
  problemas: Problema[];
  resultado: Resultado | null;
  error: string | null;
  recalculando: boolean;
  activo: number | null;
  onElegir: (i: number | null) => void;
  onCerrar: () => void;
}

export function Revision({ problemas, resultado: r, error, recalculando, activo, onElegir, onCerrar }: Props) {
  const errores = problemas.filter((p) => p.nivel === 'error').length;
  const avisos = problemas.filter((p) => p.nivel === 'aviso').length;
  return (
    <aside class="revision" aria-label="Revisión del cuadrante">
      <div class="revision-cabecera">
        <strong>Revisión</strong>
        {recalculando && <span class="nota">comprobando…</span>}
        <button type="button" class="icono" aria-label="Cerrar revisión" title="Cerrar" onClick={onCerrar}>×</button>
      </div>
      {error ? (
        <p class="revision-error">{error}</p>
      ) : (
        <>
          {r && (
            <div class="revision-cifras">
              <span><b>{fmt(r.resumen.min, 0)}–{fmt(r.resumen.max, 0)}</b> kg</span>
              <span>ideal <b>{fmt(r.cargaIdeal)}</b> kg</span>
              <span><b>{r.resumen.dentro25}</b>/{r.cargasKg.length - r.vacios} en ±25 %</span>
            </div>
          )}
          <p class="revision-total">
            {errores === 0 && avisos === 0 ? 'Sin problemas.' : (
              <>
                {errores > 0 && <span class="t-alta">{errores} error{errores === 1 ? '' : 'es'}</span>}
                {errores > 0 && avisos > 0 && ' · '}
                {avisos > 0 && <span class="t-aviso">{avisos} aviso{avisos === 1 ? '' : 's'}</span>}
              </>
            )}
          </p>
          <ul class="problemas">
            {problemas.map((p, i) => (
              <li class={`problema nivel-${p.nivel}${activo === i ? ' activo' : ''}`}>
                <button type="button" disabled={p.puestos.length === 0} onClick={() => onElegir(activo === i ? null : i)}
                  title={p.puestos.length ? 'Resaltar en el cuadrante' : undefined}>
                  <i class="punto" aria-hidden="true" />
                  <span class="problema-texto">
                    <span class="problema-titulo">{p.titulo}</span>
                    {p.detalle && <span class="problema-detalle">{p.detalle}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}
