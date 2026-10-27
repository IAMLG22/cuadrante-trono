// Arrastrar y soltar común a la lista de la cuadrilla, el cuadrante y la planta.
// - Ratón: el arrastre empieza al mover unos píxeles.
// - Táctil: empieza tras mantener pulsado un momento, para no estorbar al desplazamiento.
// - Un toque sin arrastrar es una «pulsación» (sirve para elegir y luego tocar el destino).
// Los elementos se marcan con data-puesto, data-hdt o data-zona.

import { useEffect, useRef, useState } from 'preact/hooks';

import type { Destino, Origen } from '../io/mover';

export type { Destino, Origen };

export function mismoDestino(a: Destino | null, b: Destino | null): boolean {
  if (!a || !b) return a === b;
  if ('puesto' in a) return 'puesto' in b && a.puesto === b.puesto;
  if ('hdt' in a) return 'hdt' in b && a.hdt === b.hdt;
  return 'zona' in b && a.zona === b.zona;
}

export function destinoEn(x: number, y: number): Destino | null {
  const el = document.elementFromPoint(x, y)?.closest('[data-puesto],[data-hdt],[data-zona]');
  if (!el) return null;
  const p = el.getAttribute('data-puesto');
  if (p) return { puesto: p };
  const h = el.getAttribute('data-hdt');
  if (h) return { hdt: Number(h) };
  const z = el.getAttribute('data-zona');
  return z === 'lista' ? { zona: z } : null;
}

interface Opciones {
  alSoltar: (o: Origen, d: Destino) => void;
  alPrevisualizar?: (o: Origen, d: Destino | null) => void;
  alPulsar?: (o: Origen) => void;
}

interface Arrastre {
  origen: Origen;
  texto: string;
  x0: number;
  y0: number;
  tactil: boolean;
  activo: boolean;
  objetivo: Destino | null;
  temporizador: number;
}

export function useArrastre(op: Opciones) {
  const actual = useRef<Arrastre | null>(null);
  const [vista, setVista] = useState<{ origen: Origen; texto: string; x: number; y: number; objetivo: Destino | null } | null>(null);
  const cb = useRef(op);
  cb.current = op;

  useEffect(() => {
    const activar = (a: Arrastre, x: number, y: number) => {
      a.activo = true;
      setVista({ origen: a.origen, texto: a.texto, x, y, objetivo: null });
      if (a.tactil) navigator.vibrate?.(12);
    };
    const terminar = () => {
      const a = actual.current;
      if (a) clearTimeout(a.temporizador);
      actual.current = null;
      setVista(null);
      return a;
    };
    const mover = (e: PointerEvent) => {
      const a = actual.current;
      if (!a) return;
      if (!a.activo) {
        const dist = Math.hypot(e.clientX - a.x0, e.clientY - a.y0);
        if (a.tactil) {
          if (dist > 10) terminar(); // está desplazando la página, no arrastrando
          return;
        }
        if (dist < 6) return;
        activar(a, e.clientX, e.clientY);
      }
      let d = destinoEn(e.clientX, e.clientY);
      if (d && mismoDestino(d, a.origen)) d = null;
      if (!mismoDestino(d, a.objetivo)) {
        a.objetivo = d;
        cb.current.alPrevisualizar?.(a.origen, d);
      }
      setVista((v) => (v ? { ...v, x: e.clientX, y: e.clientY, objetivo: d } : v));
    };
    const soltar = () => {
      const a = terminar();
      if (!a) return;
      if (a.activo) {
        if (a.objetivo) cb.current.alSoltar(a.origen, a.objetivo);
        else cb.current.alPrevisualizar?.(a.origen, null);
      } else cb.current.alPulsar?.(a.origen);
    };
    const cancelar = () => {
      const a = terminar();
      if (a?.activo) cb.current.alPrevisualizar?.(a.origen, null);
    };
    // Con el arrastre táctil en marcha, impedir que la página se desplace
    const tocar = (e: TouchEvent) => { if (actual.current?.activo) e.preventDefault(); };
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
    window.addEventListener('pointercancel', cancelar);
    window.addEventListener('touchmove', tocar, { passive: false });
    return () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
      window.removeEventListener('pointercancel', cancelar);
      window.removeEventListener('touchmove', tocar);
    };
  }, []);

  const empezar = (e: PointerEvent, origen: Origen, texto: string) => {
    if (e.button > 0) return;
    const tactil = e.pointerType === 'touch';
    if (!tactil) e.preventDefault(); // evita seleccionar texto al arrastrar con el ratón
    const a: Arrastre = { origen, texto, x0: e.clientX, y0: e.clientY, tactil, activo: false, objetivo: null, temporizador: 0 };
    if (tactil) {
      a.temporizador = window.setTimeout(() => {
        if (actual.current === a) {
          a.activo = true;
          setVista({ origen, texto, x: a.x0, y: a.y0, objetivo: null });
          navigator.vibrate?.(12);
        }
      }, 280);
    }
    actual.current = a;
  };

  return {
    empezar,
    arrastrando: vista?.origen ?? null,
    objetivo: vista?.objetivo ?? null,
    fantasma: vista ? <div class="fantasma" style={{ left: `${vista.x}px`, top: `${vista.y}px` }}>{vista.texto}</div> : null,
  };
}
