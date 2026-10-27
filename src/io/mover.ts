// Mover a un HdT dentro del cuadrante: de la lista a un puesto, entre puestos (intercambio)
// o de vuelta a la lista.

import type { Asignacion } from './tablas';

export type Origen = { puesto: string } | { hdt: number };
export type Destino = Origen | { zona: 'lista' };

/**
 * Devuelve la asignación nueva, o null si no cambia nada.
 */
export function mover(asig: Asignacion, o: Origen, d: Destino): Asignacion | null {
  const a: Asignacion = { ...asig };
  const donde = (id: number) => Object.keys(a).find((k) => a[k] === id) ?? null;
  let id: number;
  let desde: string | null;
  if ('puesto' in o) {
    if (a[o.puesto] === undefined) return null;
    id = a[o.puesto];
    desde = o.puesto;
  } else {
    id = o.hdt;
    desde = donde(id);
  }

  // A la lista (o sobre alguien de la lista): queda libre
  if ('zona' in d || 'hdt' in d) {
    if (!desde) return null;
    delete a[desde];
    return a;
  }
  // A un puesto: si está ocupado, se intercambian (o el que estaba vuelve a la lista)
  const k = d.puesto;
  if (k === desde) return null;
  const otro = a[k];
  if (desde) {
    if (otro !== undefined) a[desde] = otro;
    else delete a[desde];
  }
  a[k] = id;
  return a;
}
