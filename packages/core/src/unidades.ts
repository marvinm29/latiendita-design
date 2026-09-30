import type { Producto } from "./tipos";

/** Redondea a 3 decimales (numeric(12,3) del spec). */
export function redondearCantidad(n: number): number {
  if (!Number.isFinite(n)) throw new Error(`cantidad no finita: ${n}`);
  return Math.round(n * 1000) / 1000;
}

/** Convierte de unidad de venta a unidad base: base = venta × factor. */
export function convertirACantidadBase(cantidadVenta: number, factor: number): number {
  if (!(factor > 0)) throw new Error(`factor debe ser > 0, recibido: ${factor}`);
  if (!Number.isFinite(cantidadVenta)) throw new Error(`cantidadVenta no finita: ${cantidadVenta}`);
  return redondearCantidad(cantidadVenta * factor);
}

/** Convierte de unidad base a unidad de venta: venta = base ÷ factor. */
export function convertirDesdeBase(cantidadBase: number, factor: number): number {
  if (!(factor > 0)) throw new Error(`factor debe ser > 0, recibido: ${factor}`);
  if (!Number.isFinite(cantidadBase)) throw new Error(`cantidadBase no finita: ${cantidadBase}`);
  return redondearCantidad(cantidadBase / factor);
}

/** Factor de conversión (venta → base) declarado por el producto. */
export function factorDe(producto: Producto): number {
  if (!(producto.factor > 0)) {
    throw new Error(`factor inválido en producto ${producto.id}: ${producto.factor}`);
  }
  return producto.factor;
}
