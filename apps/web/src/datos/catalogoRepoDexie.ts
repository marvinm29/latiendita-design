/**
 * Implementación de `CatalogoRepo` sobre la capa Dexie de @latiendita/core
 * (T-03): catálogo y stock en IndexedDB, escrituras con op de outbox en la
 * misma transacción (003 §3). La UI consume la MISMA interfaz que antes
 * usaba el repo en memoria (C2) — no cambia nada en paginas/.
 *
 * Arranque perezoso: cada método espera `db.open()` + semilla demo (una sola
 * vez). Mientras la promesa no resuelve, la UI muestra "cargando"; si
 * IndexedDB falla, muestra "error" y el siguiente uso reintenta.
 *
 * Suscripción: `liveQuery` de Dexie — re-emite ante escrituras en
 * `productos`/`stock_cache` (incluye otras pestañas y las de movimientosRepo).
 * `fake-indexeddb` queda SOLO en los tests de core; este módulo nunca lo toca.
 */
import { liveQuery } from "dexie";
import {
  abrirDb,
  crearRepos,
  escribirMeta,
  leerMeta,
  stockDerivado,
  type LaTienditaDb,
  type Producto,
  type ProductoFila,
  type Repos,
} from "@latiendita/core";
import { PRODUCTOS_DEMO, STOCK_DEMO } from "./demo";
import type { CatalogoRepo, ItemCatalogo } from "./catalogoRepo";

/**
 * M1 sin login (P2 pendiente): un solo negocio local por dispositivo.
 * En M2 se reemplaza por el `negocioId` real de la invitación.
 */
const NEGOCIO_LOCAL = "local";

/** Flag de siembra en la tabla `meta`: el seed corre una sola vez por base. */
const CLAVE_SEMILLA = "demo:sembrado:v1";

/** Id determinista para la entrada inicial de cada producto demo (reintento = 1 fila). */
const idSemillaEntrada = (productoId: string) => `demo-semilla:entrada:${productoId}`;

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
  private readonly db: LaTienditaDb;
  private readonly repos: Repos;
  private promesaListo: Promise<void> | null = null;

  constructor(db: LaTienditaDb = abrirDb()) {
    this.db = db;
    this.repos = crearRepos(db, NEGOCIO_LOCAL);
  }

  /** Resuelve cuando la base está abierta y la semilla demo ya corrió. */
  private get listo(): Promise<void> {
    this.promesaListo ??= this.iniciar();
    return this.promesaListo;
  }

  private async iniciar(): Promise<void> {
    try {
      await this.db.open();
      await this.sembrarDemoSiHaceFalta();
    } catch (error) {
      this.promesaListo = null; // el siguiente uso (p. ej. "Reintentar") reintenta
      throw error;
    }
  }

  /**
   * Siembra demo (C2): productos de demo.ts + entradas iniciales POR EL LIBRO
   * (el stock se deriva de movimientos; nunca se escribe `stock_cache` a mano).
   * Idempotente por tres capas: flag en `meta`, salto de productos existentes
   * e ids deterministas de movimiento — un corte a mitad no duplica nada.
   */
  private async sembrarDemoSiHaceFalta(): Promise<void> {
    const sembrado = await leerMeta<unknown>(this.db, CLAVE_SEMILLA);
    if (sembrado !== undefined) return;
    for (const producto of PRODUCTOS_DEMO) {
      const existente = await this.db.productos.get(producto.id);
      if (!existente || existente.deletedAt !== null) {
        await this.repos.productos.crear({ ...producto, id: producto.id });
      }
      const cantidad = STOCK_DEMO[producto.id] ?? 0;
      if (cantidad > 0) {
        const idEntrada = idSemillaEntrada(producto.id);
        const yaRegistrada = await this.db.movimientos.get(idEntrada);
        if (!yaRegistrada) {
          await this.repos.movimientos.registrarEntrada({
            productoId: producto.id,
            cantidadBase: cantidad,
            costoCentavos: producto.costoCentavos,
            motivo: "Carga inicial (demo)",
            id: idEntrada,
            opId: idEntrada,
          });
        }
      }
    }
    await escribirMeta(this.db, CLAVE_SEMILLA, { version: 1, cuando: Date.now() });
  }

  /** Lectura compartida por `listar` y por `liveQuery` (no espera la semilla). */
  private async listarInterno(): Promise<ItemCatalogo[]> {
    const filas = await this.repos.productos.listar();
    const caches = await this.db.stock_cache.toArray();
    const stocks = new Map(
      caches
        .filter((c) => c.negocioId === NEGOCIO_LOCAL)
        .map((c) => [c.productoId, c.stock]),
    );
    const items: ItemCatalogo[] = [];
    for (const fila of filas) {
      if (!fila.activo) continue; // activos, igual que el repo en memoria
      let stock = stocks.get(fila.id);
      if (stock === undefined) {
        // Sin caché: deriva del libro (misma regla que `leerStockLocal` de core).
        const movimientos = await this.db.movimientos
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
    const fila = await this.db.productos.get(id);
    if (!fila || fila.negocioId !== NEGOCIO_LOCAL) return null;
    return filaAProducto(fila);
  }

  /** Upsert: crea o actualiza; los repos de core encolan la op en la misma tx. */
  async guardar(producto: Producto): Promise<Producto> {
    await this.listo;
    const fila = await this.db.productos.get(producto.id);
    if (fila && fila.negocioId !== NEGOCIO_LOCAL) {
      throw new Error(`producto de otro negocio: ${producto.id}`);
    }
    if (!fila) {
      const creada = await this.repos.productos.crear({ ...producto, id: producto.id });
      return filaAProducto(creada);
    }
    if (fila.deletedAt !== null) {
      // Tombstone: no se revive en silencio (C2.5) — la UI muestra el fallo.
      throw new Error(`producto borrado: ${producto.id}`);
    }
    const editada = await this.repos.productos.actualizar(producto.id, cambiosDe(producto));
    return filaAProducto(editada);
  }

  async borrarLogico(id: string): Promise<void> {
    await this.listo;
    await this.repos.productos.borrar(id);
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

/** Instancia única de la app: la UI consume `repoCatalogo` de catalogoRepo.ts. */
export function crearRepoCatalogoDexie(): CatalogoRepo {
  return new CatalogoRepoDexie();
}
