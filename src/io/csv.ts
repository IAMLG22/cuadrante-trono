// Importar la cuadrilla desde CSV o desde un pegado de Excel, y exportar a CSV.

import type { HdT } from '../geometria/tipos';

export interface Importacion {
  cuadrilla: HdT[];
  avisos: string[];
}

/** Convierte "119,5" o "119.5" en número. */
export function numero(texto: string): number {
  const t = texto.trim().replace(/\s/g, '').replace(',', '.');
  if (t === '') return NaN;
  return Number(t);
}

/** Separa una línea respetando comillas dobles. */
function separar(linea: string, sep: string): string[] {
  const campos: string[] = [];
  let actual = '', comillas = false;
  for (let i = 0; i < linea.length; i++) {
    const ch = linea[i];
    if (comillas) {
      if (ch === '"' && linea[i + 1] === '"') { actual += '"'; i++; }
      else if (ch === '"') comillas = false;
      else actual += ch;
    } else if (ch === '"') comillas = true;
    else if (ch === sep) { campos.push(actual); actual = ''; }
    else actual += ch;
  }
  campos.push(actual);
  return campos.map((c) => c.trim());
}

function detectarSeparador(lineas: string[]): string {
  const muestra = lineas.slice(0, 10).join('\n');
  for (const sep of ['\t', ';']) if (muestra.includes(sep)) return sep;
  return ',';
}

const normalizar = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Columnas esperadas: Nombre, Altura de hombro (cm), Confianza (1–3).
 * La fila de cabecera es opcional; si existe, se usa para localizar las columnas.
 */
export function importarCuadrilla(texto: string): Importacion {
  const lineas = texto.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
  const avisos: string[] = [];
  if (lineas.length === 0) return { cuadrilla: [], avisos: ['No hay datos.'] };
  const sep = detectarSeparador(lineas);
  let filas = lineas.map((l) => separar(l, sep));

  let cNombre = 0, cHombro = 1, cConf = 2;
  const cab = filas[0].map(normalizar);
  const pareceCabecera = filas[0].length > 1 && Number.isNaN(numero(filas[0][1] ?? ''));
  if (pareceCabecera) {
    const buscar = (claves: string[]) => cab.findIndex((c) => claves.some((k) => c.includes(k)));
    const n = buscar(['nombre', 'name']);
    const h = buscar(['hombro', 'altura', 'talla']);
    const c = buscar(['confianza', 'conf']);
    if (n >= 0) cNombre = n;
    if (h >= 0) cHombro = h;
    cConf = c; // -1 si no hay columna de confianza
    filas = filas.slice(1);
  }

  const cuadrilla: HdT[] = [];
  let sinConfianza = 0;
  filas.forEach((f, i) => {
    const linea = i + (pareceCabecera ? 2 : 1);
    const nombre = (f[cNombre] ?? '').trim();
    let hombro = numero(f[cHombro] ?? '');
    if (!nombre && Number.isNaN(hombro)) return;
    if (Number.isNaN(hombro)) {
      avisos.push(`Línea ${linea}: altura de hombro no válida («${f[cHombro] ?? ''}»), se omite.`);
      return;
    }
    if (hombro < 3) hombro *= 100; // venía en metros
    if (hombro < 80 || hombro > 220) avisos.push(`Línea ${linea}: altura de hombro poco habitual (${hombro} cm).`);
    const confTxt = cConf >= 0 ? (f[cConf] ?? '').trim() : '';
    let confianza = Math.round(numero(confTxt));
    if (!(confianza >= 1 && confianza <= 3)) {
      if (confTxt !== '') avisos.push(`Línea ${linea}: confianza «${confTxt}» no válida, se usa 2.`);
      else sinConfianza++;
      confianza = 2;
    }
    cuadrilla.push({ id: cuadrilla.length + 1, nombre: nombre || `HdT ${cuadrilla.length + 1}`, hombro, confianza: confianza as 1 | 2 | 3 });
  });
  if (sinConfianza > 0) avisos.push(`${sinConfianza} HdT sin confianza: se les ha puesto 2.`);
  return { cuadrilla, avisos };
}

/** CSV con «;» y coma decimal (lo que abre bien Excel en español). */
export function aCsv(filas: (string | number | null)[][]): string {
  const celda = (v: string | number | null) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'number' ? String(Math.round(v * 100) / 100).replace('.', ',') : v;
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + filas.map((f) => f.map(celda).join(';')).join('\r\n');
}

export function descargar(nombre: string, contenido: BlobPart, tipo: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
