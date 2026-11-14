/**
 * Implementación de `MovimientosRepo` sobre la capa Dexie de @latiendita/core
 * (T-03): el libro vive en IndexedDB, la misma base que el catálogo.
 *
 * El libro es append-only (C8.4): `agregar` sólo INSERTA; no existe editar ni
 * borrar. Cada escritura ocurre en UNA transacción con su op de outbox
 * (`crearMovimientoConOp`), de modo que un movimiento nunca se pierde (C8.4) y
 * el `stock_cache` se refresca en el mismo acto (C4.3).
 *
 * Arranque perezoso compartido con el catálogo (`asegurarBaseLista`). La
 * suscripción usa `liveQuery` de Dexie sobre la tabla `movimientos`.
 */
import { liveQuery } from "dexie";
import {
  leerStockLocal,
  type CrearMovimientoInput,
  type Movimiento,
  type MovimientoFila,
} from "@latiendita/core";
import { asegurarBaseLista, resolverBaseLocal, baseApp, type BaseLocal } from "./baseLocal";
import type { MovimientosRepo } from "./movimientosRepo";

export class MovimientosRepoDexie implements MovimientosRepo {
  private readonly base: BaseLocal;

  constructor(base: BaseLocal = baseApp) {
    this.base = base;
  }

  /** Resuelve cuando la base está abierta y la semilla demo ya corrió. */
  private get listo(): Promise<BaseLocal> {
    return asegurarBaseLista(this.base);
  }

  async listarPorProducto(productoId: string): Promise<MovimientoFila[]> {
    const base = await this.listo;
    return base.repos.movimientos.listarPorProducto(productoId);
  }

  async listarTodos(): Promise<MovimientoFila[]> {
    const base = await this.listo;
    const filas = await base.db.movimientos
      .where("negocioId")
      .equals(base.negocioId)
      .toArray();
    // Orden cronológico estable (el índice compuesto no cubre todo el negocio).
    return filas.sort((a, b) => a.ocurridoAt - b.ocurridoAt);
  }

  async stockDe(productoId: string): Promise<number> {
    const base = await this.listo;
    return leerStockLocal(base.db, productoId, base.negocioId);
  }

  async agregar(input: CrearMovimientoInput): Promise<Movimiento> {
    const base = await this.listo;
    // Libro + op de outbox + caché de stock en una sola transacción (C4.3/C8.4).
    const { movimiento } = await base.repos.movimientos.crearMovimientoConOp(input);
    return movimiento;
  }

  suscribir(listener: () => void): () => void {
    // liveQuery emite el valor inicial al suscribirse: se ignora para no
    // realimentar el `useVersionMovimientos` (bucle effect↔suscripción).
    let primera = true;
    const subcripcion = liveQuery(async () => {
      const base = await resolverBaseLocal(this.base);
      return base.db.movimientos.where("negocioId").equals(base.negocioId).toArray();
    }).subscribe({
      next: () => {
        if (primera) {
          primera = false;
          return;
        }
        listener();
      },
      error: () => undefined,
    });
    return () => subcripcion.unsubscribe();
  }
}

/** Repo del libro sobre IndexedDB (implementación activa de la app). */
export function crearRepoMovimientosDexie(base: BaseLocal = baseApp): MovimientosRepo {
  return new MovimientosRepoDexie(base);
}
