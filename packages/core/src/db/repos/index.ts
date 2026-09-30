/**
 * Capa de repositorios locales: un único punto de acceso para la UI.
 *
 * Uso típico (web):
 * ```ts
 * const db = abrirDb();
 * const repos = crearRepos(db, negocioId);
 * const { movimiento } = await repos.movimientos.registrarSalida({...});
 * ```
 */
import type { LaTienditaDb } from "../schema";
import { crearConteoRepo, type ConteoRepo } from "./conteoRepo";
import { crearFiadosRepo, type FiadosRepo } from "./fiadosRepo";
import { crearMovimientosRepo, type MovimientosRepo } from "./movimientosRepo";
import { crearOutboxRepo, type OutboxRepo } from "./outboxRepo";
import { crearProductosRepo, type ProductosRepo } from "./productosRepo";

export * from "./comun";
export * from "./productosRepo";
export * from "./movimientosRepo";
export * from "./fiadosRepo";
export * from "./outboxRepo";
export * from "./conteoRepo";

export interface Repos {
  productos: ProductosRepo;
  movimientos: MovimientosRepo;
  fiados: FiadosRepo;
  outbox: OutboxRepo;
  conteo: ConteoRepo;
}

/** Liga todos los repos a una base y un `negocioId` (scoping de fila). */
export function crearRepos(db: LaTienditaDb, negocioId: string): Repos {
  if (!negocioId) throw new Error("negocioId es obligatorio");
  return {
    productos: crearProductosRepo(db, negocioId),
    movimientos: crearMovimientosRepo(db, negocioId),
    fiados: crearFiadosRepo(db, negocioId),
    outbox: crearOutboxRepo(db, negocioId),
    conteo: crearConteoRepo(db, negocioId),
  };
}
