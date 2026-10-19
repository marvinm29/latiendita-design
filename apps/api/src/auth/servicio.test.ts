/**
 * Pruebas del servicio de cuentas y acceso (T-05) con el repositorio memoria.
 * Cubren: alta de negocio, invitación ↔ unirse, código de un solo uso,
 * PIN incorrecto, ciclo del token (válido/rotado/revocado) y aislamiento A/B.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { normalizarCodigo } from "./codigo";
import { RepositorioAuthMemoria } from "./repoMemoria";
import { hashearPin, hashearToken, verificarPin } from "./seguridad";
import { DURACION_INVITACION_MS, DURACION_SESION_MS, ServicioAuth } from "./servicio";
import { ErrorAuth } from "./tipos";

const T0 = 1_760_000_000_000;

function montar(instanteInicial = T0) {
  const reloj = { instante: instanteInicial };
  const repo = new RepositorioAuthMemoria();
  const servicio = new ServicioAuth(repo, { ahora: () => reloj.instante });
  return { repo, servicio, reloj };
}

async function negocioDePrueba(servicio: ServicioAuth, nombre = "La Esquina") {
  return servicio.crearNegocio({
    nombreNegocio: nombre,
    nombreDueno: "Marta",
    pin: "1234",
  });
}

async function invitarYUnirse(servicio: ServicioAuth) {
  const duena = await negocioDePrueba(servicio);
  const invitacion = await servicio.crearInvitacion(
    duena.sesion.negocioId,
    duena.sesion.usuarioId,
    duena.sesion.rol,
  );
  const empleado = await servicio.unirseConCodigo({
    codigo: invitacion.codigo,
    nombre: "José",
    pin: "5678",
  });
  return { duena, invitacion, empleado };
}

test("crear negocio abre sesión de dueña y guarda el PIN hasheado", async () => {
  const { repo, servicio } = montar();

  const { negocio, sesion } = await negocioDePrueba(servicio);

  assert.equal(negocio.nombre, "La Esquina");
  assert.equal(negocio.moneda, "USD");
  assert.equal(negocio.creadoEn, T0);
  assert.equal(sesion.rol, "dueña");
  assert.equal(sesion.nombre, "Marta");
  assert.equal(sesion.negocioId, negocio.id);
  assert.equal(sesion.expiraEn, T0 + DURACION_SESION_MS);
  assert.match(sesion.token, /^[A-Za-z0-9_-]{43}$/);

  const usuario = await repo.buscarUsuario(sesion.usuarioId);
  assert.ok(usuario);
  assert.match(usuario.pinHash, /^\$argon2id\$/);
  assert.ok(!usuario.pinHash.includes("1234"));

  const autenticada = await servicio.autenticarToken(sesion.token);
  assert.equal(autenticada.usuarioId, sesion.usuarioId);
  assert.equal(autenticada.nombre, "Marta");
});

test("invitar ↔ unirse: el empleado entra al mismo negocio con rol empleado", async () => {
  const { servicio, reloj } = montar();
  const { duena, invitacion, empleado } = await invitarYUnirse(servicio);

  assert.match(invitacion.codigo, /^[0-9A-HJKMNP-TV-Z]{8}$/);
  assert.equal(invitacion.expiraEn, reloj.instante + DURACION_INVITACION_MS);
  assert.notEqual(empleado.sesion.token, duena.sesion.token);
  assert.notEqual(empleado.sesion.usuarioId, duena.sesion.usuarioId);
  assert.equal(empleado.sesion.negocioId, duena.sesion.negocioId);
  assert.equal(empleado.sesion.rol, "empleado");
  assert.equal(empleado.sesion.nombre, "José");
  assert.equal(empleado.negocio.nombre, "La Esquina");

  const autenticada = await servicio.autenticarToken(empleado.sesion.token);
  assert.equal(autenticada.rol, "empleado");

  // El código se tolera en minúsculas y con guiones al escribirlo.
  const normalizado = normalizarCodigo(` ${invitacion.codigo.toLowerCase()} `);
  assert.equal(normalizado, invitacion.codigo);
});

test("el código de invitación es de un solo uso", async () => {
  const { servicio } = montar();
  const { duena, invitacion } = await invitarYUnirse(servicio);

  await assert.rejects(
    servicio.unirseConCodigo({ codigo: invitacion.codigo, nombre: "Ana", pin: "4321" }),
    (error: unknown) =>
      error instanceof ErrorAuth &&
      error.estado === 400 &&
      error.codigo === "codigo_invalido" &&
      error.message === "El código no es válido o ya venció.",
  );

  const sesionDuena = await servicio.autenticarToken(duena.sesion.token);
  assert.equal(sesionDuena.rol, "dueña");
});

test("un código vencido no deja entrar (7 días)", async () => {
  const { servicio, reloj } = montar();
  const duena = await negocioDePrueba(servicio);
  const { codigo } = await servicio.crearInvitacion(
    duena.sesion.negocioId,
    duena.sesion.usuarioId,
    "dueña",
  );

  reloj.instante += DURACION_INVITACION_MS + 1;

  await assert.rejects(
    servicio.unirseConCodigo({ codigo, nombre: "Ana", pin: "4321" }),
    (error: unknown) => error instanceof ErrorAuth && error.estado === 400,
  );
});

test("PIN incorrecto no verifica y un PIN mal formado no crea usuario", async () => {
  const hash = await hashearPin("2468");
  assert.equal(await verificarPin("2468", hash), true);
  assert.equal(await verificarPin("1357", hash), false);

  const { servicio } = montar();
  const duena = await negocioDePrueba(servicio);
  const { codigo } = await servicio.crearInvitacion(
    duena.sesion.negocioId,
    duena.sesion.usuarioId,
    "dueña",
  );

  await assert.rejects(
    servicio.unirseConCodigo({ codigo, nombre: "José", pin: "12" }),
    (error: unknown) =>
      error instanceof ErrorAuth &&
      error.estado === 400 &&
      error.codigo === "pin_invalido" &&
      error.message === "El PIN debe tener entre 4 y 8 números.",
  );
});

test("sólo la dueña puede invitar", async () => {
  const { servicio } = montar();
  const { empleado } = await invitarYUnirse(servicio);

  await assert.rejects(
    servicio.crearInvitacion(empleado.sesion.negocioId, empleado.sesion.usuarioId, "empleado"),
    (error: unknown) =>
      error instanceof ErrorAuth && error.estado === 403 && error.codigo === "solo_duena",
  );
});

test("sesión: válida, rotada y revocada", async () => {
  const { servicio, reloj } = montar();
  const { sesion } = await negocioDePrueba(servicio);

  const renovada = await servicio.renovarSesion(sesion.token);
  assert.notEqual(renovada.sesion.token, sesion.token);
  assert.equal(renovada.sesion.usuarioId, sesion.usuarioId);
  assert.equal(renovada.sesion.negocioId, sesion.negocioId);
  assert.equal(renovada.sesion.expiraEn, reloj.instante + DURACION_SESION_MS);

  // El token anterior quedó revocado por la rotación.
  await assert.rejects(
    servicio.autenticarToken(sesion.token),
    (error: unknown) => error instanceof ErrorAuth && error.estado === 401,
  );

  const vigente = await servicio.autenticarToken(renovada.sesion.token);
  assert.equal(vigente.usuarioId, sesion.usuarioId);

  await servicio.cerrarSesion(renovada.sesion.token);
  await assert.rejects(
    servicio.autenticarToken(renovada.sesion.token),
    (error: unknown) =>
      error instanceof ErrorAuth &&
      error.estado === 401 &&
      error.message === "Tu sesión venció. Vuelve a entrar.",
  );

  // Salir dos veces no falla (idempotente).
  await servicio.cerrarSesion(renovada.sesion.token);
});

test("una sesión vence a los 30 días", async () => {
  const { servicio, reloj } = montar();
  const { sesion } = await negocioDePrueba(servicio);

  reloj.instante += DURACION_SESION_MS + 1;

  await assert.rejects(
    servicio.autenticarToken(sesion.token),
    (error: unknown) => error instanceof ErrorAuth && error.estado === 401,
  );
});

test("aislamiento A/B: el token de A nunca apunta al negocio B", async () => {
  const { servicio, repo } = montar();

  const a = await servicio.crearNegocio({ nombreNegocio: "Tienda A", nombreDueno: "Marta", pin: "1111" });
  const b = await servicio.crearNegocio({ nombreNegocio: "Tienda B", nombreDueno: "Ana", pin: "2222" });

  const sesionA = await servicio.autenticarToken(a.sesion.token);
  const sesionB = await servicio.autenticarToken(b.sesion.token);

  assert.equal(sesionA.negocioId, a.negocio.id);
  assert.equal(sesionB.negocioId, b.negocio.id);
  assert.notEqual(sesionA.negocioId, sesionB.negocioId);

  // La invitación de A sólo crea membresías en A.
  const invitacionA = await servicio.crearInvitacion(
    sesionA.negocioId,
    sesionA.usuarioId,
    sesionA.rol,
  );
  const empleadoA = await servicio.unirseConCodigo({
    codigo: invitacionA.codigo,
    nombre: "José",
    pin: "3333",
  });
  assert.equal(empleadoA.sesion.negocioId, a.negocio.id);
  assert.notEqual(empleadoA.sesion.negocioId, b.negocio.id);
  assert.equal(empleadoA.negocio.nombre, "Tienda A");

  // El servidor sólo guarda hashes: el token en claro no está en la base.
  assert.equal(await repo.buscarSesionPorToken(a.sesion.token), null);
  assert.ok(await repo.buscarSesionPorToken(hashearToken(a.sesion.token)));
});
