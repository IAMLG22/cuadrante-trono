// Vista previa del trono en la pantalla de configuración: cifras clave, esquema acotado en planta
// y el perfil de hombros que pide cada fila (exterior frente a central).

import { useMemo, useState } from 'preact/hooks';
import { perfilIdeal } from '../fem/contacto';
import { construirModelo, GRAV, K_PERSONA } from '../fem/modelo';
import type { Trono } from '../geometria/tipos';
import { longitudManto } from '../geometria/trono';
import { fmt } from '../io/tablas';

export function VistaTrono({ t }: { t: Trono }) {
  // Perfil ideal: cuánto más alto que en la mesa tiene que ir el hombro en cada puesto
  const perfil = useMemo(() => {
    try {
      const m = construirModelo(t);
      const Fid = m.pesoTotalN / t.puestos.length;
      return { w: perfilIdeal(m, Fid).w, idealKg: Fid / GRAV, compresionCm: (Fid / K_PERSONA) * 100 };
    } catch {
      return null;
    }
  }, [t]);
  const maxCm = perfil ? Math.max(...Array.from(perfil.w)) * 100 : 0;

  return (
    <div class="vista-trono">
      <div class="cifras compactas">
        <div class="cifra"><span class="cifra-etiqueta">Puestos</span><span class="cifra-valor">{t.puestos.length}</span></div>
        <div class="cifra"><span class="cifra-etiqueta">Peso total</span><span class="cifra-valor">{fmt(t.pesos.total, 0)} kg</span></div>
        <div class="cifra"><span class="cifra-etiqueta">Ideal por persona</span><span class="cifra-valor">{perfil ? `${fmt(perfil.idealKg)} kg` : '—'}</span></div>
        <div class="cifra"><span class="cifra-etiqueta">La punta pide</span><span class="cifra-valor">+{fmt(maxCm)} cm</span></div>
      </div>
      <Esquema t={t} />
      {perfil && <Perfil t={t} w={perfil.w} />}
    </div>
  );
}

// ------------------------------------------------------------------ esquema acotado

function Esquema({ t }: { t: Trono }) {
  const c = t.config;
  const L = c.mesa.largo, B = c.mesa.ancho;
  const xDel = L / 2 + c.varales.largoDelante, xDet = -L / 2 - c.varales.largoDetras;
  const cabD = c.varales.cabezas.delante.longitud, cabT = c.varales.cabezas.detras.longitud;
  const xMax = xDel + cabD, xMin = xDet - cabT;
  const yA = t.yVarales[0], yZ = t.yVarales[t.nVarales - 1];
  const yTop = Math.max(B / 2, yA), yBot = Math.min(-B / 2, yZ);
  // Delante a la derecha; y hacia arriba en pantalla = izquierda del trono (A arriba)
  const X = (x: number) => x, Y = (y: number) => -y;
  const margenIzq = 1.5, margenDer = 0.8, arriba = 1.3, abajo = 0.6;
  const vb = [xMin - margenIzq, Y(yTop) - arriba, xMax - xMin + margenIzq + margenDer, yTop - yBot + arriba + abajo];
  const cota = (x1: number, x2: number, y: number, texto: string) => (
    <g class="cota">
      <line x1={x1} y1={y} x2={x2} y2={y} />
      <line x1={x1} y1={y - 0.08} x2={x1} y2={y + 0.08} />
      <line x1={x2} y1={y - 0.08} x2={x2} y2={y + 0.08} />
      <text x={(x1 + x2) / 2} y={y - 0.14}>{texto}</text>
    </g>
  );
  const yCota1 = Y(yTop) - 0.4, yCota2 = Y(yTop) - 0.95;
  const m = (v: number) => `${fmt(v, 2)} m`;
  return (
    <figure class="esquema">
      <figcaption>Planta (delante a la derecha)</figcaption>
      <svg viewBox={vb.join(' ')} role="img" aria-label="Esquema acotado del trono">
        <rect class="mesa" x={-L / 2} y={Y(B / 2)} width={L} height={B} rx={0.05} />
        <text class="rotulo" x={0} y={(Y(B / 2) + Y(-B / 2)) / 2}>MESA</text>
        {c.manto.activo && longitudManto(c) > 0 && (() => {
          // Silueta orientativa: estrecha en la cabeza de la Virgen y ancha en la cola
          const xf = -longitudManto(c);
          const a0 = 0.25, a1 = (yA - yZ) / 2 + 0.15;
          return (
            <g class="manto">
              <path d={`M0,${Y(a0)} L${xf},${Y(a1)} L${xf},${Y(-a1)} L0,${Y(-a0)} Z`} />
              <text x={xf + 0.25} y={Y(yZ) - 0.25}>MANTO</text>
            </g>
          );
        })()}
        {t.yVarales.map((y, i) => (
          <g>
            <line class="varal" x1={xDet} y1={Y(y)} x2={xDel} y2={Y(y)} />
            {cabD > 0 && <line class="cabeza" x1={xDel} y1={Y(y)} x2={xMax} y2={Y(y)} />}
            {cabT > 0 && <line class="cabeza" x1={xMin} y1={Y(y)} x2={xDet} y2={Y(y)} />}
            <text class="letra" x={xMax + 0.3} y={Y(y)}>{t.letras[i]}</text>
          </g>
        ))}
        {c.quitacimbres.activo && [xDel - c.quitacimbres.distDelante, xDet + c.quitacimbres.distDetras].map((x) => (
          <line class="quitacimbre" x1={x} y1={Y(yA)} x2={x} y2={Y(yZ)} />
        ))}
        {t.puestos.map((p) => <circle class="punto-puesto" cx={X(p.x)} cy={Y(p.y)} r={0.07} />)}
        {/* Cotas a lo largo */}
        {cota(xDet, -L / 2, yCota1, m(c.varales.largoDetras))}
        {cota(-L / 2, L / 2, yCota1, m(L))}
        {cota(L / 2, xDel, yCota1, m(c.varales.largoDelante))}
        {cota(xMin, xMax, yCota2, `Total ${m(xMax - xMin)}`)}
        {/* Separaciones entre varales, a la izquierda */}
        {t.yVarales.slice(1).map((y, i) => {
          const y1 = t.yVarales[i];
          return (
            <g class="cota vertical">
              <line x1={xMin - 0.35} y1={Y(y1)} x2={xMin - 0.35} y2={Y(y)} />
              <line x1={xMin - 0.43} y1={Y(y1)} x2={xMin - 0.27} y2={Y(y1)} />
              <text x={xMin - 0.52} y={(Y(y1) + Y(y)) / 2}>{fmt(y1 - y, 2)}</text>
            </g>
          );
        })}
        <line x1={xMin - 0.43} y1={Y(yZ)} x2={xMin - 0.27} y2={Y(yZ)} class="cota-tope" />
        <text class="delante" x={xMax + 0.45} y={Y(yBot) + 0.45}>DELANTE →</text>
      </svg>
    </figure>
  );
}

// ------------------------------------------------------------------ perfil de hombros

function Perfil({ t, w }: { t: Trono; w: Float64Array }) {
  const [hover, setHover] = useState<number | null>(null);
  const exterior = 0, central = Math.floor((t.nVarales - 1) / 2);
  const serie = (v: number) =>
    t.puestos.filter((p) => p.varal === v).sort((a, b) => a.x - b.x).map((p) => ({ x: p.x, cm: w[p.idx] * 100, numero: p.numero }));
  const sA = serie(exterior), sC = serie(central);
  const xs = sA.map((p) => p.x);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const yMaxDato = Math.max(1, ...sA.map((p) => p.cm), ...sC.map((p) => p.cm));
  const paso = yMaxDato > 8 ? 4 : yMaxDato > 4 ? 2 : 1;
  const yMax = Math.ceil(yMaxDato / paso) * paso;
  // Área de dibujo (px del viewBox)
  const W = 520, H = 220, mi = 40, md = 12, ms = 14, mb = 30;
  const px = (x: number) => mi + ((x - x0) / (x1 - x0 || 1)) * (W - mi - md);
  const py = (cm: number) => ms + (1 - cm / yMax) * (H - ms - mb);
  const ruta = (s: { x: number; cm: number }[]) => s.map((p, i) => `${i ? 'L' : 'M'}${px(p.x).toFixed(1)},${py(p.cm).toFixed(1)}`).join(' ');
  const L = t.config.mesa.largo;
  const numeros = sA.map((p) => p.numero);
  const fila = hover !== null ? numeros[hover] : null;
  const valorEn = (s: typeof sA, n: number | null) => s.find((p) => p.numero === n);
  const mostrarCentral = central !== exterior;
  return (
    <figure class="perfil">
      <figcaption>
        Cuánto más alto que en la mesa tiene que ir el hombro en cada fila
        <span class="leyenda-perfil">
          <span><i class="trazo continuo" />Exterior ({t.letras[exterior]})</span>
          {mostrarCentral && <span><i class="trazo discontinuo" />Central ({t.letras[central]})</span>}
        </span>
      </figcaption>
      <div class="perfil-lienzo">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Perfil de hombros a lo largo del trono"
          onPointerLeave={() => setHover(null)}
          onPointerMove={(e) => {
            const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const xv = ((e.clientX - r.left) / r.width) * W;
            let mejor = 0;
            sA.forEach((p, i) => { if (Math.abs(px(p.x) - xv) < Math.abs(px(sA[mejor].x) - xv)) mejor = i; });
            setHover(mejor);
          }}>
          {/* Zona de la mesa */}
          <rect class="zona-mesa" x={px(Math.max(-L / 2, x0))} y={ms} width={px(Math.min(L / 2, x1)) - px(Math.max(-L / 2, x0))} height={H - ms - mb} />
          {/* Rejilla y ejes */}
          {Array.from({ length: yMax / paso + 1 }, (_, i) => i * paso).map((v) => (
            <g class="rejilla-graf">
              <line x1={mi} x2={W - md} y1={py(v)} y2={py(v)} />
              <text x={mi - 6} y={py(v)}>{v === 0 ? '0' : `+${v}`}</text>
            </g>
          ))}
          <text class="eje-titulo" x={mi} y={H - 8}>← detrás</text>
          <text class="eje-titulo fin" x={W - md} y={H - 8}>delante →</text>
          <text class="eje-titulo centro" x={(px(-L / 2) + px(L / 2)) / 2} y={H - 8}>mesa</text>
          {mostrarCentral && <path class="linea-perfil central" d={ruta(sC)} />}
          <path class="linea-perfil exterior" d={ruta(sA)} />
          {sA.map((p, i) => <circle class={`marca-perfil${hover === i ? ' activa' : ''}`} cx={px(p.x)} cy={py(p.cm)} r={hover === i ? 4.5 : 3} />)}
          {hover !== null && <line class="cursor-perfil" x1={px(sA[hover].x)} x2={px(sA[hover].x)} y1={ms} y2={H - mb} />}
        </svg>
        {fila !== null && hover !== null && (
          <div class="tooltip-perfil" style={{ left: `${(px(sA[hover].x) / W) * 100}%` }}>
            <strong>Fila {fila}</strong>
            <span>{t.letras[exterior]}: +{fmt(valorEn(sA, fila)?.cm ?? 0)} cm</span>
            {mostrarCentral && valorEn(sC, fila) && <span>{t.letras[central]}: +{fmt(valorEn(sC, fila)!.cm)} cm</span>}
          </div>
        )}
      </div>
      <p class="nota">
        Con todos cargando lo mismo. Las puntas se levantan porque la gente empuja hacia arriba y el peso de la mesa cae en el centro:
        ahí tiene que ir la gente más alta.
      </p>
    </figure>
  );
}
