import { describe, expect, it } from 'vitest';
import type { CuadrillaTipo } from '../src/geometria/tipos';
import { separacionFilas } from '../src/geometria/trono';
import {
  alarguesAEstudiar, alturasTipo, colocar, conAlargue, conLargo, cuadrillaTipoPorDefecto, estudiarVarales, leerAlturas,
  simularCuadrillas,
} from '../src/optimizador/longitud';
import { cuadrillaClasica, tronoClasico } from './datos';

const cu = cuadrillaClasica();
const tipo = (t: Partial<CuadrillaTipo> = {}): CuadrillaTipo => ({ ...cuadrillaTipoPorDefecto(), origen: 'actual', ...t });
const media = (v: ArrayLike<number>) => Array.from(v).reduce((a, b) => a + b, 0) / v.length;

describe('cuadrilla tipo y cuadrillas simuladas', () => {
  it('lee alturas pegadas de cualquier forma (coma decimal, metros, basura)', () => {
    expect(leerAlturas('152,5\n149; 1,56 abc 300 12')).toEqual([152.5, 149, 156]);
  });

  it('la cuadrilla tipo sale del ejemplo, de la actual, de otros años o de media y dispersión', () => {
    expect(alturasTipo(tipo({ origen: 'ejemplo' }), cu).length).toBe(250);
    expect(alturasTipo(tipo({ origen: 'actual' }), cu).length).toBe(cu.length);
    expect(alturasTipo(tipo({ origen: 'historico', historico: '150 151 152' }), cu)).toEqual([150, 151, 152]);
    const p = alturasTipo(tipo({ origen: 'parametros', media: 153, desviacion: 3, min: 147, max: 160 }), cu);
    expect(media(p)).toBeCloseTo(153, 0);
    expect(Math.min(...p)).toBeGreaterThanOrEqual(147);
    expect(Math.max(...p)).toBeLessThanOrEqual(160);
  });

  it('las simuladas cubren años de gente baja y de gente alta, con más o menos gente', () => {
    const alturas = alturasTipo(tipo({ origen: 'ejemplo' }), cu);
    const s = simularCuadrillas(alturas, 200, 2, 12);
    expect(s.length).toBe(12);
    for (const g of s) {
      expect(Array.from(g)).toEqual(Array.from(g).sort((a, b) => a - b));
      expect(g.length).toBeGreaterThan(170);
      expect(g.length).toBeLessThan(230);
    }
    // La primera es un año de gente baja y la última de gente alta: unos 4 cm de diferencia
    expect(media(s[11]) - media(s[0])).toBeGreaterThan(0.03);
    expect(media(s[11]) - media(s[0])).toBeLessThan(0.05);
  });

  it('cada puesto recibe a la persona libre más cercana a lo que pide, sin repetir a nadie', () => {
    const w = Float64Array.from([0, 0.01, 0.02, 0.05]);
    const gente = Float64Array.from([1.48, 1.49, 1.50, 1.53, 1.60]);
    expect(Array.from(colocar(w, 1.48, gente))).toEqual([1.48, 1.49, 1.50, 1.53]);
    // Si falta gente, se quedan vacíos los puestos que más altura piden (las puntas)
    const h = colocar(w, 1.48, Float64Array.from([1.48, 1.49, 1.50]));
    expect(h[3]).toBe(-10);
    expect(Array.from(h.slice(0, 3))).toEqual([1.48, 1.49, 1.50]);
  });
});

describe('¿varales óptimos?', () => {
  it('cambiar el largo mantiene la separación entre filas', () => {
    const c = tronoClasico();
    const sep = separacionFilas(c.varales.largoDelante, c.puestos.filasDelante);
    const d = conLargo(c, 'delante', 6);
    expect(d.varales.largoDelante).toBe(6);
    expect(d.varales.largoDetras).toBe(c.varales.largoDetras);
    expect(Math.abs(separacionFilas(6, d.puestos.filasDelante) - sep)).toBeLessThan(sep / 2);
  });

  it('se alargan y acortan los dos voladizos a la vez y lo mismo', () => {
    const c = tronoClasico();
    c.varales.largoDetras = 4;
    const d = conAlargue(c, 0.5);
    expect(d.varales.largoDelante).toBe(5);
    expect(d.varales.largoDetras).toBe(4.5);
    const A = alarguesAEstudiar(c);
    expect(A).toContain(0);
    expect(A[0]).toBe(-1.5);
    expect(4.5 + A[A.length - 1]).toBeGreaterThanOrEqual(6 - 1e-9);
  });

  const e = estudiarVarales(tronoClasico(), cu, tipo());

  it('cada largo da un año normal entre un año bueno y uno malo', () => {
    for (const p of e.puntos) {
      expect(p.altosP10).toBeLessThanOrEqual(p.altosKg + 1e-9);
      expect(p.altosKg).toBeLessThanOrEqual(p.altosP90 + 1e-9);
    }
    // La carga ideal siempre baja al alargar…
    for (let i = 1; i < e.puntos.length; i++) expect(e.puntos[i].idealKg).toBeLessThanOrEqual(e.puntos[i - 1].idealKg + 0.2);
    // …pero alargar mucho más no quita kilos a los que más cargan
    expect(e.puntos[e.puntos.length - 1].altosKg).toBeGreaterThan(e.recomendado.altosKg + 2);
  });

  it('el resultado apenas depende del largo del que se parte', () => {
    const recs = [-0.5, 0.5].map((d) => estudiarVarales(conAlargue(tronoClasico(), d), cu, tipo()).recomendado.largo);
    for (const r of recs) expect(Math.abs(r - e.recomendado.largo)).toBeLessThanOrEqual(0.5 + 1e-9);
  });

  it('con una cuadrilla tipo más alta, el largo recomendado no es más corto', () => {
    const bajos = estudiarVarales(tronoClasico(), cu, tipo({ origen: 'parametros', media: 149, desviacion: 2, min: 145, max: 155 }));
    const altos = estudiarVarales(tronoClasico(), cu, tipo({ origen: 'parametros', media: 157, desviacion: 4, min: 149, max: 168 }));
    expect(altos.recomendado.largo).toBeGreaterThanOrEqual(bajos.recomendado.largo);
  });

  it('si no suele haber gente para tantos puestos, no se recomienda ese largo', () => {
    const pocos = estudiarVarales(tronoClasico(), cu, tipo({ disponibles: 130 }));
    const actual = pocos.puntoActual;
    expect(actual.faltaGente).toBeGreaterThan(0.5); // 152 puestos y unos 130 de gente
    expect(pocos.recomendado.faltaGente).toBeLessThanOrEqual(0.5);
    expect(pocos.recomendado.largo).toBeLessThan(pocos.actual);
    expect(pocos.veredicto).toBe('largo');
  });
});
