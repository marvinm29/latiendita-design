import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  abrirDb,
  borrarDb,
  crearRepos,
  escribirMeta,
  type Fiado,
  type Movimiento,
  type Producto,
  type LaTienditaDb,
} from "@latiendita/core";
import { asegurarBaseLista, CLAVE_SEMILLA, type BaseLocal } from "./baseLocal";
import {
  calcularReportes,
  calcularResumenInicio,
  inicioRango,
  movimientosPorProducto,
  productosQueFaltan,
  resumenFiados,
  valorInventario,
  DIAS_RANGO,
} from "./reportes";

const DIA = 86_400_000;
const NEGOCIO = "negocio-reportes-prueba";

let db: LaTienditaDb;
let base: BaseLocal;

beforeEach(async () => {
  db = abrirDb(`web-reportes-${crypto.randomUUID()}`);
  base = { db, repos: crearRepos(db, NEGOCIO), negocioId: NEGOCIO };
  await asegurarBaseLista(base);
});

afterEach(async () => {
  await borrarDb(db);
});

function producto(
  id: string,
  nombre: string,
  costoCentavos: number,
  precioCentavos: number,
  stockMinimoBase = 0,
): Producto {
  return {
    id,
    nombre,
    categoria: "Prueba",
    codigoBarras: null,
    unidadBase: "unidad",
    unidadVenta: "unidad",
    factor: 1,
    costoCentavos,
    precioCentavos,
    stockMinimoBase,
    activo: true,
  };
}

function entrada(
  id: string,
  productoId: string,
  cantidadBase: number,
  creadoEn: number,
): Movimiento {
  return { id, productoId, tipo: "entrada", cantidadBase, creadoEn };
}

describe("reportes · cálculos puros (C11)", () => {
  it("valúa al costo y a precio con centavos enteros y stock fraccionario", () => {
    const productos = [
      producto("p1", "Uno", 55, 75),
      producto("p2", "Dos", 100, 150),
      producto("p3", "Tres", 40, 60),
    ];
    const movimientos: Movimiento[] = [
      entrada("m1", "p1", 10, 1),
      entrada("m2", "p2", 2.5, 2),
      { id: "m3", productoId: "p3", tipo: "salida", cantidadBase: 3, creadoEn: 3 },
    ];

    expect(valorInventario(productos, movimientos)).toEqual({
      conStock: 2,
      unidades: 12.5,
      costoCentavos: 550 + 250,
      precioCentavos: 750 + 375,
    });
  });

  it("ordena lo que falta por urgencia: agotado → crítico → bajo", () => {
    const productos = [
      producto("bajo", "Bajo", 10, 20, 5),
      producto("agotado", "Agotado", 10, 20, 5),
      producto("critico", "Crítico", 10, 20, 4),
    ];
    const movimientos = [
      entrada("m1", "bajo", 3, 1),
      entrada("m2", "critico", 1, 2),
    ];

    expect(productosQueFaltan(productos, movimientos).map((f) => f.producto.id)).toEqual([
      "agotado",
      "critico",
      "bajo",
    ]);
  });

  it("cuenta entradas/salidas por producto y respeta el rango de 30 días", () => {
    const ahora = 1_000_000_000_000;
    const productos = [producto("p1", "Uno", 10, 20), producto("p2", "Dos", 10, 20)];
    const movimientos: Movimiento[] = [
      entrada("m1", "p1", 2, ahora - DIA),
      { id: "m2", productoId: "p1", tipo: "salida", cantidadBase: 1, creadoEn: ahora - DIA },
      entrada("m3", "p1", 4, ahora - 40 * DIA),
      entrada("m4", "p2", 1, ahora - 40 * DIA),
      { id: "m5", productoId: "p1", tipo: "ajuste", cantidadBase: -1, creadoEn: ahora },
    ];

    const desde = inicioRango("30d", ahora);
    expect(desde).toBe(ahora - DIAS_RANGO * DIA);

    const corto = movimientosPorProducto(productos, movimientos, desde);
    expect(corto).toHaveLength(1);
    expect(corto[0]).toMatchObject({ productoId: "p1", entradas: 1, salidas: 1, movimientos: 2 });

    const todo = movimientosPorProducto(productos, movimientos, null);
    expect(todo.map((m) => m.productoId).sort()).toEqual(["p1", "p2"]);
  });

  it("suma el ledger de fiados: fiado, cobrado y saldo (enteros)", () => {
    const fiados: Fiado[] = [
      { id: "f1", clienteId: "c1", tipo: "cargo", montoCentavos: 500, descripcion: null, creadoEn: 1 },
      { id: "f2", clienteId: "c1", tipo: "abono", montoCentavos: 200, descripcion: null, creadoEn: 2 },
      { id: "f3", clienteId: "c2", tipo: "cargo", montoCentavos: 100, descripcion: null, creadoEn: 3 },
    ];
    expect(resumenFiados(fiados)).toEqual({
      totalFiadoCentavos: 600,
      totalCobradoCentavos: 200,
      saldoTotalCentavos: 400,
    });
  });
});

describe("reportes · base local sembrada (C5.1 / C11)", () => {
  it("Inicio resume productos, lo que falta y los movimientos recientes", async () => {
    const resumen = await calcularResumenInicio(base);

    expect(resumen.productos).toBe(6);
    expect(resumen.porFaltar).toBe(3);
    expect(resumen.faltantes.map((f) => f.producto.id)).toEqual([
      "p-leche-dona-vera-1l",
      "p-cafe-santa-ana-1lb",
      "p-harina-selecta-5lb",
    ]);
    expect(resumen.faltantes.map((f) => f.estado)).toEqual(["agotado", "critico", "bajo"]);
    expect(resumen.saldoFiadoCentavos).toBe(0);
    expect(resumen.clientesConSaldo).toBe(0);
    expect(resumen.recientes).toHaveLength(5);
    expect(resumen.recientes.every((m) => m.tipo === "entrada")).toBe(true);
    expect(resumen.conteoEnCurso).toBeNull();
  });

  it("calcula C11.1 y C11.3 sobre la semilla y la libreta", async () => {
    const ahora = Date.now();
    const cliente = await base.repos.fiados.crearCliente({ nombre: "Doña Rosa" });
    await base.repos.fiados.crearCargoConOp({
      clienteId: cliente.id,
      montoCentavos: 500,
      creadoEn: ahora - 2000,
    });
    await base.repos.fiados.crearAbonoConOp({
      clienteId: cliente.id,
      montoCentavos: 200,
      creadoEn: ahora - 1000,
    });

    const reporte = await calcularReportes("30d", base, ahora);

    // Semilla: 12×55 + 3×85 + 40×90 + 2×320 + 18×60 = 6235 al costo.
    expect(reporte.inventario).toEqual({
      conStock: 5,
      unidades: 75,
      costoCentavos: 6235,
      precioCentavos: 8660,
    });
    expect(reporte.fiados).toEqual({
      totalFiadoCentavos: 500,
      totalCobradoCentavos: 200,
      saldoTotalCentavos: 300,
    });
    expect(reporte.clientesConSaldo).toBe(1);
    expect(reporte.hayDatos).toBe(true);

    const refresco = reporte.movidos.find((m) => m.productoId === "p-refresco-big-cola");
    expect(refresco).toMatchObject({ entradas: 1, salidas: 0, movimientos: 1 });
  });

  it("incluye el conteo en curso cuando existe (C5.2)", async () => {
    const conteo = await base.repos.conteo.iniciar();
    await base.repos.conteo.registrarItem(conteo.id, "p-refresco-big-cola", 10);

    const resumen = await calcularResumenInicio(base);
    expect(resumen.conteoEnCurso).toMatchObject({ id: conteo.id, contados: 1 });
  });

  it("el rango excluye movimientos viejos del ranking, pero no del inventario", async () => {
    const ahora = Date.now();
    const viejo = await base.repos.productos.crear({
      nombre: "Producto viejo",
      categoria: "Prueba",
      codigoBarras: null,
      unidadBase: "unidad",
      unidadVenta: "unidad",
      factor: 1,
      costoCentavos: 10,
      precioCentavos: 20,
      stockMinimoBase: 0,
      id: "p-viejo",
    });
    await base.repos.movimientos.registrarEntrada({
      productoId: viejo.id,
      cantidadBase: 4,
      creadoEn: ahora - 40 * DIA,
      id: "m-viejo",
      opId: "op-m-viejo",
    });

    const corto = await calcularReportes("30d", base, ahora);
    const todo = await calcularReportes("todo", base, ahora);

    expect(corto.movidos.some((m) => m.productoId === "p-viejo")).toBe(false);
    expect(todo.movidos.some((m) => m.productoId === "p-viejo")).toBe(true);
    expect(todo.inventario.costoCentavos).toBe(corto.inventario.costoCentavos);
    expect(todo.inventario.costoCentavos).toBe(6235 + 40);
  });

  it("una base vacía devuelve ceros honestos, no errores", async () => {
    const vacia = abrirDb(`web-reportes-vacia-${crypto.randomUUID()}`);
    const baseVacia: BaseLocal = {
      db: vacia,
      repos: crearRepos(vacia, NEGOCIO),
      negocioId: NEGOCIO,
    };
    await vacia.open();
    // Evita la semilla demo: la base queda realmente vacía.
    await escribirMeta(vacia, CLAVE_SEMILLA, { version: 1 });

    const resumen = await calcularResumenInicio(baseVacia);
    expect(resumen).toMatchObject({
      productos: 0,
      porFaltar: 0,
      faltantes: [],
      saldoFiadoCentavos: 0,
      clientesConSaldo: 0,
      recientes: [],
      conteoEnCurso: null,
    });

    const reporte = await calcularReportes("30d", baseVacia);
    expect(reporte.hayDatos).toBe(false);
    expect(reporte.inventario).toEqual({
      conStock: 0,
      unidades: 0,
      costoCentavos: 0,
      precioCentavos: 0,
    });
    expect(reporte.movidos).toEqual([]);

    await borrarDb(vacia);
  });
});
