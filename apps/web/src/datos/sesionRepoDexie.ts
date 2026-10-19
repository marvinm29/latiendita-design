/**
 * Sesión local sobre IndexedDB (C1 / T-05).
 *
 * Una sola fila (`id = "actual"`) en `sesion_local` con:
 * - la sesión que emitió el servidor (token opaco),
 * - un verificador PBKDF2-SHA-256 del PIN (sal aleatoria, nunca el PIN),
 * - `bloqueada`, que la app restablece al abrirse.
 *
 * El token NUNCA va a localStorage. Todo el desbloqueo ocurre con Web Crypto
 * en el dispositivo: no hay red de por medio (C8.1).
 */
import {
  validarPin,
  type SesionCuenta,
  type SesionLocalFila,
  type VerificadorPinFila,
} from "@latiendita/core";
import { baseApp, type BaseLocal } from "./baseLocal";
import { salir } from "./authApi";
import type { SesionRepo } from "./sesionRepo";

const ID_ACTUAL = "actual";
const BYTES_SAL = 16;
const BYTES_HASH = 32;
const BITS_HASH = BYTES_HASH * 8;

/** Iteraciones de PBKDF2-SHA-256 (equilibrio seguridad / Android de gama baja). */
export const ITERACIONES_PIN = 210_000;

function aBase64(bytes: Uint8Array): string {
  let binario = "";
  for (const byte of bytes) binario += String.fromCharCode(byte);
  return btoa(binario);
}

function desdeBase64(texto: string): Uint8Array<ArrayBuffer> {
  const binario = atob(texto);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

/** Comparación en tiempo constante (misma longitud fija de hash). */
export function igualesEnTiempoConstante(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diferencia = 0;
  for (let i = 0; i < a.length; i++) diferencia |= a[i]! ^ b[i]!;
  return diferencia === 0;
}

function exigirWebCrypto(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error(
      "Este dispositivo no puede proteger el PIN. Actualiza el navegador e intenta de nuevo.",
    );
  }
  return subtle;
}

async function derivarPin(
  pin: string,
  sal: Uint8Array<ArrayBuffer>,
  iteraciones: number,
): Promise<Uint8Array> {
  const subtle = exigirWebCrypto();
  const clave = await subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const bits = await subtle.deriveBits(
    { name: "PBKDF2", salt: sal, iterations: iteraciones, hash: "SHA-256" },
    clave,
    BITS_HASH,
  );
  return new Uint8Array(bits);
}

async function crearVerificador(pin: string): Promise<VerificadorPinFila> {
  const sal = new Uint8Array(BYTES_SAL);
  globalThis.crypto.getRandomValues(sal);
  const hash = await derivarPin(pin, sal, ITERACIONES_PIN);
  return {
    sal: aBase64(sal),
    hash: aBase64(hash),
    iteraciones: ITERACIONES_PIN,
  };
}

async function coincidePin(
  pin: string,
  verificador: VerificadorPinFila,
): Promise<boolean> {
  const sal = desdeBase64(verificador.sal);
  const esperado = desdeBase64(verificador.hash);
  const obtenido = await derivarPin(pin, sal, verificador.iteraciones);
  return igualesEnTiempoConstante(obtenido, esperado);
}

export class SesionRepoDexie implements SesionRepo {
  private readonly base: BaseLocal;

  constructor(base: BaseLocal = baseApp) {
    this.base = base;
  }

  private get db() {
    return this.base.db;
  }

  async guardarSesion(sesion: SesionCuenta, pin: string): Promise<void> {
    const problema = validarPin(pin);
    if (problema) throw new Error(problema);

    const verificadorPin = await crearVerificador(pin);
    await this.db.open();
    const fila: SesionLocalFila = {
      id: ID_ACTUAL,
      sesion,
      verificadorPin,
      bloqueada: false,
      actualizadoEn: Date.now(),
    };
    await this.db.sesion_local.put(fila);
  }

  async sesionActual(): Promise<SesionCuenta | null> {
    await this.db.open();
    const fila = await this.db.sesion_local.get(ID_ACTUAL);
    return fila?.sesion ?? null;
  }

  async estaBloqueada(): Promise<boolean> {
    await this.db.open();
    const fila = await this.db.sesion_local.get(ID_ACTUAL);
    return fila?.bloqueada ?? false;
  }

  async desbloquear(pin: string): Promise<boolean> {
    await this.db.open();
    const fila = await this.db.sesion_local.get(ID_ACTUAL);
    if (!fila) return false;
    if (!(await coincidePin(pin, fila.verificadorPin))) return false;
    await this.db.sesion_local.update(ID_ACTUAL, {
      bloqueada: false,
      actualizadoEn: Date.now(),
    });
    return true;
  }

  async bloquear(): Promise<void> {
    await this.db.open();
    await this.db.sesion_local.update(ID_ACTUAL, {
      bloqueada: true,
      actualizadoEn: Date.now(),
    });
  }

  async cerrarSesion(): Promise<void> {
    await this.db.open();
    const fila = await this.db.sesion_local.get(ID_ACTUAL);
    await this.db.sesion_local.delete(ID_ACTUAL);
    if (!fila?.sesion.token) return;
    // Best-effort: si no hay red, la sesión local ya quedó borrada.
    await salir(fila.sesion.token).catch(() => undefined);
  }
}

/** Repo de sesión sobre IndexedDB (implementación activa de la app). */
export function crearRepoSesionDexie(base: BaseLocal = baseApp): SesionRepo {
  return new SesionRepoDexie(base);
}
