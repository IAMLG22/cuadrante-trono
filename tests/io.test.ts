import { describe, expect, it } from 'vitest';
import { aCsv, importarCuadrilla } from '../src/io/csv';

describe('importar cuadrilla', () => {
  it('pegado desde Excel (tabuladores, coma decimal, con cabecera)', () => {
    const r = importarCuadrilla('Nombre\tAltura de hombro (cm)\nJuan Pérez\t126,5\nLuis Gil\t124\n');
    expect(r.cuadrilla).toEqual([
      { id: 1, nombre: 'Juan Pérez', hombro: 126.5 },
      { id: 2, nombre: 'Luis Gil', hombro: 124 },
    ]);
    expect(r.avisos).toEqual([]);
  });

  it('CSV con punto y coma y sin cabecera; las columnas de más se ignoran', () => {
    const r = importarCuadrilla('"Ruiz; Antonio";125,5;\nPedro;127;2');
    expect(r.cuadrilla).toEqual([{ id: 1, nombre: 'Ruiz; Antonio', hombro: 125.5 }, { id: 2, nombre: 'Pedro', hombro: 127 }]);
    expect(r.avisos).toEqual([]);
  });

  it('CSV con comas y columnas en otro orden', () => {
    const r = importarCuadrilla('Confianza,Nombre,Hombro\n3,Ana,1.25\n');
    expect(r.cuadrilla[0]).toEqual({ id: 1, nombre: 'Ana', hombro: 125 });
  });

  it('avisa de alturas no válidas', () => {
    const r = importarCuadrilla('Nombre;Hombro;Confianza\nX;abc;2\nY;126;5');
    expect(r.cuadrilla.length).toBe(1);
    expect(r.avisos.length).toBe(1);
  });

  it('exporta CSV con punto y coma y coma decimal', () => {
    expect(aCsv([['A1', 'Juan; hijo', 17.856]])).toBe('﻿A1;"Juan; hijo";17,86');
  });
});
