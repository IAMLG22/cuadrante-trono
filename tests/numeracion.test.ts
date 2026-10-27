import { describe, expect, it } from 'vitest';
import { construirTrono, distanciasFilas, separacionFilas } from '../src/geometria/trono';
import { tronoPrueba } from './datos';

const numerosDe = (t: ReturnType<typeof construirTrono>, letra: string) =>
  t.puestos.filter((p) => p.codigo?.startsWith(letra)).map((p) => p.numero!).sort((a, b) => a - b);

const rango = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

describe('numeración de puestos', () => {
  const c = tronoPrueba();
  c.puestos.filasDelante = 10;
  c.puestos.filasDetras = 11;
  c.puestos.costerosPorLado = 11;
  c.varales.largoDetras = 5;
  const t = construirTrono(c);

  it('5. el varal B va del 1 al 10 y del 22 al 32', () => {
    expect(numerosDe(t, 'B')).toEqual([...rango(1, 10), ...rango(22, 32)]);
  });

  it('el varal A va del 1 al 32 sin cortes', () => {
    expect(numerosDe(t, 'A')).toEqual(rango(1, 32));
    expect(numerosDe(t, 'H')).toEqual(rango(1, 32));
  });

  it('el 1 es el más cercano a la punta delantera y los números crecen hacia atrás', () => {
    const a = t.puestos.filter((p) => p.varal === 0 && p.codigo).sort((p, q) => p.numero! - q.numero!);
    for (let i = 1; i < a.length; i++) expect(a[i].x).toBeLessThan(a[i - 1].x);
  });

  it('el mismo número es la misma fila transversal en todos los varales', () => {
    const b7 = t.puestos.find((p) => p.codigo === 'B7')!;
    const g7 = t.puestos.find((p) => p.codigo === 'G7')!;
    expect(b7.x).toBeCloseTo(g7.x, 12);
    expect(b7.espejo).toBe(g7.idx);
  });

  it('puestos clave: 2 filas exteriores y las 4 esquinas', () => {
    const claves = t.puestos.filter((p) => p.clave).map((p) => p.codigo);
    expect(claves).toContain('A1');
    expect(claves).toContain('D2');
    expect(claves).toContain('E31');
    expect(claves).toContain('H32');
    expect(claves).toContain('A11');
    expect(claves).toContain('A21');
    expect(claves).not.toContain('A12');
    expect(claves).not.toContain('C3');
    expect(claves.length).toBe(4 * 8 + 4);
  });

  it('las filas se reparten por igual en el voladizo, con medio tramo junto a la mesa y en la punta', () => {
    expect(separacionFilas(4.5, 10)).toBeCloseTo(0.45, 12);
    const d = distanciasFilas(4.5, 10);
    expect(d[0]).toBeCloseTo(0.225, 12);
    expect(d[9]).toBeCloseTo(4.275, 12);
    for (let i = 1; i < d.length; i++) expect(d[i] - d[i - 1]).toBeCloseTo(0.45, 12);
    expect(distanciasFilas(4.5, 0)).toEqual([]);
    expect(construirTrono(tronoPrueba()).puestos.length).toBe(184);
  });
});
