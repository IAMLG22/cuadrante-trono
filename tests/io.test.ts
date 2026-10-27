import { describe, expect, it } from 'vitest';
import { aCsv, importarCuadrilla } from '../src/io/csv';

describe('importar cuadrilla', () => {
  it('pegado desde Excel (tabuladores, coma decimal, con cabecera)', () => {
    const r = importarCuadrilla('Nombre\tAltura de hombro (cm)\tConfianza\nJuan Pérez\t126,5\t3\nLuis Gil\t124\t1\n');
    expect(r.cuadrilla).toEqual([
      { id: 1, nombre: 'Juan Pérez', hombro: 126.5, confianza: 3 },
      { id: 2, nombre: 'Luis Gil', hombro: 124, confianza: 1 },
    ]);
    expect(r.avisos).toEqual([]);
  });

  it('CSV con punto y coma, sin cabecera y confianza vacía', () => {
    const r = importarCuadrilla('"Ruiz; Antonio";125,5;\nPedro;127;2');
    expect(r.cuadrilla.map((h) => [h.nombre, h.hombro, h.confianza])).toEqual([['Ruiz; Antonio', 125.5, 2], ['Pedro', 127, 2]]);
    expect(r.avisos.join(' ')).toMatch(/1 HdT sin confianza/);
  });

  it('CSV con comas y columnas en otro orden', () => {
    const r = importarCuadrilla('Confianza,Nombre,Hombro\n3,Ana,1.25\n');
    expect(r.cuadrilla[0]).toMatchObject({ nombre: 'Ana', hombro: 125, confianza: 3 });
  });

  it('avisa de alturas no válidas', () => {
    const r = importarCuadrilla('Nombre;Hombro;Confianza\nX;abc;2\nY;126;5');
    expect(r.cuadrilla.length).toBe(1);
    expect(r.avisos.length).toBe(2);
  });

  it('exporta CSV con punto y coma y coma decimal', () => {
    expect(aCsv([['A1', 'Juan; hijo', 17.856]])).toBe('﻿A1;"Juan; hijo";17,86');
  });
});
