/**
 * Pruebas HTTP del plugin `/auth` (T-05) con Fastify `inject` y el
 * repositorio memoria. Verifican códigos de estado, mensajes en español,
 * el ciclo de sesión y el límite de intentos.
 */
import assert from "node:assert/strict";
import test from "node:test";
import Fastify, { type FastifyInstance } from "fastify";
import { LimitadorIntentos } from "./limitador";
import { registrarAuth } from "./plugin";
import { RepositorioAuthMemoria } from "./repoMemoria";
import { ServicioAuth } from "./servicio";

const T0 = 1_760_000_000_000;

async function montarApp() {
  const limitador = new LimitadorIntentos({ ahora: () => T0 });
  const servicio = new ServicioAuth(new RepositorioAuthMemoria(), { ahora: () => T0 });
  const app = Fastify();

  registrarAuth(app, { servicio, limitador });

  // /health no se ve afectado por el plugin de auth (sigue registrándose aparte).
  app.get("/health", async () => ({ status: "ok" }));
  await app.ready();
  return app;
}

function portador(token: string) {
  return { authorization: `Bearer ${token}` };
}

async function altaDeNegocio(app: FastifyInstance) {
  const respuesta = await app.inject({
    method: "POST",
    url: "/auth/negocio",
    payload: { nombreNegocio: "La Esquina", nombreDueno: "Marta", pin: "1234" },
  });
  assert.equal(respuesta.statusCode, 201);
  return respuesta.json() as {
    negocio: { id: string; nombre: string };
    sesion: { token: string; rol: string; negocioId: string };
  };
}

test("flujo HTTP: negocio → invitación → unirse → yo → salir", async (t) => {
  const app = await montarApp();
  t.after(() => app.close());

  const duena = await altaDeNegocio(app);

  const yo = await app.inject({
    method: "GET",
    url: "/auth/yo",
    headers: portador(duena.sesion.token),
  });
  assert.equal(yo.statusCode, 200);
  const cuerpoYo = yo.json() as { sesion: { nombre: string; rol: string } };
  assert.equal(cuerpoYo.sesion.nombre, "Marta");
  assert.equal(cuerpoYo.sesion.rol, "dueña");

  const invitacion = await app.inject({
    method: "POST",
    url: "/auth/invitacion",
    headers: portador(duena.sesion.token),
  });
  assert.equal(invitacion.statusCode, 201);
  const { codigo } = invitacion.json() as { codigo: string };

  const unirse = await app.inject({
    method: "POST",
    url: "/auth/unirse",
    payload: { codigo, nombre: "José", pin: "5678" },
  });
  assert.equal(unirse.statusCode, 201);
  const empleado = unirse.json() as {
    negocio: { id: string };
    sesion: { token: string; rol: string };
  };
  assert.equal(empleado.sesion.rol, "empleado");
  assert.equal(empleado.negocio.id, duena.negocio.id);

  const salir = await app.inject({
    method: "POST",
    url: "/auth/salir",
    headers: portador(empleado.sesion.token),
  });
  assert.equal(salir.statusCode, 200);
  assert.deepEqual(salir.json(), { ok: true });

  const yoRevocado = await app.inject({
    method: "GET",
    url: "/auth/yo",
    headers: portador(empleado.sesion.token),
  });
  assert.equal(yoRevocado.statusCode, 401);
  assert.equal(
    (yoRevocado.json() as { error: string }).error,
    "Tu sesión venció. Vuelve a entrar.",
  );
});

test("sin token: /auth/yo responde 401 en español", async (t) => {
  const app = await montarApp();
  t.after(() => app.close());

  const respuesta = await app.inject({ method: "GET", url: "/auth/yo" });
  assert.equal(respuesta.statusCode, 401);
  assert.equal((respuesta.json() as { codigo: string }).codigo, "sesion_invalida");
});

test("unirse no filtra si el código existe y valida el PIN", async (t) => {
  const app = await montarApp();
  t.after(() => app.close());

  const inexistente = await app.inject({
    method: "POST",
    url: "/auth/unirse",
    payload: { codigo: "ZZZZZZZZ", nombre: "Ana", pin: "4321" },
  });
  assert.equal(inexistente.statusCode, 400);
  assert.equal(
    (inexistente.json() as { error: string }).error,
    "El código no es válido o ya venció.",
  );

  const pinCorto = await app.inject({
    method: "POST",
    url: "/auth/unirse",
    payload: { codigo: "ZZZZZZZZ", nombre: "Ana", pin: "12" },
  });
  assert.equal(pinCorto.statusCode, 400);
  assert.equal(
    (pinCorto.json() as { error: string }).error,
    "El PIN debe tener entre 4 y 8 números.",
  );
});

test("límite de intentos: 5 fallos por IP y el sexto responde 429", async (t) => {
  const app = await montarApp();
  t.after(() => app.close());

  for (let intento = 0; intento < 5; intento++) {
    const respuesta = await app.inject({
      method: "POST",
      url: "/auth/unirse",
      payload: { codigo: "ZZZZZZZZ", nombre: "Ana", pin: "4321" },
    });
    assert.equal(respuesta.statusCode, 400);
  }

  const bloqueado = await app.inject({
    method: "POST",
    url: "/auth/unirse",
    payload: { codigo: "ZZZZZZZZ", nombre: "Ana", pin: "4321" },
  });
  assert.equal(bloqueado.statusCode, 429);
  assert.equal((bloqueado.json() as { codigo: string }).codigo, "demasiados_intentos");
});

test("/health y las rutas existentes no dependen de la base", async (t) => {
  const app = await montarApp();
  t.after(() => app.close());

  const salud = await app.inject({ method: "GET", url: "/health" });
  assert.equal(salud.statusCode, 200);
  assert.deepEqual(salud.json(), { status: "ok" });
});
