/**
 * @latiendita/core — dominio puro compartido cliente/servidor (T-01)
 * + persistencia local IndexedDB/Dexie y repos tipados (T-03).
 *
 * M1: libro de movimientos append-only, stock derivado, unidades, fiados,
 * outbox de sync e índice de búsqueda; abajo, la capa `db/` (esquema,
 * `abrirDb`, `solicitarPersistencia`, cursors de sync y repos).
 */

export * from "./tipos";
export * from "./libro";
export * from "./stock";
export * from "./unidades";
export * from "./fiados";
export * from "./outbox";
export * from "./indice";
export * from "./auth";

export * from "./db/schema";
export * from "./db/db";
export * from "./db/meta";
export * from "./db/repos";

export const CORE_VERSION = "0.0.1";
