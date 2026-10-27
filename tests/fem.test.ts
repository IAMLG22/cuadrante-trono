import { describe, expect, it } from 'vitest';
import { construirTrono } from '../src/geometria/trono';
import { construirModelo, GRAV, K_PERSONA } from '../src/fem/modelo';
import { flechasPuntas, perfilIdeal, resolverContacto } from '../src/fem/contacto';
import { precalcularRapido, resolverRapido } from '../src/fem/rapido';
import { aleatorio } from '../src/io/ejemplo';
import { tronoPrueba } from './datos';

const trono = construirTrono(tronoPrueba());
const modelo = construirModelo(trono);
const N = trono.puestos.length;
const Fid = modelo.pesoTotalN / N;
const ideal = perfilIdeal(modelo, Fid);
const xs = trono.puestos.map((p) => p.x);

/** Alturas de hombro realistas: perfil ideal más un ruido de ±1,5 cm, simétrico si se pide. */
function alturasRuido(semilla: number, simetricas: boolean): Float64Array {
  const r = aleatorio(semilla);
  const h = new Float64Array(N);
  for (const p of trono.puestos) {
    if (simetricas && p.espejo < p.idx) h[p.idx] = h[p.espejo];
    else h[p.idx] = 1.26 + ideal.w[p.idx] + Fid / K_PERSONA + (r() - 0.5) * 0.03;
  }
  return h;
}

describe('modelo estructural', () => {
  it('el trono de prueba tiene 184 puestos', () => {
    expect(N).toBe(184);
  });

  it('1. hombros sobre el perfil ideal ⇒ todas las cargas iguales (< 0,01 kg)', () => {
    const h = Float64Array.from(ideal.w, (w) => 1.25 + w + Fid / K_PERSONA);
    const sol = resolverContacto(modelo, h);
    for (const F of sol.F) expect(Math.abs(F - Fid) / GRAV).toBeLessThan(0.01);
  });

  it('2. la suma de las cargas es el peso total', () => {
    for (const semilla of [1, 2, 3]) {
      const sol = resolverContacto(modelo, alturasRuido(semilla, false));
      const suma = sol.F.reduce((a, b) => a + b, 0);
      expect(Math.abs(suma - modelo.pesoTotalN) / GRAV).toBeLessThan(1e-4);
    }
  });

  it('3. asignación simétrica ⇒ alabeo ~0', () => {
    const sol = resolverContacto(modelo, alturasRuido(7, true));
    expect(Math.abs(sol.alabeo)).toBeLessThan(1e-9);
    const asim = resolverContacto(modelo, alturasRuido(7, false));
    expect(Math.abs(asim.alabeo)).toBeGreaterThan(1e-6);
  });

  it('4. cuesta uniforme sin cdg elevado no cambia el reparto', () => {
    const h = alturasRuido(11, false);
    const llano = resolverContacto(modelo, h);
    const cuesta = resolverContacto(modelo, h, { pendiente: 0.05, xs, conCdg: false });
    for (let i = 0; i < N; i++) expect(Math.abs(cuesta.F[i] - llano.F[i]) / GRAV).toBeLessThan(1e-6);
    expect(cuesta.cabeceo - llano.cabeceo).toBeCloseTo(0.05, 9);
  });

  it('cuesta con cdg elevado: al subir cargan más los de detrás', () => {
    const h = alturasRuido(11, false);
    const llano = resolverContacto(modelo, h);
    const sube = resolverContacto(modelo, h, { pendiente: 0.05, xs, conCdg: true });
    // Por zonas completas: la fila de la punta puede subir algo porque el voladizo, más
    // descargado, se flecta menos.
    const delante = trono.puestos.filter((p) => p.zona === 'delante').map((p) => p.idx);
    const detras = trono.puestos.filter((p) => p.zona === 'detras').map((p) => p.idx);
    const suma = (F: Float64Array, ids: number[]) => ids.reduce((a, i) => a + F[i], 0);
    expect(suma(sube.F, delante)).toBeLessThan(suma(llano.F, delante));
    expect(suma(sube.F, detras)).toBeGreaterThan(suma(llano.F, detras));
  });

  it('un HdT demasiado bajo no carga y el resto sigue en equilibrio', () => {
    const h = alturasRuido(5, false);
    h[0] -= 0.2;
    const sol = resolverContacto(modelo, h);
    expect(sol.F[0]).toBe(0);
    expect(sol.activos[0]).toBe(0);
    const suma = sol.F.reduce((a, b) => a + b, 0);
    expect(Math.abs(suma - modelo.pesoTotalN) / GRAV).toBeLessThan(1e-4);
  });

  it('voladizo sin quitacimbre ni cabezas: flecha de la punta = qL⁴/(8EI)', () => {
    // Perfil ideal sin personas (carga ideal 0): solo el peso propio del varal.
    const c = tronoPrueba();
    c.quitacimbres.activo = false;
    c.varales.cabezas = { delante: { peso: 0, longitud: 0 }, detras: { peso: 0, longitud: 0 } };
    const t = construirTrono(c);
    const p = perfilIdeal(construirModelo(t), 0);
    const q = t.seccion.kgPorMetro * GRAV;
    expect(p.puntas[0]).toBeCloseTo(-(q * c.varales.largoDelante ** 4) / (8 * t.seccion.EI), 9);
  });

  it('cabeza de varal: suma P·L³/(3EI) + (P·l/2)·L²/(2EI) a la flecha de la punta', () => {
    const c = tronoPrueba();
    c.quitacimbres.activo = false;
    c.varales.cabezas = { delante: { peso: 15, longitud: 0.4 }, detras: { peso: 15, longitud: 0.4 } };
    const t = construirTrono(c);
    const p = perfilIdeal(construirModelo(t), 0);
    const L = c.varales.largoDelante, EI = t.seccion.EI;
    const q = t.seccion.kgPorMetro * GRAV, P = 15 * GRAV, M = P * 0.2;
    const esperado = -(q * L ** 4 / 8 + P * L ** 3 / 3 + M * L ** 2 / 2) / EI;
    expect(p.puntas[0]).toBeCloseTo(esperado, 9);
    // Detrás, por simetría, lo mismo
    expect(p.puntas[t.nVarales]).toBeCloseTo(esperado, 9);
    // Y el peso total las incluye
    expect(t.pesos.cabezas).toBeCloseTo(8 * 30, 9);
  });
});

describe('solver rápido en el espacio de los puestos', () => {
  const rapido = precalcularRapido(modelo);
  for (const [nombre, op] of [
    ['llano', {}],
    ['subiendo con cdg', { pendiente: 0.05, xs, conCdg: true }],
    ['bajando con cdg', { pendiente: -0.05, xs, conCdg: true }],
  ] as const) {
    it(`coincide con el modelo completo (${nombre}, con HdT que no llegan)`, () => {
      const h = alturasRuido(21, false);
      h[3] -= 0.06; h[50] -= 0.08; h[200] -= 0.05; // algunos no llegan
      const a = resolverContacto(modelo, h, op);
      const b = resolverRapido(rapido, h, op);
      expect(Array.from(b.activos)).toEqual(Array.from(a.activos));
      for (let i = 0; i < N; i++) expect(Math.abs(b.F[i] - a.F[i]) / GRAV).toBeLessThan(1e-6);
      expect(b.cabeceo).toBeCloseTo(a.cabeceo, 10);
      expect(b.alabeo).toBeCloseTo(a.alabeo, 10);
      const fl = flechasPuntas(modelo, a);
      for (let q = 0; q < fl.length; q++) expect(b.flechas[q]).toBeCloseTo(fl[q], 9);
    });
  }
});
