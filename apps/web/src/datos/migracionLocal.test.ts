import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { abrirDb, borrarDb, crearRepos, type LaTienditaDb } from "@latiendita/core";
import { asegurarBaseLista, resolverBaseLocal, type BaseLocal } from "./baseLocal";
import { SesionRepoDexie } from "./sesionRepoDexie";
import { PRODUCTOS_DEMO } from "./demo";
import { prepararTrasladoLocal, trasladarDatosLocales, leerRespaldoLocal } from "./migracionLocal";

let db: LaTienditaDb;
let base: BaseLocal;
let sesion: SesionRepoDexie;
let local: ReturnType<typeof crearRepos>;
const confirmacion = { token: "token-a", negocioId: "a" };

async function guardarCuenta(negocioId = "a", rol: "dueña" | "empleado" = "dueña") {
  await sesion.guardarSesion({ negocioId, token: `token-${negocioId}`, usuarioId: `persona-${negocioId}`,
    nombre: "Marta", rol, expiraEn: Date.now() + 86400000 }, "1234");
}

async function origen() {
  return {
    productos: await db.productos.toArray(), movimientos: await db.movimientos.toArray(),
    clientes: await db.clientes.toArray(), fiados: await db.fiados.toArray(),
    categorias: await db.categorias.toArray(), conteos: await db.conteos.toArray(),
    unidadesVenta: await db.unidades_venta.toArray(), outbox: await db.outbox.toArray(),
    stockCache: await db.stock_cache.toArray(),
  };
}

beforeEach(async () => {
  db = abrirDb(`migracion-${crypto.randomUUID()}`);
  local = crearRepos(db, "local");
  base = { db, repos: local, negocioId: "local", seguirSesion: true };
  sesion = new SesionRepoDexie(base);
  await asegurarBaseLista(base);
  await local.productos.actualizar(PRODUCTOS_DEMO[0]!.id, { nombre: "Cola de Marta" });
  await local.productos.borrar(PRODUCTOS_DEMO[1]!.id);
  await local.movimientos.registrarSalida({ productoId: PRODUCTOS_DEMO[0]!.id, cantidadBase: 2 });
  const cliente = await local.fiados.crearCliente({ id: "rosa", nombre: "Rosa" });
  await local.fiados.crearCargoConOp({ clienteId: cliente.id, montoCentavos: 500 });
  const conteo = await local.conteo.iniciar();
  await local.conteo.registrarItem(conteo.id, PRODUCTOS_DEMO[0]!.id, 9);
  await db.unidades_venta.add({ id: "caja", productoId: PRODUCTOS_DEMO[0]!.id, nombre: "Caja", factor: 12, esBase: false });
  await db.meta.put({ clave: "server_seq:local", valor: 999, actualizadoEn: 1 });
  await guardarCuenta();
});

afterEach(async () => { vi.restoreAllMocks(); await borrarDb(db); });

it("inspecciona sin escribir y traslada todo con respaldo íntegro e IDs/cola conservados", async () => {
  const antes = await origen();
  const resumen = await prepararTrasladoLocal(base);
  expect(resumen).toMatchObject({ negocioId: "a", productos: 6, movimientos: 6, clientes: 1, fiados: 1, conteos: 1 });
  expect(await origen()).toEqual(antes); // No hay traslado al ver el resumen ni al cancelar.
  await trasladarDatosLocales(confirmacion, base);
  const respaldo = await leerRespaldoLocal(base);
  expect(respaldo).toMatchObject({ ...antes, negocioId: "local", version: 1 });
  expect(JSON.stringify(respaldo)).not.toContain("token-a");
  expect(JSON.stringify(respaldo)).not.toContain("verificadorPin");
  const despues = await origen();
  for (const tabla of ["productos", "movimientos", "clientes", "fiados", "categorias", "conteos", "stockCache"] as const) {
    expect(despues[tabla]).toEqual(antes[tabla].map((fila) => ({ ...fila, negocioId: "a" })));
  }
  expect(despues.unidadesVenta).toEqual(antes.unidadesVenta);
  expect(despues.outbox.map((op) => op.id)).toEqual(antes.outbox.map((op) => op.id));
  for (const op of despues.outbox) {
    expect(op.negocioId).toBe("a");
    expect(op.payload).toMatchObject({ negocioId: "a" });
    expect(JSON.stringify(op.payload)).not.toContain('"negocioId":"local"');
  }
  expect(await crearRepos(db, "a").movimientos.listarRecientes()).toHaveLength(6);
  expect((await crearRepos(db, "a").fiados.obtenerCliente("rosa"))?.saldoCentavos).toBe(500);
  expect(await db.meta.get("server_seq:a")).toBeUndefined();
  db.close();
  expect(await leerRespaldoLocal(base)).toEqual(respaldo);
  expect(await prepararTrasladoLocal(base)).toBeNull();
  await trasladarDatosLocales(confirmacion, base); // Reintento después de perder respuesta.
  expect(await origen()).toEqual(despues);
});

it.each(["sin sesión", "empleado", "bloqueada", "cuenta cambiada"])("rechaza %s sin alterar el origen ni guardar respaldo", async (caso) => {
  const antes = await origen();
  if (caso === "sin sesión") await db.sesion_local.clear();
  if (caso === "empleado") await guardarCuenta("a", "empleado");
  if (caso === "bloqueada") await sesion.bloquear();
  if (caso === "cuenta cambiada") await guardarCuenta("b");
  await expect(trasladarDatosLocales(confirmacion, base)).rejects.toThrow();
  expect(await origen()).toEqual(antes);
  expect(await leerRespaldoLocal(base)).toBeNull();
});

it("rechaza un destino ocupado incluso si sólo tiene cola", async () => {
  await crearRepos(db, "a").outbox.encolar({ id: "ajena", endpoint: "/sync/push", payload: {}, estado: "pendiente", intentos: 0, creadoEn: 1, proximoIntentoEn: 1, ultimoError: null });
  const antes = await origen();
  await expect(trasladarDatosLocales(confirmacion, base)).rejects.toThrow(/datos/);
  expect(await origen()).toEqual(antes);
  expect(await leerRespaldoLocal(base)).toBeNull();
});

it.each(["referencia", "payload"])("rechaza %s de otro negocio y conserva todas las filas", async (caso) => {
  await crearRepos(db, "b").productos.crear({ ...PRODUCTOS_DEMO[0]!, id: "ajeno" });
  if (caso === "referencia") {
    await db.movimientos.add({ id: "cruzado", negocioId: "local", productoId: "ajeno", tipo: "entrada", cantidadBase: 2, creadoEn: 1, ocurridoAt: 1, serverSeq: null });
  } else {
    const op = (await db.outbox.where("negocioId").equals("local").first())!;
    await db.outbox.update(op.id, { payload: { negocioId: "local", entidad: "producto", datos: { alta: { negocioId: "b", id: "ajeno" } } } });
  }
  const antes = await origen();
  await expect(trasladarDatosLocales(confirmacion, base)).rejects.toThrow();
  expect(await origen()).toEqual(antes);
  expect(await leerRespaldoLocal(base)).toBeNull();
});

it("revierte el respaldo y las filas ya movidas si falla una escritura posterior", async () => {
  const antes = await origen();
  db.fiados.hook("updating", () => { throw new Error("fallo de escritura"); });
  await expect(trasladarDatosLocales(confirmacion, base)).rejects.toThrow(/fallo de escritura/);
  expect(await origen()).toEqual(antes);
  expect(await leerRespaldoLocal(base)).toBeNull();
});

it("el negocio B no ve el respaldo ni reclama el origen de A; al salir no reaparece demo", async () => {
  await trasladarDatosLocales(confirmacion, base);
  await guardarCuenta("b");
  expect(await leerRespaldoLocal(base)).toBeNull();
  expect(await prepararTrasladoLocal(base)).toBeNull();
  await expect(trasladarDatosLocales({ negocioId: "b", token: "token-b" }, base)).rejects.toThrow();
  expect(await crearRepos(db, "b").productos.listar()).toEqual([]);
  await db.sesion_local.clear();
  await expect(resolverBaseLocal(base)).rejects.toThrow(/cuenta/);
  expect(await db.productos.where("negocioId").equals("local").count()).toBe(0);
});

it("repositorios capturados antes del traslado no escriben al origen retirado", async () => {
  await trasladarDatosLocales(confirmacion, base);
  await expect(local.productos.crear({ ...PRODUCTOS_DEMO[0]!, id: "tardio" })).rejects.toThrow(/traslad/);
  await expect(local.fiados.crearCliente({ nombre: "Tardío" })).rejects.toThrow(/traslad/);
  await expect(local.conteo.iniciar()).rejects.toThrow(/traslad/);
  await expect(local.outbox.encolar({ id: "tardia", endpoint: "/sync/push", payload: {}, estado: "pendiente", intentos: 0, creadoEn: 1, proximoIntentoEn: 1, ultimoError: null })).rejects.toThrow(/traslad/);
  expect(await db.productos.where("negocioId").equals("local").count()).toBe(0);
});

it("respalda las confirmaciones antiguas pero no las atribuye a la tienda destino", async () => {
  const productoId = PRODUCTOS_DEMO[0]!.id;
  await db.productos.update(productoId, { serverSeq: 123 });
  const op = (await db.outbox.where("negocioId").equals("local").first())!;
  await db.outbox.update(op.id, { estado: "ok" });
  await trasladarDatosLocales(confirmacion, base);
  expect((await db.productos.get(productoId))?.serverSeq).toBeNull();
  expect((await db.outbox.get(op.id))?.estado).toBe("pendiente");
  const respaldo = await leerRespaldoLocal(base);
  expect(respaldo?.productos.find((p) => p.id === productoId)?.serverSeq).toBe(123);
  expect(respaldo?.outbox.find((o) => o.id === op.id)?.estado).toBe("ok");
});

it("no traslada una operación cuyo ID de entidad pertenece a B aunque declare negocio local", async () => {
  const productoB = await crearRepos(db, "b").productos.crear({ ...PRODUCTOS_DEMO[0]!, id: "producto-b" });
  const op = (await db.outbox.where("negocioId").equals("local").first())!;
  await db.outbox.update(op.id, { payload: { negocioId: "local", entidad: "producto", datos: { baja: { id: productoB.id, deletedAt: 1 } } } });
  const antes = await origen();
  await expect(trasladarDatosLocales(confirmacion, base)).rejects.toThrow();
  expect(await origen()).toEqual(antes);
});

it("una operación antigua desconocida bloquea el traslado sin perderla", async () => {
  const op = (await db.outbox.where("negocioId").equals("local").first())!;
  await db.outbox.update(op.id, { payload: { datos: "formato no reconocido" } });
  const antes = await origen();
  await expect(trasladarDatosLocales(confirmacion, base)).rejects.toThrow(/desconocida/);
  expect(await origen()).toEqual(antes);
});

it("el stock destino se deriva del libro aunque la caché anterior sea incorrecta", async () => {
  const productoId = PRODUCTOS_DEMO[0]!.id;
  await db.stock_cache.put({ productoId, negocioId: "local", stock: 999, actualizadoEn: 1 });
  await trasladarDatosLocales(confirmacion, base);
  expect((await db.stock_cache.get(productoId))?.stock).toBe(10); // Entrada 12, salida 2.
  expect((await leerRespaldoLocal(base))?.stockCache.find((p) => p.productoId === productoId)?.stock).toBe(999);
});
