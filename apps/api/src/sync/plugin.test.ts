import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { RepositorioAuthMemoria } from "../auth/repoMemoria";
import { ServicioAuth } from "../auth/servicio";
import { registrarSyncExperimental } from "./plugin";
import { RepositorioSyncMemoria } from "./repoMemoria";

test("HTTP experimental autentica, conserva operaciones y separa negocios", async (t) => {
  const auth = new ServicioAuth(new RepositorioAuthMemoria());
  const a = await auth.crearNegocio({ nombreNegocio: "A", nombreDueno: "Marta", pin: "1234" });
  const b = await auth.crearNegocio({ nombreNegocio: "B", nombreDueno: "Ana", pin: "1234" });
  const app = Fastify();
  registrarSyncExperimental(app, { auth, repositorio: new RepositorioSyncMemoria() });
  t.after(() => app.close());
  const cabecera = (token: string) => ({ authorization: `Bearer ${token}` });
  const operaciones = Array.from({ length: 100 }, (_, n) => ({
    id: `op-${n}`, endpoint: "/sync/push", payload: { negocioId: a.negocio.id, entidad: "movimiento", datos: { movimiento: { id: `m-${n}`, cantidadBase: 1 } } },
  }));

  assert.equal((await app.inject({ method: "POST", url: "/sync/push", payload: { operaciones } })).statusCode, 401);
  const enviar = () => app.inject({ method: "POST", url: "/sync/push", headers: cabecera(a.sesion.token), payload: { operaciones } });
  assert.equal((await enviar()).statusCode, 200);
  assert.equal((await enviar()).statusCode, 200);
  const primera = await app.inject({ method: "GET", url: "/sync/pull?since=0&limit=60", headers: cabecera(a.sesion.token) });
  const segunda = await app.inject({ method: "GET", url: "/sync/pull?since=60", headers: cabecera(a.sesion.token) });
  assert.equal(primera.statusCode, 200);
  assert.deepEqual([primera.json().eventos.length, segunda.json().eventos.length], [60, 40]);
  const otro = await app.inject({ method: "GET", url: "/sync/pull?since=0", headers: cabecera(b.sesion.token) });
  assert.deepEqual(otro.json().eventos, []);
  const suplantacion = await app.inject({ method: "POST", url: "/sync/push", headers: cabecera(b.sesion.token), payload: { operaciones } });
  assert.equal(suplantacion.statusCode, 403);
  assert.equal((await app.inject({ method: "GET", url: "/sync/pull?since=-1", headers: cabecera(a.sesion.token) })).statusCode, 400);
  await auth.cerrarSesion(a.sesion.token);
  assert.equal((await enviar()).statusCode, 401);
});
