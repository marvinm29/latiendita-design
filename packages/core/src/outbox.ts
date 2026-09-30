import type { OpEstado, OpOutbox } from "./tipos";

export interface CrearOpInput {
  endpoint: string;
  payload: unknown;
  ahora?: number;
  /** Solo para tests/fixtures. */
  id?: string;
}

/**
 * Nueva operación pendiente en la outbox.
 * En producción el id será UUIDv7 (dependencia M2); en M1 usamos randomUUID.
 */
export function crearOp(input: CrearOpInput): OpOutbox {
  if (!input.endpoint) throw new Error("endpoint es obligatorio");
  const ahora = input.ahora ?? Date.now();
  return {
    id: input.id ?? crypto.randomUUID(),
    endpoint: input.endpoint,
    payload: input.payload,
    estado: "pendiente",
    intentos: 0,
    creadoEn: ahora,
    proximoIntentoEn: ahora,
    ultimoError: null,
  };
}

/** Agrega una op a la outbox (devuelve un array nuevo). */
export function encolar(ops: readonly OpOutbox[], op: OpOutbox): OpOutbox[] {
  return [...ops, op];
}

export function marcarEnviando(op: OpOutbox): OpOutbox {
  if (op.estado === "ok") throw new Error("la op ya está en estado ok");
  return { ...op, estado: "enviando" };
}

export function marcarOk(op: OpOutbox): OpOutbox {
  return { ...op, estado: "ok", ultimoError: null };
}

/**
 * Backoff exponencial: `1000 * 2^n` ms, tope 60 s, jitter ±20%.
 * `n` = reintentos ya agotados (0 = primer reintento tras el fallo).
 * `rng` inyectable para tests deterministas (debe devolver [0, 1)).
 */
export function calcularSiguienteReintento(
  n: number,
  rng: () => number = Math.random,
): number {
  if (n < 0) throw new Error(`n debe ser >= 0, recibido: ${n}`);
  const base = Math.min(1000 * 2 ** n, 60_000);
  const jitter = 0.8 + rng() * 0.4;
  return Math.round(base * jitter);
}

/**
 * Marca fallo: incrementa intentos y programa el próximo intento
 * con backoff. `rng` controla el jitter.
 */
export function marcarError(
  op: OpOutbox,
  error: string,
  ahora: number = Date.now(),
  rng: () => number = Math.random,
): OpOutbox {
  if (op.estado === "ok") throw new Error("la op ya está en estado ok");
  const intentos = op.intentos + 1;
  const retraso = calcularSiguienteReintento(intentos - 1, rng);
  return {
    ...op,
    estado: "error",
    intentos,
    ultimoError: error,
    proximoIntentoEn: ahora + retraso,
  };
}

const ENVIABLES: ReadonlySet<OpEstado> = new Set<OpEstado>(["pendiente", "error"]);

/** Ops listas para reintentar: pendientes/error cuyo `proximoIntentoEn` ya venció. */
export function opsListasParaEnviar(
  ops: readonly OpOutbox[],
  ahora: number,
): OpOutbox[] {
  return ops.filter((op) => ENVIABLES.has(op.estado) && op.proximoIntentoEn <= ahora);
}
