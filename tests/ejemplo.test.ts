import { describe, expect, it } from 'vitest';
import { construirTrono } from '../src/geometria/trono';
import { calcularPesos, validarConfig } from '../src/geometria/trono';
import { cuadrillaEjemplo, HOMBRO_MAX, HOMBRO_MIN, TALLAS_EJEMPLO, tronoEjemplo } from '../src/io/ejemplo';
import { cuadrillaClasica, tronoClasico } from './datos';

describe('datos de ejemplo', () => {
  const t = construirTrono(tronoEjemplo());

  it('es el trono del Rocío: mesa de 4,80 × 3,48 m, varales de 13 m y unos 4.000 kg', () => {
    const c = tronoEjemplo();
    expect(validarConfig(c)).toEqual([]);
    expect(c.mesa.largo).toBe(4.8);
    expect(c.mesa.ancho).toBe(3.48);
    expect(c.varales.largoDelante + c.mesa.largo + c.varales.largoDetras).toBeCloseTo(13, 9);
    expect(Math.abs(calcularPesos(c).total - 4000)).toBeLessThan(50);
  });

  it('8 varales con 11 filas delante y 11 detrás, y la laceria bajo la mesa: unos 225 en total', () => {
    expect(t.nVarales).toBe(8);
    for (const letra of t.letras) {
      const p = t.puestos.filter((q) => q.codigo?.startsWith(letra) && q.zona !== 'submarino');
      expect(p.filter((q) => q.zona === 'delante').length).toBe(11);
      expect(p.filter((q) => q.zona === 'detras').length).toBe(11);
    }
    // 8 × 22 + 2 × 12 costeros + laceria de 4 en cada uno de los 6 varales interiores
    expect(t.puestos.filter((p) => p.zona !== 'submarino').length).toBe(200);
    expect(t.puestos.filter((p) => p.zona === 'submarino').length).toBe(24);
    expect(Math.abs(t.puestos.length - 225)).toBeLessThanOrEqual(1);
  });

  it('hay más HdT que puestos (algunos de reserva)', () => {
    expect(cuadrillaEjemplo().length).toBeGreaterThan(t.puestos.length);
  });

  it('tallas como en una cuadrilla real: el grueso entre 149 y 155, muchos de 148–149 y pocos altos', () => {
    const h = cuadrillaEjemplo().map((x) => x.hombro);
    expect(h.length).toBe(250);
    expect(Math.min(...h)).toBeGreaterThanOrEqual(HOMBRO_MIN);
    expect(Math.max(...h)).toBeLessThanOrEqual(HOMBRO_MAX);
    const cuenta = (f: (x: number) => boolean) => h.filter(f).length;
    expect(cuenta((x) => x >= 146 && x < 148)).toBeGreaterThanOrEqual(8); // hay de 1,46 y 1,47
    expect(cuenta((x) => x >= 148 && x < 150)).toBeGreaterThanOrEqual(30); // mucha gente de 1,48 y 1,49
    expect(cuenta((x) => x >= 149 && x < 156)).toBeGreaterThan(0.65 * h.length); // el grueso
    expect(cuenta((x) => x >= 156)).toBeLessThan(0.2 * h.length); // por encima, unos cuantos
    expect(h.every((x) => Number.isInteger(x * 2))).toBe(true); // al medio centímetro
    // Cada centímetro tiene exactamente los HdT de la tabla
    for (const [cm, n] of Object.entries(TALLAS_EJEMPLO)) expect(cuenta((x) => Math.floor(x) === Number(cm))).toBe(n);
  });
});

describe('dirección de la inclinación', () => {
  it('con la cuadrilla clásica el trono no va picado y las puntas llevan a los más altos', async () => {
    const { calcularCuadrante } = await import('../src/optimizador/optimizar');
    const { optimizadorPorDefecto } = await import('../src/io/ejemplo');
    const c = tronoClasico(), cu = cuadrillaClasica(), t = construirTrono(c);
    const porId = new Map(cu.map((h) => [h.id, h.hombro]));
    {
      const r = calcularCuadrante(c, cu, optimizadorPorDefecto());
      expect(r.inclinacionGrados).toBeGreaterThanOrEqual(-0.01);
      const media = (n: number) => {
        const hs = t.puestos.filter((p) => p.zona !== 'submarino' && p.numero === n).map((p) => porId.get(r.asignacion[p.idx])!);
        return hs.reduce((a, b) => a + b, 0) / hs.length;
      };
      // Delante: la punta (fila 1) más alta que junto a la mesa (fila 10); detrás igual (32 frente a 23)
      expect(media(1)).toBeGreaterThan(media(10));
      expect(media(t.numeroMax)).toBeGreaterThan(media(t.filasDelante + 12 + 1));
      // Y la punta delantera no más baja que la trasera
      expect(media(1)).toBeGreaterThanOrEqual(media(t.numeroMax));
    }
  });
});
