import { describe, expect, it } from 'vitest';
import type { ConfigTrono } from '../src/geometria/tipos';
import { separacionFilas } from '../src/geometria/trono';
import { cuadrillaEjemplo, tronoEjemplo } from '../src/io/ejemplo';
import { alarguesAEstudiar, conAlargue, conLargo, estudiarVarales } from '../src/optimizador/longitud';

const cu = cuadrillaEjemplo();
const con = (f: (c: ConfigTrono) => void) => { const c = tronoEjemplo(); f(c); return c; };

describe('¿varales óptimos?', () => {
  it('cambiar el largo mantiene la separación entre filas', () => {
    const c = tronoEjemplo();
    const sep = separacionFilas(c.varales.largoDelante, c.puestos.filasDelante);
    const d = conLargo(c, 'delante', 6);
    expect(d.varales.largoDelante).toBe(6);
    expect(d.varales.largoDetras).toBe(c.varales.largoDetras);
    expect(d.puestos.filasDetras).toBe(c.puestos.filasDetras);
    expect(Math.abs(separacionFilas(6, d.puestos.filasDelante) - sep)).toBeLessThan(sep / 2);
  });

  it('se alargan y acortan los dos voladizos a la vez y lo mismo', () => {
    const c = con((c) => { c.varales.largoDetras = 4; });
    const d = conAlargue(c, 0.5);
    expect(d.varales.largoDelante).toBeCloseTo(5, 9);
    expect(d.varales.largoDetras).toBeCloseTo(4.5, 9);
    const A = alarguesAEstudiar(c);
    expect(A).toContain(0);
    expect(4 + A[0]).toBeGreaterThanOrEqual(1.5 - 1e-9);
    expect(4.5 + A[A.length - 1]).toBeGreaterThanOrEqual(6 - 1e-9);
  });

  it('el trono de ejemplo tiene los varales óptimos para su cuadrilla', () => {
    const e = estudiarVarales(tronoEjemplo(), cu);
    expect(e.veredicto).toBe('optimo');
    // La carga ideal siempre baja al alargar…
    for (let i = 1; i < e.puntos.length; i++) expect(e.puntos[i].idealKg).toBeLessThanOrEqual(e.puntos[i - 1].idealKg + 0.2);
    // …pero alargar mucho más no quita kilos a los que más cargan
    const largo = e.puntos[e.puntos.length - 1];
    expect(largo.altosKg).toBeGreaterThan(e.puntoActual.altosKg + 5);
    expect(largo.acompanan).toBeGreaterThan(e.puntoActual.acompanan);
  });

  it('el resultado no depende del largo del que se parte', () => {
    const recs = [-1, 0, 1].map((d) => estudiarVarales(conAlargue(tronoEjemplo(), d), cu).recomendado.largo);
    expect(Math.max(...recs) - Math.min(...recs)).toBeLessThanOrEqual(0.25 + 1e-9);
    expect(estudiarVarales(conAlargue(tronoEjemplo(), 1), cu).veredicto).toBe('largo');
    expect(estudiarVarales(conAlargue(tronoEjemplo(), -1), cu).veredicto).toBe('corto');
  });

  it('un varal más rígido aguanta más largo; uno más flojo, menos', () => {
    const base = estudiarVarales(tronoEjemplo(), cu).recomendado.largo;
    const acero = estudiarVarales(con((c) => { c.varales.material = { tipo: 'acero', E_GPa: 210, densidad: 7850 }; }), cu).recomendado.largo;
    const fino = estudiarVarales(con((c) => { c.varales.seccion = { tipo: 'rect', ancho: 80, alto: 80, espesor: 3 }; }), cu).recomendado.largo;
    expect(acero).toBeGreaterThan(base);
    expect(fino).toBeLessThan(base);
  });

  it('el óptimo cambia con el resto del trono (palio, manto, cabezas)', () => {
    const e = estudiarVarales(tronoEjemplo(), cu);
    const conPalio = estudiarVarales(con((c) => { c.palio.activo = true; }), cu);
    const conCabezas = estudiarVarales(con((c) => { c.varales.cabezas.delante.peso = 25; c.varales.cabezas.detras.peso = 25; }), cu);
    expect(conPalio.puntoActual.altosKg).toBeGreaterThan(e.puntoActual.altosKg);
    expect(conCabezas.recomendado.largo).toBeGreaterThanOrEqual(e.recomendado.largo);
  });
});
