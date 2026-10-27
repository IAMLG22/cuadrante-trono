import { describe, expect, it } from 'vitest';
import { mover } from '../src/io/mover';

describe('mover a la gente en el cuadrante', () => {
  it('de la lista a un puesto vacío', () => {
    expect(mover({}, { hdt: 7 }, { puesto: 'A1' })).toEqual({ A1: 7 });
  });
  it('de la lista a un puesto ocupado: el que estaba vuelve a la lista', () => {
    expect(mover({ A1: 3 }, { hdt: 7 }, { puesto: 'A1' })).toEqual({ A1: 7 });
  });
  it('entre dos puestos ocupados: se intercambian', () => {
    expect(mover({ A1: 3, B2: 5 }, { puesto: 'A1' }, { puesto: 'B2' })).toEqual({ A1: 5, B2: 3 });
  });
  it('a un puesto vacío: se mueve', () => {
    expect(mover({ A1: 3 }, { puesto: 'A1' }, { puesto: 'C4' })).toEqual({ C4: 3 });
  });
  it('a la lista: queda libre', () => {
    expect(mover({ A1: 3, B2: 5 }, { puesto: 'A1' }, { zona: 'lista' })).toEqual({ B2: 5 });
  });
  it('sin cambios devuelve null', () => {
    expect(mover({ A1: 3 }, { puesto: 'A1' }, { puesto: 'A1' })).toBeNull();
    expect(mover({}, { puesto: 'A1' }, { puesto: 'B1' })).toBeNull();
  });
});
