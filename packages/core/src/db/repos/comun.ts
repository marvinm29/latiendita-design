/**
 * Auxiliares compartidos por los repos locales.
 *
 * Política de transacciones (003 §3): toda escritura de negocio se hace en UNA
 * transacción `rw` de Dexie que incluye el libro/índice Y la outbox; si algo
 * falla, no queda ni el registro ni la op. El caché de stock se actualiza en
 * esa misma transacción para que `caché == derivado` siempre (C4.3).
 */
import Dexie, { type Collection, type Table } from "dexie";
import { crearOp } from "../../outbox";
import { actualizarCache, stockDerivado } from "../../stock";
import type { Movimiento, OpOutbox } from "../../tipos";
import type { LaTienditaDb, MovimientoFila, OpOutboxFila, ProductoFila } from "../schema";

/** Endpoint único de push por lote (003 §5.2); el tipo de op va en el payload. */
export const ENDPOINT_SYNC = "/sync/push";

export type EntidadOp =
  | "producto"
  | "unidad_venta"
  | "movimiento"
  | "cliente"
  | "fiado"
  | "categoria"
  | "conteo";

export interface PayloadOp {
  negocioId: string;
  entidad: EntidadOp;
  datos: unknown;
}

/** Op lista para la outbox con el payload canónico `{negocioId, entidad, datos}`. */
export function crearOpDe(
  negocioId: string,
  entidad: EntidadOp,
  datos: unknown,
  opciones?: { ahora?: number; id?: string },
): OpOutbox {
  return crearOp({
    endpoint: ENDPOINT_SYNC,
    payload: { negocioId, entidad, datos } satisfies PayloadOp,
    ahora: opciones?.ahora,
    id: opciones?.id,
  });
}

/**
 * Rango por prefijo sobre un índice compuesto (el resto de componentes va de
 * `Dexie.minKey` a `Dexie.maxKey`), conservando el orden del índice.
 */
export function rangoCompuesto<T>(
  tabla: Table<T, string>,
  indice: string,
  prefijo: readonly (string | number)[],
): Collection<T, string> {
  return tabla.where(indice).between([...prefijo, Dexie.minKey], [...prefijo, Dexie.maxKey]);
}

/** Producto del negocio, vivo y sin tombstone; lanza si no sirve. */
export async function productoActivo(
  db: LaTienditaDb,
  negocioId: string,
  productoId: string,
): Promise<ProductoFila> {
  const producto = await db.productos.get(productoId);
  if (!producto || producto.negocioId !== negocioId) {
    throw new Error(`producto no encontrado: ${productoId}`);
  }
  if (producto.deletedAt !== null) {
    throw new Error(`producto borrado: ${productoId}`);
  }
  return producto;
}

/**
 * Stock actual del producto: caché si existe; si no, derivado del libro.
 * No escribe nada (sólo lectura dentro de transacciones de sólo lectura).
 */
export async function leerStockLocal(db: LaTienditaDb, productoId: string): Promise<number> {
  const cache = await db.stock_cache.get(productoId);
  if (cache) return cache.stock;
  const movimientos = await db.movimientos.where("productoId").equals(productoId).toArray();
  return stockDerivado(movimientos, productoId);
}

/**
 * Refresca `stock_cache` DESPUÉS de insertar `mov` en el libro, dentro de la
 * misma transacción. Si hay caché previa aplica el movimiento de forma
 * incremental (`actualizarCache`); si no, deriva desde el libro completo.
 */
export async function refrescarStock(
  db: LaTienditaDb,
  negocioId: string,
  mov: Movimiento,
  ahora: number,
): Promise<number> {
  const cache = await db.stock_cache.get(mov.productoId);
  let stock: number;
  if (cache) {
    const mapa = new Map<string, number>([[mov.productoId, cache.stock]]);
    actualizarCache(mapa, mov.productoId, mov);
    const incremental = mapa.get(mov.productoId);
    if (incremental === undefined) throw new Error(`stock ilegible para ${mov.productoId}`);
    stock = incremental;
  } else {
    const movimientos = await db.movimientos.where("productoId").equals(mov.productoId).toArray();
    stock = stockDerivado(movimientos, mov.productoId);
  }
  await db.stock_cache.put({ productoId: mov.productoId, negocioId, stock, actualizadoEn: ahora });
  return stock;
}

/** Fila de libro listo para insertar (índice `ocurridoAt` = `creadoEn`). */
export function filaDeMovimiento(mov: Movimiento, negocioId: string): MovimientoFila {
  return { ...mov, negocioId, ocurridoAt: mov.creadoEn, serverSeq: null };
}

/** Fila de outbox con el negocio de la operación. */
export function filaDeOp(op: OpOutbox, negocioId: string): OpOutboxFila {
  return { ...op, negocioId };
}
