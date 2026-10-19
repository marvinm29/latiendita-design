/**
 * Implementación de `CatalogoRepo` sobre la capa Dexie de @latiendita/core
 * (T-03): catálogo y stock en IndexedDB, escrituras con op de outbox en la
 * misma transacción (003 §3). La UI consume la MISMA interfaz que antes
 * usaba el repo en memoria (C2) — no cambia nada en paginas/.
 *
 * La base, el `negocioId` y la siembra demo viven en `baseLocal.ts` (los
 * comparte con el libro de movimientos y el conteo). Arranque perezoso:
 * `asegurarBaseLista()` abre IndexedDB y siembra una sola vez; mientras la
 * promesa no resuelve, la UI muestra "cargando"; si falla, muestra "error" y
 * el siguiente uso reintenta.
 *
 * Suscripción: `liveQuery` de Dexie — re-emite ante escrituras en
 * `productos`/`stock_cache`/`movimientos` (incluye otras pestañas y las del
 * libro). `fake-indexeddb` queda SOLO en los tests; este módulo nunca lo toca.
 */
import { liveQuery } from "dexie";
import { stockDerivado, type Producto, type ProductoFila } from "@latiendita/core";
import { asegurarBaseLista, baseApp, type BaseLocal } from "./baseLocal";
import type { CatalogoRepo, ItemCatalogo } from "./catalogoRepo";

/** Quita los campos de sync — la UI sólo conoce el tipo `Producto` puro. */
function filaAProducto(fila: ProductoFila): Producto {
  return {
    id: fila.id,
    nombre: fila.nombre,
    categoria: fila.categoria,
    codigoBarras: fila.codigoBarras,
    unidadBase: fila.unidadBase,
    unidadVenta: fila.unidadVenta,
    factor: fila.factor,
    costoCentavos: fila.costoCentavos,
    precioCentavos: fila.precioCentavos,
    stockMinimoBase: fila.stockMinimoBase,
    activo: fila.activo,
  };
}

function cambiosDe(producto: Producto): Omit<Producto, "id"> {
  return {
    nombre: producto.nombre,
    categoria: producto.categoria,
    codigoBarras: producto.codigoBarras,
    unidadBase: producto.unidadBase,
    unidadVenta: producto.unidadVenta,
    factor: producto.factor,
    costoCentavos: producto.costoCentavos,
    precioCentavos: producto.precioCentavos,
    stockMinimoBase: producto.stockMinimoBase,
    activo: producto.activo,
  };
}

export class CatalogoRepoDexie implements CatalogoRepo {
  private readonly base: BaseLocal;

  constructor(base: BaseLocal = baseApp) {
    this.base = base;
  }

  /** Resuelve cuando la base está abierta y la semilla demo ya corrió. */
  private get listo(): Promise<void> {
    return asegurarBaseLista(this.base);
  }

  /** Lectura compartida por `listar` y por `liveQuery` (no espera la semilla). */
  private async listarInterno(): Promise<ItemCatalogo[]> {
    const { db, repos, negocioId } = this.base;
    const filas = await repos.productos.listar();
    const caches = await db.stock_cache.toArray();
    const stocks = new Map(
      caches.filter((c) => c.negocioId === negocioId).map((c) => [c.productoId, c.stock]),
    );
    const items: ItemCatalogo[] = [];
    for (const fila of filas) {
      if (!fila.activo) continue; // activos, igual que el repo en memoria
      let stock = stocks.get(fila.id);
      if (stock === undefined) {
        // Sin caché: deriva del libro (misma regla que `leerStockLocal` de core).
        const movimientos = await db.movimientos
          .where("productoId")
          .equals(fila.id)
          .toArray();
        stock = stockDerivado(movimientos, fila.id);
      }
      items.push({ producto: filaAProducto(fila), stock });
    }
    // Orden estable por nombre — la lista no debe “bailar” al reintentar.
    return items.sort((a, b) => a.producto.nombre.localeCompare(b.producto.nombre, "es"));
  }

  async listar(): Promise<ItemCatalogo[]> {
    await this.listo;
    return this.listarInterno();
  }

  /** Incluye borrados lógicos (contrato: auditoría/edición). */
  async obtener(id: string): Promise<Producto | null> {
    await this.listo;
    const fila = await this.base.db.productos.get(id);
    if (!fila || fila.negocioId !== this.base.negocioId) return null;
    return filaAProducto(fila);
  }

  /** Upsert: crea o actualiza; los repos de core encolan la op en la misma tx. */
  async guardar(producto: Producto): Promise<Producto> {
    await this.listo;
    const { db, repos, negocioId } = this.base;
    const fila = await db.productos.get(producto.id);
    if (fila && fila.negocioId !== negocioId) {
      throw new Error(`producto de otro negocio: ${producto.id}`);
    }
    if (!fila) {
      const creada = await repos.productos.crear({ ...producto, id: producto.id });
      return filaAProducto(creada);
    }
    if (fila.deletedAt !== null) {
      // Tombstone: no se revive en silencio (C2.5) — la UI muestra el fallo.
      throw new Error(`producto borrado: ${producto.id}`);
    }
    const editada = await repos.productos.actualizar(producto.id, cambiosDe(producto));
    return filaAProducto(editada);
  }

  async borrarLogico(id: string): Promise<void> {
    await this.listo;
    await this.base.repos.productos.borrar(id);
  }

  suscribir(listener: () => void): () => void {
    // liveQuery emite el valor inicial al suscribirse: se ignora para no
    // realimentar el `recargar` de useCatalogo (bucle effect↔suscripción).
    // Sólo se notifican CAMBIOS, igual que hacía el repo en memoria.
    let primera = true;
    const subcripcion = liveQuery(() => this.listarInterno()).subscribe({
      next: () => {
        if (primera) {
          primera = false;
          return;
        }
        listener();
      },
      // El error real lo reporta `listar()` vía el estado "error" de la UI.
      error: () => undefined,
    });
    return () => subcripcion.unsubscribe();
  }
}

/** Repo de catálogo sobre IndexedDB (implementación activa de la app). */
export function crearRepoCatalogoDexie(base: BaseLocal = baseApp): CatalogoRepo {
  return new CatalogoRepoDexie(base);
}
