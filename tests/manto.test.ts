import { describe, expect, it } from 'vitest';
import { resolverContacto } from '../src/fem/contacto';
import { construirModelo, GRAV } from '../src/fem/modelo';
import { precalcularRapido, resolverRapido } from '../src/fem/rapido';
import type { ConfigTrono, RepartoManto } from '../src/geometria/tipos';
import { cdgManto, construirTrono, EXPONENTE_MANTO, fraccionMantoEnMesa, longitudManto, validarConfig } from '../src/geometria/trono';
import { aleatorio } from '../src/io/ejemplo';
import { tronoBase } from './datos';

const conManto = (reparto: RepartoManto, peso = 300, distanciaFinal = 0.5, apoyo: 'mesa' | 'varales' = 'varales'): ConfigTrono => {
  const c = tronoBase();
  c.manto = { activo: true, peso, distanciaFinal, reparto, apoyo };
  return c;
};

/** Hombros fijos (los mismos para todos los casos) en torno al perfil del trono sin manto. */
function hombros(c: ConfigTrono): Float64Array {
  const t = construirTrono(c);
  const r = aleatorio(3);
  return Float64Array.from(t.puestos, () => 1.5 + (r() - 0.5) * 0.004);
}

function sumas(c: ConfigTrono, h: Float64Array) {
  const t = construirTrono(c);
  const s = resolverContacto(construirModelo(t), h);
  let F = 0, Fx = 0;
  t.puestos.forEach((p, i) => { F += s.F[i]; Fx += s.F[i] * p.x; });
  const detras = t.puestos.filter((p) => p.zona === 'detras').reduce((a, p) => a + s.F[p.idx], 0) / GRAV;
  return { F: F / GRAV, Fx: Fx / GRAV, detras, t, s };
}

describe('manto', () => {
  const base = tronoBase();
  const h = hombros(base);
  const sinManto = sumas(base, h);

  for (const reparto of ['uniforme', 'creciente', 'final'] as const) {
    it(`equilibrio exacto (${reparto}): el manto suma su peso y su momento respecto a su centro de gravedad`, () => {
      const c = conManto(reparto);
      const con = sumas(c, h);
      const Lm = longitudManto(c);
      const p = EXPONENTE_MANTO[reparto];
      const xCdg = -Lm * (p + 1) / (p + 2); // detrás de la cabeza de la Virgen
      expect(con.F - sinManto.F).toBeCloseTo(300, 4);
      expect(con.Fx - sinManto.Fx).toBeCloseTo(300 * xCdg, 4);
      expect(con.t.pesos.manto).toBe(300);
      expect(con.t.pesos.total - sinManto.t.pesos.total).toBeCloseTo(300, 9);
    });
  }

  it('cuanto más cargado al final, más carga la parte de detrás', () => {
    const u = sumas(conManto('uniforme'), h).detras;
    const cr = sumas(conManto('creciente'), h).detras;
    const fi = sumas(conManto('final'), h).detras;
    expect(cr).toBeGreaterThan(u);
    expect(fi).toBeGreaterThan(cr);
    expect(u).toBeGreaterThan(sinManto.detras);
  });

  it('la fracción sobre la mesa sale de integrar el reparto', () => {
    const c = conManto('final');
    const Lm = longitudManto(c);
    expect(Lm).toBeCloseTo(4.5 / 2 + 4.5 - 0.5, 12);
    expect(fraccionMantoEnMesa(c)).toBeCloseTo((2.25 / Lm) ** 4, 12);
    expect(fraccionMantoEnMesa(conManto('uniforme'))).toBeCloseTo(2.25 / Lm, 12);
  });

  it('un manto corto que no sale de la mesa también cumple el equilibrio', () => {
    const c = conManto('creciente', 200, 4.5 + 0.5); // acaba a 1,75 m de la cabeza, dentro de la mesa
    expect(longitudManto(c)).toBeCloseTo(1.75, 12);
    expect(fraccionMantoEnMesa(c)).toBe(1);
    const con = sumas(c, h);
    expect(con.Fx - sinManto.Fx).toBeCloseTo(200 * (-1.75 * 2 / 3), 4);
  });

  it('el solver rápido coincide con el completo con manto', () => {
    const t = construirTrono(conManto('final'));
    const m = construirModelo(t);
    const a = resolverContacto(m, h), b = resolverRapido(precalcularRapido(m), h);
    for (let i = 0; i < h.length; i++) expect(Math.abs(a.F[i] - b.F[i]) / GRAV).toBeLessThan(1e-6);
  });

  it('el manto inactivo no cambia nada', () => {
    const c = conManto('final');
    c.manto.activo = false;
    const r = sumas(c, h);
    expect(r.Fx).toBeCloseTo(sinManto.Fx, 9);
  });

  it('valida que el manto acabe detrás de la cabeza de la Virgen', () => {
    expect(validarConfig(conManto('final', 300, 7)).join(' ')).toMatch(/acabar detrás del centro/);
    expect(validarConfig(conManto('final', -5)).join(' ')).toMatch(/peso del manto/);
    expect(validarConfig(conManto('final'))).toEqual([]);
  });

  for (const reparto of ['uniforme', 'creciente', 'final'] as const) {
    it(`apoyado en la mesa (${reparto}): mismo equilibrio y solo carga la mesa (fuerza y momento)`, () => {
      const c = conManto(reparto, 300, 0.5, 'mesa');
      const con = sumas(c, h);
      expect(con.F - sinManto.F).toBeCloseTo(300, 4);
      expect(con.Fx - sinManto.Fx).toBeCloseTo(-300 * cdgManto(c), 4);
      // Comparado con el modelo sin manto, solo cambian las cargas de la mesa (z0 y cabeceo)
      const f1 = construirModelo(construirTrono(c)).f0, f0 = construirModelo(construirTrono(base)).f0;
      f1.forEach((v, i) => { if (i > 1) expect(v).toBeCloseTo(f0[i], 9); });
      expect((f0[0] - f1[0]) / GRAV).toBeCloseTo(300, 9);
      expect((f1[1] - f0[1]) / GRAV).toBeCloseTo(300 * cdgManto(c), 9);
    });
  }

  it('apoyado en la mesa carga más a los de detrás que sin manto', () => {
    expect(sumas(conManto('final', 300, 0.5, 'mesa'), h).detras).toBeGreaterThan(sinManto.detras + 150);
  });
});
