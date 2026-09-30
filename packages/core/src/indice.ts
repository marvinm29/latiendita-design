import type { Producto } from "./tipos";

/**
 * Búsqueda simple sobre el catálogo: case-insensitive en
 * nombre, categoría y código de barras. Query vacía = todo.
 */
export function buscarProductos(
  productos: readonly Producto[],
  query: string,
): Producto[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...productos];
  return productos.filter((p) => {
    if (p.nombre.toLowerCase().includes(q)) return true;
    if (p.categoria.toLowerCase().includes(q)) return true;
    if (p.codigoBarras !== null && p.codigoBarras.toLowerCase().includes(q)) return true;
    return false;
  });
}
