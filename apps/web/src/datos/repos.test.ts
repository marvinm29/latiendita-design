import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { abrirDb, borrarDb, crearRepos, type LaTienditaDb } from "@latiendita/core";
import { asegurarBaseLista, type BaseLocal } from "./baseLocal";
import { CatalogoRepoDexie } from "./catalogoRepoDexie";
import { ConteosRepoDexie } from "./conteosRepoDexie";
import { MovimientosRepoDexie } from "./movimientosRepoDexie";
import { PRODUCTOS_DEMO, STOCK_DEMO } from "./demo";

const NEGOCIO = "negocio-prueba";
const REFRESCO = "p-refresco-big-cola";
const GALLETAS = "p-galletas-charme";

const stockDemo = (id: string): number => STOCK_DEMO[id] ?? 0;

let db: LaTienditaDb;
let base: BaseLocal;

beforeEach(async () => {
  db = abrirDb(`web-prueba-${crypto.randomUUID()}`);
  base = { db, repos: crearRepos(db, NEGOCIO), negocioId: NEGOCIO };
  await asegurarBaseLista(base);
});

afterEach(async () => {
  await borrarDb(db);
});

describe("baseLocal · siembra demo (C2/C4.3)", () => {
  it("siembra una sola vez: productos y stock entran por el libro", async () => {
    await asegurarBaseLista(base); // segunda llamada: no duplica nada

    const productos = await base.repos.productos.listar();
    expect(productos).toHaveLength(PRODUCTOS_DEMO.length);

    const conStock = PRODUCTOS_DEMO.filter((p) => stockDemo(p.id) > 0).length;
    expect(await db.movimientos.count()).toBe(conStock);

    const movimientos = new MovimientosRepoDexie(base);
    for (const producto of PRODUCTOS_DEMO) {
      expect(await movimientos.stockDe(producto.id)).toBe(stockDemo(producto.id));
    }
  });
});

describe("movimientos y catálogo comparten el libro (C4.3)", () => {
  it("una salida descuenta el stock que ve el catálogo", async () => {
    const movimientos = new MovimientosRepoDexie(base);
    const catalogo = new CatalogoRepoDexie(base);
    const antes = await movimientos.stockDe(REFRESCO);

    await movimientos.agregar({
      productoId: REFRESCO,
      tipo: "salida",
      cantidadBase: 2,
      opId: "op-salida",
    });

    expect(await movimientos.stockDe(REFRESCO)).toBe(antes - 2);
    const items = await catalogo.listar();
    expect(items.find((i) => i.producto.id === REFRESCO)?.stock).toBe(antes - 2);
  });
});

describe("libro append-only + outbox (C8.4)", () => {
  it("agregar sólo inserta y encola la op en la misma transacción", async () => {
    const movimientos = new MovimientosRepoDexie(base);
    const opsAntes = await db.outbox.count();

    const mov = await movimientos.agregar({
      productoId: GALLETAS,
      tipo: "entrada",
      cantidadBase: 5,
      opId: "op-entrada",
    });

    expect(await db.outbox.count()).toBe(opsAntes + 1);
    expect(mov.opId).toBe("op-entrada");

    const filas = await movimientos.listarPorProducto(GALLETAS);
    expect(filas.at(-1)?.id).toBe(mov.id);
    const pendientes = await base.repos.outbox.pendientes();
    expect(pendientes.some((o) => o.id === "op-entrada")).toBe(true);
  });

  it("un ajuste con signo corrige el stock contado (C5.2)", async () => {
    const movimientos = new MovimientosRepoDexie(base);
    const antes = await movimientos.stockDe(GALLETAS);

    await movimientos.agregar({
      productoId: GALLETAS,
      tipo: "ajuste",
      cantidadBase: -3,
      motivo: "Conteo físico",
      opId: "op-ajuste",
    });

    expect(await movimientos.stockDe(GALLETAS)).toBe(antes - 3);
  });
});

describe("sesión de conteo persistente (C5.2)", () => {
  it("retoma la sesión abierta tras 'recargar' y la cierra con sus ajustes", async () => {
    const conteos = new ConteosRepoDexie(base);
    const antes = await new MovimientosRepoDexie(base).stockDe(REFRESCO);
    const opsAntes = new Set((await base.db.outbox.toArray()).map((op) => op.id));

    const sesion = await conteos.iniciar();
    await conteos.registrarItem(sesion.id, REFRESCO, antes - 2);

    // Nuevo repo sobre la misma base: simula recargar la app.
    const trasRecarga = new ConteosRepoDexie(base);
    const abierta = await trasRecarga.retomar();
    expect(abierta?.id).toBe(sesion.id);
    expect(abierta?.items[0]).toMatchObject({ productoId: REFRESCO, contado: antes - 2 });

    const { conteo, ajustes } = await trasRecarga.cerrarConAjustes(sesion.id);
    expect(conteo.estado).toBe("cerrado");
    expect(conteo.items[0]).toMatchObject({ sistema: antes, diferencia: -2 });
    expect(ajustes).toHaveLength(1);
    expect(ajustes[0]?.movimiento).toMatchObject({ tipo: "ajuste", cantidadBase: -2 });
    expect(await trasRecarga.retomar()).toBeUndefined();
    expect(await new MovimientosRepoDexie(base).stockDe(REFRESCO)).toBe(antes - 2);

    const ops = (await base.db.outbox.toArray()).filter((op) => !opsAntes.has(op.id));
    const entidadDe = (op: (typeof ops)[number]): string | undefined =>
      (op.payload as { entidad?: string }).entidad;
    expect(ops.filter((op) => entidadDe(op) === "conteo")).toHaveLength(1);
    expect(ops.filter((op) => entidadDe(op) === "movimiento")).toHaveLength(1);
  });

  it("un conteo sin diferencias cierra sin ajustes y deja la op del conteo", async () => {
    const conteos = new ConteosRepoDexie(base);
    const stock = await new MovimientosRepoDexie(base).stockDe(GALLETAS);
    const opsAntes = new Set((await base.db.outbox.toArray()).map((op) => op.id));
    const sesion = await conteos.iniciar();
    await conteos.registrarItem(sesion.id, GALLETAS, stock);

    const { conteo, ajustes } = await conteos.cerrarConAjustes(sesion.id);
    expect(conteo.estado).toBe("cerrado");
    expect(ajustes).toHaveLength(0);
    expect(await new MovimientosRepoDexie(base).stockDe(GALLETAS)).toBe(stock);

    const ops = (await base.db.outbox.toArray()).filter((op) => !opsAntes.has(op.id));
    const entidadDe = (op: (typeof ops)[number]): string | undefined =>
      (op.payload as { entidad?: string }).entidad;
    expect(ops.filter((op) => entidadDe(op) === "conteo")).toHaveLength(1);
    expect(ops.filter((op) => entidadDe(op) === "movimiento")).toHaveLength(0);
  });
});
