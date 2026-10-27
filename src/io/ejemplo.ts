// Datos de ejemplo que se cargan al abrir la aplicación por primera vez.

import { MATERIALES } from '../geometria/secciones';
import type { ConfigOptimizador, ConfigTrono, HdT } from '../geometria/tipos';
import { CONFIANZA_POR_DEFECTO } from '../geometria/trono';

export function tronoEjemplo(): ConfigTrono {
  return {
    mesa: { largo: 4.5, ancho: 3.5, altura: 1.2, peso: 3200 },
    varales: {
      numero: 6,
      material: { ...MATERIALES.aluminio },
      seccion: { tipo: 'rect', ancho: 100, alto: 100, espesor: 5 },
      largoDelante: 4.5,
      largoDetras: 4.5,
      separaciones: null,
      cabezas: { delante: { peso: 10, longitud: 0.35 }, detras: { peso: 10, longitud: 0.35 } },
    },
    palio: { activo: false, peso: 300, altura: 2.5 },
    manto: { activo: false, peso: 250, distanciaFinal: 0.5, reparto: 'final', apoyo: 'mesa' },
    quitacimbres: {
      activo: true,
      distDelante: 0.3,
      distDetras: 0.3,
      ancho: 60,
      espesor: 10,
      colocacion: 'canto',
      material: { ...MATERIALES.acero },
    },
    puestos: {
      filasDelante: 10,
      filasDetras: 10,
      costerosPorLado: 12,
    },
  };
}

export function optimizadorPorDefecto(): ConfigOptimizador {
  return {
    prioridadConfianza: 0.5,
    inclinacionMaxGrados: 1,
    iteraciones: 30000,
    tolParejaCm: 1,
    permitirPicado: false,
    confianza: { ...CONFIANZA_POR_DEFECTO },
  };
}

const NOMBRES = ['Antonio', 'José', 'Manuel', 'Francisco', 'Juan', 'David', 'Javier', 'Daniel', 'Carlos', 'Miguel',
  'Rafael', 'Pedro', 'Alejandro', 'Pablo', 'Sergio', 'Fernando', 'Jorge', 'Alberto', 'Luis', 'Álvaro', 'Adrián',
  'Rubén', 'Iván', 'Raúl', 'Enrique', 'Salvador', 'Cristóbal', 'Ignacio', 'Andrés', 'Víctor', 'Gonzalo', 'Jesús'];
const APELLIDOS = ['García', 'Rodríguez', 'González', 'Fernández', 'López', 'Martínez', 'Sánchez', 'Pérez', 'Gómez',
  'Martín', 'Jiménez', 'Ruiz', 'Hernández', 'Díaz', 'Moreno', 'Muñoz', 'Álvarez', 'Romero', 'Navarro', 'Torres',
  'Domínguez', 'Ramos', 'Gil', 'Serrano', 'Molina', 'Ortega', 'Delgado', 'Castro', 'Ortiz', 'Rubio', 'Marín', 'Cortés'];

/** Generador pseudoaleatorio con semilla (mulberry32), para que el ejemplo sea siempre el mismo. */
export function aleatorio(semilla: number) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Hombros de la cuadrilla de ejemplo: campana ancha de media 156 cm y desviación 5 cm, sin salir
 * de 146–164 cm. Hay bastantes cerca de 1,62 y unos cuantos cerca de 1,46.
 */
export const HOMBRO_MEDIO = 156;
export const HOMBRO_DESVIACION = 5;
export const HOMBRO_MIN = 146;
export const HOMBRO_MAX = 164;

/** Normal tipificada (Box-Muller) a partir de un generador uniforme. */
export function normal(r: () => number): number {
  return Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
}

/**
 * Genera una cuadrilla con nombres verosímiles y confianza variada (≈30 % de 3, 50 % de 2, 20 % de 1).
 * `hombro(r, i)` da la altura de hombro (cm) del i-ésimo.
 */
export function generarCuadrilla(n: number, semilla: number, hombro: (r: () => number, i: number) => number): HdT[] {
  const r = aleatorio(semilla);
  const usados = new Set<string>();
  const lista: HdT[] = [];
  for (let i = 0; i < n; i++) {
    let nombre = '';
    do {
      nombre = `${NOMBRES[Math.floor(r() * NOMBRES.length)]} ${APELLIDOS[Math.floor(r() * APELLIDOS.length)]} ${APELLIDOS[Math.floor(r() * APELLIDOS.length)]}`;
    } while (usados.has(nombre));
    usados.add(nombre);
    const h = hombro(r, i);
    const u = r();
    const confianza = (u < 0.3 ? 3 : u < 0.8 ? 2 : 1) as 1 | 2 | 3;
    lista.push({ id: i + 1, nombre, hombro: h, confianza });
  }
  return lista;
}

/**
 * Cuadrilla de ejemplo: 150 HdT (144 puestos y 6 de reserva) con el hombro distribuido como en
 * una cuadrilla real: la mayoría entre 150 y 162 cm, con gente también cerca de los extremos (146 y 164 cm).
 * Se mide al medio centímetro.
 */
export function cuadrillaEjemplo(n = 150, semilla = 2026): HdT[] {
  return generarCuadrilla(n, semilla, (r) => {
    let h: number;
    do h = Math.round((HOMBRO_MEDIO + HOMBRO_DESVIACION * normal(r)) * 2) / 2;
    while (h < HOMBRO_MIN || h > HOMBRO_MAX);
    return h;
  });
}
