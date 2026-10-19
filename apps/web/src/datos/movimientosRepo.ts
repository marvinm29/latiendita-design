import { useEffect, useState } from "preact/hooks";
import {
  crearMovimiento,
  stockDerivado,
  type CrearMovimientoInput,
  type Movimiento,
} from "@latiendita/core";
import { PRODUCTOS_DEMO, STOCK_DEMO } from "./demo";
import { crearRepoMovimientosDexie } from "./movimientosRepoDexie";

/**
 * Contrato de acceso al libro de movimientos (C4) desde la UI.
 *
 * La implementación activa es `MovimientosRepoDexie` (IndexedDB vía
 * @latiendita/core, ver movimientosRepoDexie.ts):
 *
 *  - `listarPorProducto` → `negocioId+productoId+ocurridoAt` en el libro
 *  - `listarTodos`       → todos los movimientos del negocio (conteos/reportes)
 *  - `stockDe`           → caché de stock o `stockDerivado` del libro
 *  - `agregar`           → transacción libro + op de outbox (idempotente por op_id)
 *  - `suscribir`         → `liveQuery` de Dexie
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

/**
 * Adaptador en memoria — queda exportado para tests e historias locales.
 * Siembra coherente con `datos/demo.ts` (el stock derivado == STOCK_DEMO).
 */
export class MovimientosRepoMemoria implements MovimientosRepo {
  private readonly movimientos: Movimiento[] = [];
  private readonly listeners = new Set<() => void>();

  constructor() {
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

/**
 * Instancia única de la app: implementación Dexie (IndexedDB local, C8.1).
 * Comparte base con el catálogo (`baseLocal.ts`): el libro es la única fuente
 * de stock y cada movimiento deja su op en la outbox (C8.4).
 */
export const repoMovimientos: MovimientosRepo = crearRepoMovimientosDexie();

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
