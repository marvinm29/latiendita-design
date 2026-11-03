/** Integración optativa: requiere PostgreSQL temporal y SYNC_TEST_PG=1. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { Pool } from "pg";
import type { SesionCuenta } from "../auth/tipos";
import { RepositorioBitacoraPostgres } from "./repoPostgres";
import { ErrorSync, ServicioSync, type OperacionSync } from "./servicio";

test("PostgreSQL: RLS real, secuencias concurrentes, reintentos y persistencia", { skip: process.env.SYNC_TEST_PG !== "1" }, async () => {
  const sufijo = randomUUID().replaceAll("-", "");
  const esquema = `sync_test_${sufijo}`;
  const rol = `sync_test_${sufijo}`;
  const clave = randomUUID();
  const admin = new Pool();
  let app: Pool | undefined;
  let creadoRol = false;
  let creadoEsquema = false;
  try {
    const cliente = await admin.connect();
    try {
      await cliente.query(`CREATE ROLE "${rol}" LOGIN PASSWORD '${clave}'`);
      creadoRol = true;
      await cliente.query(`CREATE SCHEMA "${esquema}"`);
      creadoEsquema = true;
      await cliente.query(`SET search_path TO "${esquema}"`);
      await cliente.query("CREATE TABLE negocio (id uuid PRIMARY KEY)");
      const sql = await readFile(resolve(process.cwd(), "src/migrations/0002_sync_bitacora.sql"), "utf8");
      await cliente.query(sql);
      await cliente.query(await readFile(resolve(process.cwd(), "src/migrations/0003_sync_movimiento.sql"), "utf8"));
      await cliente.query(`GRANT USAGE ON SCHEMA "${esquema}" TO "${rol}"`);
      await cliente.query(`GRANT SELECT, INSERT ON "${esquema}".sync_evento TO "${rol}"`);
      await cliente.query(`GRANT SELECT, INSERT ON "${esquema}".sync_movimiento TO "${rol}"`);
      await cliente.query("INSERT INTO negocio (id) VALUES ($1), ($2)", ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002"]);
    } finally {
      cliente.release();
    }
    app = new Pool({ user: rol, password: clave, options: `-c search_path=${esquema}` });
    const servicio = new ServicioSync(new RepositorioBitacoraPostgres(app));
    const a = "00000000-0000-4000-8000-000000000001";
    const b = "00000000-0000-4000-8000-000000000002";
    const sesion = (negocioId: string): SesionCuenta => ({ token: "t", negocioId, usuarioId: "u", nombre: "Marta", rol: "dueña", expiraEn: 9999999999999 });
    const op = (negocioId: string, id: string): OperacionSync => ({ id, endpoint: "/sync/push", payload: { negocioId, entidad: "categoria", datos: { id } } });

    const lote = Array.from({ length: 40 }, (_, i) => op(a, `op-${i}`));
    const respuestas = await Promise.all(lote.map((operacion) => servicio.recibir(sesion(a), [operacion])));
    assert.deepEqual(respuestas.map((r) => r[0]!.secuencia).sort((x, y) => x - y), Array.from({ length: 40 }, (_, i) => i + 1));
    await servicio.recibir(sesion(a), lote);
    assert.equal((await new ServicioSync(new RepositorioBitacoraPostgres(app)).consultar(sesion(a), 0)).length, 40);
    assert.deepEqual(await servicio.consultar(sesion(b), 0), []);
    await servicio.recibir(sesion(b), [op(b, "op-b")]);
    assert.equal((await servicio.consultar(sesion(b), 0)).length, 1);
    assert.equal((await servicio.consultar(sesion(a), 0)).length, 40);
    await assert.rejects(servicio.recibir(sesion(b), [op(b, "op-0")]), (error: unknown) => error instanceof ErrorSync && error.codigo === "op_conflictiva");

    const movimiento: OperacionSync = { id: "op-mov", endpoint: "/sync/push", payload: { negocioId: a, entidad: "movimiento", datos: { movimiento: { id: "mov-1", productoId: "producto-1", tipo: "entrada", cantidadBase: 2, creadoEn: 123, opId: "op-mov" } } } };
    await servicio.recibir(sesion(a), [movimiento]);
    await servicio.recibir(sesion(a), [movimiento]);
    const asientos = await admin.query(`SELECT datos FROM "${esquema}".sync_movimiento WHERE negocio_id = $1`, [a]);
    assert.equal(asientos.rowCount, 1);
    assert.deepEqual(asientos.rows[0]?.datos, movimiento.payload.datos.movimiento);
    const conflicto = structuredClone(movimiento);
    conflicto.id = "otra-op";
    (conflicto.payload.datos.movimiento as { opId: string }).opId = conflicto.id;
    await assert.rejects(servicio.recibir(sesion(a), [conflicto]));
    assert.equal((await servicio.consultar(sesion(a), 0)).length, 41);
    const invalido = structuredClone(movimiento);
    invalido.id = "op-invalida";
    (invalido.payload.datos.movimiento as { cantidadBase: number; opId: string }).cantidadBase = -1;
    (invalido.payload.datos.movimiento as { opId: string }).opId = invalido.id;
    await assert.rejects(servicio.recibir(sesion(a), [invalido]), (error: unknown) => error instanceof ErrorSync && error.codigo === "datos_invalidos");
    assert.equal((await servicio.consultar(sesion(a), 0)).length, 41);

    const clienteApp = await app.connect();
    try {
      await clienteApp.query("BEGIN");
      await clienteApp.query("SELECT set_config('app.negocio_id', $1, true)", [a]);
      const filtradas = await clienteApp.query("SELECT * FROM sync_evento WHERE negocio_id = $1", [b]);
      assert.equal(filtradas.rowCount, 0);
      await clienteApp.query("SELECT set_config('app.negocio_id', $1, true)", [b]);
      const movimientosOtroNegocio = await clienteApp.query("SELECT * FROM sync_movimiento WHERE negocio_id = $1", [a]);
      assert.equal(movimientosOtroNegocio.rowCount, 0);
      await clienteApp.query("SELECT set_config('app.negocio_id', $1, true)", [a]);
      await assert.rejects(clienteApp.query("UPDATE sync_movimiento SET datos = '{}' WHERE id = 'mov-1'"), (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === "42501");
      await clienteApp.query("ROLLBACK");
      await clienteApp.query("BEGIN");
      await clienteApp.query("SELECT set_config('app.negocio_id', $1, true)", [a]);
      await assert.rejects(clienteApp.query("INSERT INTO sync_evento (op_id, negocio_id, server_seq, huella, operacion) VALUES ($1, $2, 1, 'x', '{}')", ["ataque", b]), (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === "42501");
      await clienteApp.query("ROLLBACK");
    } finally {
      clienteApp.release();
    }
  } finally {
    await app?.end();
    if (creadoEsquema) await admin.query(`DROP SCHEMA "${esquema}" CASCADE`);
    if (creadoRol) await admin.query(`DROP ROLE "${rol}"`);
    await admin.end();
  }
});
