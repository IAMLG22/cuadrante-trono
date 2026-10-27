import { describe, expect, it } from 'vitest';
import { construirTrono } from '../src/geometria/trono';
import { cuadrillaEjemplo, HOMBRO_MAX, HOMBRO_MIN, TALLAS_EJEMPLO, tronoEjemplo } from '../src/io/ejemplo';

describe('datos de ejemplo', () => {
  const t = construirTrono(tronoEjemplo());

  it('trono de 6 varales con 10 filas delante y 10 detrás en cada varal', () => {
    expect(t.nVarales).toBe(6);
    for (const letra of t.letras) {
      const p = t.puestos.filter((q) => q.codigo?.startsWith(letra));
      expect(p.filter((q) => q.zona === 'delante').length).toBe(10);
      expect(p.filter((q) => q.zona === 'detras').length).toBe(10);
    }
    // 6 × 20 + 2 × 12 costeros + submarino en C y D (4 por varal)
    expect(t.puestos.filter((p) => p.zona !== 'submarino').length).toBe(144);
    expect(t.puestos.filter((p) => p.zona === 'submarino').map((p) => p.codigo)).toEqual(
      ['C-S1', 'C-S2', 'C-S3', 'C-S4', 'D-S1', 'D-S2', 'D-S3', 'D-S4']);
  });

  it('hay más HdT que puestos (algunos de reserva)', () => {
    expect(cuadrillaEjemplo().length).toBeGreaterThan(t.puestos.length);
  });

  it('tallas como en una cuadrilla real: el grueso entre 149 y 155, muchos de 148–149 y pocos altos', () => {
    const h = cuadrillaEjemplo().map((x) => x.hombro);
    expect(h.length).toBe(180);
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
  it('con la cuadrilla de ejemplo el trono no va picado y las puntas llevan a los más altos', async () => {
    const { calcularCuadrante } = await import('../src/optimizador/optimizar');
    const { optimizadorPorDefecto } = await import('../src/io/ejemplo');
    const c = tronoEjemplo(), cu = cuadrillaEjemplo(), t = construirTrono(c);
    const porId = new Map(cu.map((h) => [h.id, h.hombro]));
    for (const prioridadConfianza of [0, 0.5, 1]) {
      const r = calcularCuadrante(c, cu, { ...optimizadorPorDefecto(), prioridadConfianza });
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
