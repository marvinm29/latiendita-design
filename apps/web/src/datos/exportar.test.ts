import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { abrirDb, borrarDb, crearRepos, type LaTienditaDb } from "@latiendita/core";
import { asegurarBaseLista, type BaseLocal } from "./baseLocal";
import { aCsv, campoCsv, fiadosCsv, movimientosCsv, productosCsv, respaldoJson } from "./exportar";
import { MovimientosRepoDexie } from "./movimientosRepoDexie";

const NEGOCIO = "negocio-export";
let db: LaTienditaDb;
let base: BaseLocal;

beforeEach(async () => {
  db = abrirDb(`export-${crypto.randomUUID()}`);
  base = { db, repos: crearRepos(db, NEGOCIO), negocioId: NEGOCIO };
  await asegurarBaseLista(base);
});

afterEach(async () => {
  await borrarDb(db);
});

describe("exportación C10", () => {
  it("escapa comillas, comas y saltos de línea", () => {
    expect(campoCsv("simple")).toBe("simple");
    expect(campoCsv('Con "comillas", comas')).toBe('"Con ""comillas"", comas"');
    expect(campoCsv("dos\nlíneas")).toBe('"dos\nlíneas"');
    expect(aCsv(["a", "b"], [["1", "2"]])).toBe("a,b\r\n1,2");
  });

  it("exporta productos vivos con cabeceras en español", async () => {
    const csv = await productosCsv(base);
    expect(csv.split("\r\n")[0]).toContain("nombre,categoria,codigo_barras");
    expect(csv).toContain("Refresco Big Cola 355ml");
    expect(csv).not.toContain("Producto borrado");
  });

  it("exporta movimientos y fiados con nombre legible", async () => {
    const movimientos = new MovimientosRepoDexie(base);
    await movimientos.agregar({
      productoId: "p-galletas-charme",
      tipo: "salida",
      cantidadBase: 2,
      motivo: "Prueba",
      opId: "op-export-mov",
    });
    const cliente = await base.repos.fiados.crearCliente({ nombre: "Doña Rosa" });
    await base.repos.fiados.crearCargoConOp({
      clienteId: cliente.id,
      montoCentavos: 500,
      descripcion: "Arroz, jabón",
    });

    const csvMov = await movimientosCsv(base);
    expect(csvMov).toContain("Galletas Charme,salida,2,Prueba");

    const csvFiados = await fiadosCsv(base);
    expect(csvFiados).toContain("Doña Rosa,cargo,5.00");
  });

  it("el respaldo JSON incluye las tablas del negocio", async () => {
    const respaldo = await respaldoJson(base);
    expect(respaldo.version).toBe(1);
    expect(respaldo.negocioId).toBe(NEGOCIO);
    expect(respaldo.productos.length).toBeGreaterThan(0);
    expect(respaldo.movimientos.length).toBeGreaterThan(0);
    expect(JSON.parse(JSON.stringify(respaldo)).productos).toHaveLength(
      respaldo.productos.length,
    );
  });
});
