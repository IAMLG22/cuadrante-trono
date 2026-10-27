// Batería de pruebas sobre muchas configuraciones de trono y de cuadrilla.
// Física: numeración, equilibrio, simetría, cuesta, solver rápido y rigidez.
// Optimizador: validez, tiempo, inclinación (nunca picado sin motivo), puntas, fijados y revisión.

import { describe, expect, it } from 'vitest';
import { flechasPuntas, perfilIdeal, resolverContacto } from '../src/fem/contacto';
import { construirModelo, GRAV, K_PERSONA } from '../src/fem/modelo';
import { precalcularRapido, resolverRapido } from '../src/fem/rapido';
import { MATERIALES } from '../src/geometria/secciones';
import type { ConfigTrono, HdT, Seccion, Trono } from '../src/geometria/tipos';
import { construirTrono, filasSugeridas, validarConfig } from '../src/geometria/trono';
import { aleatorio, generarCuadrilla, normal, optimizadorPorDefecto, tronoEjemplo } from '../src/io/ejemplo';
import { calcularCuadrante, evaluarAsignacion, type Resultado } from '../src/optimizador/optimizar';
import { revisar, UMBRAL_PICADO_GRADOS } from '../src/optimizador/revision';

// ---------------------------------------------------------------- configuraciones

interface Caso {
  nombre: string;
  config: ConfigTrono;
  simetrico: boolean; // mismo voladizo delante y detrás
}

const SECCIONES: { nombre: string; material: keyof typeof MATERIALES; seccion: Seccion }[] = [
  { nombre: 'Al 100×100×5', material: 'aluminio', seccion: { tipo: 'rect', ancho: 100, alto: 100, espesor: 5 } },
  { nombre: 'acero 80×80×4', material: 'acero', seccion: { tipo: 'rect', ancho: 80, alto: 80, espesor: 4 } },
  { nombre: 'pino 80×140', material: 'pino', seccion: { tipo: 'macizo', ancho: 80, alto: 140 } },
  { nombre: 'carbono 100×100×4', material: 'carbono', seccion: { tipo: 'rect', ancho: 100, alto: 100, espesor: 4 } },
  { nombre: 'Al Ø100×6', material: 'aluminio', seccion: { tipo: 'redondo', diametro: 100, espesor: 6 } },
];
const VOLADIZOS: [number, number][] = [[4.5, 4.5], [3.5, 5.0], [5.0, 3.5], [2.5, 2.5]];
/** Separaciones con el hueco central más estrecho (un lado + centro). */
const SEPARACIONES: Record<number, number[]> = { 4: [1.3, 0.9], 6: [0.75, 0.75, 0.5], 8: [0.5, 0.5, 0.5, 0.35] };
const CABEZAS = [
  { delante: { peso: 0, longitud: 0 }, detras: { peso: 0, longitud: 0 } },
  { delante: { peso: 10, longitud: 0.35 }, detras: { peso: 10, longitud: 0.35 } },
  { delante: { peso: 25, longitud: 0.6 }, detras: { peso: 12, longitud: 0.3 } },
];

function crearCasos(): Caso[] {
  const casos: Caso[] = [];
  let k = 0;
  for (const n of [4, 6, 8] as const) {
    for (const [del, det] of VOLADIZOS) {
      for (const extras of [false, true]) {
        const c = tronoEjemplo();
        const s = SECCIONES[k % SECCIONES.length];
        c.varales.numero = n;
        c.varales.material = { ...MATERIALES[s.material] };
        c.varales.seccion = { ...s.seccion };
        c.varales.largoDelante = del;
        c.varales.largoDetras = det;
        c.puestos.filasDelante = filasSugeridas(del);
        c.puestos.filasDetras = filasSugeridas(det);
        c.puestos.costerosPorLado = [12, 8, 0, 10][k % 4];
        c.quitacimbres.activo = extras;
        c.palio.activo = extras;
        c.mesa.peso = [3200, 2400, 4000][k % 3];
        c.varales.separaciones = k % 2 === 1 ? [...SEPARACIONES[n]] : null;
        c.varales.cabezas = structuredClone(CABEZAS[k % 3]);
        c.manto = { activo: extras && k % 4 !== 1, peso: 250, distanciaFinal: 0.5, reparto: (['final', 'creciente', 'uniforme'] as const)[k % 3], apoyo: k % 2 === 0 ? 'mesa' : 'varales' };
        if (c.manto.activo && !(c.varales.largoDetras + c.mesa.largo / 2 - c.manto.distanciaFinal > 0)) c.manto.activo = false;
        const cab = c.varales.cabezas;
        const etiquetas = [
          `${n} varales`, s.nombre, `${del}/${det} m`, `costeros ${c.puestos.costerosPorLado}`,
          c.varales.separaciones ? 'centro estrecho' : 'separación igual',
          cab.delante.peso || cab.detras.peso ? `cabezas ${cab.delante.peso}/${cab.detras.peso} kg` : 'sin cabezas',
          ...(extras ? ['quitacimbres y palio'] : []),
          ...(c.manto.activo ? [`manto ${c.manto.reparto}`] : []),
        ];
        // Con cabezas distintas delante y detrás el trono deja de ser simétrico
        const simetrico = del === det && cab.delante.peso === cab.detras.peso && cab.delante.longitud === cab.detras.longitud && !c.manto.activo;
        casos.push({ nombre: etiquetas.join(' · '), config: c, simetrico });
        k++;
      }
    }
  }
  return casos;
}

const CASOS = crearCasos();

// ---------------------------------------------------------------- utilidades

function ideales(t: Trono) {
  const m = construirModelo(t);
  const Fid = m.pesoTotalN / t.puestos.length;
  const w = perfilIdeal(m, Fid).w;
  return { m, Fid, w, hombroCm: Array.from(w, (x) => 140 + (x + Fid / K_PERSONA) * 100) };
}

/** Cuadrilla «igualada» al perfil del trono (más ruido de medio centímetro). */
function cuadrillaIgualada(t: Trono, extra = 0, semilla = 1): HdT[] {
  const { hombroCm } = ideales(t);
  return generarCuadrilla(t.puestos.length + extra, semilla, (r, i) =>
    Math.round((hombroCm[i % hombroCm.length] + 0.25 * normal(r)) * 2) / 2);
}

/** Cuadrilla real: normal de media 155 cm y desviación 3 cm, entre 146 y 164. */
function cuadrillaNormal(n: number, semilla = 2): HdT[] {
  return generarCuadrilla(n, semilla, (r) => {
    let h: number;
    do h = Math.round((155 + 3 * normal(r)) * 2) / 2; while (h < 146 || h > 164);
    return h;
  });
}

const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const kg = (N: number) => N / GRAV;

/** Hombro medio de la fila transversal `numero` en una asignación (ids por puesto). */
function hombroFila(t: Trono, cuad: HdT[], asig: number[], numero: number): number {
  const porId = new Map(cuad.map((h) => [h.id, h.hombro]));
  return media(t.puestos.filter((p) => p.numero === numero && asig[p.idx] >= 0).map((p) => porId.get(asig[p.idx])!));
}

// ---------------------------------------------------------------- física

describe.each(CASOS)('física: $nombre', ({ config, simetrico }) => {
  const t = construirTrono(config);
  const N = t.puestos.length;
  const { m, Fid, w } = ideales(t);
  const xs = t.puestos.map((p) => p.x);
  const r = aleatorio(N * 7 + config.varales.numero);
  const ruido = Float64Array.from(w, (x) => 1.5 + x + Fid / K_PERSONA + (r() - 0.5) * 0.03);

  it('la configuración es válida', () => {
    expect(validarConfig(config)).toEqual([]);
  });

  it('numeración: cada varal correlativo; los interiores se cortan en la mesa', () => {
    const nf = t.filasDelante, nc = config.puestos.costerosPorLado, nb = t.filasDetras;
    t.letras.forEach((l, v) => {
      const nums = t.puestos.filter((p) => p.varal === v).map((p) => p.numero).sort((a, b) => a - b);
      const exterior = v === 0 || v === t.nVarales - 1;
      const esperado = [
        ...Array.from({ length: nf }, (_, i) => i + 1),
        ...(exterior ? Array.from({ length: nc }, (_, i) => nf + 1 + i) : []),
        ...Array.from({ length: nb }, (_, i) => nf + nc + 1 + i),
      ];
      expect(nums).toEqual(esperado);
      expect(t.puestos.filter((p) => p.varal === v).every((p) => p.codigo === `${l}${p.numero}`)).toBe(true);
    });
    expect(N).toBe(t.nVarales * (nf + nb) + 2 * nc);
  });

  it('el mismo número es la misma fila y el espejo es simétrico', () => {
    for (const p of t.puestos) {
      const q = t.puestos[p.espejo];
      expect(q.espejo).toBe(p.idx);
      expect(q.numero).toBe(p.numero);
      expect(q.x).toBeCloseTo(p.x, 12);
      expect(q.y).toBeCloseTo(-p.y, 12);
    }
  });

  it('la suma de las cargas es el peso total (también con gente que no llega)', () => {
    const h = Float64Array.from(ruido);
    h[0] -= 0.1;
    h[N - 1] -= 0.1;
    const s = resolverContacto(m, h);
    expect(Math.abs(kg(s.F.reduce((a, b) => a + b, 0)) - t.pesos.total)).toBeLessThan(1e-4);
    expect(s.F.every((F) => F >= 0)).toBe(true);
  });

  it('con hombros en el perfil ideal, todas las cargas iguales (voladizos iguales)', () => {
    if (!simetrico) return; // con voladizos distintos la carga uniforme no está en equilibrio
    const s = resolverContacto(m, Float64Array.from(w, (x) => 1.5 + x + Fid / K_PERSONA));
    for (const F of s.F) expect(Math.abs(kg(F - Fid))).toBeLessThan(0.01);
  });

  it('asignación simétrica ⇒ alabeo nulo', () => {
    const h = Float64Array.from(ruido);
    for (const p of t.puestos) if (p.espejo < p.idx) h[p.idx] = h[p.espejo];
    expect(Math.abs(resolverContacto(m, h).alabeo)).toBeLessThan(1e-9);
  });

  it('cuesta sin centro de gravedad elevado: el reparto no cambia; con él, carga más el lado de abajo', () => {
    const llano = resolverContacto(m, ruido);
    const sin = resolverContacto(m, ruido, { pendiente: 0.05, xs, conCdg: false });
    for (let i = 0; i < N; i++) expect(Math.abs(kg(sin.F[i] - llano.F[i]))).toBeLessThan(1e-6);
    const sube = resolverContacto(m, ruido, { pendiente: 0.05, xs, conCdg: true });
    const detras = (F: Float64Array) => t.puestos.filter((p) => p.zona === 'detras').reduce((a, p) => a + F[p.idx], 0);
    if (t.pesos.alturaCdg > 0) expect(detras(sube.F)).toBeGreaterThan(detras(llano.F));
  });

  it('el solver rápido da lo mismo que el modelo completo (llano, subiendo y bajando)', () => {
    const rapido = precalcularRapido(m);
    const h = Float64Array.from(ruido);
    h[1] -= 0.08;
    h[N - 2] -= 0.06;
    for (const op of [{}, { pendiente: 0.05, xs, conCdg: true }, { pendiente: -0.05, xs, conCdg: true }]) {
      const a = resolverContacto(m, h, op), b = resolverRapido(rapido, h, op);
      for (let i = 0; i < N; i++) expect(Math.abs(kg(a.F[i] - b.F[i]))).toBeLessThan(1e-6);
      expect(b.cabeceo).toBeCloseTo(a.cabeceo, 9);
      const fl = flechasPuntas(m, a);
      fl.forEach((f, q) => expect(b.flechas[q]).toBeCloseTo(f, 8));
    }
  });

  it('las puntas piden hombros más altos que junto a la mesa, y el voladizo más largo, más', () => {
    const punta = (zona: 'delante' | 'detras', numero: number) =>
      media(t.puestos.filter((p) => p.zona === zona && p.numero === numero).map((p) => w[p.idx]));
    const pDel = punta('delante', 1), mDel = punta('delante', t.filasDelante);
    const pDet = punta('detras', t.numeroMax), mDet = punta('detras', t.filasDelante + config.puestos.costerosPorLado + 1);
    expect(pDel).toBeGreaterThan(mDel);
    expect(pDet).toBeGreaterThan(mDet);
    if (config.varales.largoDetras > config.varales.largoDelante + 0.5) expect(pDet).toBeGreaterThan(pDel);
    if (config.varales.largoDelante > config.varales.largoDetras + 0.5) expect(pDel).toBeGreaterThan(pDet);
    if (simetrico) expect(Math.abs(pDel - pDet)).toBeLessThan(1e-9);
  });

  it('un varal más rígido se flecta menos', () => {
    const rigido = structuredClone(config);
    rigido.varales.material = { ...rigido.varales.material, tipo: 'otro', E_GPa: rigido.varales.material.E_GPa * 3 };
    const t2 = construirTrono(rigido);
    const amplitud = (tt: Trono) => { const x = ideales(tt).w; return Math.max(...x) - Math.min(...x); };
    expect(amplitud(t2)).toBeLessThan(amplitud(t));
  });
});

// ---------------------------------------------------------------- optimizador

type TipoCuadrilla = 'igualada' | 'normal' | 'igualada+reservas';

interface CasoOpt {
  nombre: string;
  caso: Caso;
  cuadrilla: TipoCuadrilla;
  prioridad: number;
}

// Una selección que cubre 4/6/8 varales, voladizos iguales y distintos, y los tres tipos de cuadrilla
const CASOS_OPT: CasoOpt[] = [];
CASOS.forEach((caso, i) => {
  if (i % 3 !== 0) return;
  const cuadrilla = (['igualada', 'normal', 'igualada+reservas'] as const)[(i / 3) % 3];
  const prioridad = [0, 0.5, 1][(i / 3) % 3 === 2 ? 1 : ((i / 3) % 2) * 2 / 2];
  CASOS_OPT.push({ nombre: `${caso.nombre} · cuadrilla ${cuadrilla} · prioridad ${prioridad}`, caso, cuadrilla, prioridad });
});

describe.each(CASOS_OPT)('optimizador: $nombre', ({ caso, cuadrilla, prioridad }) => {
  const t = construirTrono(caso.config);
  const N = t.puestos.length;
  const cuad = cuadrilla === 'normal' ? cuadrillaNormal(N + 4)
    : cuadrillaIgualada(t, cuadrilla === 'igualada+reservas' ? 10 : 0);
  const op = { ...optimizadorPorDefecto(), prioridadConfianza: prioridad };
  let r: Resultado;
  const inicio = performance.now();
  r = calcularCuadrante(caso.config, cuad, op);
  const ms = performance.now() - inicio;

  it('asignación válida: todos los puestos cubiertos, nadie repetido, reservas correctas', () => {
    expect(r.asignacion.length).toBe(N);
    expect(r.asignacion.every((id) => id > 0)).toBe(true);
    expect(new Set(r.asignacion).size).toBe(N);
    expect(r.reservas.length).toBe(cuad.length - N);
    expect(new Set([...r.asignacion, ...r.reservas]).size).toBe(cuad.length);
  });

  it('tarda menos de 3 s', () => {
    expect(ms).toBeLessThan(3000);
  });

  it('respeta la inclinación máxima y nunca deja el trono picado', () => {
    expect(Math.abs(r.inclinacionGrados)).toBeLessThanOrEqual(op.inclinacionMaxGrados + 0.05);
    expect(r.inclinacionGrados).toBeGreaterThanOrEqual(-UMBRAL_PICADO_GRADOS);
  });

  it('los más altos van en las puntas; con voladizos iguales, la punta delantera no es más baja que la trasera', () => {
    const nf = t.filasDelante, nc = caso.config.puestos.costerosPorLado;
    const f1 = hombroFila(t, cuad, r.asignacion, 1);
    const fMesaDel = hombroFila(t, cuad, r.asignacion, nf);
    const fMesaDet = hombroFila(t, cuad, r.asignacion, nf + nc + 1);
    const fUlt = hombroFila(t, cuad, r.asignacion, t.numeroMax);
    expect(f1).toBeGreaterThan(fMesaDel);
    expect(fUlt).toBeGreaterThan(fMesaDet);
    if (caso.simetrico) expect(f1).toBeGreaterThanOrEqual(fUlt - 0.25);
  });

  it('el alabeo es pequeño', () => {
    expect(Math.abs(r.alabeoGrados)).toBeLessThan(0.15);
  });

  it('mejora mucho a una asignación al azar', () => {
    const azar = aleatorio(99);
    const ids = cuad.map((h) => h.id).map((id) => ({ id, k: azar() })).sort((a, b) => a.k - b.k).slice(0, N).map((x) => x.id);
    const e = evaluarAsignacion(caso.config, cuad, op, ids);
    expect(r.resumen.desviacionTipica).toBeLessThan(e.resumen.desviacionTipica);
    // Con voladizos distintos la carga uniforme no es posible (equilibrio de momentos)
    if (cuadrilla !== 'normal' && caso.simetrico) expect(r.resumen.desviacionTipica).toBeLessThan(0.4 * r.cargaIdeal);
  });

  it('la suma de las cargas es el peso total', () => {
    expect(Math.abs(r.cargasKg.reduce((a, b) => a + b, 0) - r.pesoTotal)).toBeLessThan(1e-4);
  });

  it('la revisión es coherente con el resultado', () => {
    const p = revisar(t, r, cuad, op);
    const titulos = p.map((x) => x.titulo).join(' | ');
    if (r.resumen.noLlegan > 0) expect(titulos).toMatch(/no llega/);
    else expect(titulos).not.toMatch(/no llega/);
    if (r.inclinacionGrados < -UMBRAL_PICADO_GRADOS) expect(titulos).toMatch(/picado/);
    expect(p.length).toBeGreaterThan(0);
    for (const x of p) for (const ref of x.puestos) expect(t.puestos.some((q) => q.ref === ref)).toBe(true);
  });

  it('rellenar huecos respeta a los colocados a mano y no repite a nadie', () => {
    const fijos = t.puestos.map(() => -1);
    const elegidos = [0, Math.floor(N / 3), Math.floor(N / 2), N - 1];
    elegidos.forEach((i, k) => (fijos[i] = r.reservas[k] ?? r.asignacion[(i + 7) % N]));
    // Si no hay reservas suficientes, se usan HdT de otros puestos (también vale)
    const usados = new Set<number>();
    for (const i of elegidos) { if (usados.has(fijos[i])) fijos[i] = -1; else usados.add(fijos[i]); }
    const r2 = calcularCuadrante(caso.config, cuad, op, () => {}, fijos);
    elegidos.forEach((i) => { if (fijos[i] >= 0) expect(r2.asignacion[i]).toBe(fijos[i]); });
    expect(new Set(r2.asignacion).size).toBe(N);
  });
});

// ---------------------------------------------------------------- casos límite

describe('casos límite', () => {
  it('sin costeros y con voladizo corto (1 fila) también funciona', () => {
    const c = tronoEjemplo();
    c.puestos.costerosPorLado = 0;
    c.varales.largoDelante = 0.5;
    c.varales.largoDetras = 0.5;
    c.puestos.filasDelante = filasSugeridas(c.varales.largoDelante);
    c.puestos.filasDetras = filasSugeridas(c.varales.largoDetras);
    c.quitacimbres.activo = false;
    const t = construirTrono(c);
    expect(t.filasDelante).toBe(1);
    const cu = cuadrillaIgualada(t);
    const r = calcularCuadrante(c, cu, { ...optimizadorPorDefecto(), prioridadConfianza: 0 });
    expect(new Set(r.asignacion).size).toBe(t.puestos.length);
    expect(Math.abs(r.cargasKg.reduce((a, b) => a + b, 0) - r.pesoTotal)).toBeLessThan(1e-4);
  });

  it('filas a mano que no caben dan error claro', () => {
    const c = tronoEjemplo();
    c.puestos.filasDelante = 20; // 4,5 m / 20 = 0,225 m entre filas
    expect(validarConfig(c).join(' ')).toMatch(/no caben/);
    c.puestos.filasDelante = 15; // 0,30 m: justo cabe
    expect(validarConfig(c)).toEqual([]);
  });

  it('falta gente: error claro con cuántos faltan', () => {
    const c = tronoEjemplo();
    const t = construirTrono(c);
    expect(() => calcularCuadrante(c, cuadrillaNormal(t.puestos.length - 5), optimizadorPorDefecto())).toThrow(/Faltan 5 hombres/);
  });

  it('voladizo trasero más largo: por defecto va nivelado; si se permite, puede ir picado y la revisión avisa', () => {
    const c = tronoEjemplo();
    c.varales.numero = 8;
    c.varales.largoDelante = 3.5;
    c.varales.largoDetras = 5;
    c.puestos.filasDelante = filasSugeridas(c.varales.largoDelante);
    c.puestos.filasDetras = filasSugeridas(c.varales.largoDetras);
    c.quitacimbres.activo = false;
    const t = construirTrono(c);
    const cu = cuadrillaIgualada(t);
    const base = { ...optimizadorPorDefecto(), prioridadConfianza: 0 };
    const nivelado = calcularCuadrante(c, cu, base);
    expect(nivelado.inclinacionGrados).toBeGreaterThanOrEqual(-UMBRAL_PICADO_GRADOS);
    const libre = calcularCuadrante(c, cu, { ...base, permitirPicado: true });
    expect(libre.inclinacionGrados).toBeLessThan(-UMBRAL_PICADO_GRADOS);
    // Ir picado reparte mejor: ese es el precio de nivelarlo
    expect(libre.resumen.desviacionTipica).toBeLessThan(nivelado.resumen.desviacionTipica);
    expect(revisar(t, libre, cu, base).map((p) => p.titulo).join(' ')).toMatch(/picado/);
  });

  it('cuadrilla toda igual de alta: reparto posible y sin picado', () => {
    const c = tronoEjemplo();
    const t = construirTrono(c);
    const cu = generarCuadrilla(t.puestos.length, 5, () => 155);
    const r = calcularCuadrante(c, cu, { ...optimizadorPorDefecto(), prioridadConfianza: 0 });
    expect(r.inclinacionGrados).toBeGreaterThanOrEqual(-0.01);
    expect(Math.abs(r.cargasKg.reduce((a, b) => a + b, 0) - r.pesoTotal)).toBeLessThan(1e-4);
  });

  it('un cuadrante a medio colocar se puede comprobar', () => {
    const c = tronoEjemplo();
    const t = construirTrono(c);
    const cu = cuadrillaIgualada(t);
    const r = calcularCuadrante(c, cu, { ...optimizadorPorDefecto(), prioridadConfianza: 0 });
    const mitad = r.asignacion.map((id, i) => (i % 2 === 0 ? id : -1));
    const e = evaluarAsignacion(c, cu, optimizadorPorDefecto(), mitad);
    expect(e.vacios).toBe(Math.floor(t.puestos.length / 2));
    expect(Math.abs(e.cargasKg.reduce((a, b) => a + b, 0) - e.pesoTotal)).toBeLessThan(1e-4);
  });
});
