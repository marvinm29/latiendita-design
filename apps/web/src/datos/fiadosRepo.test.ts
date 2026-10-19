import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { abrirDb, borrarDb, crearRepos, type LaTienditaDb } from "@latiendita/core";
import { asegurarBaseLista, type BaseLocal } from "./baseLocal";
import { FiadosRepoDexie } from "./fiadosRepoDexie";

const NEGOCIO = "negocio-fiados-prueba";

let db: LaTienditaDb;
let base: BaseLocal;

beforeEach(async () => {
  db = abrirDb(`web-fiados-${crypto.randomUUID()}`);
  base = { db, repos: crearRepos(db, NEGOCIO), negocioId: NEGOCIO };
  await asegurarBaseLista(base);
});

afterEach(async () => {
  await borrarDb(db);
});

async function entidadesEnOutbox(): Promise<string[]> {
  const ops = await base.db.outbox.toArray();
  return ops.map((op) => (op.payload as { entidad?: string }).entidad ?? "?");
}

describe("fiadosRepoDexie · libreta local (C6)", () => {
  it("crea cliente, cargo y abono: saldo derivado y op por asiento", async () => {
    const repo = new FiadosRepoDexie(base);

    const cliente = await repo.crearClienteConOp({
      nombre: "  Doña Rosa  ",
      telefono: " 7788-1234 ",
    });
    expect(cliente).toMatchObject({
      nombre: "Doña Rosa",
      telefono: "7788-1234",
      limiteCentavos: null,
    });

    let libreta = await repo.listarClientesConSaldo();
    expect(libreta).toHaveLength(1);
    expect(libreta[0]).toMatchObject({ saldoCentavos: 0, ultimoMovimientoEn: null });

    await repo.crearCargoConOp({
      clienteId: cliente.id,
      montoCentavos: 500,
      descripcion: "2 leches",
      creadoEn: 1000,
    });
    await repo.crearAbonoConOp({
      clienteId: cliente.id,
      montoCentavos: 200,
      descripcion: "Abono en efectivo",
      creadoEn: 2000,
    });

    libreta = await repo.listarClientesConSaldo();
    expect(libreta[0]?.saldoCentavos).toBe(300);
    expect(libreta[0]?.ultimoMovimientoEn).toBe(2000);

    const movimientos = await repo.listarMovimientos(cliente.id);
    expect(movimientos.map((m) => m.tipo)).toEqual(["cargo", "abono"]);
    expect(movimientos.map((m) => m.montoCentavos)).toEqual([500, 200]);
    expect(await repo.listarTodosLosMovimientos()).toHaveLength(2);

    // Ledger append-only + outbox coherente: 1 alta de cliente y 2 asientos.
    expect(await db.fiados.count()).toBe(2);
    const entidades = await entidadesEnOutbox();
    expect(entidades.filter((e) => e === "cliente")).toHaveLength(1);
    expect(entidades.filter((e) => e === "fiado")).toHaveLength(2);
    const asientos = await db.fiados.toArray();
    expect(asientos.every((f) => f.negocioId === NEGOCIO)).toBe(true);
  });

  it("ordena por saldo y antigüedad, y persiste al recrear el repo", async () => {
    const repo = new FiadosRepoDexie(base);
    const rosa = await repo.crearClienteConOp({ nombre: "Rosa" });
    const ana = await repo.crearClienteConOp({ nombre: "Ana" });
    const beto = await repo.crearClienteConOp({ nombre: "Beto" });

    await repo.crearCargoConOp({
      clienteId: rosa.id,
      montoCentavos: 300,
      creadoEn: 100,
    });
    await repo.crearCargoConOp({
      clienteId: ana.id,
      montoCentavos: 1200,
      creadoEn: 900,
    });
    await repo.crearAbonoConOp({
      clienteId: beto.id,
      montoCentavos: 50,
      creadoEn: 500,
    });

    expect((await repo.listarClientesConSaldo()).map((c) => c.nombre)).toEqual([
      "Ana",
      "Rosa",
      "Beto",
    ]);
    expect(
      (await repo.listarClientesConSaldo("antiguedad")).map((c) => c.nombre),
    ).toEqual(["Rosa", "Beto", "Ana"]);

    // Otra instancia sobre la misma base: simula recargar la PWA.
    const trasRecarga = new FiadosRepoDexie(base);
    const detalle = await trasRecarga.obtenerCliente(ana.id);
    expect(detalle).toMatchObject({ nombre: "Ana", saldoCentavos: 1200 });
    expect(await trasRecarga.obtenerCliente("no-existe")).toBeNull();
  });

  it("rechaza montos que no son enteros positivos", async () => {
    const repo = new FiadosRepoDexie(base);
    const cliente = await repo.crearClienteConOp({ nombre: "Carlos" });

    await expect(
      repo.crearCargoConOp({ clienteId: cliente.id, montoCentavos: 0 }),
    ).rejects.toThrow(/> 0/);
    await expect(
      repo.crearAbonoConOp({ clienteId: cliente.id, montoCentavos: 10.5 }),
    ).rejects.toThrow(/entero/);
    expect(await db.fiados.count()).toBe(0);
  });
});
