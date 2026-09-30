import { useEffect, useState } from "preact/hooks";
import {
  crearMovimiento,
  stockDerivado,
  type CrearMovimientoInput,
  type Movimiento,
} from "@latiendita/core";
import { PRODUCTOS_DEMO, STOCK_DEMO } from "../../datos/demo";

/**
 * Contrato de acceso al libro de movimientos (C4) desde la UI.
 *
 * La implementación actual es un adaptador en memoria sembrado coherente con
 * `datos/demo.ts` (el stock derivado del libro == STOCK_DEMO). La persistencia
 * real llega con otro batch: TODO(Dexie) escribir `MovimientosRepoDexie` que
 * cumpla esta misma interfaz sobre la tabla `movimientos` + outbox por `op_id`
 * y sustituir `repoMovimientos`. La UI no cambia:
 *
 *  - `listarPorProducto` → Dexie `movimientos.where('productoId').equals(id)`
 *  - `stockDe`           → caché de stock o `stockDerivado` del libro
 *  - `agregar`           → Dexie `add` + encolar op en outbox (idempotente por op_id)
 *  - `suscribir`         → Dexie liveQuery / eventos de la capa de datos
 *
 * Regla de oro (C8.4): el libro es append-only — aquí no existe editar ni
 * borrar; las correcciones son movimientos nuevos con `corrigeA`.
 */
export interface MovimientosRepo {
  /** Historial completo del producto (orden de inserción, antiguo→nuevo). */
  listarPorProducto(productoId: string): Promise<Movimiento[]>;
  /** Todos los movimientos del libro (para conteos y reportes). */
  listarTodos(): Promise<Movimiento[]>;
  /** Stock actual en unidades base, derivado del libro. */
  stockDe(productoId: string): Promise<number>;
  /**
   * Append-only: valida con `crearMovimiento` (puede lanzar) y agrega.
   * Nunca edita ni elimina movimientos existentes.
   */
  agregar(input: CrearMovimientoInput): Promise<Movimiento>;
  /** Notifica cambios del libro; devuelve el unsubscribe. */
  suscribir(listener: () => void): () => void;
}

class MovimientosRepoMemoria implements MovimientosRepo {
  private readonly movimientos: Movimiento[] = [];
  private readonly listeners = new Set<() => void>();

  constructor() {
    // Seed coherente con demo.ts: una entrada por producto que produce
    // exactamente STOCK_DEMO (stockDerivado == stock del catálogo demo).
    const creadoEn = Date.now() - 24 * 60 * 60 * 1000;
    for (const producto of PRODUCTOS_DEMO) {
      const cantidad = STOCK_DEMO[producto.id] ?? 0;
      if (cantidad > 0) {
        this.movimientos.push(
          crearMovimiento({
            productoId: producto.id,
            tipo: "entrada",
            cantidadBase: cantidad,
            motivo: "Stock inicial",
            creadoEn,
          }),
        );
      }
    }
  }

  async listarPorProducto(productoId: string): Promise<Movimiento[]> {
    return this.movimientos.filter((mov) => mov.productoId === productoId);
  }

  async listarTodos(): Promise<Movimiento[]> {
    return [...this.movimientos];
  }

  async stockDe(productoId: string): Promise<number> {
    return stockDerivado(this.movimientos, productoId);
  }

  async agregar(input: CrearMovimientoInput): Promise<Movimiento> {
    const mov = crearMovimiento(input);
    this.movimientos.push(mov);
    this.emitir();
    return mov;
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

/** Instancia única de la demo. TODO(Dexie): reemplazar por MovimientosRepoDexie. */
export const repoMovimientos: MovimientosRepo = new MovimientosRepoMemoria();

/**
 * Versión del libro: se incrementa con cada movimiento agregado y fuerza
 * re-render para recalcular stock/historial derivados.
 */
export function useVersionMovimientos(): number {
  const [version, setVersion] = useState(0);
  useEffect(
    () => repoMovimientos.suscribir(() => setVersion((n) => n + 1)),
    [],
  );
  return version;
}

/** Historial reactivo de un producto (opcional; vacío si `productoId` es null). */
export function useMovimientosProducto(productoId: string | null): Movimiento[] {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const version = useVersionMovimientos();

  useEffect(() => {
    if (productoId === null) {
      setMovimientos([]);
      return;
    }
    let vivo = true;
    repoMovimientos.listarPorProducto(productoId).then((lista) => {
      if (vivo) setMovimientos(lista);
    });
    return () => {
      vivo = false;
    };
  }, [productoId, version]);

  return movimientos;
}
