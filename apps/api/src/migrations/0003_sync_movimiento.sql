-- Libro experimental: sólo inserciones; la bitácora y el asiento comparten transacción.
CREATE TABLE sync_movimiento (
  negocio_id uuid NOT NULL REFERENCES negocio(id),
  id text NOT NULL,
  op_id text NOT NULL REFERENCES sync_evento(op_id),
  datos jsonb NOT NULL,
  PRIMARY KEY (negocio_id, id),
  UNIQUE (op_id)
);

ALTER TABLE sync_movimiento ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_movimiento FORCE ROW LEVEL SECURITY;
CREATE POLICY sync_movimiento_aislamiento ON sync_movimiento
  USING (negocio_id = nullif(current_setting('app.negocio_id', true), '')::uuid)
  WITH CHECK (negocio_id = nullif(current_setting('app.negocio_id', true), '')::uuid);
