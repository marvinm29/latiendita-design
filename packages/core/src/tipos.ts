/** Unidades de venta soportadas en v1 (pieza y granel). */
export type UnidadVenta = "unidad" | "kg" | "litro" | "caja";

export type MovimientoTipo = "entrada" | "salida" | "ajuste";

/** cargo = el cliente debe · abono = el cliente paga. */
export type TipoFiado = "cargo" | "abono";

export type OpEstado = "pendiente" | "enviando" | "ok" | "error";

/** Chips: agotado/critico = rojo · bajo = ámbar · ok = verde. */
export type EstadoStock = "agotado" | "critico" | "bajo" | "ok";

/**
 * Catálogo de producto. Todo el dinero va en centavos enteros (nunca float).
 * `factor` = cuántas unidades base equivale 1 unidad de venta (1 si son iguales).
 * `stockMinimoBase` es el mínimo en unidades base para el chip de estado.
 */
export interface Producto {
  id: string;
  nombre: string;
  categoria: string;
  codigoBarras: string | null;
  unidadBase: UnidadVenta;
  unidadVenta: UnidadVenta;
  factor: number;
  costoCentavos: number;
  precioCentavos: number;
  stockMinimoBase: number;
  activo: boolean;
}

/**
 * Movimiento append-only del libro. Nunca se edita ni se borra:
 * las correcciones son movimientos nuevos con `corrigeA` apuntando al original.
 *
 * `cantidadBase` es el signo que se aplica al stock:
 * - entrada: > 0 (se suma)
 * - salida:  > 0 (se resta en `aplicarMovimiento`)
 * - ajuste:  con signo (puede ser ±)
 */
export interface Movimiento {
  id: string;
  productoId: string;
  tipo: MovimientoTipo;
  cantidadBase: number;
  costoCentavos?: number;
  motivo?: string;
  /** Id del movimiento que este corrige (solo en inversos). */
  corrigeA?: string;
  creadoEn: number;
  opId?: string;
}

export interface Cliente {
  id: string;
  nombre: string;
  telefono: string | null;
  /** Límite de crédito en centavos; null = sin límite. */
  limiteCentavos: number | null;
  activo: boolean;
}

/** Registro del libro de fiados. Siempre positivo; el signo lo da `tipo`. */
export interface Fiado {
  id: string;
  clienteId: string;
  tipo: TipoFiado;
  montoCentavos: number;
  descripcion: string | null;
  creadoEn: number;
  opId?: string;
}

/** Operación en la outbox de sincronización offline. */
export interface OpOutbox {
  id: string;
  endpoint: string;
  payload: unknown;
  estado: OpEstado;
  /** Fallos acumulados (para backoff). */
  intentos: number;
  creadoEn: number;
  /** Epoch ms en el que vuelve a ser elegible para enviar. */
  proximoIntentoEn: number;
  ultimoError: string | null;
}
