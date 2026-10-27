// Exportación del cuadrante a CSV y a Excel (SheetJS, cargado bajo demanda).

import { aCsv, descargar } from './csv';
import { tablaCuadrante, tablaPorVaral, tablaReserva, tablaResumen, type Vista } from './tablas';

const fecha = () => new Date().toISOString().slice(0, 10);

export function exportarCsv(v: Vista) {
  descargar(`cuadrante-${fecha()}.csv`, aCsv(tablaCuadrante(v)), 'text/csv;charset=utf-8');
}

export function exportarCsvPorVaral(v: Vista) {
  descargar(`cuadrante-por-varal-${fecha()}.csv`, aCsv(tablaPorVaral(v)), 'text/csv;charset=utf-8');
}

export async function exportarXlsx(v: Vista) {
  const XLSX = await import('xlsx');
  const libro = XLSX.utils.book_new();
  const hoja = (nombre: string, filas: (string | number | null)[][], anchos: number[]) => {
    const h = XLSX.utils.aoa_to_sheet(filas.map((f) => f.map((c) => (typeof c === 'number' ? Math.round(c * 100) / 100 : c))));
    h['!cols'] = anchos.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(libro, h, nombre);
  };
  hoja('Cuadrante', tablaCuadrante(v), [10, 32, 12, 10, 11]);
  hoja('Por varal', tablaPorVaral(v), [5, ...v.trono.letras.map(() => 28)]);
  hoja('Reserva', tablaReserva(v), [32, 12, 10]);
  hoja('Resumen', tablaResumen(v), [38, 20]);
  XLSX.writeFile(libro, `cuadrante-${fecha()}.xlsx`);
}
