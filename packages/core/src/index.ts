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

export * from "./db/schema";
export * from "./db/db";
export * from "./db/meta";
export * from "./db/repos";

/** Roles de membresía (D4 / C7.1) — espejo del CHECK en 0001_init.sql. */
export type Rol = "dueña" | "empleado";

export const CORE_VERSION = "0.0.1";
