/**
 * Open Food Facts en el cliente (D3/P4) — acelerador, nunca dependencia.
 *
 * 1. Caché local en IndexedDB (tabla `meta`, clave `off:<codigo>`) con TTL:
 *    30 días si se encontró, 24 h si no (evita repetir consultas inútiles).
 * 2. Si no hay caché, pide al proxy `/off/:codigo` (el servidor evita CORS).
 * 3. Cualquier fallo (sin red, timeout, 500, IndexedDB) devuelve `null`: el
 *    formulario sigue manual-first y nunca se bloquea (C2.2, P4).
 */
import { type LaTienditaDb, escribirMeta, leerMeta } from "@latiendita/core";
import { baseApp } from "./baseLocal";

export interface DatosOff {
  nombre: string;
  marca?: string;
  cantidad?: string;
}

type CacheOff =
  | { encontrado: true; nombre: string; marca?: string; cantidad?: string; guardadoEn: number }
  | { encontrado: false; guardadoEn: number };

const TTL_ENCONTRADO_MS = 30 * 24 * 60 * 60 * 1000;
const TTL_NO_ENCONTRADO_MS = 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 2_500;

function clave(codigo: string): string {
  return `off:${codigo}`;
}

function vigente(cache: CacheOff, ahora: number): boolean {
  const ttl = cache.encontrado ? TTL_ENCONTRADO_MS : TTL_NO_ENCONTRADO_MS;
  return ahora - cache.guardadoEn < ttl;
}

/**
 * Busca un código en OFF. Devuelve `null` si no hay datos, no hay red o el
 * código no es válido — nunca lanza.
 */
export async function buscarEnOff(
  codigo: string,
  db: LaTienditaDb = baseApp.db,
): Promise<DatosOff | null> {
  const limpio = codigo.trim();
  if (!/^\d{8,14}$/.test(limpio)) return null;

  const ahora = Date.now();
  try {
    const cache = await leerMeta<CacheOff>(db, clave(limpio));
    if (cache && vigente(cache, ahora)) {
      return cache.encontrado
        ? { nombre: cache.nombre, marca: cache.marca, cantidad: cache.cantidad }
        : null;
    }
  } catch {
    // Sin caché (IndexedDB caída): se intenta la red igual.
  }

  try {
    const respuesta = await fetch(`/off/${encodeURIComponent(limpio)}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: "application/json" },
    });
    if (!respuesta.ok) return null;

    const datos = (await respuesta.json()) as {
      encontrado?: boolean;
      nombre?: string;
      marca?: string;
      cantidad?: string;
    };

    if (datos.encontrado && typeof datos.nombre === "string" && datos.nombre.trim() !== "") {
      const nombre = datos.nombre.trim();
      await escribirMeta(db, clave(limpio), {
        encontrado: true,
        nombre,
        marca: datos.marca,
        cantidad: datos.cantidad,
        guardadoEn: ahora,
      } satisfies CacheOff).catch(() => undefined);
      return { nombre, marca: datos.marca, cantidad: datos.cantidad };
    }

    await escribirMeta(db, clave(limpio), {
      encontrado: false,
      guardadoEn: ahora,
    } satisfies CacheOff).catch(() => undefined);
    return null;
  } catch {
    return null; // sin red / timeout / JSON roto: manual-first
  }
}
