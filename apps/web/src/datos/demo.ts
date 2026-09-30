import type { Producto } from "@latiendita/core";

/**
 * Semilla del catálogo (C2) que `catalogoRepoDexie` siembra UNA sola vez en
 * IndexedDB (flag idempotente en la tabla `meta`). El stock inicial entra por
 * el libro (movimientos de entrada) — nunca se escribe `stock_cache` a mano.
 */
export const PRODUCTOS_DEMO: Producto[] = [
  {
    id: "p-refresco-big-cola",
    nombre: "Refresco Big Cola 355ml",
    categoria: "Bebidas",
    codigoBarras: "7501000000017",
    unidadBase: "unidad",
    unidadVenta: "unidad",
    factor: 1,
    costoCentavos: 55,
    precioCentavos: 75,
    stockMinimoBase: 6,
    activo: true,
  },
  {
    id: "p-harina-selecta-5lb",
    nombre: "Harina Selecta 5 lb",
    categoria: "Abarrotes",
    codigoBarras: "7501000000024",
    unidadBase: "unidad",
    unidadVenta: "unidad",
    factor: 1,
    costoCentavos: 85,
    precioCentavos: 110,
    stockMinimoBase: 5,
    activo: true,
  },
  {
    id: "p-leche-dona-vera-1l",
    nombre: "Leche Doña Vera 1 L",
    categoria: "Lácteos",
    codigoBarras: null,
    unidadBase: "unidad",
    unidadVenta: "unidad",
    factor: 1,
    costoCentavos: 72,
    precioCentavos: 95,
    stockMinimoBase: 4,
    activo: true,
  },
  {
    id: "p-galletas-charme",
    nombre: "Galletas Charme",
    categoria: "Galletas",
    codigoBarras: "7501234567890",
    unidadBase: "unidad",
    unidadVenta: "unidad",
    factor: 1,
    costoCentavos: 90,
    precioCentavos: 125,
    stockMinimoBase: 10,
    activo: true,
  },
  {
    id: "p-cafe-santa-ana-1lb",
    nombre: "Café Santa Ana 1 lb",
    categoria: "Bebidas",
    codigoBarras: null,
    unidadBase: "unidad",
    unidadVenta: "unidad",
    factor: 1,
    costoCentavos: 320,
    precioCentavos: 450,
    stockMinimoBase: 6,
    activo: true,
  },
  {
    id: "p-jabon-rebaja-200g",
    nombre: "Jabón Rebaja 200g",
    categoria: "Limpieza",
    codigoBarras: "7501000000048",
    unidadBase: "unidad",
    unidadVenta: "unidad",
    factor: 1,
    costoCentavos: 60,
    precioCentavos: 85,
    stockMinimoBase: 6,
    activo: true,
  },
];

/**
 * Stock inicial en unidades base. Es un atajo de demo: en la app real el
 * stock se deriva del libro de movimientos (core `stockDerivado`).
 */
export const STOCK_DEMO: Record<string, number> = {
  "p-refresco-big-cola": 12,
  "p-harina-selecta-5lb": 3,
  "p-leche-dona-vera-1l": 0,
  "p-galletas-charme": 40,
  "p-cafe-santa-ana-1lb": 2,
  "p-jabon-rebaja-200g": 18,
};
