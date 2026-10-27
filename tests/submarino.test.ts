import { describe, expect, it } from 'vitest';
import type { ConfigTrono } from '../src/geometria/tipos';
import { construirTrono, validarConfig, varalesSubmarino } from '../src/geometria/trono';
import { optimizadorPorDefecto } from '../src/io/ejemplo';
import { calcularCuadrante, evaluarAsignacion } from '../src/optimizador/optimizar';
import { tronoBase } from './datos';
import { generarCuadrilla, normal } from '../src/io/ejemplo';

const conSubmarino = (varales: number[], porVaral = 4, numero: 4 | 6 | 8 = 6): ConfigTrono => {
  const c = tronoBase();
  c.varales.numero = numero;
  c.submarino = { varales, porVaral };
  return c;
};

const cuadrilla = (n: number) => generarCuadrilla(n, 9, (r) => Math.round((153 + 3 * normal(r)) * 2) / 2);
const op = { ...optimizadorPorDefecto(), prioridadConfianza: 0 };

describe('submarino: geometría', () => {
  it('C y D con 4 por varal: 8 puestos bajo la mesa, repartidos a lo largo de ella', () => {
    const t = construirTrono(conSubmarino([2, 3]));
    const sub = t.puestos.filter((p) => p.zona === 'submarino');
    expect(sub.map((p) => p.codigo)).toEqual(['C-S1', 'C-S2', 'C-S3', 'C-S4', 'D-S1', 'D-S2', 'D-S3', 'D-S4']);
    const L = t.config.mesa.largo;
    expect(sub.filter((p) => p.varal === 2).map((p) => +p.x.toFixed(6))).toEqual([L * 3 / 8, L / 8, -L / 8, -L * 3 / 8].map((x) => +x.toFixed(6)));
    for (const p of sub) expect(p.y).toBeCloseTo(t.yVarales[p.varal], 12);
    // Espejo: C-S1 ↔ D-S1
    const c1 = sub.find((p) => p.codigo === 'C-S1')!, d1 = sub.find((p) => p.codigo === 'D-S1')!;
    expect(c1.espejo).toBe(d1.idx);
    // El resto de la numeración no cambia
    expect(t.puestos.filter((p) => p.zona !== 'submarino').length).toBe(144);
  });

  it('si el varal simétrico no trabaja, el puesto es su propio espejo', () => {
    const t = construirTrono(conSubmarino([2]));
    for (const p of t.puestos.filter((q) => q.zona === 'submarino')) expect(p.espejo).toBe(p.idx);
  });

  it('solo cuentan los varales interiores: 4 con 6 varales y 6 con 8', () => {
    expect(varalesSubmarino(conSubmarino([1, 2, 3, 4]))).toEqual([1, 2, 3, 4]);
    expect(varalesSubmarino(conSubmarino([1, 2, 3, 4, 5, 6], 4, 8))).toEqual([1, 2, 3, 4, 5, 6]);
    expect(validarConfig(conSubmarino([0, 2]))).toContain('En el submarino solo pueden trabajar los varales interiores.');
    expect(validarConfig(conSubmarino([2, 5]))).toContain('En el submarino solo pueden trabajar los varales interiores.');
    expect(validarConfig(conSubmarino([2, 3], -1)).join(' ')).toMatch(/personas por varal del submarino/);
    expect(validarConfig(conSubmarino([2, 3]))).toEqual([]);
  });
});

describe('submarino: rellenar huecos', () => {
  const c = conSubmarino([2, 3]);
  const t = construirTrono(c);
  const sub = t.puestos.filter((p) => p.zona === 'submarino');
  const cu = cuadrilla(170);

  it('rellena también los puestos del submarino', () => {
    const r = calcularCuadrante(c, cu, op);
    for (const p of t.puestos) expect(r.asignacion[p.idx]).toBeGreaterThan(0);
    expect(new Set(r.asignacion).size).toBe(152);
    expect(r.vacios).toBe(0);
    expect(Math.abs(r.cargasKg.reduce((a, b) => a + b, 0) - r.pesoTotal)).toBeLessThan(1e-4);
    expect(r.cargaIdeal).toBeCloseTo(r.pesoTotal / 152, 9);
    // Bajo la mesa no pone a los más altos: el submarino carga cerca de lo ideal
    for (const p of sub) expect(r.cargasKg[p.idx]).toBeGreaterThan(0);
  });

  it('respeta a los que el capataz ha puesto en el submarino y rellena el resto', () => {
    const colocados = t.puestos.map(() => -1);
    colocados[sub[0].idx] = cu[0].id;
    colocados[sub[5].idx] = cu[1].id;
    const r = calcularCuadrante(c, cu, op, () => {}, colocados);
    expect(r.asignacion[sub[0].idx]).toBe(cu[0].id);
    expect(r.asignacion[sub[5].idx]).toBe(cu[1].id);
    for (const p of sub) expect(r.asignacion[p.idx]).toBeGreaterThan(0);
    expect(new Set(r.asignacion).size).toBe(152);
  });

  it('con el submarino vacío a mano, lo que carga el submarino lo deja de cargar el resto', () => {
    const r = calcularCuadrante(c, cu, op);
    const a = [...r.asignacion];
    for (const p of sub) a[p.idx] = -1;
    const e = evaluarAsignacion(c, cu, op, a);
    const cargaSub = sub.reduce((s, p) => s + r.cargasKg[p.idx], 0);
    expect(cargaSub).toBeGreaterThan(0);
    const resto = (res: typeof e) => t.puestos.filter((p) => p.zona !== 'submarino').reduce((s, p) => s + res.cargasKg[p.idx], 0);
    expect(resto(e)).toBeCloseTo(resto(r) + cargaSub, 3);
    expect(e.vacios).toBe(8);
  });
});
