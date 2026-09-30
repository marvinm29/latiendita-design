/**
 * Instancia de la base local y persistencia (003 T-03).
 *
 * - `abrirDb()` es una factory con singleton por nombre: no se abre nada al
 *   importar el módulo (seguro en Node/servidor sin IndexedDB).
 * - `solicitarPersistencia()` pide `navigator.storage.persist()` al primer
 *   arranque para proteger los datos del negocio de la evicción (C8.5).
 */
import { LaTienditaDb } from "./schema";

const NOMBRE_BASE = "latiendita";
const instancias = new Map<string, LaTienditaDb>();

/**
 * Nombre de base: `latiendita` por defecto; con negocio → `latiendita-<slug>`
 * (aislamiento opcional si un equipo comparte dispositivo). El `negocio_id`
 * sigue escopando las filas aunque la base sea única.
 */
export function nombreDeBase(nombreNegocio?: string): string {
  const slug = (nombreNegocio ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug || slug === NOMBRE_BASE) return NOMBRE_BASE;
  return `${NOMBRE_BASE}-${slug}`;
}

/** Devuelve (y cachea) la instancia local; idéntica para el mismo nombre. */
export function abrirDb(nombreNegocio?: string): LaTienditaDb {
  const nombre = nombreDeBase(nombreNegocio);
  const existente = instancias.get(nombre);
  if (existente) return existente;
  const db = new LaTienditaDb(nombre);
  instancias.set(nombre, db);
  return db;
}

/** Cierra y borra la base (tests y "salir de la cuenta" en M2). */
export async function borrarDb(db: LaTienditaDb): Promise<void> {
  instancias.delete(db.name);
  await db.delete();
}

/**
 * Pide almacenamiento persistente (no eviccionable) al navegador.
 * `true` = concedido o ya concedido; `false` = denegado o entorno sin API
 * (Node/tests). Nunca lanza.
 */
export async function solicitarPersistencia(): Promise<boolean> {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  try {
    const almacen = navigator.storage;
    if (!almacen || typeof almacen.persist !== "function") return false;
    if (typeof almacen.persisted === "function" && (await almacen.persisted())) return true;
    return await almacen.persist();
  } catch {
    return false;
  }
}
