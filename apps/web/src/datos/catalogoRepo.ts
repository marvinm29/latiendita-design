import { useCallback, useEffect, useState } from "preact/hooks";
import type { Producto } from "@latiendita/core";
import { crearRepoCatalogoDexie } from "./catalogoRepoDexie";

/**
 * Contrato de acceso al catálogo (C2) desde la UI.
 *
 * La implementación activa es `CatalogoRepoDexie` (IndexedDB vía @latiendita/core):
 *
 *  - `listar`     → productos vivos/activos + stock (caché o derivado del libro)
 *  - `obtener`    → get(id), incluye borrados lógicos (auditoría/edición)
 *  - `guardar`    → upsert + op en outbox en la MISMA transacción (003 §3)
 *  - `borrarLogico` → tombstone `deletedAt` + `activo = false` (C2.5)
 *  - `suscribir`  → `liveQuery` de Dexie (re-emite ante cualquier escritura)
 *
 * El arranque es perezoso: cada método espera `db.open()` + la semilla demo;
 * la UI muestra "cargando" mientras resuelve y "error" si IndexedDB falla.
 * Nada de esta interfaz depende de red: todas las operaciones son locales
 * (C8.1) y pueden resolverse sin conexión.
 */
export interface CatalogoRepo {
  /** Productos activos con su stock (unidades base) — lectura local. */
  listar(): Promise<ItemCatalogo[]>;
  /** Un producto por id (incluye borrados lógicos — para auditoría/edición). */
  obtener(id: string): Promise<Producto | null>;
  /** Crea o actualiza (upsert). Debe resolver solo tras persistir localmente. */
  guardar(producto: Producto): Promise<Producto>;
  /** Borrado lógico (tombstone): `activo = false`, el historial sobrevive. */
  borrarLogico(id: string): Promise<void>;
  /** Notifica cambios del catálogo; devuelve el unsubscribe. */
  suscribir(listener: () => void): () => void;
}

export interface ItemCatalogo {
  producto: Producto;
  /** Stock derivado en unidades base (hoy: semilla demo; luego: libro). */
  stock: number;
}

export type EstadoCatalogo = "cargando" | "listo" | "error";

/** Adaptador en memoria — queda exportado para tests e historias locales. */
export class CatalogoRepoMemoria implements CatalogoRepo {
  private readonly productos = new Map<string, Producto>();
  private readonly stocks = new Map<string, number>();
  private readonly listeners = new Set<() => void>();

  constructor(seed: readonly Producto[], stock: Record<string, number>) {
    for (const producto of seed) {
      this.productos.set(producto.id, producto);
      this.stocks.set(producto.id, stock[producto.id] ?? 0);
    }
  }

  async listar(): Promise<ItemCatalogo[]> {
    const items: ItemCatalogo[] = [];
    for (const producto of this.productos.values()) {
      if (!producto.activo) continue;
      items.push({ producto, stock: this.stocks.get(producto.id) ?? 0 });
    }
    // Orden estable por nombre — la lista no debe “bailar” al reintentar.
    return items.sort((a, b) => a.producto.nombre.localeCompare(b.producto.nombre, "es"));
  }

  async obtener(id: string): Promise<Producto | null> {
    return this.productos.get(id) ?? null;
  }

  async guardar(producto: Producto): Promise<Producto> {
    this.productos.set(producto.id, producto);
    if (!this.stocks.has(producto.id)) this.stocks.set(producto.id, 0);
    this.emitir();
    return producto;
  }

  async borrarLogico(id: string): Promise<void> {
    const actual = this.productos.get(id);
    if (!actual) return;
    this.productos.set(id, { ...actual, activo: false });
    this.emitir();
  }

  suscribir(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emitir(): void {
    for (const listener of this.listeners) listener();
  }
}

/**
 * Instancia única de la app: implementación Dexie (IndexedDB local, C8.1).
 * La primera llamada espera la apertura de la base y la siembra demo
 * (idempotente, flag en `meta`) — ver catalogoRepoDexie.ts.
 */
export const repoCatalogo: CatalogoRepo = crearRepoCatalogoDexie();

/** Suscripción reactiva al catálogo. Recarga ante cambios y ante `recargar()`. */
export function useCatalogo(): {
  items: ItemCatalogo[];
  estado: EstadoCatalogo;
  recargar: () => void;
} {
  const [items, setItems] = useState<ItemCatalogo[]>([]);
  const [estado, setEstado] = useState<EstadoCatalogo>("cargando");
  const [orden, setOrden] = useState(0);
  const recargar = useCallback(() => setOrden((n) => n + 1), []);

  useEffect(() => {
    let vivo = true;
    setEstado("cargando");
    repoCatalogo
      .listar()
      .then((lista) => {
        if (!vivo) return;
        setItems(lista);
        setEstado("listo");
      })
      .catch(() => {
        if (vivo) setEstado("error");
      });
    const unsubscribe = repoCatalogo.suscribir(recargar);
    return () => {
      vivo = false;
      unsubscribe();
    };
  }, [orden, recargar]);

  return { items, estado, recargar };
}
