import { describe, expect, it } from 'vitest';
import { MATERIALES, NOMBRE_MATERIAL, propiedades } from '../src/geometria/secciones';

describe('materiales de los varales', () => {
  const seccion = { tipo: 'rect' as const, ancho: 100, alto: 100, espesor: 5 };

  it('fibra de carbono: 120 GPa y 1550 kg/m³', () => {
    expect(MATERIALES.carbono).toEqual({ tipo: 'carbono', E_GPa: 120, densidad: 1550 });
    expect(NOMBRE_MATERIAL.carbono).toBe('Fibra de carbono');
  });

  it('con la misma sección, el carbono pesa mucho menos que el aluminio y es más rígido', () => {
    const al = propiedades(seccion, MATERIALES.aluminio);
    const cf = propiedades(seccion, MATERIALES.carbono);
    expect(cf.kgPorMetro).toBeCloseTo(al.kgPorMetro * (1550 / 2700), 9);
    expect(cf.EI).toBeCloseTo(al.EI * (120 / 69), 3);
    expect(cf.kgPorMetro).toBeCloseTo(19e-4 * 1550, 9); // 19 cm² de sección
  });
});
