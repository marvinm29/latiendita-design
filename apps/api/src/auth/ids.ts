/** IDs UUIDv7 generados en el servidor (specs/003 §4.1). */
import { randomBytes } from "node:crypto";

export function nuevoId(): string {
  const bytes = randomBytes(16);

  // 48 bits de milisegundos (big-endian) al inicio: ordenable por tiempo.
  let tiempo = BigInt(Date.now());
  for (let i = 5; i >= 0; i--) {
    bytes[i] = Number(tiempo & 0xffn);
    tiempo >>= 8n;
  }

  bytes[6] = (bytes[6]! & 0x0f) | 0x70; // versión 7
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // variante RFC 4122

  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}
