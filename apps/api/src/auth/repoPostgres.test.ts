/** Integración optativa: sólo contra PostgreSQL desechable con conexión explícita. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../db/schema";
import { RepositorioAuthPostgres } from "./repoPostgres";
import { ServicioAuth } from "./servicio";

test("PostgreSQL auth: migraciones, acceso real y mínimo privilegio", {
  skip: process.env.SYNC_TEST_PG !== "1",
}, async (t) => {
  for (const variable of ["PGHOST", "PGPORT", "PGUSER", "PGDATABASE"]) {
    assert.ok(process.env[variable], `Falta conexión explícita: ${variable}`);
  }
  const sufijo = randomUUID().replaceAll("-", "");
  const base = `auth_test_${sufijo}`;
  const rol = `auth_test_${sufijo}`;
  const clave = randomUUID();
  const admin = new Pool();
  let migrador: Pool | undefined;
  let app: Pool | undefined;
  let creadoRol = false;
  let creadaBase = false;
  try {
    const version = await admin.query("SHOW server_version_num");
    assert.equal(Math.floor(Number(version.rows[0].server_version_num) / 10000), 16);
    await admin.query(`CREATE ROLE "${rol}" LOGIN PASSWORD '${clave}' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`);
    creadoRol = true;
    await admin.query(`CREATE DATABASE "${base}" TEMPLATE template0 ENCODING 'UTF8'`);
    creadaBase = true;
    migrador = new Pool({ database: base });
    const carpeta = resolve(process.cwd(), "src/migrations");
    for (const archivo of (await readdir(carpeta)).filter((f) => f.endsWith(".sql")).sort()) {
      await migrador.query(await readFile(resolve(carpeta, archivo), "utf8"));
    }
    const clienteMigrador = await migrador.connect();
    try {
      await clienteMigrador.query("SELECT set_config('latiendita.rol_app', $1, false)", [rol]);
      await clienteMigrador.query(await readFile(resolve(process.cwd(), "../../infra/permisos-app.sql"), "utf8"));
    } finally {
      clienteMigrador.release();
    }
    app = new Pool({ database: base, user: rol, password: clave });
    const identidad = await app.query("SELECT current_user, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname = current_user");
    assert.deepEqual(identidad.rows[0], { current_user: rol, rolsuper: false, rolbypassrls: false, rolcreatedb: false, rolcreaterole: false });

    const repo = new RepositorioAuthPostgres(drizzle(app, { schema }));
    let ahora = Date.now();
    const servicio = new ServicioAuth(repo, { ahora: () => ahora });
    const a = await servicio.crearNegocio({ nombreNegocio: "Tienda A", nombreDueno: "Marta", pin: "1234" });
    const b = await servicio.crearNegocio({ nombreNegocio: "Tienda B", nombreDueno: "Rosa", pin: "5678" });

    await t.test("fallar la sesión inicial revierte negocio, usuario y membresía", async () => {
      const antes = await migrador!.query("SELECT (SELECT count(*) FROM negocio) negocios, (SELECT count(*) FROM usuario) usuarios, (SELECT count(*) FROM membresia) miembros");
      await migrador!.query(`CREATE FUNCTION fallo_sesion() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fallo deliberado'; END $$;
        CREATE TRIGGER fallo_sesion BEFORE INSERT ON sesion FOR EACH ROW EXECUTE FUNCTION fallo_sesion()`);
      try {
        await assert.rejects(servicio.crearNegocio({ nombreNegocio: "Alta fallida", nombreDueno: "Ana", pin: "9876" }), /fallo deliberado/);
      } finally {
        await migrador!.query("DROP TRIGGER fallo_sesion ON sesion; DROP FUNCTION fallo_sesion()");
      }
      const despues = await migrador!.query("SELECT (SELECT count(*) FROM negocio) negocios, (SELECT count(*) FROM usuario) usuarios, (SELECT count(*) FROM membresia) miembros");
      assert.deepEqual(despues.rows, antes.rows);
    });

    await t.test("alta → invitación → unión → sesión → rotación → revocación", async () => {
      const invitacion = await servicio.crearInvitacion(a.negocio.id, a.sesion.usuarioId, "dueña");
      const empleado = await servicio.unirseConCodigo({ codigo: invitacion.codigo, nombre: "José", pin: "4321" });
      assert.equal(empleado.sesion.negocioId, a.negocio.id);
      assert.equal(empleado.sesion.rol, "empleado");
      assert.deepEqual(await servicio.autenticarToken(empleado.sesion.token), empleado.sesion);
      await assert.rejects(servicio.crearInvitacion(a.negocio.id, empleado.sesion.usuarioId, "empleado"), { codigo: "solo_duena" });
      await assert.rejects(servicio.unirseConCodigo({ codigo: invitacion.codigo, nombre: "Otro", pin: "1111" }), { codigo: "codigo_invalido" });
      const renovada = await servicio.renovarSesion(empleado.sesion.token);
      await assert.rejects(servicio.autenticarToken(empleado.sesion.token), { codigo: "sesion_invalida" });
      assert.equal((await servicio.autenticarToken(renovada.sesion.token)).usuarioId, empleado.sesion.usuarioId);
      await servicio.cerrarSesion(renovada.sesion.token);
      await servicio.cerrarSesion(renovada.sesion.token);
      await assert.rejects(servicio.autenticarToken(renovada.sesion.token), { codigo: "sesion_invalida" });
      assert.equal((await servicio.autenticarToken(b.sesion.token)).negocioId, b.negocio.id);
      const uso = await migrador!.query("SELECT ultimo_uso_at FROM sesion WHERE usuario_id = $1 ORDER BY created_at LIMIT 1", [empleado.sesion.usuarioId]);
      assert.ok(uso.rows[0].ultimo_uso_at);
    });

    await t.test("un canje concurrente incorpora exactamente a una persona", async () => {
      const invitacion = await servicio.crearInvitacion(a.negocio.id, a.sesion.usuarioId, "dueña");
      const antes = await migrador!.query("SELECT (SELECT count(*) FROM usuario) usuarios, (SELECT count(*) FROM membresia) miembros, (SELECT count(*) FROM sesion) sesiones");
      const resultados = await Promise.allSettled(["José 1", "José 2"].map((nombre) => servicio.unirseConCodigo({ codigo: invitacion.codigo, nombre, pin: "4321" })));
      assert.equal(resultados.filter((r) => r.status === "fulfilled").length, 1);
      const rechazo = resultados.find((r) => r.status === "rejected");
      assert.equal(rechazo?.reason.codigo, "codigo_invalido");
      const despues = await migrador!.query("SELECT (SELECT count(*) FROM usuario) usuarios, (SELECT count(*) FROM membresia) miembros, (SELECT count(*) FROM sesion) sesiones");
      for (const columna of ["usuarios", "miembros", "sesiones"]) {
        assert.equal(Number(despues.rows[0][columna]), Number(antes.rows[0][columna]) + 1);
      }
    });

    await t.test("un fallo del canje revierte el código y todas sus filas", async () => {
      const invitacion = await servicio.crearInvitacion(a.negocio.id, a.sesion.usuarioId, "dueña");
      const antes = await migrador!.query("SELECT (SELECT count(*) FROM usuario) usuarios, (SELECT count(*) FROM membresia) miembros, (SELECT count(*) FROM sesion) sesiones");
      await migrador!.query(`CREATE FUNCTION fallo_sesion() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fallo deliberado'; END $$;
        CREATE TRIGGER fallo_sesion BEFORE INSERT ON sesion FOR EACH ROW EXECUTE FUNCTION fallo_sesion()`);
      try {
        await assert.rejects(servicio.unirseConCodigo({ codigo: invitacion.codigo, nombre: "José", pin: "4321" }), /fallo deliberado/);
      } finally {
        await migrador!.query("DROP TRIGGER fallo_sesion ON sesion; DROP FUNCTION fallo_sesion()");
      }
      const despues = await migrador!.query("SELECT (SELECT count(*) FROM usuario) usuarios, (SELECT count(*) FROM membresia) miembros, (SELECT count(*) FROM sesion) sesiones");
      assert.deepEqual(despues.rows, antes.rows);
      assert.equal((await servicio.unirseConCodigo({ codigo: invitacion.codigo, nombre: "José", pin: "4321" })).sesion.negocioId, a.negocio.id);
    });

    await t.test("la rotación concurrente emite una sola sesión vigente", async () => {
      const cuenta = await servicio.crearNegocio({ nombreNegocio: "Rotación", nombreDueno: "Ana", pin: "9876" });
      const resultados = await Promise.allSettled([servicio.renovarSesion(cuenta.sesion.token), servicio.renovarSesion(cuenta.sesion.token)]);
      assert.equal(resultados.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(resultados.find((r) => r.status === "rejected")?.reason.codigo, "sesion_invalida");
      await assert.rejects(servicio.autenticarToken(cuenta.sesion.token), { codigo: "sesion_invalida" });
      const filas = await migrador!.query("SELECT count(*) FROM sesion WHERE usuario_id = $1 AND revocada_at IS NULL", [cuenta.sesion.usuarioId]);
      assert.equal(Number(filas.rows[0].count), 1);
    });

    await t.test("funciones acotadas: sin EXECUTE público ni escritura de esquema", async () => {
      const funciones = await migrador!.query(`SELECT p.prosecdef, p.proconfig,
        EXISTS (SELECT 1 FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
          WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE') AS publica
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname LIKE 'auth_%'`);
      assert.equal(funciones.rowCount, 4);
      for (const funcion of funciones.rows) {
        assert.equal(funcion.prosecdef, true);
        assert.equal(funcion.publica, false);
        assert.deepEqual(funcion.proconfig, ["search_path=pg_catalog, public, pg_temp"]);
      }
      assert.equal((await app!.query("SELECT has_schema_privilege(current_user, 'public', 'CREATE') AS crear")).rows[0].crear, false);
      for (const tabla of ["negocio", "usuario", "membresia"]) {
        assert.equal((await app!.query("SELECT has_table_privilege(current_user, $1, 'INSERT') AS insertar", [tabla])).rows[0].insertar, false);
      }
      await assert.rejects(app!.query("CREATE TABLE public.intruso (id int)"), { code: "42501" });
    });

    await t.test("sin contexto no hay filas; A no lee ni escribe B", async () => {
      await servicio.crearInvitacion(b.negocio.id, b.sesion.usuarioId, "dueña");
      const cliente = await app!.connect();
      try {
        for (const tabla of ["negocio", "usuario", "membresia", "invitacion", "sesion"]) {
          assert.equal((await cliente.query(`SELECT * FROM ${tabla}`)).rowCount, 0);
        }
        await cliente.query("BEGIN");
        await cliente.query("SELECT set_config('app.negocio_id', $1, true)", [a.negocio.id]);
        assert.equal((await cliente.query("SELECT * FROM negocio")).rows[0].id, a.negocio.id);
        assert.equal((await cliente.query("SELECT * FROM usuario WHERE id = $1", [b.sesion.usuarioId])).rowCount, 0);
        for (const tabla of ["membresia", "invitacion", "sesion"]) {
          assert.equal((await cliente.query(`SELECT * FROM ${tabla} WHERE negocio_id = $1`, [b.negocio.id])).rowCount, 0);
        }
        assert.equal((await cliente.query("UPDATE sesion SET revocada_at = now() WHERE negocio_id = $1", [b.negocio.id])).rowCount, 0);
        await assert.rejects(cliente.query("INSERT INTO sesion (id, negocio_id, usuario_id, token_hash, rol, expira_at) VALUES ($1, $2, $3, 'cruzado', 'dueña', now())", [randomUUID(), b.negocio.id, b.sesion.usuarioId]), { code: "42501" });
        await cliente.query("ROLLBACK");
        await cliente.query("BEGIN");
        await cliente.query("SELECT set_config('app.negocio_id', $1, true)", [a.negocio.id]);
        await assert.rejects(cliente.query("INSERT INTO sesion (id, negocio_id, usuario_id, token_hash, rol, expira_at) VALUES ($1, $2, $3, 'usuario-cruzado', 'dueña', now())", [randomUUID(), a.negocio.id, b.sesion.usuarioId]), { code: "42501" });
        await cliente.query("ROLLBACK");
        await assert.rejects(repo.crearInvitacion({ id: randomUUID(), negocioId: a.negocio.id, codigoHash: "creador-cruzado", expiraEn: ahora + 1000, usadaEn: null, createdBy: b.sesion.usuarioId, creadoEn: ahora }), { code: "42501" });
        await assert.rejects(cliente.query("INSERT INTO usuario (id, nombre, pin_hash) VALUES ($1, 'intruso', 'x')", [randomUUID()]), { code: "42501" });
        assert.equal((await cliente.query("SELECT * FROM sesion")).rowCount, 0);
      } finally {
        await cliente.query("ROLLBACK");
        cliente.release();
      }
      assert.equal((await servicio.autenticarToken(b.sesion.token)).negocioId, b.negocio.id);
    });

    await t.test("borrar la membresía invalida el token y su renovación", async () => {
      const invitacion = await servicio.crearInvitacion(a.negocio.id, a.sesion.usuarioId, "dueña");
      const empleado = await servicio.unirseConCodigo({ codigo: invitacion.codigo, nombre: "Sale", pin: "4321" });
      await migrador!.query("UPDATE membresia SET deleted_at = now() WHERE usuario_id = $1", [empleado.sesion.usuarioId]);
      await assert.rejects(servicio.autenticarToken(empleado.sesion.token), { codigo: "sesion_invalida" });
      await assert.rejects(servicio.renovarSesion(empleado.sesion.token), { codigo: "sesion_invalida" });
    });

    await t.test("invitación y sesión vencidas se rechazan en PostgreSQL", async () => {
      const invitacion = await servicio.crearInvitacion(b.negocio.id, b.sesion.usuarioId, "dueña");
      ahora += 8 * 24 * 60 * 60 * 1000;
      await assert.rejects(servicio.unirseConCodigo({ codigo: invitacion.codigo, nombre: "José", pin: "4321" }), { codigo: "codigo_invalido" });
      ahora += 31 * 24 * 60 * 60 * 1000;
      await assert.rejects(servicio.autenticarToken(b.sesion.token), { codigo: "sesion_invalida" });
    });
  } finally {
    await app?.end();
    await migrador?.end();
    if (creadaBase) await admin.query(`DROP DATABASE "${base}"`);
    if (creadoRol) await admin.query(`DROP ROLE "${rol}"`);
    await admin.end();
  }
});
