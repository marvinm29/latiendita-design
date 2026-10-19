/**
 * Contrato interno de cuentas y acceso (C1 / T-05).
 *
 * Espejo de `packages/core/src/auth.ts` (contrato compartido con la web). La
 * API no importa `@latiendita/core` para no arrastrar Dexie al servidor; los
 * tipos de respuesta son estructuralmente iguales.
 */

export type Rol = "dueña" | "empleado";

export interface NegocioCuenta {
  id: string;
  nombre: string;
  moneda: "USD";
  creadoEn: number;
}

export interface SesionCuenta {
  token: string;
  negocioId: string;
  usuarioId: string;
  nombre: string;
  rol: Rol;
  expiraEn: number;
}

export interface CrearNegocioRespuesta {
  negocio: NegocioCuenta;
  sesion: SesionCuenta;
}

export interface CrearInvitacionRespuesta {
  codigo: string;
  expiraEn: number;
}

export interface UnirseRespuesta {
  negocio: NegocioCuenta;
  sesion: SesionCuenta;
}

export interface RenovarSesionRespuesta {
  sesion: SesionCuenta;
}

/* -------------------------------------------------------------------------- */
/* Filas del repositorio (fechas en epoch ms para no filtrar `Date` al dominio) */
/* -------------------------------------------------------------------------- */

export interface FilaNegocio {
  id: string;
  nombre: string;
  moneda: string;
  creadoEn: number;
}

export interface FilaUsuario {
  id: string;
  nombre: string;
  pinHash: string;
  creadoEn: number;
}

export interface FilaMembresia {
  id: string;
  negocioId: string;
  usuarioId: string;
  rol: Rol;
}

export interface FilaInvitacion {
  id: string;
  negocioId: string;
  codigoHash: string;
  expiraEn: number;
  usadaEn: number | null;
  createdBy: string;
  creadoEn: number;
}

export interface FilaSesion {
  id: string;
  negocioId: string;
  usuarioId: string;
  tokenHash: string;
  rol: Rol;
  expiraEn: number;
  revocadaEn: number | null;
  ultimoUsoEn: number | null;
  creadoEn: number;
}

export interface NuevoNegocio {
  negocio: FilaNegocio;
  usuario: FilaUsuario;
  membresia: FilaMembresia;
}

export interface CanjeInvitacion {
  invitacionId: string;
  ahora: number;
  usuario: FilaUsuario;
  membresia: FilaMembresia;
  sesion: FilaSesion;
}

/**
 * Puerto de persistencia. Hay dos adaptadores: `memoria` (tests y desarrollo)
 * y `postgres` (drizzle). El servicio de auth no conoce SQL.
 */
export interface RepositorioAuth {
  crearNegocio(datos: NuevoNegocio): Promise<void>;
  buscarNegocio(id: string): Promise<FilaNegocio | null>;

  crearInvitacion(invitacion: FilaInvitacion): Promise<void>;
  buscarInvitacionPorCodigo(codigoHash: string): Promise<FilaInvitacion | null>;
  /**
   * Canje atómico: marca la invitación como usada (sólo si sigue sin usar),
   * crea el usuario + membresía y abre la sesión. Devuelve `false` si otro
   * request ganó la carrera o la invitación ya estaba usada.
   */
  canjearInvitacion(datos: CanjeInvitacion): Promise<boolean>;

  buscarUsuario(id: string): Promise<FilaUsuario | null>;

  crearSesion(sesion: FilaSesion): Promise<void>;
  buscarSesionPorToken(tokenHash: string): Promise<FilaSesion | null>;
  /** Rotación atómica: revoca la anterior y crea la nueva. */
  rotarSesion(idAnterior: string, nueva: FilaSesion): Promise<boolean>;
  marcarUsoSesion(id: string, ahora: number): Promise<void>;
  revocarSesion(id: string, ahora: number): Promise<void>;
}

/* -------------------------------------------------------------------------- */
/* Errores                                                                     */
/* -------------------------------------------------------------------------- */

/** Error de negocio con estado HTTP y mensaje en español para la persona. */
export class ErrorAuth extends Error {
  constructor(
    public readonly estado: number,
    public readonly codigo: string,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = "ErrorAuth";
  }
}

/** Mensaje único para código inexistente, vencido o ya usado (no filtra). */
export const ERROR_CODIGO = "El código no es válido o ya venció.";
export const ERROR_SESION = "Tu sesión venció. Vuelve a entrar.";
export const ERROR_PIN = "El PIN debe tener entre 4 y 8 números.";

export function validarPin(pin: string): string | null {
  if (!/^\d{4,8}$/.test(pin)) return ERROR_PIN;
  return null;
}
