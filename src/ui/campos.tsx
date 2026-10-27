// Campos de formulario reutilizables (aceptan coma decimal).

import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { numero } from '../io/csv';

const aTexto = (v: number) => (Number.isFinite(v) ? String(Math.round(v * 1e6) / 1e6).replace('.', ',') : '');

interface PropsNum {
  etiqueta: string;
  valor: number;
  onCambio: (v: number) => void;
  unidad?: string;
  ayuda?: ComponentChildren;
  entero?: boolean;
  min?: number;
  max?: number;
  desactivado?: boolean;
}

export function Num({ etiqueta, valor, onCambio, unidad, ayuda, entero, min, max, desactivado }: PropsNum) {
  const [txt, setTxt] = useState(aTexto(valor));
  const [error, setError] = useState(false);
  const foco = useRef(false);
  useEffect(() => {
    if (!foco.current) setTxt(aTexto(valor));
  }, [valor]);
  return (
    <label class={`campo${error ? ' con-error' : ''}`}>
      <span class="etiqueta">{etiqueta}</span>
      <span class="entrada">
        <input
          type="text"
          inputMode={entero ? 'numeric' : 'decimal'}
          value={txt}
          disabled={desactivado}
          onFocus={() => (foco.current = true)}
          onBlur={() => {
            foco.current = false;
            setError(false);
            setTxt(aTexto(valor));
          }}
          onInput={(e) => {
            const t = e.currentTarget.value;
            setTxt(t);
            let n = numero(t);
            if (entero) n = Math.round(n);
            const ok = Number.isFinite(n) && (min === undefined || n >= min) && (max === undefined || n <= max);
            setError(!ok);
            if (ok) onCambio(n);
          }}
        />
        {unidad && <span class="unidad">{unidad}</span>}
      </span>
      {ayuda && <small class="ayuda">{ayuda}</small>}
    </label>
  );
}

interface PropsSel<T extends string | number> {
  etiqueta: string;
  valor: T;
  opciones: [T, string][];
  onCambio: (v: T) => void;
}

export function Sel<T extends string | number>({ etiqueta, valor, opciones, onCambio }: PropsSel<T>) {
  return (
    <label class="campo">
      <span class="etiqueta">{etiqueta}</span>
      <select
        value={String(valor)}
        onChange={(e) => {
          const o = opciones.find(([v]) => String(v) === e.currentTarget.value);
          if (o) onCambio(o[0]);
        }}
      >
        {opciones.map(([v, t]) => (
          <option value={String(v)}>{t}</option>
        ))}
      </select>
    </label>
  );
}

export function Casilla({ etiqueta, valor, onCambio }: { etiqueta: string; valor: boolean; onCambio: (v: boolean) => void }) {
  return (
    <label class="casilla">
      <input type="checkbox" checked={valor} onChange={(e) => onCambio(e.currentTarget.checked)} />
      <span>{etiqueta}</span>
    </label>
  );
}

/** Tarjeta de formulario con título. */
export function Grupo({ titulo, children }: { titulo: ComponentChildren; children: ComponentChildren }) {
  return (
    <section class="tarjeta">
      <h3>{titulo}</h3>
      <div class="rejilla">{children}</div>
    </section>
  );
}
