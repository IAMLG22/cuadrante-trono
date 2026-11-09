// Datos fijos para los tests, independientes del ejemplo que muestra la aplicación:
// trono de 8 varales con 184 puestos y una cuadrilla «igualada» a su perfil.

import { perfilIdeal } from '../src/fem/contacto';
import { construirModelo, K_PERSONA } from '../src/fem/modelo';
import type { ConfigTrono, HdT } from '../src/geometria/tipos';
import { construirTrono } from '../src/geometria/trono';
import { MATERIALES } from '../src/geometria/secciones';
import { cuadrillaConTallas, generarCuadrilla, normal } from '../src/io/ejemplo';

/**
 * Trono «clásico» de los tests: el que fue el ejemplo de la aplicación hasta que se cambió por el
 * del Rocío. Se guarda aquí, fijo, para que los tests no dependan del ejemplo que se muestre.
 * 6 varales de aluminio, mesa de 4,50 × 3,50 m, 10 filas en cada voladizo de 4,50 m,
 * 12 costeros por lado y submarino de 4 en C y D: 152 puestos.
 */
export function tronoClasico(): ConfigTrono {
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
      activo: true, distDelante: 0.3, distDetras: 0.3, ancho: 60, espesor: 10, colocacion: 'canto',
      material: { ...MATERIALES.acero },
    },
    puestos: { filasDelante: 10, filasDetras: 10, costerosPorLado: 12 },
    submarino: { varales: [2, 3], porVaral: 4 },
  };
}

/** Tallas de la cuadrilla clásica (180 HdT), la que acompañaba al trono clásico. */
export const TALLAS_CLASICAS: Record<number, number> = {
  146: 3, 147: 5, 148: 14, 149: 18, 150: 20, 151: 20, 152: 20, 153: 18, 154: 16, 155: 13,
  156: 8, 157: 6, 158: 5, 159: 4, 160: 3, 161: 3, 162: 2, 163: 1, 164: 1,
};
export const cuadrillaClasica = () => cuadrillaConTallas(TALLAS_CLASICAS);

/** Trono clásico sin submarino: la base de los tests. */
export function tronoBase(): ConfigTrono {
  const c = tronoClasico();
  c.submarino = { varales: [], porVaral: 4 };
  return c;
}

export function tronoPrueba(): ConfigTrono {
  const c = tronoBase();
  c.varales.numero = 8;
  c.puestos.filasDelante = 10;
  c.puestos.filasDetras = 10;
  return c;
}

/** Hombro (cm) que haría cargar lo ideal en cada puesto del trono de prueba, con la mesa a 124,5 cm. */
function hombrosIdeales(): number[] {
  const t = construirTrono(tronoPrueba());
  const m = construirModelo(t);
  const Fid = m.pesoTotalN / t.puestos.length;
  return Array.from(perfilIdeal(m, Fid).w, (w) => 124.5 + (w + Fid / K_PERSONA) * 100);
}

/**
 * Cuadrilla que sigue el perfil que pide el trono de prueba: un HdT por puesto con el hombro
 * ideal más un pequeño ruido, medido al medio centímetro; el primero es muy bajo (119 cm).
 */
export function cuadrillaPrueba(n = 184, semilla = 2026): HdT[] {
  const ideal = hombrosIdeales();
  return generarCuadrilla(n, semilla, (r, i) => {
    if (i === 0) return 119;
    return Math.round((ideal[i % ideal.length] + 0.2 * normal(r)) * 2) / 2;
  });
}
