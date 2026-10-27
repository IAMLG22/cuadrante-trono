import { describe, expect, it } from 'vitest';
import { construirTrono } from '../src/geometria/trono';
import { cuadrillaEjemplo, HOMBRO_MAX, HOMBRO_MIN, tronoEjemplo } from '../src/io/ejemplo';

describe('datos de ejemplo', () => {
  const t = construirTrono(tronoEjemplo());

  it('trono de 6 varales con 10 filas delante y 10 detrás en cada varal', () => {
    expect(t.nVarales).toBe(6);
    for (const letra of t.letras) {
      const p = t.puestos.filter((q) => q.codigo?.startsWith(letra));
      expect(p.filter((q) => q.zona === 'delante').length).toBe(10);
      expect(p.filter((q) => q.zona === 'detras').length).toBe(10);
    }
    // 6 × 20 + 2 × 12 costeros (el submarino no cuenta)
    expect(t.puestos.length).toBe(144);
  });

  it('hay más HdT que puestos (algunos de reserva)', () => {
    expect(cuadrillaEjemplo().length).toBeGreaterThan(t.puestos.length);
  });

  it('hombros en campana ancha: media ~156 cm, entre 146 y 164, con gente cerca de los extremos', () => {
    const h = cuadrillaEjemplo().map((x) => x.hombro);
    const media = h.reduce((a, b) => a + b, 0) / h.length;
    expect(Math.abs(media - 156)).toBeLessThan(1);
    expect(Math.min(...h)).toBeGreaterThanOrEqual(HOMBRO_MIN);
    expect(Math.max(...h)).toBeLessThanOrEqual(HOMBRO_MAX);
    const frac = (f: (x: number) => boolean) => h.filter(f).length / h.length;
    expect(frac((x) => x >= 153 && x < 157)).toBeLessThan(0.35); // no tanta gente en el medio
    expect(frac((x) => x >= 160)).toBeGreaterThan(0.12); // bastantes cerca de 1,62
    expect(frac((x) => x <= 150)).toBeGreaterThan(0.06); // unos cuantos cerca de 1,46
    expect(frac((x) => x >= 160)).toBeGreaterThan(frac((x) => x <= 150));
    expect(h.every((x) => Number.isInteger(x * 2))).toBe(true); // al medio centímetro
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
        const hs = t.puestos.filter((p) => p.numero === n).map((p) => porId.get(r.asignacion[p.idx])!);
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
