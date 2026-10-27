// Histograma de alturas de hombro de la cuadrilla (barras de 1 cm).

import { useState } from 'preact/hooks';
import type { HdT } from '../geometria/tipos';
import { fmt } from '../io/tablas';

export function Histograma({ cuadrilla }: { cuadrilla: HdT[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (cuadrilla.length === 0) return null;
  const hs = cuadrilla.map((h) => h.hombro);
  const min = Math.floor(Math.min(...hs)), max = Math.floor(Math.max(...hs));
  const cubos = Array.from({ length: max - min + 1 }, (_, i) => ({ desde: min + i, n: 0 }));
  for (const h of hs) cubos[Math.floor(h) - min].n++;
  const nMax = Math.max(...cubos.map((c) => c.n));
  const media = hs.reduce((a, b) => a + b, 0) / hs.length;
  const porConf = [3, 2, 1].map((k) => cuadrilla.filter((h) => h.confianza === k).length);

  const W = 520, H = 170, mi = 28, md = 8, ms = 12, mb = 24;
  const ancho = (W - mi - md) / cubos.length;
  const py = (n: number) => ms + (1 - n / nMax) * (H - ms - mb);
  const paso = nMax > 20 ? 10 : nMax > 8 ? 5 : 2;
  const etiquetaCada = cubos.length > 24 ? 4 : cubos.length > 12 ? 2 : 1;

  return (
    <figure class="histograma">
      <figcaption>Alturas de hombro</figcaption>
      <div class="cifras compactas">
        <div class="cifra"><span class="cifra-etiqueta">HdT</span><span class="cifra-valor">{cuadrilla.length}</span></div>
        <div class="cifra"><span class="cifra-etiqueta">Media</span><span class="cifra-valor">{fmt(media)} cm</span></div>
        <div class="cifra"><span class="cifra-etiqueta">De … a</span><span class="cifra-valor">{fmt(Math.min(...hs))}–{fmt(Math.max(...hs))}</span></div>
        <div class="cifra"><span class="cifra-etiqueta">Confianza 3 · 2 · 1</span><span class="cifra-valor">{porConf.join(' · ')}</span></div>
      </div>
      <div class="perfil-lienzo">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Histograma de alturas de hombro" onPointerLeave={() => setHover(null)}>
          {Array.from({ length: Math.floor(nMax / paso) + 1 }, (_, i) => i * paso).map((v) => (
            <g class="rejilla-graf">
              <line x1={mi} x2={W - md} y1={py(v)} y2={py(v)} />
              <text x={mi - 6} y={py(v)}>{v}</text>
            </g>
          ))}
          {cubos.map((c, i) => {
            const x = mi + i * ancho;
            const alto = H - mb - py(c.n);
            return (
              <g onPointerEnter={() => setHover(i)}>
                {/* Zona sensible más grande que la barra */}
                <rect x={x} y={ms} width={ancho} height={H - ms - mb} fill="transparent" />
                {c.n > 0 && (
                  <path class={`barra-hist${hover === i ? ' activa' : ''}`}
                    d={barra(x + 1, py(c.n), Math.max(1, ancho - 2), alto)} />
                )}
                {i % etiquetaCada === 0 && <text class="eje-x" x={x + ancho / 2} y={H - 8}>{c.desde}</text>}
              </g>
            );
          })}
        </svg>
        {hover !== null && (
          <div class="tooltip-perfil" style={{ left: `${((mi + (hover + 0.5) * ancho) / W) * 100}%` }}>
            <strong>{cubos[hover].desde}–{cubos[hover].desde + 1} cm</strong>
            <span>{cubos[hover].n} HdT</span>
          </div>
        )}
      </div>
    </figure>
  );
}

/** Barra con las esquinas de arriba redondeadas (4 px) y la base recta sobre el eje. */
function barra(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}
