import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { crearOp } from "../../outbox";
import { stockDerivado } from "../../stock";
import { abrirDb, borrarDb } from "../db";
import type { LaTienditaDb } from "../schema";
import { crearRepos, type ProductoNuevo, type Repos } from "./index";

const NEGOCIO = "negocio-test";

const PRODUCTO_BASE: ProductoNuevo = {
  nombre: "Sal de grano",
  categoria: "Despensa",
  codigoBarras: "7501234567890",
  unidadBase: "unidad",
  unidadVenta: "unidad",
  factor: 1,
  costoCentavos: 800,
  precioCentavos: 1200,
  stockMinimoBase: 5,
};

const dormir = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

let db: LaTienditaDb;
let repos: Repos;

beforeEach(async () => {
  db = abrirDb(`prueba-${crypto.randomUUID()}`);
  await db.open();
  repos = crearRepos(db, NEGOCIO);
});

afterEach(async () => {
  await borrarDb(db);
});

async function crearProducto(sobrescribe: Partial<ProductoNuevo> = {}) {
  return repos.productos.crear({ ...PRODUCTO_BASE, ...sobrescribe });
}

describe("productosRepo", () => {
  it("alta offline: catálogo + op encolada en la misma transacción", async () => {
    const producto = await crearProducto();

    expect(producto.negocioId).toBe(NEGOCIO);
    expect(producto.deletedAt).toBeNull();
    expect(producto.serverSeq).toBeNull();
    expect(producto.updatedAt).toBeGreaterThan(0);

    const listados = await repos.productos.listar();
    expect(listados.map((p) => p.id)).toEqual([producto.id]);

    const ops = await repos.outbox.pendientes();
    expect(ops).toHaveLength(1);
    expect(ops[0]?.payload).toMatchObject({ negocioId: NEGOCIO, entidad: "producto" });

    expect(await repos.productos.buscar("sal")).toHaveLength(1);
    expect(await repos.productos.buscar("despensa")).toHaveLength(1);
    expect(await repos.productos.buscar("xyz")).toHaveLength(0);
    expect((await repos.productos.getById(producto.id))?.id).toBe(producto.id);
    expect(
      (await repos.productos.getByIdPorCodigo(PRODUCTO_BASE.codigoBarras as string))?.id,
    ).toBe(producto.id);
  });

  it("código de barras único entre productos vivos; el tombstone lo libera", async () => {
    const primero = await crearProducto();
    await expect(crearProducto({ nombre: "Otro" })).rejects.toThrow(/código/);
    expect(await db.productos.count()).toBe(1);

    await repos.productos.borrar(primero.id);
    const reuso = await crearProducto({ nombre: "Reuso" });
    expect(reuso.codigoBarras).toBe(PRODUCTO_BASE.codigoBarras);
  });

  it("actualizar cambia campos y marca updatedAt", async () => {
    const producto = await crearProducto();
    await dormir(5);
    const actualizado = await repos.productos.actualizar(producto.id, {
      precioCentavos: 1500,
      codigoBarras: null,
    });

    expect(actualizado.precioCentavos).toBe(1500);
    expect(actualizado.codigoBarras).toBeNull();
    expect(actualizado.updatedAt).toBeGreaterThan(producto.updatedAt);
    expect(await repos.productos.getByIdPorCodigo(PRODUCTO_BASE.codigoBarras as string)).toBeUndefined();
    expect(await repos.outbox.pendientes()).toHaveLength(2); // alta + edición
  });

  it("borrado lógico: sale del catálogo pero no borra el historial", async () => {
    const producto = await crearProducto();
    await repos.movimientos.registrarEntrada({
      productoId: producto.id,
      cantidadBase: 10,
      creadoEn: 1000,
    });
    await repos.productos.borrar(producto.id);

    expect(await repos.productos.listar()).toHaveLength(0);
    expect(await repos.productos.getById(producto.id)).toBeUndefined();

    const crudo = await db.productos.get(producto.id);
    expect(crudo?.deletedAt).toBeTypeOf("number");
    expect(crudo?.activo).toBe(false);

    expect(await repos.movimientos.listarPorProducto(producto.id)).toHaveLength(1);
    expect(await db.stock_cache.get(producto.id)).toMatchObject({ stock: 10 });
    expect(await repos.outbox.pendientes()).toHaveLength(3); // alta + entrada + baja
  });
});

describe("movimientosRepo", () => {
  it("crearMovimientoConOp escribe libro y outbox con el mismo opId", async () => {
    const producto = await crearProducto();
    const { movimiento, op, stock } = await repos.movimientos.crearMovimientoConOp({
      productoId: producto.id,
      tipo: "entrada",
      cantidadBase: 5,
      creadoEn: 500,
    });

    expect(movimiento.opId).toBe(op.id);
    expect(op.estado).toBe("pendiente");
    expect(stock).toBe(5);

    expect((await db.movimientos.get(movimiento.id))?.opId).toBe(op.id);
    expect((await db.outbox.get(op.id))?.payload).toMatchObject({ entidad: "movimiento" });
    expect((await db.outbox.get(op.id))?.payload).toMatchObject({ negocioId: NEGOCIO });
  });

  it("la transacción se revierte entera si la op no cabe en la outbox", async () => {
    const producto = await crearProducto();
    const primera = await repos.movimientos.registrarEntrada({
      productoId: producto.id,
      cantidadBase: 10,
      creadoEn: 1000,
    });
    const movsAntes = await db.movimientos.count();
    const opsAntes = await db.outbox.count();

    await expect(
      repos.movimientos.crearMovimientoConOp({
        productoId: producto.id,
        tipo: "entrada",
        cantidadBase: 3,
        creadoEn: 2000,
        opId: primera.op.id, // opId repetido → la outbox rechaza y todo revierte
      }),
    ).rejects.toThrow();

    expect(await db.movimientos.count()).toBe(movsAntes);
    expect(await db.outbox.count()).toBe(opsAntes);
    expect(await db.stock_cache.get(producto.id)).toMatchObject({ stock: 10 });
  });

  it("caché de stock siempre es igual al derivado del libro (C4.3)", async () => {
    const producto = await crearProducto();
    await repos.movimientos.registrarEntrada({
      productoId: producto.id,
      cantidadBase: 10,
      creadoEn: 1000,
    });
    const salida = await repos.movimientos.registrarSalida({
      productoId: producto.id,
      cantidadBase: 4,
      creadoEn: 2000,
    });
    expect(salida.stock).toBe(6);

    const movimientos = await db.movimientos.where("productoId").equals(producto.id).toArray();
    const derivado = stockDerivado(movimientos, producto.id);
    const cache = await db.stock_cache.get(producto.id);
    expect(derivado).toBe(6);
    expect(cache?.stock).toBe(derivado);
  });

  it("listarRecientes ordena por ocurridoAt desc y respeta el límite", async () => {
    const producto = await crearProducto();
    for (const creadoEn of [1000, 2000, 3000]) {
      await repos.movimientos.registrarEntrada({
        productoId: producto.id,
        cantidadBase: 1,
        creadoEn,
      });
    }
    const recientes = await repos.movimientos.listarRecientes(2);
    expect(recientes.map((m) => m.creadoEn)).toEqual([3000, 2000]);
    expect(await repos.movimientos.listarPorProducto(producto.id)).toHaveLength(3);
  });
});

describe("outboxRepo", () => {
  it("drena sin duplicar: encolar es idempotente por opId", async () => {
    const op = crearOp({ endpoint: "/sync/push", payload: null, ahora: 1000, id: "op-drain" });
    await repos.outbox.encolar(op);
    await repos.outbox.encolar(op);
    expect(await db.outbox.count()).toBe(1);
    expect(await repos.outbox.opsListasParaEnviar(1500)).toHaveLength(1);

    await repos.outbox.marcarEnviando("op-drain");
    expect(await repos.outbox.opsListasParaEnviar(1500)).toHaveLength(0);
    expect(await repos.outbox.pendientes()).toHaveLength(1); // "por sincronizar"

    await repos.outbox.marcarOk("op-drain");
    expect(await repos.outbox.pendientes()).toHaveLength(0);
    expect(await repos.outbox.opsListasParaEnviar(1500)).toHaveLength(0);

    // Reintento de push con el mismo opId: sigue habiendo 1 sola fila.
    await repos.outbox.encolar(op);
    expect(await db.outbox.count()).toBe(1);
    expect(await repos.outbox.opsListasParaEnviar(1500)).toHaveLength(1);
  });

  it("marcarError aplica backoff: no vuelve a ser elegible hasta vencer", async () => {
    const op = crearOp({ endpoint: "/sync/push", payload: null, ahora: 0, id: "op-b" });
    await repos.outbox.encolar(op);
    await repos.outbox.marcarError("op-b", "sin red", 1000, () => 0.5);

    expect(await db.outbox.get("op-b")).toMatchObject({
      estado: "error",
      intentos: 1,
      ultimoError: "sin red",
      proximoIntentoEn: 2000,
    });
    expect(await repos.outbox.opsListasParaEnviar(1999)).toHaveLength(0);
    expect(await repos.outbox.opsListasParaEnviar(2000)).toHaveLength(1);
  });
});

describe("fiadosRepo", () => {
  it("libreta: saldos derivados, historial ordenado y una op por asiento", async () => {
    const cliente = await repos.fiados.crearCliente({
      nombre: "Doña María",
      telefono: "7000-0000",
    });
    let clientes = await repos.fiados.listarClientes();
    expect(clientes).toHaveLength(1);
    expect(clientes[0]?.saldoCentavos).toBe(0);

    const cargo = await repos.fiados.crearCargoConOp({
      clienteId: cliente.id,
      montoCentavos: 1000,
      creadoEn: 1000,
    });
    expect(cargo.fiado.opId).toBe(cargo.op.id);
    await repos.fiados.crearAbonoConOp({
      clienteId: cliente.id,
      montoCentavos: 400,
      creadoEn: 2000,
    });

    clientes = await repos.fiados.listarClientes();
    expect(clientes[0]?.saldoCentavos).toBe(600);

    const historial = await repos.fiados.historialPorCliente(cliente.id);
    expect(historial.map((f) => f.tipo)).toEqual(["cargo", "abono"]);
    expect(await repos.outbox.pendientes()).toHaveLength(3); // alta + cargo + abono
  });

  it("no deja cargar fiado a un cliente inexistente", async () => {
    await expect(
      repos.fiados.crearCargoConOp({ clienteId: "no-existe", montoCentavos: 100 }),
    ).rejects.toThrow(/cliente/);
    expect(await db.fiados.count()).toBe(0);
    expect(await db.outbox.count()).toBe(0);
  });
});

describe("conteoRepo", () => {
  it("sesión abre, cuenta con diferencia y cierra encolando la op", async () => {
    const producto = await crearProducto();
    await repos.movimientos.registrarEntrada({
      productoId: producto.id,
      cantidadBase: 10,
      creadoEn: 1000,
    });

    const sesion = await repos.conteo.iniciar();
    expect(sesion.estado).toBe("abierto");
    expect((await repos.conteo.listarAbierta())?.id).toBe(sesion.id);

    const conItem = await repos.conteo.registrarItem(sesion.id, producto.id, 8);
    expect(conItem.items).toHaveLength(1);
    expect(conItem.items[0]).toMatchObject({
      productoId: producto.id,
      contado: 8,
      sistema: 10,
      diferencia: -2,
    });

    const opsAntes = await db.outbox.count();
    const cerrada = await repos.conteo.cerrar(sesion.id);
    expect(cerrada.estado).toBe("cerrado");
    expect(cerrada.cerradoEn).toBeTypeOf("number");
    expect(await repos.conteo.listarAbierta()).toBeUndefined();
    expect(await db.outbox.count()).toBe(opsAntes + 1); // op del cierre

    await expect(repos.conteo.registrarItem(sesion.id, producto.id, 1)).rejects.toThrow(
      /cerrado/,
    );
  });
});
