import { describe, expect, it } from 'vitest';
import { construirTrono } from '../src/geometria/trono';
import { optimizadorPorDefecto } from '../src/io/ejemplo';
import { cuadrillaPrueba, tronoPrueba } from './datos';
import { calcularCuadrante, evaluarAsignacion } from '../src/optimizador/optimizar';
import { revisar } from '../src/optimizador/revision';

const c = tronoPrueba();
const op = { ...optimizadorPorDefecto(), prioridadConfianza: 0 };
const cuad = cuadrillaPrueba();
const t = construirTrono(c, op.confianza);
const base = calcularCuadrante(c, cuad, op);

describe('puestos vacíos y fijados', () => {
  it('con puestos vacíos se puede comprobar y los vacíos no cargan', () => {
    const a = [...base.asignacion];
    for (const i of [5, 40, 100, 180]) a[i] = -1;
    const r = evaluarAsignacion(c, cuad, op, a);
    expect(r.vacios).toBe(4);
    for (const i of [5, 40, 100, 180]) expect(r.cargasKg[i]).toBe(0);
    expect(Math.abs(r.cargasKg.reduce((x, y) => x + y, 0) - r.pesoTotal)).toBeLessThan(1e-4);
    expect(r.reservas.length).toBe(4);
  });

  it('con casi nadie colocado avisa de que no se puede comprobar', () => {
    const a = base.asignacion.map((id, i) => (i < 3 ? id : -1));
    expect(() => evaluarAsignacion(c, cuad, op, a)).toThrow(/Coloca más gente/);
  });

  it('rellenar huecos respeta a los que ya están colocados', () => {
    // El capataz coloca a mano a los 10 primeros de la cuadrilla en puestos concretos
    const colocados = t.puestos.map(() => -1);
    const elegidos = [0, 7, 33, 60, 150, 170, 175, 180, 2, 90];
    elegidos.forEach((i, k) => (colocados[i] = cuad[k].id));
    const r = calcularCuadrante(c, cuad, op, () => {}, colocados);
    elegidos.forEach((i, k) => expect(r.asignacion[i]).toBe(cuad[k].id));
    expect(new Set(r.asignacion).size).toBe(184);
    expect(r.vacios).toBe(0);
  });
});

describe('revisión', () => {
  it('un cuadrante optimizado no tiene errores graves de inclinación', () => {
    const p = revisar(t, base, cuad, op);
    expect(p.some((x) => x.titulo.startsWith('El trono va inclinado'))).toBe(false);
  });

  it('detecta vacíos, cargas de más y confianza 1 en puestos clave', () => {
    const a = [...base.asignacion];
    a[100] = -1;
    // Poner al más alto en la fila 10 (carga de más) y a un confianza 1 en A1 (clave)
    const alto = [...cuad].sort((x, y) => y.hombro - x.hombro)[0];
    const iAlto = a.indexOf(alto.id), i10 = t.puestos.find((q) => q.codigo === 'C10')!.idx;
    [a[iAlto], a[i10]] = [a[i10], a[iAlto]];
    const c1 = cuad.find((h) => h.confianza === 1 && a.indexOf(h.id) >= 0)!;
    const iC1 = a.indexOf(c1.id), iA1 = t.puestos.find((q) => q.codigo === 'A1')!.idx;
    [a[iC1], a[iA1]] = [a[iA1], a[iC1]];
    const r = evaluarAsignacion(c, cuad, op, a);
    const p = revisar(t, r, cuad, op);
    const titulos = p.map((x) => x.titulo).join(' | ');
    expect(titulos).toMatch(/1 puesto sin cubrir/);
    expect(titulos).toMatch(/carga.? de más/);
    expect(titulos).toMatch(/Confianza 1 en/);
    expect(p.find((x) => /de más/.test(x.titulo))!.puestos).toContain('C10');
    expect(p.find((x) => /Confianza 1/.test(x.titulo))!.puestos).toContain('A1');
    expect(p[0].nivel).toBe('error');
  });
});
