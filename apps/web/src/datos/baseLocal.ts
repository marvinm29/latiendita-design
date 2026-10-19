/**
 * Base local compartida de la PWA (M1): un único `negocioId`, una única
 * instancia de IndexedDB y la siembra demo idempotente, en un solo lugar.
 *
 * Antes el catálogo duplicaba `NEGOCIO_LOCAL` y la semilla; con el libro ya
 * persistido (C4.3) el catálogo, los movimientos y el conteo DEBEN mirar la
 * MISMA base: por eso viven aquí. `asegurarBaseLista()` abre la base y siembra
 * UNA sola vez (promesa única por base; si falla, el siguiente uso reintenta).
 *
 * M1 sin login (P2 pendiente): un solo negocio local por dispositivo. En M2 lo
 * reemplaza el `negocioId` real de la invitación.
 */
import {
  abrirDb,
  crearRepos,
  escribirMeta,
  leerMeta,
  solicitarPersistencia,
  type LaTienditaDb,
  type Repos,
} from "@latiendita/core";
import { PRODUCTOS_DEMO, STOCK_DEMO } from "./demo";

/** M1 sin login: negocio local único. En M2 lo fija la invitación. */
export const NEGOCIO_LOCAL = "local";

/** Flag de siembra en la tabla `meta`: el seed corre una sola vez por base. */
export const CLAVE_SEMILLA = "demo:sembrado:v1";

export interface BaseLocal {
  db: LaTienditaDb;
  repos: Repos;
  negocioId: string;
}

const db = abrirDb();
const repos = crearRepos(db, NEGOCIO_LOCAL);

/** Contexto local de la app: la base y los repos que consumen las pantallas. */
export const baseApp: BaseLocal = { db, repos, negocioId: NEGOCIO_LOCAL };

const listos = new WeakMap<LaTienditaDb, Promise<void>>();

/** Resuelve cuando la base está abierta y la semilla demo ya corrió. */
export function asegurarBaseLista(base: BaseLocal = baseApp): Promise<void> {
  const existente = listos.get(base.db);
  if (existente) return existente;
  const promesa = iniciar(base).catch((error: unknown) => {
    listos.delete(base.db); // el siguiente uso (p. ej. "Reintentar") reintenta
    throw error;
  });
  listos.set(base.db, promesa);
  return promesa;
}

async function iniciar(base: BaseLocal): Promise<void> {
  await base.db.open();
  // Protege los datos del negocio de la evicción del navegador (C8.5).
  await solicitarPersistencia();
  await sembrarDemoSiHaceFalta(base);
}

/** Id determinista para la entrada inicial de cada producto demo. */
function idSemillaEntrada(productoId: string): string {
  return `demo-semilla:entrada:${productoId}`;
}

/**
 * Siembra demo (C2): productos de `demo.ts` + entradas iniciales POR EL LIBRO
 * (el stock se deriva de movimientos; nunca se escribe `stock_cache` a mano).
 * Idempotente por tres capas: flag en `meta`, salto de productos existentes e
 * ids deterministas de movimiento — un corte a mitad no duplica nada.
 */
async function sembrarDemoSiHaceFalta(base: BaseLocal): Promise<void> {
  const { db, repos } = base;
  const sembrado = await leerMeta<unknown>(db, CLAVE_SEMILLA);
  if (sembrado !== undefined) return;

  for (const producto of PRODUCTOS_DEMO) {
    const existente = await db.productos.get(producto.id);
    if (!existente || existente.deletedAt !== null) {
      await repos.productos.crear({ ...producto, id: producto.id });
    }
    const cantidad = STOCK_DEMO[producto.id] ?? 0;
    if (cantidad > 0) {
      const idEntrada = idSemillaEntrada(producto.id);
      const yaRegistrada = await db.movimientos.get(idEntrada);
      if (!yaRegistrada) {
        await repos.movimientos.registrarEntrada({
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

  await escribirMeta(db, CLAVE_SEMILLA, { version: 1, cuando: Date.now() });
}
