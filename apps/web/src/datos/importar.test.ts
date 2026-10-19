import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  abrirDb,
  borrarDb,
  crearRepos,
  stockDerivado,
  type CategoriaFila,
  type LaTienditaDb,
} from "@latiendita/core";
import { asegurarBaseLista, type BaseLocal } from "./baseLocal";
import { respaldoJson, type RespaldoJson } from "./exportar";
import {
  importarProductosCsv,
  parsearCsv,
  plantillaProductosCsv,
  restaurarRespaldo,
  validarRespaldoJson,
} from "./importar";

const NEGOCIO = "negocio-import";
let db: LaTienditaDb;
let base: BaseLocal;

async function nuevaBase(nombre: string, negocioId: string): Promise<BaseLocal> {
  const nueva = abrirDb(nombre);
  const local: BaseLocal = {
    db: nueva,
    repos: crearRepos(nueva, negocioId),
    negocioId,
  };
  await asegurarBaseLista(local);
  return local;
}

function filaCategoria(id: string, nombre: string, negocioId: string): CategoriaFila {
  return {
    id,
    nombre,
    negocioId,
    updatedAt: 1,
    deletedAt: null,
    serverSeq: null,
    rev: 0,
  };
}

beforeEach(async () => {
  db = abrirDb(`import-${crypto.randomUUID()}`);
  base = { db, repos: crearRepos(db, NEGOCIO), negocioId: NEGOCIO };
  await asegurarBaseLista(base);
});

afterEach(async () => {
  await borrarDb(db);
});

describe("validarRespaldoJson", () => {
  it("acepta un respaldo exportado y devuelve el resumen de conteos", async () => {
    const respaldo = await respaldoJson(base);
    const validacion = validarRespaldoJson(JSON.stringify(respaldo));

    expect(validacion.ok).toBe(true);
    if (!validacion.ok) return;
    expect(validacion.resumen.productos).toBe(respaldo.productos.length);
    expect(validacion.resumen.movimientos).toBe(respaldo.movimientos.length);
    expect(validacion.resumen.clientes).toBe(0);
    expect(validacion.resumen.fiados).toBe(0);
    expect(validacion.resumen.categorias).toBe(0);
  });

  it("rechaza JSON inválido, versiones distintas y listas que no son arrays", async () => {
    const roto = validarRespaldoJson("{no es json");
    expect(roto.ok).toBe(false);
    if (!roto.ok) expect(roto.error).toContain("JSON válido");

    const version = validarRespaldoJson(
      JSON.stringify({ version: 2, exportadoEn: "", negocioId: "x" }),
    );
    expect(version.ok).toBe(false);
    if (!version.ok) expect(version.error).toContain("versión 1");

    const respaldo = await respaldoJson(base);
    const sinProductos = validarRespaldoJson(
      JSON.stringify({ ...respaldo, productos: "no-es-array" }),
    );
    expect(sinProductos.ok).toBe(false);
    if (!sinProductos.ok) expect(sinProductos.error).toContain("productos");
  });

  it("señala la fila y el campo que no cumplen", async () => {
    const respaldo = await respaldoJson(base);
    const malo = {
      ...respaldo,
      productos: [{ ...respaldo.productos[0], factor: 0 }],
    };
    const validacion = validarRespaldoJson(JSON.stringify(malo));
    expect(validacion.ok).toBe(false);
    if (!validacion.ok) {
      expect(validacion.error).toContain("productos, fila 1");
      expect(validacion.error).toContain("factor");
    }
  });
});

describe("restaurarRespaldo", () => {
  it("combina los datos sin borrar ni duplicar ids", async () => {
    const origen = await nuevaBase(`origen-${crypto.randomUUID()}`, "origen");
    try {
      const producto = await origen.repos.productos.crear({
        id: "p-importado",
        nombre: "Producto importado",
        categoria: "Importados",
        codigoBarras: "9000000000012",
        unidadBase: "unidad",
        unidadVenta: "unidad",
        factor: 1,
        costoCentavos: 100,
        precioCentavos: 150,
        stockMinimoBase: 1,
      });
      await origen.repos.movimientos.registrarEntrada({
        productoId: producto.id,
        cantidadBase: 7,
        id: "mov-importado-1",
        opId: "op-mov-importado-1",
      });
      const cliente = await origen.repos.fiados.crearCliente({
        id: "c-importado",
        nombre: "Cliente importado",
      });
      await origen.repos.fiados.crearCargoConOp({
        clienteId: cliente.id,
        montoCentavos: 250,
        id: "f-importado",
      });
      await origen.db.categorias.put(
        filaCategoria("cat-importada", "Importados", origen.negocioId),
      );

      const respaldo = await respaldoJson(origen);

      const primera = await restaurarRespaldo(respaldo, base);
      expect(primera.productos.nuevos).toBe(1);
      expect(primera.movimientos.nuevos).toBe(1);
      expect(primera.clientes.nuevos).toBe(1);
      expect(primera.fiados.nuevos).toBe(1);
      expect(primera.categorias.nuevos).toBe(1);
      expect(primera.stockRecalculado).toBe(1);

      expect(await db.productos.get("p-importado")).toBeDefined();
      expect(await db.clientes.get("c-importado")).toBeDefined();
      expect(await db.movimientos.get("mov-importado-1")).toBeDefined();
      expect((await db.stock_cache.get("p-importado"))?.stock).toBe(7);
      // Los datos demo del teléfono siguen ahí (no se borra nada).
      expect(await db.productos.get("p-refresco-big-cola")).toBeDefined();

      const antes = {
        productos: await db.productos.count(),
        movimientos: await db.movimientos.count(),
        clientes: await db.clientes.count(),
        fiados: await db.fiados.count(),
        categorias: await db.categorias.count(),
      };
      const segunda = await restaurarRespaldo(respaldo, base);
      expect(segunda.productos.nuevos).toBe(0);
      expect(segunda.productos.existentes).toBe(respaldo.productos.length);
      expect(segunda.movimientos.nuevos).toBe(0);
      expect({
        productos: await db.productos.count(),
        movimientos: await db.movimientos.count(),
        clientes: await db.clientes.count(),
        fiados: await db.fiados.count(),
        categorias: await db.categorias.count(),
      }).toEqual(antes);
    } finally {
      await borrarDb(origen.db);
    }
  });

  it("recalcula stock_cache desde el libro, nunca desde el valor del archivo", async () => {
    const origen = await nuevaBase(`origen-stock-${crypto.randomUUID()}`, "origen-stock");
    try {
      await origen.repos.productos.crear({
        id: "p-stock",
        nombre: "Producto con libro",
        categoria: "Pruebas",
        codigoBarras: null,
        unidadBase: "unidad",
        unidadVenta: "unidad",
        factor: 1,
        costoCentavos: 10,
        precioCentavos: 20,
        stockMinimoBase: 0,
      });
      await origen.repos.movimientos.registrarEntrada({
        productoId: "p-stock",
        cantidadBase: 10,
        id: "mov-stock-1",
        opId: "op-stock-1",
      });
      await restaurarRespaldo(await respaldoJson(origen), base);

      // Caché corrupto a propósito: la restauración debe ignorarlo.
      await db.stock_cache.put({
        productoId: "p-stock",
        negocioId: NEGOCIO,
        stock: 999,
        actualizadoEn: 0,
      });

      await origen.repos.movimientos.registrarSalida({
        productoId: "p-stock",
        cantidadBase: 3,
        id: "mov-stock-2",
        opId: "op-stock-2",
      });
      await restaurarRespaldo(await respaldoJson(origen), base);

      const libro = await db.movimientos.where("productoId").equals("p-stock").toArray();
      const esperado = stockDerivado(libro, "p-stock");
      expect(esperado).toBe(7);
      expect((await db.stock_cache.get("p-stock"))?.stock).toBe(esperado);
    } finally {
      await borrarDb(origen.db);
    }
  });

  it("acepta un respaldo manual con listas vacías", async () => {
    const respaldo: RespaldoJson = {
      version: 1,
      exportadoEn: new Date().toISOString(),
      negocioId: "otro-negocio",
      productos: [],
      movimientos: [],
      clientes: [],
      fiados: [],
      categorias: [],
    };
    const resultado = await restaurarRespaldo(respaldo, base);
    expect(resultado.productos).toEqual({ nuevos: 0, existentes: 0 });
    expect(resultado.stockRecalculado).toBe(0);
  });
});

describe("importarProductosCsv", () => {
  const cabecera =
    "nombre,categoria,codigo_barras,unidad_base,unidad_venta,factor,costo_usd,precio_usd,stock_minimo";

  it("la plantilla trae la cabecera y dos ejemplos", () => {
    const filas = parsearCsv(plantillaProductosCsv());
    expect(filas[0]).toEqual(cabecera.split(","));
    expect(filas).toHaveLength(3);
  });

  it("tolera BOM, comillas, comas y campos vacíos", async () => {
    const csv =
      `\uFEFF${cabecera}\r\n` +
      '"Arroz, ""especial""","Granos",,unidad,,,"0,75",1.25,\r\n';

    const resultado = await importarProductosCsv(csv, base);
    expect(resultado.creados).toBe(1);
    expect(resultado.omitidos).toBe(0);
    expect(resultado.errores).toEqual([]);

    const productos = await base.repos.productos.buscar("Arroz");
    expect(productos[0]?.nombre).toBe('Arroz, "especial"');
    expect(productos[0]?.codigoBarras).toBeNull();
    expect(productos[0]?.factor).toBe(1);
    expect(productos[0]?.costoCentavos).toBe(75);
    expect(productos[0]?.precioCentavos).toBe(125);
  });

  it("reporta la fila mala y sigue con las demás", async () => {
    const csv =
      `${cabecera}\r\n` +
      "Sin precio,Granos,,unidad,unidad,1,abc,1.00,1\r\n" +
      "Producto bueno,Granos,,unidad,unidad,1,0.50,1.00,1\r\n";

    const resultado = await importarProductosCsv(csv, base);
    expect(resultado.creados).toBe(1);
    expect(resultado.errores).toHaveLength(1);
    expect(resultado.errores[0]?.fila).toBe(2);
    expect(resultado.errores[0]?.mensaje).toContain("costo_usd");
    expect((await base.repos.productos.buscar("Producto bueno")).length).toBe(1);
  });

  it("omite códigos repetidos en el archivo y en la base", async () => {
    const csv =
      `${cabecera}\r\n` +
      "Uno,Granos,9000000000099,unidad,unidad,1,1,2,1\r\n" +
      "Dos,Granos,9000000000099,unidad,unidad,1,1,2,1\r\n";

    const primera = await importarProductosCsv(csv, base);
    expect(primera.creados).toBe(1);
    expect(primera.omitidos).toBe(1);

    const segunda = await importarProductosCsv(csv, base);
    expect(segunda.creados).toBe(0);
    expect(segunda.omitidos).toBe(2);
    expect(segunda.errores).toEqual([]);
  });

  it("falla con un mensaje claro si falta una columna", async () => {
    await expect(
      importarProductosCsv("nombre,categoria\r\nArroz,Granos\r\n", base),
    ).rejects.toThrow(/Falta la columna/);
  });
});
