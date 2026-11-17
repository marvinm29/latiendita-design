/**
 * Base compartida de la PWA: una instancia de IndexedDB y repositorios
 * ligados al negocio de la sesión. La demo se limita al contexto `local`.
 *
 * Antes el catálogo duplicaba `NEGOCIO_LOCAL` y la semilla; con el libro ya
 * persistido (C4.3) el catálogo, los movimientos y el conteo DEBEN mirar la
 * MISMA base: por eso viven aquí. `asegurarBaseLista()` prepara una instantánea
 * por negocio; si falla, el siguiente uso reintenta.
 *
 * La sesión selecciona el negocio sin reasignar los datos heredados `local`.
 * Cada operación recibe una instantánea del contexto, nunca un objeto mutable.
 */
import {
  abrirDb,
  crearRepos,
  escribirMeta,
  exigirOrigenDisponible,
  leerMeta,
  solicitarPersistencia,
  type LaTienditaDb,
  type Repos,
} from "@latiendita/core";
import { PRODUCTOS_DEMO, STOCK_DEMO } from "./demo";

/** Contexto heredado/demo sin sesión; nunca se reasigna implícitamente a una cuenta. */
export const NEGOCIO_LOCAL = "local";

/** Flag de siembra en la tabla `meta`: el seed corre una sola vez por base. */
export const CLAVE_SEMILLA = "demo:sembrado:v1";

export interface BaseLocal {
  db: LaTienditaDb;
  repos: Repos;
  negocioId: string;
  /** Contexto de la app: resolver la sesión guardada antes de cada operación. */
  seguirSesion?: boolean;
  /** Sólo el modo local/demo recibe semillas; las cuentas reales arrancan vacías. */
  sembrarDemo?: boolean;
}

const db = abrirDb();
const repos = crearRepos(db, NEGOCIO_LOCAL);

/** Contexto local de la app: la base y los repos que consumen las pantallas. */
export const baseApp: BaseLocal = { db, repos, negocioId: NEGOCIO_LOCAL, seguirSesion: true };

const listos = new WeakMap<LaTienditaDb, Map<string, Promise<void>>>();

/** Selección por sesión; también registra la dependencia de `liveQuery`. No escribe. */
export async function resolverBaseLocal(base: BaseLocal = baseApp): Promise<BaseLocal> {
  if (!base.seguirSesion) return { ...base };
  const fila = await base.db.sesion_local.get("actual");
  const negocioId = fila?.sesion.negocioId ?? NEGOCIO_LOCAL;
  if (!fila) await exigirOrigenDisponible(base.db, NEGOCIO_LOCAL);
  if (fila && (!negocioId || negocioId === NEGOCIO_LOCAL)) {
    throw new Error("La sesión no identifica un negocio válido.");
  }
  return {
    db: base.db,
    repos: crearRepos(base.db, negocioId),
    negocioId,
    sembrarDemo: !fila,
  };
}

/** Devuelve el contexto preparado. El llamador debe usar esa instantánea hasta terminar. */
export async function asegurarBaseLista(base: BaseLocal = baseApp): Promise<BaseLocal> {
  const elegida = await resolverBaseLocal(base);
  let porNegocio = listos.get(elegida.db);
  if (!porNegocio) {
    porNegocio = new Map();
    listos.set(elegida.db, porNegocio);
  }
  const clave = JSON.stringify([elegida.negocioId, elegida.sembrarDemo !== false]);
  let promesa = porNegocio.get(clave);
  if (!promesa) {
    promesa = iniciar(elegida).catch((error: unknown) => {
      porNegocio.delete(clave);
      throw error;
    });
    porNegocio.set(clave, promesa);
  }
  await promesa;
  return elegida;
}

async function iniciar(base: BaseLocal): Promise<void> {
  await base.db.open();
  // Protege los datos del negocio de la evicción del navegador (C8.5).
  await solicitarPersistencia();
  if (base.sembrarDemo !== false) await sembrarDemoSiHaceFalta(base);
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
    if (existente && existente.negocioId !== base.negocioId) {
      throw new Error(`producto demo de otro negocio: ${producto.id}`);
    }
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
