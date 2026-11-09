// Datos de ejemplo que se cargan al abrir la aplicación por primera vez.

import { MATERIALES } from '../geometria/secciones';
import type { ConfigOptimizador, ConfigTrono, HdT } from '../geometria/tipos';

/**
 * Trono de ejemplo basado en el de María Santísima del Rocío (Málaga, Martes Santo), con los datos
 * que publica su cofradía (cofradiadelrocio.com): mesa de 4,80 × 3,48 m, varales de 13 m, cerca de
 * 4.000 kg en total y unos 225 hombres de trono, 25 de ellos bajo la mesa (la «laceria»).
 * Lo que no se publica es supuesto: 8 varales de aluminio de 100 × 100 × 5 mm, 11 filas en cada
 * voladizo, 12 costeros por lado, palio de 350 kg, manto de 120 kg y el peso de la mesa, ajustado
 * para que el total salga unos 4.000 kg.
 */
export function tronoEjemplo(): ConfigTrono {
  return {
    mesa: { largo: 4.8, ancho: 3.48, altura: 1.2, peso: 2800 },
    varales: {
      numero: 8,
      material: { ...MATERIALES.aluminio },
      seccion: { tipo: 'rect', ancho: 100, alto: 100, espesor: 5 },
      // 13 m de varal: (13 − 4,80) / 2 en cada voladizo
      largoDelante: 4.1,
      largoDetras: 4.1,
      separaciones: null,
      cabezas: { delante: { peso: 10, longitud: 0.35 }, detras: { peso: 10, longitud: 0.35 } },
    },
    palio: { activo: true, peso: 350, altura: 2.5 },
    manto: { activo: true, peso: 120, distanciaFinal: 0.5, reparto: 'final', apoyo: 'mesa' },
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
      filasDelante: 11,
      filasDetras: 11,
      costerosPorLado: 12,
    },
    // La laceria: 4 por varal en los 6 varales interiores (24, por los 25 que da la cofradía)
    submarino: { varales: [1, 2, 3, 4, 5, 6], porVaral: 4 },
  };
}

export function optimizadorPorDefecto(): ConfigOptimizador {
  return {
    inclinacionMaxGrados: 1,
    iteraciones: 30000,
    tolParejaCm: 1,
    permitirPicado: false,
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
 * Cuántos HdT de cada talla (cm de hombro) tiene la cuadrilla de ejemplo, como en una cuadrilla
 * real: algunos de 146–147, muchos de 148–149, el grueso entre 149 y 155 y unos cuantos por encima.
 * Dentro de cada centímetro, la mitad se mide en ,0 y la otra mitad en ,5 (más o menos).
 */
export const TALLAS_EJEMPLO: Record<number, number> = {
  146: 4, 147: 7, 148: 20, 149: 25, 150: 28, 151: 28, 152: 28, 153: 25, 154: 22, 155: 18,
  156: 11, 157: 8, 158: 7, 159: 6, 160: 4, 161: 4, 162: 3, 163: 1, 164: 1,
};
export const HOMBRO_MIN = 146;
export const HOMBRO_MAX = 164;

/** Normal tipificada (Box-Muller) a partir de un generador uniforme. */
export function normal(r: () => number): number {
  return Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
}

/**
 * Genera una cuadrilla con nombres verosímiles.
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
    r(); // antes se sorteaba la confianza: se mantiene para que las cuadrillas de ejemplo no cambien
    lista.push({ id: i + 1, nombre, hombro: h });
  }
  return lista;
}

/**
 * Cuadrilla de ejemplo: 250 HdT (224 puestos y el resto de reserva) con las tallas de
 * `TALLAS_EJEMPLO`, medidas al medio centímetro y en orden aleatorio.
 */
export function cuadrillaEjemplo(semilla = 2026): HdT[] {
  return cuadrillaConTallas(TALLAS_EJEMPLO, semilla);
}

/** Cuadrilla con tantos HdT de cada talla (cm de hombro) como diga `cuantos`, al medio centímetro y barajados. */
export function cuadrillaConTallas(cuantos: Record<number, number>, semilla = 2026): HdT[] {
  const r = aleatorio(semilla + 1);
  const tallas: number[] = [];
  for (const [cm, n] of Object.entries(cuantos)) {
    for (let k = 0; k < n; k++) tallas.push(Number(cm) + (Number(cm) < HOMBRO_MAX && r() < 0.5 ? 0.5 : 0));
  }
  // Barajar (Fisher-Yates) para que la lista no salga ordenada por talla
  for (let i = tallas.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [tallas[i], tallas[j]] = [tallas[j], tallas[i]];
  }
  return generarCuadrilla(tallas.length, semilla, (_, i) => tallas[i]);
}
