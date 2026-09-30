/**
 * Repositorio de la outbox local (003 §5.1).
 *
 * - `encolar` usa `put` con el `opId` como clave primaria: reintentar encolar
 *   la misma op N veces deja 1 sola fila (y el servidor es idempotente por
 *   `op_id` en M2).
 * - `pendientes` = ops aún no confirmadas (badge "por sincronizar").
 * - `opsListasParaEnviar` delega la elegibilidad (pendiente/error vencido con
 *   backoff) en el dominio `opsListasParaEnviar`.
 */
import { marcarEnviando, marcarOk, marcarError, opsListasParaEnviar } from "../../outbox";
import type { OpOutbox } from "../../tipos";
import type { LaTienditaDb, OpOutboxFila } from "../schema";
import { filaDeOp } from "./comun";

export interface OutboxRepo {
  /** Idempotente por `opId`: encolar dos veces = una fila. */
  encolar(op: OpOutbox): Promise<OpOutboxFila>;
  /** Ops del negocio que aún no están en estado `ok`. */
  pendientes(): Promise<OpOutboxFila[]>;
  marcarEnviando(opId: string): Promise<OpOutboxFila>;
  marcarOk(opId: string): Promise<OpOutboxFila>;
  marcarError(
    opId: string,
    error: string,
    ahora?: number,
    rng?: () => number,
  ): Promise<OpOutboxFila>;
  /** Ops del negocio listas para empujar ahora (dominio + backoff). */
  opsListasParaEnviar(ahora?: number): Promise<OpOutboxFila[]>;
}

export function crearOutboxRepo(db: LaTienditaDb, negocioId: string): OutboxRepo {
  async function obtener(opId: string): Promise<OpOutboxFila> {
    const op = await db.outbox.get(opId);
    if (!op || op.negocioId !== negocioId) throw new Error(`op no encontrada: ${opId}`);
    return op;
  }

  async function transicion(
    opId: string,
    mutar: (op: OpOutboxFila) => OpOutbox,
  ): Promise<OpOutboxFila> {
    return db.transaction("rw", db.outbox, async () => {
      const siguiente: OpOutboxFila = { ...mutar(await obtener(opId)), negocioId };
      await db.outbox.put(siguiente);
      return siguiente;
    });
  }

  return {
    async encolar(op: OpOutbox): Promise<OpOutboxFila> {
      const fila = filaDeOp(op, negocioId);
      await db.outbox.put(fila);
      return fila;
    },

    async pendientes(): Promise<OpOutboxFila[]> {
      const filas = await db.outbox.where("negocioId").equals(negocioId).toArray();
      return filas.filter((op) => op.estado !== "ok");
    },

    marcarEnviando: (opId) => transicion(opId, (op) => marcarEnviando(op)),
    marcarOk: (opId) => transicion(opId, (op) => marcarOk(op)),
    marcarError: (opId, error, ahora = Date.now(), rng = Math.random) =>
      transicion(opId, (op) => marcarError(op, error, ahora, rng)),

    async opsListasParaEnviar(ahora = Date.now()): Promise<OpOutboxFila[]> {
      // Índice `proximoIntentoEn`: descarta de entrada las que esperan backoff.
      const candidatas = await db.outbox.where("proximoIntentoEn").belowOrEqual(ahora).toArray();
      const propias = candidatas.filter((op) => op.negocioId === negocioId);
      return opsListasParaEnviar(propias, ahora) as OpOutboxFila[];
    },
  };
}
