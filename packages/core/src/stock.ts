import { aplicarMovimiento } from "./libro";
import type { EstadoStock, Movimiento } from "./tipos";

/**
 * Stock = suma de todos los movimientos del producto (el libro manda;
 * el caché es solo un atajo derivado).
 */
export function stockDerivado(
  movimientos: readonly Movimiento[],
  productoId: string,
): number {
  let stock = 0;
  for (const mov of movimientos) {
    if (mov.productoId === productoId) {
      stock = aplicarMovimiento(stock, mov);
    }
  }
  return stock;
}

/**
 * Actualiza incrementalmente el caché de stock con un movimiento.
 * `mov` debe pertenecer a `productoId`. Devuelve el mismo Map (mutado).
 */
export function actualizarCache(
  cache: Map<string, number>,
  productoId: string,
  mov: Movimiento,
): Map<string, number> {
  const actual = cache.get(productoId) ?? 0;
  cache.set(productoId, aplicarMovimiento(actual, mov));
  return cache;
}

/**
 * Estado para el chip de color (nunca solo color: el texto acompaña).
 *
 * Regla documentada en tests:
 * - stock === 0            → 'agotado'
 * - stock < 0              → 'critico'
 * - 0 < stock < min × 0.5  → 'critico'  (bajo crítico)
 * - 0 < stock < min        → 'bajo'
 * - si no                  → 'ok'
 *
 * Si min <= 0, un stock > 0 es 'ok'.
 */
export function estadoStock(stock: number, min: number): EstadoStock {
  if (stock === 0) return "agotado";
  if (stock < 0) return "critico";
  if (min > 0 && stock < min * 0.5) return "critico";
  if (stock < min) return "bajo";
  return "ok";
}
