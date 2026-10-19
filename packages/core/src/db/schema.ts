/**
 * Esquema local IndexedDB (T-03) — una sola versión de esquema para M1.
 *
 * Convenciones (003 §4):
 * - Toda fila de negocio lleva `negocioId` (paridad con RLS por negocio).
 * - Filas mutables (productos, clientes, categorías): `updatedAt` (LWW por
 *   campo en M2), `deletedAt` (tombstone), `serverSeq` (null = aún no
 *   confirmada por el servidor tras una edición local) y `rev`.
 * - Ledger append-only (movimientos, fiados): sólo `serverSeq`; nunca se
 *   editan ni se borran (C8.4).
 * - El stock y el saldo NO son verdad almacenada: `stock_cache` es sólo
 *   velocidad y siempre se puede recalcular desde el libro (C4.3).
 */
import Dexie, { type Table } from "dexie";
import type { SesionCuenta } from "../auth";
import type { Cliente, Fiado, Movimiento, OpOutbox, Producto } from "../tipos";

/** Versión del esquema local. Cambios de tablas/índices → subirla y añadir .stores(). */
export const VERSION_ESQUEMA = 2;

/** Estado de una sesión de conteo (C5). */
export type EstadoConteo = "abierto" | "cerrado";

/** Campos de sincronización comunes a las filas mutables (003 §4.1). */
export interface FilaSync {
  negocioId: string;
  updatedAt: number;
  deletedAt: number | null;
  serverSeq: number | null;
  rev: number;
}

export interface ProductoFila extends Producto, FilaSync {}

export interface ClienteFila extends Cliente, FilaSync {}

export interface CategoriaFila extends FilaSync {
  id: string;
  nombre: string;
}

/** Unidad de venta específica de un producto (003 §4.2 `unidad_venta`). */
export interface UnidadVentaFila {
  id: string;
  productoId: string;
  nombre: string;
  factor: number;
  esBase: boolean;
}

/**
 * Fila del libro. `ocurridoAt` es el nombre del índice que exige 003 §4.3
 * (`negocio_id, producto_id, ocurrido_at`); es un espejo de `creadoEn` y al
 * ser append-only no puede divergir.
 */
export interface MovimientoFila extends Movimiento {
  negocioId: string;
  ocurridoAt: number;
  serverSeq: number | null;
}

export interface FiadoFila extends Fiado {
  negocioId: string;
  serverSeq: number | null;
}

/** Op de la outbox ligada al negocio (el push es por negocio en M2). */
export interface OpOutboxFila extends OpOutbox {
  negocioId: string;
}

/**
 * Caché de velocidad del stock: un renglón por producto. La verdad sigue
 * siendo el libro; si falta o duda, se recalcula con `stockDerivado`.
 */
export interface StockCacheFila {
  productoId: string;
  negocioId: string;
  stock: number;
  actualizadoEn: number;
}

/** Pares clave/valor (cursors de sync, flags de primer arranque…). */
export interface MetaFila {
  clave: string;
  valor: unknown;
  actualizadoEn: number;
}

/**
 * Verificador de PIN local (C1/T-05): PBKDF2-SHA-256 con sal aleatoria.
 * Sólo se guarda el hash; el PIN nunca se almacena en claro ni se manda a la
 * API en cada desbloqueo. Permite abrir la sesión SIN red.
 */
export interface VerificadorPinFila {
  /** Sal aleatoria en base64. */
  sal: string;
  /** Hash derivado del PIN en base64. */
  hash: string;
  /** Iteraciones PBKDF2 usadas al crear el verificador. */
  iteraciones: number;
}

/**
 * Sesión de la cuenta guardada en el dispositivo. Una sola fila (`id` =
 * "actual"). El token vive aquí (IndexedDB), NUNCA en localStorage.
 * `bloqueada` se restablece al abrir la app: el PIN lo desbloquea sin red.
 */
export interface SesionLocalFila {
  id: "actual";
  sesion: SesionCuenta;
  verificadorPin: VerificadorPinFila;
  bloqueada: boolean;
  actualizadoEn: number;
}

/** Ítem de una sesión de conteo: lo físico vs. lo que dice el sistema. */
export interface ConteoItemFila {
  productoId: string;
  contado: number;
  sistema: number;
  diferencia: number;
}

export interface ConteoFila {
  id: string;
  negocioId: string;
  estado: EstadoConteo;
  creadoEn: number;
  cerradoEn: number | null;
  items: ConteoItemFila[];
}

/** Esquema v1 (M1, 10 tablas) — se conserva para migrar bases existentes. */
const ESQUEMA_V1: Record<string, string> = {
  productos: "id, negocioId, [negocioId+codigoBarras], [negocioId+serverSeq], nombre",
  unidades_venta: "id, productoId",
  movimientos:
    "id, negocioId, productoId, [negocioId+productoId+ocurridoAt], [negocioId+ocurridoAt], [negocioId+serverSeq]",
  clientes: "id, negocioId, nombre, [negocioId+serverSeq]",
  fiados:
    "id, clienteId, [negocioId+clienteId], [negocioId+clienteId+creadoEn], [negocioId+serverSeq]",
  categorias: "id, negocioId, nombre",
  conteos: "id, negocioId, [negocioId+estado]",
  outbox: "id, negocioId, [estado+creadoEn], proximoIntentoEn",
  meta: "clave, actualizadoEn",
  stock_cache: "productoId, negocioId",
};

/**
 * Base local de LaTiendita.
 *
 * Índices pensados para las consultas del negocio (003 T-03/§4.3):
 * - productos: `negocioId+codigoBarras` (escaneo por código) y `nombre`
 *   (catálogo ordenado); `negocioId+serverSeq` para el pull incremental.
 * - movimientos: `negocioId+productoId+ocurridoAt` (historial por producto) y
 *   `negocioId+ocurridoAt` (recientes); `negocioId+serverSeq` para pull.
 * - fiados: `negocioId+clienteId` (+ `creadoEn` para la libreta ordenada).
 * - outbox: `estado+creadoEn` (barrido por estado) y `proximoIntentoEn`
 *   (ops elegibles para reintentar con backoff).
 *
 * Unicidad de código de barras (003 §4.3) es **parcial** en el spec
 * (`not null` y `deleted_at is null`), que IndexedDB no puede expresar: se
 * valida en la transacción de escritura de `productosRepo`.
 */
export class LaTienditaDb extends Dexie {
  productos!: Table<ProductoFila, string>;
  unidades_venta!: Table<UnidadVentaFila, string>;
  movimientos!: Table<MovimientoFila, string>;
  clientes!: Table<ClienteFila, string>;
  fiados!: Table<FiadoFila, string>;
  categorias!: Table<CategoriaFila, string>;
  conteos!: Table<ConteoFila, string>;
  outbox!: Table<OpOutboxFila, string>;
  meta!: Table<MetaFila, string>;
  stock_cache!: Table<StockCacheFila, string>;
  sesion_local!: Table<SesionLocalFila, string>;

  constructor(nombre: string) {
    super(nombre);
    this.version(1).stores(ESQUEMA_V1);
    // v2 · S3: sesión + verificador de PIN local (migración aditiva).
    this.version(VERSION_ESQUEMA).stores({
      ...ESQUEMA_V1,
      sesion_local: "id",
    });
  }
}
