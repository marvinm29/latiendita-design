/**
 * Códigos de invitación (T-05): 8 caracteres en base32 Crockford.
 *
 * Sin caracteres ambiguos (no hay I, L, O ni U), se puede dictar por teléfono
 * y se toleran confusiones típicas al escribirlo (O→0, I/L→1).
 */
import { randomBytes } from "node:crypto";

export const ALFABETO_CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const LONGITUD_CODIGO = 8;

/** 8 bytes → 8 símbolos (256 es múltiplo de 32: sin sesgo). */
export function generarCodigo(): string {
  const bytes = randomBytes(LONGITUD_CODIGO);
  let codigo = "";
  for (const byte of bytes) {
    codigo += ALFABETO_CROCKFORD[byte % ALFABETO_CROCKFORD.length];
  }
  return codigo;
}

/** Normaliza lo que escribe la persona; `null` si no es un código válido. */
export function normalizarCodigo(entrada: string): string | null {
  const limpio = entrada
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  return /^[0-9A-HJKMNP-TV-Z]{8}$/.test(limpio) ? limpio : null;
}
