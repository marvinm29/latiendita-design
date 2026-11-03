-- Bitácora experimental de operaciones recibidas. No sustituye la
-- materialización de entidades ni habilita los endpoints de producción.
CREATE TABLE IF NOT EXISTS sync_evento (
  op_id text PRIMARY KEY,
  negocio_id uuid NOT NULL REFERENCES negocio(id),
  server_seq bigint NOT NULL CHECK (server_seq > 0),
  huella text NOT NULL,
  operacion jsonb NOT NULL,
  creado_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (negocio_id, server_seq)
);

ALTER TABLE sync_evento ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_evento FORCE ROW LEVEL SECURITY;

CREATE POLICY sync_evento_aislamiento ON sync_evento
  USING (negocio_id = nullif(current_setting('app.negocio_id', true), '')::uuid)
  WITH CHECK (negocio_id = nullif(current_setting('app.negocio_id', true), '')::uuid);
