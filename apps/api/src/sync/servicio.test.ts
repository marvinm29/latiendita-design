import assert from "node:assert/strict";
import test from "node:test";
import type { SesionCuenta } from "../auth/tipos";
import { RepositorioSyncMemoria } from "./repoMemoria";
import { ErrorSync, ServicioSync, type OperacionSync } from "./servicio";

const sesion = (negocioId: string): SesionCuenta => ({ token: "token", negocioId, usuarioId: "usuario", nombre: "Marta", rol: "dueña", expiraEn: 9999999999999 });
const op = (negocioId: string, id: string): OperacionSync => ({ id, endpoint: "/sync/push", payload: { negocioId, entidad: "movimiento", datos: { movimiento: { id, cantidadBase: 2 } } } });

test("repetir o enviar concurrentemente la misma operación devuelve una sola secuencia", async () => {
  const servicio = new ServicioSync(new RepositorioSyncMemoria());
  const operacion = op("a", "op-1");
  const resultados = await Promise.all(Array.from({ length: 10 }, () => servicio.recibir(sesion("a"), [operacion])));
  assert.ok(resultados.every((resultado) => resultado[0]?.secuencia === 1));
  assert.equal((await servicio.consultar(sesion("a"), 0)).length, 1);
});

test("aísla los negocios y rechaza identidad manipulada y colisiones de ID", async () => {
  const servicio = new ServicioSync(new RepositorioSyncMemoria());
  await servicio.recibir(sesion("a"), [op("a", "op-1")]);
  assert.deepEqual(await servicio.consultar(sesion("b"), 0), []);
  await assert.rejects(servicio.recibir(sesion("b"), [op("a", "op-2")]), (error: unknown) => error instanceof ErrorSync && error.codigo === "negocio_invalido");
  await assert.rejects(servicio.recibir(sesion("b"), [op("b", "op-1")]), (error: unknown) => error instanceof ErrorSync && error.codigo === "op_conflictiva");
  await assert.rejects(servicio.recibir(sesion("a"), [{ ...op("a", "op-1"), payload: { ...op("a", "op-1").payload, datos: { otro: 1 } } }]), (error: unknown) => error instanceof ErrorSync && error.codigo === "op_conflictiva");
  assert.equal((await servicio.consultar(sesion("a"), 0)).length, 1);
});

test("valida el lote completo antes de escribir y pagina sin perder eventos", async () => {
  const servicio = new ServicioSync(new RepositorioSyncMemoria());
  await assert.rejects(servicio.recibir(sesion("a"), [op("a", "op-1"), { id: "roto" }]), ErrorSync);
  assert.deepEqual(await servicio.consultar(sesion("a"), 0), []);
  await servicio.recibir(sesion("a"), [op("a", "op-1"), op("a", "op-2"), op("a", "op-3")]);
  assert.deepEqual((await servicio.consultar(sesion("a"), 0, 2)).map((e) => e.secuencia), [1, 2]);
  assert.deepEqual((await servicio.consultar(sesion("a"), 2, 2)).map((e) => e.secuencia), [3]);
  await assert.rejects(servicio.consultar(sesion("a"), -1), ErrorSync);
});

test("no comparte referencias mutables con el llamador", async () => {
  const servicio = new ServicioSync(new RepositorioSyncMemoria());
  const operacion = op("a", "op-1");
  await servicio.recibir(sesion("a"), [operacion]);
  operacion.payload.datos.otro = true;
  const eventos = await servicio.consultar(sesion("a"), 0);
  assert.equal(eventos[0]?.operacion.payload.datos.otro, undefined);
  eventos[0]!.operacion.payload.datos.otro = true;
  assert.equal((await servicio.consultar(sesion("a"), 0))[0]?.operacion.payload.datos.otro, undefined);
});

test("un corte a mitad del lote permite reintentarlo sin duplicar ni perder operaciones", async () => {
  class RepoConCorte extends RepositorioSyncMemoria {
    private fallar = true;
    override async registrar(negocioId: string, operacion: OperacionSync, huella: string) {
      if (operacion.id === "op-50" && this.fallar) {
        this.fallar = false;
        throw new Error("corte simulado");
      }
      return super.registrar(negocioId, operacion, huella);
    }
  }
  const servicio = new ServicioSync(new RepoConCorte());
  const lote = Array.from({ length: 100 }, (_, i) => op("a", `op-${i}`));
  await assert.rejects(servicio.recibir(sesion("a"), lote), /corte simulado/);
  assert.equal((await servicio.consultar(sesion("a"), 0)).length, 50);
  const resultado = await servicio.recibir(sesion("a"), lote);
  assert.equal(resultado.length, 100);
  assert.equal((await servicio.consultar(sesion("a"), 0)).length, 100);
  assert.equal(new Set(resultado.map((evento) => evento.secuencia)).size, 100);
});
