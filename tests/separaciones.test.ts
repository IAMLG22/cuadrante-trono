import { describe, expect, it } from 'vitest';
import { resolverContacto } from '../src/fem/contacto';
import { cholesky, resolverCholesky } from '../src/fem/lineal';
import { construirModelo, GRAV } from '../src/fem/modelo';
import { construirTrono, posicionesVarales, separacionesUniformes, validarConfig } from '../src/geometria/trono';
import { aleatorio, tronoEjemplo } from '../src/io/ejemplo';

const ocho = () => {
  const c = tronoEjemplo();
  c.varales.numero = 8;
  c.varales.separaciones = [0.5, 0.5, 0.5, 0.35]; // A–B, B–C, C–D y el hueco central D–E
  return c;
};

describe('separación entre varales', () => {
  it('por defecto, uniforme con los exteriores en los bordes de la mesa', () => {
    const c = tronoEjemplo();
    const y = posicionesVarales(c);
    expect(y[0]).toBeCloseTo(c.mesa.ancho / 2, 12);
    expect(y[y.length - 1]).toBeCloseTo(-c.mesa.ancho / 2, 12);
    const huecos = y.slice(1).map((v, i) => y[i] - v);
    for (const h of huecos) expect(h).toBeCloseTo(c.mesa.ancho / (c.varales.numero - 1), 12);
  });

  it('personalizada: cada lado igual y el hueco central más estrecho', () => {
    const y = posicionesVarales(ocho());
    const huecos = y.slice(1).map((v, i) => +(y[i] - v).toFixed(6));
    expect(huecos).toEqual([0.5, 0.5, 0.5, 0.35, 0.5, 0.5, 0.5]);
    expect(y[0]).toBeCloseTo(-y[7], 12); // simétrico respecto al eje
    expect(y[3]).toBeCloseTo(0.175, 12);
  });

  it('las separaciones uniformes como lista reproducen la posición uniforme', () => {
    const c = tronoEjemplo();
    const u = posicionesVarales(c);
    c.varales.separaciones = separacionesUniformes(c);
    const p = posicionesVarales(c);
    p.forEach((y, i) => expect(y).toBeCloseTo(u[i], 2));
  });

  it('los puestos están sobre su varal y los espejos son simétricos', () => {
    const t = construirTrono(ocho());
    for (const p of t.puestos) {
      expect(p.y).toBeCloseTo(t.yVarales[p.varal], 12);
      expect(t.puestos[p.espejo].y).toBeCloseTo(-p.y, 12);
    }
  });

  it('una asignación simétrica sigue sin alabear', () => {
    const t = construirTrono(ocho());
    const m = construirModelo(t);
    const r = aleatorio(4);
    const h = new Float64Array(t.puestos.length);
    for (const p of t.puestos) h[p.idx] = p.espejo < p.idx ? h[p.espejo] : 1.5 + (r() - 0.5) * 0.03;
    expect(Math.abs(resolverContacto(m, h).alabeo)).toBeLessThan(1e-9);
  });

  it('el quitacimbre mide lo que hay entre los varales exteriores', () => {
    const c = ocho();
    const t = construirTrono(c);
    const c2 = ocho();
    c2.quitacimbres.activo = false;
    const t2 = construirTrono(c2);
    const kgm = 7850 * (60 * 10) * 1e-6; // pletina 60×10 mm de acero
    expect(t.pesos.quitacimbres - t2.pesos.quitacimbres).toBeCloseTo(2 * 3.35 * kgm, 9);
  });

  it('valida que haya tantas separaciones como hacen falta y que sean positivas', () => {
    const c = ocho();
    c.varales.separaciones = [0.5, 0.5];
    expect(validarConfig(c).join(' ')).toMatch(/Faltan separaciones/);
    c.varales.separaciones = [0.5, 0, 0.5, 0.35];
    expect(validarConfig(c).join(' ')).toMatch(/mayores que cero/);
    expect(validarConfig(ocho())).toEqual([]);
  });

  it('las cabezas negativas no son válidas', () => {
    const c = tronoEjemplo();
    c.varales.cabezas.delante.peso = -1;
    expect(validarConfig(c).join(' ')).toMatch(/cabeza delantera/);
  });

  it('con quitacimbre, el varal exterior flecta más que los centrales; un hueco central más estrecho los rigidiza más', () => {
    // Cuánto sube la punta delantera de cada varal (A, B, C, D) al empujarla con 20 kg, con la mesa fija
    const subida = (sep: number[] | null, quita: boolean) => {
      const c = ocho();
      c.varales.separaciones = sep;
      c.quitacimbres.activo = quita;
      const m = construirModelo(construirTrono(c));
      const n = m.ndof, r = n - 3;
      const K = new Float64Array(r * r);
      for (let i = 0; i < r; i++) for (let j = 0; j < r; j++) K[i * r + j] = m.K0[(i + 3) * n + (j + 3)];
      const L = cholesky(K, r);
      return m.puntas.filter((p) => p.lado === 'delante').slice(0, 4).map((p) => {
        const f = new Float64Array(r);
        f[p.dofW - 3] = 20 * GRAV;
        return resolverCholesky(L, r, f)[p.dofW - 3];
      });
    };
    const sin = subida(null, false);
    for (const x of sin) expect(x).toBeCloseTo(sin[0], 12); // sin quitacimbre todos iguales
    const igual = subida(null, true);
    expect(igual[0]).toBeGreaterThan(igual[1]);
    expect(igual[1]).toBeGreaterThan(igual[2]);
    expect(igual[2]).toBeGreaterThan(igual[3]);
    expect(igual[0]).toBeLessThan(sin[0]); // el quitacimbre ayuda también al exterior
    const estrecho = subida([0.5, 0.5, 0.5, 0.35], true);
    expect(estrecho[3]).toBeLessThan(igual[3]);
  });
});
