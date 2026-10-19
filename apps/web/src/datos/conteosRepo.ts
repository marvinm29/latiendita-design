import type { CierreConAjustes, ConteoFila } from "@latiendita/core";
import { crearRepoConteosDexie } from "./conteosRepoDexie";

/**
 * Contrato de sesiones de conteo (C5.2) desde la UI.
 *
 * La implementación activa es `ConteosRepoDexie` (IndexedDB vía
 * @latiendita/core, ver conteosRepoDexie.ts):
 *
 *  - `retomar`          → la sesión abierta más reciente (reanuda tras recarga)
 *  - `iniciar`          → abre una sesión en blanco
 *  - `registrarItem`    → upsert del producto contado, con el sistema del libro
 *  - `cerrarConAjustes` → cierra la sesión y aplica las diferencias como ajustes
 *                         (sesión + libro + outbox en UNA transacción)
 *
 * Todo es local (C8.1): contar nunca depende de la red y la reanudación usa
 * IndexedDB, no memoria del componente.
 */
export interface ConteosRepo {
  /** Sesión abierta más reciente; `undefined` si no hay ninguna. */
  retomar(): Promise<ConteoFila | undefined>;
  iniciar(): Promise<ConteoFila>;
  /** `sistema` = stock derivado del libro al momento de contar. */
  registrarItem(conteoId: string, productoId: string, contado: number): Promise<ConteoFila>;
  /** Cierra la sesión y registra un ajuste por cada diferencia (C5.2). */
  cerrarConAjustes(conteoId: string): Promise<CierreConAjustes>;
}

/** Sesiones de conteo sobre IndexedDB (implementación activa de la app). */
export const repoConteos: ConteosRepo = crearRepoConteosDexie();
