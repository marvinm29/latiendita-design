-- 0001 · Esquema inicial — LaTiendita (M0)
-- Tablas mínimas: negocio · usuario · membresia (specs/003 §4.2).
-- Aislamiento: RLS por negocio_id (C7.2 / T-04). Cada request de la API hará
--   SET LOCAL app.negocio_id = '<uuid>'  dentro de su transacción.
-- IDs UUIDv7 generados en el cliente (§4.1) → sin default del servidor.

CREATE TABLE IF NOT EXISTS negocio (
  id          uuid PRIMARY KEY,
  nombre      text NOT NULL,
  moneda      text NOT NULL DEFAULT 'USD',
  created_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  server_seq  bigint NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS usuario (
  id          uuid PRIMARY KEY,
  nombre      text NOT NULL,
  pin_hash    text NOT NULL,          -- argon2id (T-05)
  created_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

CREATE TABLE IF NOT EXISTS membresia (
  id          uuid PRIMARY KEY,
  negocio_id  uuid NOT NULL REFERENCES negocio (id),
  usuario_id  uuid NOT NULL REFERENCES usuario (id),
  rol         text NOT NULL CHECK (rol IN ('dueña', 'empleado')),
  deleted_at  timestamptz
);

CREATE INDEX IF NOT EXISTS membresia_negocio_idx ON membresia (negocio_id);
CREATE INDEX IF NOT EXISTS membresia_usuario_idx ON membresia (usuario_id);

-- S3 / M2 · códigos de invitación (T-05). Se guarda sólo el hash del código,
-- nunca el código en claro; un solo uso (usada_at) y expira a los 7 días.
CREATE TABLE IF NOT EXISTS invitacion (
  id           uuid PRIMARY KEY,
  negocio_id   uuid NOT NULL REFERENCES negocio (id),
  codigo_hash  text NOT NULL UNIQUE,
  expira_at    timestamptz NOT NULL,
  usada_at     timestamptz,
  created_by   uuid NOT NULL REFERENCES usuario (id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invitacion_negocio_idx ON invitacion (negocio_id);

-- S3 / M2 · sesiones (T-05). Token opaco: sólo su SHA-256; expira a los 30
-- días, rota en /auth/renovar (revocada_at) y se revoca al salir.
CREATE TABLE IF NOT EXISTS sesion (
  id             uuid PRIMARY KEY,
  negocio_id     uuid NOT NULL REFERENCES negocio (id),
  usuario_id     uuid NOT NULL REFERENCES usuario (id),
  token_hash     text NOT NULL UNIQUE,
  rol            text NOT NULL CHECK (rol IN ('dueña', 'empleado')),
  expira_at      timestamptz NOT NULL,
  revocada_at    timestamptz,
  ultimo_uso_at  timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sesion_negocio_idx ON sesion (negocio_id);
CREATE INDEX IF NOT EXISTS sesion_usuario_idx ON sesion (usuario_id);

-- ---------------------------------------------------------------------------
-- RLS (frontera de aislamiento entre negocios)
-- ---------------------------------------------------------------------------

ALTER TABLE negocio ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE membresia ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE sesion ENABLE ROW LEVEL SECURITY;

-- negocio: la fila pertenece al negocio fijado en la request.
CREATE POLICY negocio_aislamiento ON negocio
  FOR ALL
  USING (id = current_setting('app.negocio_id', true)::uuid)
  WITH CHECK (id = current_setting('app.negocio_id', true)::uuid);

-- membresia: misma frontera por la columna negocio_id.
CREATE POLICY membresia_aislamiento ON membresia
  FOR ALL
  USING (negocio_id = current_setting('app.negocio_id', true)::uuid)
  WITH CHECK (negocio_id = current_setting('app.negocio_id', true)::uuid);

-- invitacion: un solo uso y misma frontera por negocio_id.
CREATE POLICY invitacion_aislamiento ON invitacion
  FOR ALL
  USING (negocio_id = current_setting('app.negocio_id', true)::uuid)
  WITH CHECK (negocio_id = current_setting('app.negocio_id', true)::uuid);

-- sesion: misma frontera. Las rutas /auth (canje de código, renovar, salir)
-- buscan por token_hash antes de conocer el negocio; en M2 corren con el rol
-- dueño de las tablas (bypass RLS). S4 las pasa a una función SECURITY DEFINER
-- con el rol de app y RLS activo.
CREATE POLICY sesion_aislamiento ON sesion
  FOR ALL
  USING (negocio_id = current_setting('app.negocio_id', true)::uuid)
  WITH CHECK (negocio_id = current_setting('app.negocio_id', true)::uuid);

-- usuario: no lleva negocio_id; se ve si existe membresía en el negocio de la
-- request. WITH CHECK (true) permite el alta en registro; M2 endurece el flujo
-- con una función SECURITY DEFINER (la creación de usuario+membría es atómica).
CREATE POLICY usuario_aislamiento ON usuario
  FOR ALL
  USING (
    id IN (
      SELECT usuario_id
      FROM membresia
      WHERE negocio_id = current_setting('app.negocio_id', true)::uuid
    )
  )
  WITH CHECK (true);

-- Rol de aplicación (M2). El owner de las tablas (quien corre esta migración)
-- hace bypass de RLS; la API conectará como rol NOLOGIN/login de app:
--   DO $$ BEGIN
--     CREATE ROLE latiendita_app NOLOGIN;
--   EXCEPTION WHEN duplicate_object THEN NULL;
--   END $$;
--   GRANT USAGE ON SCHEMA public TO latiendita_app;
--   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO latiendita_app;

-- ---------------------------------------------------------------------------
-- Semilla opcional (DEMO_SEED=true) — descomentar en M2 con IDs UUIDv7 reales:
-- BEGIN;
--   INSERT INTO negocio (id, nombre, moneda)
--   VALUES ('01900000-0000-7000-8000-000000000001', 'La Tiendita Demo', 'USD');
--   INSERT INTO usuario (id, nombre, pin_hash)
--   VALUES ('01900000-0000-7000-8000-000000000002', 'Marta', '$argon2id$…');
--   INSERT INTO membresia (id, negocio_id, usuario_id, rol)
--   VALUES (
--     '01900000-0000-7000-8000-000000000003',
--     '01900000-0000-7000-8000-000000000001',
--     '01900000-0000-7000-8000-000000000002',
--     'dueña'
--   );
-- COMMIT;
