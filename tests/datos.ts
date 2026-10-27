// Datos fijos para los tests, independientes del ejemplo que muestra la aplicación:
// trono de 8 varales con 184 puestos y una cuadrilla «igualada» a su perfil.

import { perfilIdeal } from '../src/fem/contacto';
import { construirModelo, K_PERSONA } from '../src/fem/modelo';
import type { ConfigTrono, HdT } from '../src/geometria/tipos';
import { construirTrono } from '../src/geometria/trono';
import { generarCuadrilla, normal, tronoEjemplo } from '../src/io/ejemplo';

/** Trono de ejemplo sin submarino: la base de los tests (el ejemplo puede cambiar). */
export function tronoBase(): ConfigTrono {
  const c = tronoEjemplo();
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
