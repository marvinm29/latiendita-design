/**
 * Cursors de sincronización en la tabla `meta` (003 §5.3).
 *
 * El cursor por negocio es `server_seq`: la última secuencia confirmada del
 * servidor. `0` = sin pull (login inicial requiere conexión y arranca desde 0).
 */
import type { LaTienditaDb } from "./schema";

/** Lee un valor genérico de `meta`. */
export async function leerMeta<T>(db: LaTienditaDb, clave: string): Promise<T | undefined> {
  const fila = await db.meta.get(clave);
  return fila ? (fila.valor as T) : undefined;
}

/** Escribe (upsert) un valor genérico en `meta`. */
export async function escribirMeta(
  db: LaTienditaDb,
  clave: string,
  valor: unknown,
): Promise<void> {
  await db.meta.put({ clave, valor, actualizadoEn: Date.now() });
}

export function claveCursorServidor(negocioId: string): string {
  return `server_seq:${negocioId}`;
}

/** Último `server_seq` del pull para el negocio (0 si nunca sincronizó). */
export async function leerCursorServidor(
  db: LaTienditaDb,
  negocioId: string,
): Promise<number> {
  const valor = await leerMeta<unknown>(db, claveCursorServidor(negocioId));
  return typeof valor === "number" && Number.isFinite(valor) && valor >= 0 ? valor : 0;
}

/** Avanza el cursor tras aplicar un lote del pull. */
export async function guardarCursorServidor(
  db: LaTienditaDb,
  negocioId: string,
  serverSeq: number,
): Promise<void> {
  if (!Number.isInteger(serverSeq) || serverSeq < 0) {
    throw new Error(`serverSeq inválido: ${serverSeq}`);
  }
  await escribirMeta(db, claveCursorServidor(negocioId), serverSeq);
}
