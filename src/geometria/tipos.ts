// Tipos compartidos por todos los módulos.
// Ejes: x a lo largo del trono (+ hacia delante), y a lo ancho (+ hacia la izquierda),
// z hacia arriba. Origen en el centro de la mesa. Unidades SI salvo que se indique.

export type TipoMaterial = 'aluminio' | 'acero' | 'pino' | 'carbono' | 'otro';

export interface Material {
  tipo: TipoMaterial;
  E_GPa: number;
  densidad: number; // kg/m³
}

export type Seccion =
  | { tipo: 'rect'; ancho: number; alto: number; espesor: number } // mm
  | { tipo: 'redondo'; diametro: number; espesor: number } // mm
  | { tipo: 'macizo'; ancho: number; alto: number }; // mm

export interface ConfigTrono {
  mesa: { largo: number; ancho: number; altura: number; peso: number };
  varales: {
    numero: 4 | 6 | 8;
    material: Material;
    seccion: Seccion;
    largoDelante: number;
    largoDetras: number;
    /**
     * Separaciones entre varales (m) de un lado, de fuera hacia dentro, terminando en el hueco
     * central: con 8 varales, [A–B, B–C, C–D, D–E]. El otro lado es simétrico.
     * null = todos a la misma distancia, con los exteriores en los bordes de la mesa.
     */
    separaciones: number[] | null;
    /** Cabeza de varal en cada punta (igual en todos los varales). Prolonga el varal. */
    cabezas: { delante: Cabeza; detras: Cabeza };
  };
  palio: { activo: boolean; peso: number; altura: number };
  manto: Manto;
  quitacimbres: {
    activo: boolean;
    distDelante: number; // m desde la punta delantera
    distDetras: number; // m desde la punta trasera
    ancho: number; // mm
    espesor: number; // mm
    colocacion: 'plana' | 'canto';
    material: Material;
  };
  puestos: {
    /** Filas por delante y por detrás de la mesa: se reparten por igual a lo largo del voladizo. */
    filasDelante: number;
    filasDetras: number;
    costerosPorLado: number;
  };
}

/**
 * Manto de la Virgen: va desde su cabeza (centro de la mesa) hacia la cola, hasta `distanciaFinal`
 * metros antes del final de los varales traseros.
 * - apoyo 'mesa': su estructura metálica sale de la mesa y cuelga hacia atrás; todo el peso lo
 *   recibe la mesa, que además sufre el momento de tener ese peso detrás.
 * - apoyo 'varales': lo que sale de la mesa descansa sobre los varales traseros, por igual.
 */
export interface Manto {
  activo: boolean;
  peso: number; // kg
  distanciaFinal: number; // m desde el final de los varales traseros (sin cabeza)
  /** Cómo se reparte el peso a lo largo: igual, creciendo hacia atrás o casi todo al final. */
  reparto: RepartoManto;
  apoyo: 'mesa' | 'varales';
}

export type RepartoManto = 'uniforme' | 'creciente' | 'final';

export interface Cabeza {
  peso: number; // kg, cada una
  longitud: number; // m
}

export interface ConfigOptimizador {
  /** 0 = la confianza no cuenta, 1 = máxima prioridad. */
  prioridadConfianza: number;
  /** Inclinación delante-detrás máxima, en grados. */
  inclinacionMaxGrados: number;
  iteraciones: number;
  /** Diferencia de hombro máxima (cm) dentro de una pareja espejo. */
  tolParejaCm: number;
  /** Si es false (por defecto), el trono nunca va «picado» (delantera más baja que la trasera). */
  permitirPicado: boolean;
  confianza: ConfigConfianza;
}

export interface ConfigConfianza {
  /**
   * Códigos de los puestos que el capataz considera clave (A1, H32…).
   * null = sugerencia automática: las 2 filas exteriores de delante y de detrás
   * y los costeros de las cuatro esquinas de la mesa.
   */
  puestosClave: string[] | null;
  /** Penalización (relativa) por un HdT de confianza 2 en un puesto clave. */
  penalConf2: number;
  /** Penalización (relativa) por un HdT de confianza 1 en un puesto clave. */
  penalConf1: number;
}

export interface HdT {
  id: number;
  nombre: string;
  hombro: number; // cm
  confianza: 1 | 2 | 3;
}

export type Zona = 'delante' | 'mesa' | 'detras';

export interface Puesto {
  idx: number;
  /** Referencia estable del puesto (igual que el código). */
  ref: string;
  /** Código A1, B7… */
  codigo: string;
  /** Índice de varal 0..n-1 (A = 0). */
  varal: number;
  zona: Zona;
  /** Número correlativo en el varal. */
  numero: number;
  x: number;
  y: number;
  clave: boolean;
  /** Índice del puesto simétrico (en el otro varal exterior o interior equivalente). */
  espejo: number;
  /** Fila transversal (para igualar las 8 de una fila), o -1. */
  fila: number;
}

export interface Trono {
  config: ConfigTrono;
  nVarales: number;
  yVarales: number[];
  letras: string[];
  filasDelante: number;
  filasDetras: number;
  /** Distancias desde el borde de la mesa de cada fila (índice 0 = la más cercana a la mesa). */
  dFilasDelante: number[];
  dFilasDetras: number[];
  xCosteros: number[];
  puestos: Puesto[];
  /** Número máximo de la numeración (último número del varal A). */
  numeroMax: number;
  pesos: Pesos;
  seccion: PropSeccion;
  seccionQuitacimbre: PropSeccion | null;
}

export interface PropSeccion {
  area: number; // m²
  inercia: number; // m⁴
  kgPorMetro: number;
  EI: number; // N·m²
}

export interface Pesos {
  mesa: number;
  palio: number;
  varales: number;
  varalesBajoMesa: number;
  quitacimbres: number;
  cabezas: number;
  manto: number;
  total: number; // kg
  /** Altura del centro de gravedad sobre los varales (m). */
  alturaCdg: number;
}
