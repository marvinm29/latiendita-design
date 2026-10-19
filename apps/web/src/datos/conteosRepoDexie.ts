/**
 * Implementación de `ConteosRepo` sobre la capa Dexie de @latiendita/core
 * (T-03): las sesiones de conteo viven en la MISMA base que el catálogo y el
 * libro (`baseLocal.ts`), así que reabrir la app retoma el conteo en curso.
 *
 * `cerrarConAjustes` es atómica en core: sesión cerrada + un movimiento de
 * ajuste por diferencia + sus ops de outbox + `stock_cache`, todo en una
 * transacción. La UI nunca escribe IndexedDB directamente.
 */
import type { CierreConAjustes, ConteoFila } from "@latiendita/core";
import { asegurarBaseLista, baseApp, type BaseLocal } from "./baseLocal";
import type { ConteosRepo } from "./conteosRepo";

export class ConteosRepoDexie implements ConteosRepo {
  private readonly base: BaseLocal;

  constructor(base: BaseLocal = baseApp) {
    this.base = base;
  }

  /** Resuelve cuando la base está abierta y la semilla demo ya corrió. */
  private get listo(): Promise<void> {
    return asegurarBaseLista(this.base);
  }

  async retomar(): Promise<ConteoFila | undefined> {
    await this.listo;
    return this.base.repos.conteo.listarAbierta();
  }

  async iniciar(): Promise<ConteoFila> {
    await this.listo;
    return this.base.repos.conteo.iniciar();
  }

  async registrarItem(
    conteoId: string,
    productoId: string,
    contado: number,
  ): Promise<ConteoFila> {
    await this.listo;
    return this.base.repos.conteo.registrarItem(conteoId, productoId, contado);
  }

  async cerrarConAjustes(conteoId: string): Promise<CierreConAjustes> {
    await this.listo;
    return this.base.repos.conteo.cerrarConAjustes(conteoId);
  }
}

/** Repo de conteos sobre IndexedDB (implementación activa de la app). */
export function crearRepoConteosDexie(base: BaseLocal = baseApp): ConteosRepo {
  return new ConteosRepoDexie(base);
}
