import type { Material, PropSeccion, Seccion, TipoMaterial } from './tipos';

export const MATERIALES: Record<Exclude<TipoMaterial, 'otro'>, Material> = {
  aluminio: { tipo: 'aluminio', E_GPa: 69, densidad: 2700 },
  acero: { tipo: 'acero', E_GPa: 210, densidad: 7850 },
  pino: { tipo: 'pino', E_GPa: 11, densidad: 500 },
  // Tubo de carbono pultruido (fibras a lo largo). Si es de tejido enrollado, E ≈ 70 GPa: usar «Otro».
  carbono: { tipo: 'carbono', E_GPa: 120, densidad: 1550 },
};

export const NOMBRE_MATERIAL: Record<TipoMaterial, string> = {
  aluminio: 'Aluminio',
  acero: 'Acero',
  pino: 'Madera de pino',
  carbono: 'Fibra de carbono',
  otro: 'Otro',
};

/** Área (m²) e inercia a flexión vertical (m⁴) de la sección de un varal. */
export function areaInercia(s: Seccion): { area: number; inercia: number } {
  const mm = 1e-3;
  switch (s.tipo) {
    case 'rect': {
      const b = s.ancho * mm, h = s.alto * mm, t = s.espesor * mm;
      const bi = Math.max(0, b - 2 * t), hi = Math.max(0, h - 2 * t);
      return { area: b * h - bi * hi, inercia: (b * h ** 3 - bi * hi ** 3) / 12 };
    }
    case 'redondo': {
      const D = s.diametro * mm, d = Math.max(0, D - 2 * s.espesor * mm);
      return { area: (Math.PI / 4) * (D * D - d * d), inercia: (Math.PI / 64) * (D ** 4 - d ** 4) };
    }
    case 'macizo': {
      const b = s.ancho * mm, h = s.alto * mm;
      return { area: b * h, inercia: (b * h ** 3) / 12 };
    }
  }
}

export function propiedades(s: Seccion, m: Material): PropSeccion {
  const { area, inercia } = areaInercia(s);
  return { area, inercia, kgPorMetro: area * m.densidad, EI: m.E_GPa * 1e9 * inercia };
}

/** Pletina del quitacimbre: plana (flexión por el espesor) o de canto (por el ancho). */
export function propiedadesPletina(
  anchoMm: number,
  espesorMm: number,
  colocacion: 'plana' | 'canto',
  m: Material,
): PropSeccion {
  const alto = colocacion === 'plana' ? espesorMm : anchoMm;
  const ancho = colocacion === 'plana' ? anchoMm : espesorMm;
  return propiedades({ tipo: 'macizo', ancho, alto }, m);
}
