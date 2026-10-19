/**
 * Contrato de la sesión local (C1 / T-05).
 *
 * La sesión (token opaco incluido) se guarda en IndexedDB — NUNCA en
 * localStorage. Con ella viaja un verificador de PIN (PBKDF2-SHA-256) que
 * permite **desbloquear sin red**. Al abrir la app, si hay sesión se muestra
 * el PIN; tras crear la tienda o unirse, la sesión queda desbloqueada.
 */
import type { SesionCuenta } from "@latiendita/core";
import { crearRepoSesionDexie } from "./sesionRepoDexie";

export interface SesionRepo {
  /** Guarda la sesión recién emitida + el verificador de su PIN (desbloqueada). */
  guardarSesion(sesion: SesionCuenta, pin: string): Promise<void>;
  /** Sesión guardada en este dispositivo (o null si no hay). */
  sesionActual(): Promise<SesionCuenta | null>;
  /** ¿La app debe pedir el PIN antes de entrar? */
  estaBloqueada(): Promise<boolean>;
  /** Comprueba el PIN localmente. `true` si coincide (y desbloquea). */
  desbloquear(pin: string): Promise<boolean>;
  /** Bloquea la sesión (p. ej. al abrir/reanudar la app). */
  bloquear(): Promise<void>;
  /** Borra la sesión local e intenta avisar al servidor (best-effort). */
  cerrarSesion(): Promise<void>;
}

/** Implementación activa: IndexedDB (Dexie) sobre la base compartida. */
export const repoSesion: SesionRepo = crearRepoSesionDexie();
