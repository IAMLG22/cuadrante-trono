import { propiedades, propiedadesPletina } from './secciones';
import type { ConfigConfianza, ConfigTrono, Pesos, Puesto, Trono, RepartoManto } from './tipos';

export const LETRAS = 'ABCDEFGH';
/** Por debajo de esta separación (m) las filas no caben: no hay sitio para una persona. */
export const SEPARACION_MINIMA = 0.3;

/** Filas exteriores que la sugerencia automática marca como clave. */
export const FILAS_CLAVE_AUTO = 2;

export const CONFIANZA_POR_DEFECTO: ConfigConfianza = {
  puestosClave: null,
  penalConf2: 1,
  penalConf1: 4,
};

/** Separación entre filas (m) al repartir `n` filas por igual en un voladizo de longitud `largo`. */
export function separacionFilas(largo: number, n: number): number {
  return n > 0 ? largo / n : 0;
}

/**
 * Distancias de las filas al borde de la mesa: cada fila ocupa el mismo tramo de varal, con medio
 * tramo libre junto a la mesa y medio en la punta. Índice 0 = la más cercana a la mesa.
 */
export function distanciasFilas(largo: number, n: number): number[] {
  const s = separacionFilas(largo, n);
  return Array.from({ length: n }, (_, i) => (i + 0.5) * s);
}

/** Filas que caben de forma natural (unos 45 cm por persona). */
export function filasSugeridas(largo: number): number {
  return Math.max(0, Math.round(largo / 0.45));
}

/** Versión anterior: filas que cabían con primera fila d0 y separación sep (para leer datos guardados). */
export function filasAutomaticas(largo: number, d0: number, sep: number): number {
  if (largo - 0.1 < d0 - 1e-9) return 0;
  return Math.floor((largo - 0.1 - d0) / sep + 1e-9) + 1;
}

/** Exponente del reparto del manto: densidad ∝ (s / L)^p, s medido desde la cabeza de la Virgen. */
export const EXPONENTE_MANTO: Record<RepartoManto, number> = { uniforme: 0, creciente: 1, final: 3 };

/** Longitud del manto (m) desde el centro de la mesa hasta su final. */
export function longitudManto(c: ConfigTrono): number {
  return c.mesa.largo / 2 + c.varales.largoDetras - c.manto.distanciaFinal;
}

/** Distancia (m) del centro de gravedad del manto por detrás del centro de la mesa. */
export function cdgManto(c: ConfigTrono): number {
  const p = EXPONENTE_MANTO[c.manto.reparto];
  return (longitudManto(c) * (p + 1)) / (p + 2);
}

/** Fracción del peso del manto que cae sobre la mesa (el resto, sobre los varales traseros). */
export function fraccionMantoEnMesa(c: ConfigTrono): number {
  const Lm = longitudManto(c);
  if (!(Lm > 0)) return 1;
  const p = EXPONENTE_MANTO[c.manto.reparto];
  return Math.min(1, (c.mesa.largo / 2 / Lm) ** (p + 1));
}

/** Varales interiores (ni el primero ni el último) en los que va submarino, ordenados. */
export function varalesSubmarino(c: ConfigTrono): number[] {
  const n = c.varales.numero;
  return [...new Set(c.submarino.varales)].filter((v) => v > 0 && v < n - 1).sort((a, b) => a - b);
}

/** Número de separaciones que hay que dar para n varales (un lado más el hueco central). */
export const nSeparaciones = (n: number) => n / 2;

/** Posición y de cada varal (A = el de más a la izquierda, y > 0). */
export function posicionesVarales(c: ConfigTrono): number[] {
  const n = c.varales.numero;
  const s = c.varales.separaciones;
  if (!s) return Array.from({ length: n }, (_, v) => c.mesa.ancho / 2 - (v * c.mesa.ancho) / (n - 1));
  const huecos = [...s, ...s.slice(0, -1).reverse()];
  const total = huecos.reduce((a, b) => a + b, 0);
  const y = [total / 2];
  for (const h of huecos) y.push(y[y.length - 1] - h);
  return y;
}

/** Separación uniforme expresada como lista (para empezar a editarla). */
export function separacionesUniformes(c: ConfigTrono): number[] {
  const n = c.varales.numero;
  return Array.from({ length: nSeparaciones(n) }, () => Math.round((c.mesa.ancho / (n - 1)) * 1000) / 1000);
}

export function calcularPesos(c: ConfigTrono): Pesos {
  const sec = propiedades(c.varales.seccion, c.varales.material);
  const n = c.varales.numero;
  const largoVaral = c.varales.largoDelante + c.mesa.largo + c.varales.largoDetras;
  const varales = n * largoVaral * sec.kgPorMetro;
  const varalesBajoMesa = n * c.mesa.largo * sec.kgPorMetro;
  let quitacimbres = 0;
  if (c.quitacimbres.activo) {
    const q = propiedadesPletina(c.quitacimbres.ancho, c.quitacimbres.espesor, c.quitacimbres.colocacion, c.quitacimbres.material);
    const y = posicionesVarales(c);
    quitacimbres = 2 * (y[0] - y[y.length - 1]) * q.kgPorMetro;
  }
  const cabezas = n * (c.varales.cabezas.delante.peso + c.varales.cabezas.detras.peso);
  const manto = c.manto.activo ? c.manto.peso : 0;
  const palio = c.palio.activo ? c.palio.peso : 0;
  const total = c.mesa.peso + palio + varales + quitacimbres + cabezas + manto;
  // Centro de gravedad: mesa con imágenes a la altura de la mesa, palio por encima de ella,
  // varales, cabezas y quitacimbres a la altura de los varales (0).
  // El manto baja desde la cabeza de la Virgen hasta la cola: se toma a la altura de la mesa.
  const momento = c.mesa.peso * c.mesa.altura + palio * (c.mesa.altura + (c.palio.activo ? c.palio.altura : 0)) + manto * c.mesa.altura;
  return {
    mesa: c.mesa.peso,
    palio,
    varales,
    varalesBajoMesa,
    quitacimbres,
    cabezas,
    manto,
    total,
    alturaCdg: total > 0 ? momento / total : 0,
  };
}

/** Construye la geometría completa: puestos con su código, posición, simetría y si son clave. */
export function construirTrono(c: ConfigTrono, conf: ConfigConfianza = CONFIANZA_POR_DEFECTO): Trono {
  const n = c.varales.numero;
  const L = c.mesa.largo, B = c.mesa.ancho;
  const p = c.puestos;
  const nf = p.filasDelante, nb = p.filasDetras;
  const nc = p.costerosPorLado;

  const yVarales = posicionesVarales(c);
  const letras = LETRAS.slice(0, n).split('');
  const dFilasDelante = distanciasFilas(c.varales.largoDelante, nf);
  const dFilasDetras = distanciasFilas(c.varales.largoDetras, nb);
  // Costeros repartidos uniformemente a lo largo de la mesa, con medio paso en los extremos.
  const xCosteros = Array.from({ length: nc }, (_, j) => L / 2 - ((j + 0.5) * L) / nc);
  const numeroMax = nf + nc + nb;
  const fk = FILAS_CLAVE_AUTO;

  const puestos: Puesto[] = [];
  const clave = new Map<string, number>(); // "v:numero" -> idx
  const nuevo = (q: Omit<Puesto, 'idx' | 'espejo' | 'ref'>) => {
    const idx = puestos.length;
    puestos.push({ ...q, idx, ref: q.codigo, espejo: -1 });
    clave.set(`${q.zona === 'submarino' ? 's' : ''}${q.varal}:${q.numero}`, idx);
    return idx;
  };

  for (let v = 0; v < n; v++) {
    for (let k = 1; k <= nf; k++) {
      nuevo({
        codigo: `${letras[v]}${k}`, varal: v, zona: 'delante', numero: k,
        x: L / 2 + dFilasDelante[nf - k], y: yVarales[v], clave: k <= fk, fila: k,
      });
    }
    if (v === 0 || v === n - 1) {
      for (let j = 0; j < nc; j++) {
        const numero = nf + 1 + j;
        nuevo({
          codigo: `${letras[v]}${numero}`, varal: v, zona: 'mesa', numero,
          x: xCosteros[j], y: yVarales[v], clave: j === 0 || j === nc - 1, fila: -1,
        });
      }
    }
    for (let i = 0; i < nb; i++) {
      const numero = nf + nc + 1 + i;
      nuevo({
        codigo: `${letras[v]}${numero}`, varal: v, zona: 'detras', numero,
        x: -L / 2 - dFilasDetras[i], y: yVarales[v], clave: i >= nb - fk, fila: numero,
      });
    }
  }
  // Submarino: repartido por igual a lo largo de la mesa en cada varal trabajable (de delante a atrás)
  const ns = c.submarino.porVaral;
  for (const v of varalesSubmarino(c)) {
    for (let j = 0; j < ns; j++) {
      nuevo({
        codigo: `${letras[v]}-S${j + 1}`, varal: v, zona: 'submarino', numero: j + 1,
        x: L / 2 - ((j + 0.5) * L) / ns, y: yVarales[v], clave: false, fila: -1,
      });
    }
  }
  // Puestos clave elegidos por el capataz (si no ha elegido, queda la sugerencia automática)
  if (conf.puestosClave) {
    const elegidos = new Set(conf.puestosClave);
    for (const q of puestos) q.clave = elegidos.has(q.codigo);
  }
  // Espejo: el mismo puesto en el varal simétrico (en el submarino, él mismo si ese varal no trabaja)
  for (const q of puestos) {
    const k = `${q.zona === 'submarino' ? 's' : ''}${n - 1 - q.varal}:${q.numero}`;
    q.espejo = clave.get(k) ?? q.idx;
  }

  const seccion = propiedades(c.varales.seccion, c.varales.material);
  const seccionQuitacimbre = c.quitacimbres.activo
    ? propiedadesPletina(c.quitacimbres.ancho, c.quitacimbres.espesor, c.quitacimbres.colocacion, c.quitacimbres.material)
    : null;

  return {
    config: c, nVarales: n, yVarales, letras, filasDelante: nf, filasDetras: nb, dFilasDelante, dFilasDetras,
    xCosteros, puestos, numeroMax, pesos: calcularPesos(c), seccion, seccionQuitacimbre,
  };
}

/** Códigos de la sugerencia automática de puestos clave. */
export function clavesAutomaticas(c: ConfigTrono): string[] {
  return construirTrono(c, CONFIANZA_POR_DEFECTO).puestos.filter((p) => p.clave).map((p) => p.codigo);
}

/** Códigos de los puestos clave efectivos (elegidos o automáticos). */
export function clavesEfectivas(c: ConfigTrono, conf: ConfigConfianza): string[] {
  return conf.puestosClave ?? clavesAutomaticas(c);
}

/** Comprueba la configuración y devuelve una lista de errores legibles. */
export function validarConfig(c: ConfigTrono): string[] {
  const e: string[] = [];
  const pos = (v: number, nombre: string) => { if (!(v > 0)) e.push(`${nombre} debe ser mayor que cero.`); };
  pos(c.mesa.largo, 'El largo de la mesa');
  pos(c.mesa.ancho, 'El ancho de la mesa');
  if (!(c.mesa.peso >= 0)) e.push('El peso de la mesa no puede ser negativo.');
  pos(c.varales.material.E_GPa, 'El módulo E del varal');
  pos(c.varales.material.densidad, 'La densidad del varal');
  if (!(c.varales.largoDelante >= 0) || !(c.varales.largoDetras >= 0)) e.push('Las longitudes de varal no pueden ser negativas.');
  const s = c.varales.seccion;
  if (s.tipo === 'rect' && (s.espesor * 2 >= Math.min(s.ancho, s.alto) || !(s.espesor > 0))) e.push('El espesor del tubo rectangular no es válido.');
  if (s.tipo === 'redondo' && (s.espesor * 2 >= s.diametro || !(s.espesor > 0))) e.push('El espesor del tubo redondo no es válido.');
  const p = c.puestos;
  for (const [lado, nf, largo] of [['delante', p.filasDelante, c.varales.largoDelante], ['detrás', p.filasDetras, c.varales.largoDetras]] as const) {
    if (!(Number.isInteger(nf) && nf >= 0)) e.push(`El número de filas de ${lado} no es válido.`);
    else if (nf > 0 && separacionFilas(largo, nf) < SEPARACION_MINIMA - 1e-9) {
      e.push(`Las ${nf} filas de ${lado} no caben: quedarían a ${separacionFilas(largo, nf).toFixed(2).replace('.', ',')} m unas de otras.`);
    }
  }
  if (c.quitacimbres.activo) {
    if (!(c.quitacimbres.distDelante > 0 && c.quitacimbres.distDelante < c.varales.largoDelante)) e.push('El quitacimbre delantero debe quedar entre la mesa y la punta.');
    if (!(c.quitacimbres.distDetras > 0 && c.quitacimbres.distDetras < c.varales.largoDetras)) e.push('El quitacimbre trasero debe quedar entre la mesa y la punta.');
  }
  if (c.palio.activo && !(c.palio.peso >= 0)) e.push('El peso del palio no puede ser negativo.');
  for (const [lado, cab] of [['delantera', c.varales.cabezas.delante], ['trasera', c.varales.cabezas.detras]] as const) {
    if (!(cab.peso >= 0) || !(cab.longitud >= 0)) e.push(`El peso y la longitud de la cabeza ${lado} no pueden ser negativos.`);
  }
  if (c.manto.activo) {
    if (!(c.manto.peso >= 0)) e.push('El peso del manto no puede ser negativo.');
    if (!(c.manto.distanciaFinal >= 0)) e.push('La distancia del manto al final de los varales no puede ser negativa.');
    else if (!(longitudManto(c) > 0)) e.push('El manto tiene que acabar detrás del centro de la mesa: reduce la distancia al final de los varales.');
  }
  if (!(Number.isInteger(c.submarino.porVaral) && c.submarino.porVaral >= 0)) e.push('El número de personas por varal del submarino no es válido.');
  if (c.submarino.varales.some((v) => !(v > 0 && v < c.varales.numero - 1))) {
    e.push('En el submarino solo pueden trabajar los varales interiores.');
  }
  const sep = c.varales.separaciones;
  if (sep) {
    if (sep.length !== nSeparaciones(c.varales.numero)) e.push('Faltan separaciones entre varales: vuelve a elegirlas.');
    else if (!sep.every((x) => x > 0)) e.push('Las separaciones entre varales deben ser mayores que cero.');
  }
  return e;
}
