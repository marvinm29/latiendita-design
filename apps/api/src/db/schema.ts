import { bigint, index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

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

/** S3 / M2 · invitación de un solo uso (T-05); sólo se guarda el hash. */
export const invitacion = pgTable(
  "invitacion",
  {
    id: uuid("id").primaryKey(),
    negocioId: uuid("negocio_id")
      .notNull()
      .references(() => negocio.id),
    codigoHash: text("codigo_hash").notNull().unique(),
    expiraAt: timestamp("expira_at", { withTimezone: true }).notNull(),
    usadaAt: timestamp("usada_at", { withTimezone: true }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => usuario.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (tabla) => [index("invitacion_negocio_idx").on(tabla.negocioId)],
);

/** S3 / M2 · sesión opaca con rotación y revocación (T-05). */
export const sesion = pgTable(
  "sesion",
  {
    id: uuid("id").primaryKey(),
    negocioId: uuid("negocio_id")
      .notNull()
      .references(() => negocio.id),
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => usuario.id),
    tokenHash: text("token_hash").notNull().unique(),
    rol: rolEnum("rol").notNull(),
    expiraAt: timestamp("expira_at", { withTimezone: true }).notNull(),
    revocadaAt: timestamp("revocada_at", { withTimezone: true }),
    ultimoUsoAt: timestamp("ultimo_uso_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (tabla) => [
    index("sesion_negocio_idx").on(tabla.negocioId),
    index("sesion_usuario_idx").on(tabla.usuarioId),
  ],
);

export type Invitacion = typeof invitacion.$inferSelect;
export type Sesion = typeof sesion.$inferSelect;
