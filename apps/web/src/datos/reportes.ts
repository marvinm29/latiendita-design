/**
 * Reportes locales (C5.1 / C11) — cálculos derivados sobre la MISMA base que
 * catálogo, libro, conteo y fiados (`baseLocal.ts`).
 *
 * Nada aquí llama a la red: los reportes se calculan en el teléfono con lo que
 * ya está en IndexedDB (C8.1). El stock se deriva del libro con
 * `stockDerivado` (el `stock_cache` es sólo velocidad) y los saldos de fiados
 * del ledger con los repos de core.
 *
 * Regla de dinero: TODO va en centavos enteros. El único redondeo ocurre al
 * valuar stock fraccionario (kg/litro) contra un precio por unidad base:
 * `Math.round(stock * centavos)`.
 */
import {
  estadoStock,
  stockDerivado,
  type EstadoStock,
  type Fiado,
  type Movimiento,
  type MovimientoTipo,
  type Producto,
  type UnidadVenta,
} from "@latiendita/core";
import { asegurarBaseLista, baseApp, type BaseLocal } from "./baseLocal";

const MS_DIA = 86_400_000;
/** Días del rango corto de C11.2 (“últimos 30 días”). */
export const DIAS_RANGO = 30;

export type RangoReporte = "30d" | "todo";

export const RANGOS: { valor: RangoReporte; etiqueta: string }[] = [
  { valor: "30d", etiqueta: "Últimos 30 días" },
  { valor: "todo", etiqueta: "Todo" },
];

/** Etiqueta corta del rango para encabezados (“Últimos 30 días” / “Todo”). */
export function etiquetaRango(rango: RangoReporte): string {
  return rango === "30d" ? "Últimos 30 días" : "Todo";
}

/** Epoch ms desde el que cuenta un rango (o `null` = sin límite). */
export function inicioRango(rango: RangoReporte, ahora: number = Date.now()): number | null {
  return rango === "30d" ? ahora - DIAS_RANGO * MS_DIA : null;
}

export interface ProductoFaltante {
  producto: Producto;
  /** Stock derivado del libro, en unidades base. */
  stock: number;
  /** Mínimo configurado, en unidades base. */
  minimo: number;
  estado: EstadoStock;
  /** Cuánto falta para llegar al mínimo (nunca negativo). */
  deficit: number;
}

const PRIORIDAD_ESTADO: Record<EstadoStock, number> = {
  agotado: 0,
  critico: 1,
  bajo: 2,
  ok: 3,
};

/**
 * C5.1 — productos bajo el mínimo, ordenados por urgencia:
 * agotado → crítico → bajo; a igual estado, el que más falta; luego nombre.
 */
export function productosQueFaltan(
  productos: readonly Producto[],
  movimientos: readonly Movimiento[],
): ProductoFaltante[] {
  const faltantes: ProductoFaltante[] = [];
  for (const producto of productos) {
    if (!producto.activo) continue;
    const stock = stockDerivado(movimientos, producto.id);
    const minimo = producto.stockMinimoBase;
    const estado = estadoStock(stock, minimo);
    if (estado === "ok") continue;
    faltantes.push({
      producto,
      stock,
      minimo,
      estado,
      deficit: Math.max(0, Math.round((minimo - stock) * 1000) / 1000),
    });
  }
  return faltantes.sort((a, b) => {
    if (a.estado !== b.estado) {
      return PRIORIDAD_ESTADO[a.estado] - PRIORIDAD_ESTADO[b.estado];
    }
    if (b.deficit !== a.deficit) return b.deficit - a.deficit;
    return a.producto.nombre.localeCompare(b.producto.nombre, "es");
  });
}

export interface ValorInventario {
  /** Productos vivos con stock > 0. */
  conStock: number;
  /** Unidades base en existencia (puede ser fraccionario: kg/litro). */
  unidades: number;
  costoCentavos: number;
  precioCentavos: number;
}

/**
 * C11.1 — valor del inventario al costo y a precio de venta.
 * El stock negativo (sobreventa) no resta valor: se valúa sólo lo que hay.
 */
export function valorInventario(
  productos: readonly Producto[],
  movimientos: readonly Movimiento[],
): ValorInventario {
  let conStock = 0;
  let unidades = 0;
  let costoCentavos = 0;
  let precioCentavos = 0;

  for (const producto of productos) {
    if (!producto.activo) continue;
    const stock = stockDerivado(movimientos, producto.id);
    if (!(stock > 0)) continue;
    conStock += 1;
    unidades += stock;
    costoCentavos += Math.round(stock * producto.costoCentavos);
    precioCentavos += Math.round(stock * producto.precioCentavos);
  }

  return {
    conStock,
    unidades: Math.round(unidades * 1000) / 1000,
    costoCentavos,
    precioCentavos,
  };
}

export interface ProductoMovido {
  productoId: string;
  nombre: string;
  unidad: UnidadVenta;
  entradas: number;
  salidas: number;
  /** entradas + salidas (los ajustes no son “movimiento” de venta/compra). */
  movimientos: number;
}

/**
 * C11.2 — “lo que más se movió” por producto en un rango.
 * Cuenta entradas y salidas (C11.2); los ajustes de conteo no inflan el ranking.
 * Sólo productos vivos: un producto borrado no aparece en reportes.
 */
export function movimientosPorProducto(
  productos: readonly Producto[],
  movimientos: readonly Movimiento[],
  desde: number | null,
): ProductoMovido[] {
  const vivos = new Map<string, Producto>();
  for (const producto of productos) {
    if (producto.activo) vivos.set(producto.id, producto);
  }

  const acumulado = new Map<string, ProductoMovido>();
  for (const movimiento of movimientos) {
    if (desde !== null && movimiento.creadoEn < desde) continue;
    if (movimiento.tipo !== "entrada" && movimiento.tipo !== "salida") continue;
    const producto = vivos.get(movimiento.productoId);
    if (!producto) continue;

    const fila = acumulado.get(producto.id) ?? {
      productoId: producto.id,
      nombre: producto.nombre,
      unidad: producto.unidadBase,
      entradas: 0,
      salidas: 0,
      movimientos: 0,
    };
    if (movimiento.tipo === "entrada") fila.entradas += 1;
    else fila.salidas += 1;
    fila.movimientos += 1;
    acumulado.set(producto.id, fila);
  }

  return [...acumulado.values()].sort((a, b) => {
    if (b.movimientos !== a.movimientos) return b.movimientos - a.movimientos;
    if (b.salidas !== a.salidas) return b.salidas - a.salidas;
    return a.nombre.localeCompare(b.nombre, "es");
  });
}

export interface ResumenFiados {
  /** Suma de todos los cargos (lo fiado, histórico). */
  totalFiadoCentavos: number;
  /** Suma de todos los abonos (lo cobrado, histórico). */
  totalCobradoCentavos: number;
  /** cargos − abonos (positivo = te deben). */
  saldoTotalCentavos: number;
}

/** C11.3 — resumen del ledger de fiados, en centavos enteros. */
export function resumenFiados(fiados: readonly Fiado[]): ResumenFiados {
  let totalFiadoCentavos = 0;
  let totalCobradoCentavos = 0;
  for (const fiado of fiados) {
    if (fiado.tipo === "cargo") totalFiadoCentavos += fiado.montoCentavos;
    else totalCobradoCentavos += fiado.montoCentavos;
  }
  return {
    totalFiadoCentavos,
    totalCobradoCentavos,
    saldoTotalCentavos: totalFiadoCentavos - totalCobradoCentavos,
  };
}

export interface MovimientoReciente {
  id: string;
  productoId: string;
  nombre: string;
  unidad: UnidadVenta;
  tipo: MovimientoTipo;
  cantidadBase: number;
  ocurridoEn: number;
}

export interface ConteoEnCurso {
  id: string;
  /** Productos ya capturados en la sesión abierta. */
  contados: number;
  creadoEn: number;
}

export interface ResumenInicio {
  /** Productos vivos del catálogo. */
  productos: number;
  /** Agotados + críticos + bajo mínimo. */
  porFaltar: number;
  faltantes: ProductoFaltante[];
  /** Saldo neto de todos los clientes (positivo = te deben). */
  saldoFiadoCentavos: number;
  clientesConSaldo: number;
  recientes: MovimientoReciente[];
  conteoEnCurso: ConteoEnCurso | null;
}

/**
 * Datos de /inicio: lo urgente (C5.1), el fiado total y los últimos
 * movimientos. Se recalcula al montar la pantalla; todo sale de IndexedDB.
 */
export async function calcularResumenInicio(
  base: BaseLocal = baseApp,
  limiteRecientes = 5,
): Promise<ResumenInicio> {
  await asegurarBaseLista(base);
  const [productos, movimientos, clientes, conteo] = await Promise.all([
    base.repos.productos.listar(),
    base.db.movimientos.where("negocioId").equals(base.negocioId).toArray(),
    base.repos.fiados.listarClientes(),
    base.repos.conteo.listarAbierta(),
  ]);

  const porId = new Map(productos.map((producto) => [producto.id, producto]));
  const recientes: MovimientoReciente[] = [...movimientos]
    .sort((a, b) => b.ocurridoAt - a.ocurridoAt)
    .slice(0, limiteRecientes)
    .flatMap((fila) => {
      const producto = porId.get(fila.productoId);
      if (!producto) return [];
      return [
        {
          id: fila.id,
          productoId: fila.productoId,
          nombre: producto.nombre,
          unidad: producto.unidadBase,
          tipo: fila.tipo,
          cantidadBase: fila.cantidadBase,
          ocurridoEn: fila.ocurridoAt,
        },
      ];
    });

  const faltantes = productosQueFaltan(productos, movimientos);

  return {
    productos: productos.length,
    porFaltar: faltantes.length,
    faltantes: faltantes.slice(0, 3),
    saldoFiadoCentavos: clientes.reduce((total, c) => total + c.saldoCentavos, 0),
    clientesConSaldo: clientes.filter((c) => c.saldoCentavos > 0).length,
    recientes,
    conteoEnCurso: conteo
      ? { id: conteo.id, contados: conteo.items.length, creadoEn: conteo.creadoEn }
      : null,
  };
}

export interface ReporteC11 {
  rango: RangoReporte;
  /** Epoch ms de corte del rango (`null` = todo). */
  desde: number | null;
  inventario: ValorInventario;
  fiados: ResumenFiados;
  clientesConSaldo: number;
  movidos: ProductoMovido[];
  /** Hay al menos un producto, movimiento o fiado que reportar. */
  hayDatos: boolean;
}

/**
 * Datos de /mas/reportes (C11). El rango aplica a “lo que más se movió”;
 * valor de inventario es el actual y los totales de fiado son históricos.
 */
export async function calcularReportes(
  rango: RangoReporte,
  base: BaseLocal = baseApp,
  ahora: number = Date.now(),
): Promise<ReporteC11> {
  await asegurarBaseLista(base);
  const [productos, movimientos, fiados, clientes] = await Promise.all([
    base.repos.productos.listar(),
    base.db.movimientos.where("negocioId").equals(base.negocioId).toArray(),
    base.repos.fiados.listarFiados(),
    base.repos.fiados.listarClientes(),
  ]);

  const desde = inicioRango(rango, ahora);
  return {
    rango,
    desde,
    inventario: valorInventario(productos, movimientos),
    fiados: resumenFiados(fiados),
    clientesConSaldo: clientes.filter((c) => c.saldoCentavos > 0).length,
    movidos: movimientosPorProducto(productos, movimientos, desde),
    hayDatos: productos.length > 0 || movimientos.length > 0 || fiados.length > 0,
  };
}
