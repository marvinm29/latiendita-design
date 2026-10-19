/**
 * Credenciales de acceso (T-05): argon2id para el PIN y SHA-256 para el token.
 *
 * El PIN nunca se guarda ni se registra en claro. El token de sesión es opaco
 * (32 bytes aleatorios); el servidor sólo persiste su SHA-256, así una fuga de
 * la base no permite reutilizar sesiones.
 */
import { hash, verify, type Options } from "@node-rs/argon2";
import { createHash, randomBytes } from "node:crypto";

/** Parámetros OWASP 2024 para argon2id (19 MiB, 2 pasadas, 1 hilo). */
export const OPCIONES_ARGON2 = {
  // `Algorithm.Argon2id` = 2; se evita el const enum por `isolatedModules`.
  algorithm: 2 as NonNullable<Options["algorithm"]>,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const satisfies Options;

export async function hashearPin(pin: string): Promise<string> {
  return hash(pin, OPCIONES_ARGON2);
}

/** `true` sólo si el PIN corresponde; un hash corrupto también es `false`. */
export async function verificarPin(pin: string, pinHash: string): Promise<boolean> {
  try {
    return await verify(pinHash, pin, OPCIONES_ARGON2);
  } catch {
    return false;
  }
}

export function nuevoToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashearToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** El código de invitación se guarda hasheado (40 bits aleatorios, un solo uso). */
export function hashearCodigo(codigo: string): string {
  return createHash("sha256").update(codigo).digest("hex");
}
