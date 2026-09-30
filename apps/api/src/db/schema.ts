import { bigint, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Esquema mínimo M0 — specs/003 §4.2 (negocio · usuario · membresia).
 * El resto de tablas (producto, movimiento, fiado…) las suma M1/M2 sobre esta base.
 * IDs: UUIDv7 generados en el cliente (§4.1) → sin default del servidor.
 */

export const rolEnum = pgEnum("rol", ["dueña", "empleado"]);

export const negocio = pgTable("negocio", {
  id: uuid("id").primaryKey(),
  nombre: text("nombre").notNull(),
  moneda: text("moneda").notNull().default("USD"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  serverSeq: bigint("server_seq", { mode: "number" }).notNull().default(0),
});

export const usuario = pgTable("usuario", {
  id: uuid("id").primaryKey(),
  nombre: text("nombre").notNull(),
  /** argon2id del PIN (T-05) — nunca el PIN en claro. */
  pinHash: text("pin_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const membresia = pgTable("membresia", {
  id: uuid("id").primaryKey(),
  negocioId: uuid("negocio_id")
    .notNull()
    .references(() => negocio.id),
  usuarioId: uuid("usuario_id")
    .notNull()
    .references(() => usuario.id),
  rol: rolEnum("rol").notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export type Negocio = typeof negocio.$inferSelect;
export type Usuario = typeof usuario.$inferSelect;
export type Membresia = typeof membresia.$inferSelect;
