/**
 * Contrato de cuentas y acceso (C1 / T-05) — compartido API ↔ web.
 *
 * La dueña crea el negocio con su PIN; invita con un código de un solo uso
 * (base32, 8 caracteres, expira) y el empleado se une con código + PIN.
 * El servidor emite una sesión opaca; el cliente la guarda en IndexedDB y
 * desbloquea sin red con un verificador de PIN local.
 */
import type { Rol } from "./tipos";

export interface NegocioCuenta {
  id: string;
  nombre: string;
  moneda: "USD";
  creadoEn: number;
}

export interface SesionCuenta {
  /** Token opaco (nunca se guarda en claro en el servidor). */
  token: string;
  negocioId: string;
  usuarioId: string;
  nombre: string;
  rol: Rol;
  /** Epoch ms en que expira la sesión. */
  expiraEn: number;
}

export interface CrearNegocioInput {
  nombreNegocio: string;
  nombreDueno: string;
  pin: string;
}

export interface CrearNegocioRespuesta {
  negocio: NegocioCuenta;
  sesion: SesionCuenta;
}

export interface CrearInvitacionRespuesta {
  /** Código en claro: se muestra UNA vez; el servidor sólo guarda su hash. */
  codigo: string;
  expiraEn: number;
}

export interface UnirseInput {
  codigo: string;
  nombre: string;
  pin: string;
}

export interface UnirseRespuesta {
  negocio: NegocioCuenta;
  sesion: SesionCuenta;
}

export interface RenovarSesionRespuesta {
  sesion: SesionCuenta;
}

/** Rutas de la API de acceso (T-05). */
export const RUTAS_AUTH = {
  negocio: "/auth/negocio",
  invitacion: "/auth/invitacion",
  unirse: "/auth/unirse",
  yo: "/auth/yo",
  renovar: "/auth/renovar",
  salir: "/auth/salir",
} as const;

/** PIN: 4–8 dígitos, sin espacios (lenguaje llano para Marta y José). */
export const PIN_MIN = 4;
export const PIN_MAX = 8;

export function validarPin(pin: string): string | null {
  if (!/^\d{4,8}$/.test(pin)) return "El PIN debe tener entre 4 y 8 números.";
  const n = Number(pin);
  if (!Number.isInteger(n)) return "El PIN debe tener sólo números.";
  return null;
}
