/**
 * Servicio de cuentas y acceso (C1 / T-05).
 *
 * Reglas:
 * - La dueña crea el negocio y es quien único puede invitar.
 * - El código de invitación es de un solo uso y expira a los 7 días.
 * - El PIN se guarda con argon2id; el token de sesión, sólo como SHA-256.
 * - Un token de un negocio nunca da acceso a otro: la sesión lleva negocio_id
 *   y todas las respuestas se derivan de esa fila.
 */
import { generarCodigo, normalizarCodigo } from "./codigo";
import { nuevoId } from "./ids";
import { hashearCodigo, hashearPin, hashearToken, nuevoToken } from "./seguridad";
import {
  ErrorAuth,
  ERROR_CODIGO,
  ERROR_SESION,
  validarPin,
  type CrearInvitacionRespuesta,
  type CrearNegocioRespuesta,
  type FilaNegocio,
  type FilaSesion,
  type RepositorioAuth,
  type RenovarSesionRespuesta,
  type Rol,
  type SesionCuenta,
  type UnirseRespuesta,
} from "./tipos";

export const DURACION_SESION_MS = 30 * 24 * 60 * 60 * 1000;
export const DURACION_INVITACION_MS = 7 * 24 * 60 * 60 * 1000;

export interface CrearNegocioInput {
  nombreNegocio: string;
  nombreDueno: string;
  pin: string;
}

export interface UnirseInput {
  codigo: string;
  nombre: string;
  pin: string;
}

export interface OpcionesServicioAuth {
  /** Reloj inyectable para pruebas de expiración. */
  ahora?: () => number;
}

export class ServicioAuth {
  private readonly ahora: () => number;

  constructor(
    private readonly repo: RepositorioAuth,
    opciones: OpcionesServicioAuth = {},
  ) {
    this.ahora = opciones.ahora ?? (() => Date.now());
  }

  async crearNegocio(input: CrearNegocioInput): Promise<CrearNegocioRespuesta> {
    const nombreNegocio = input.nombreNegocio.trim();
    const nombreDueno = input.nombreDueno.trim();
    if (nombreNegocio === "") {
      throw new ErrorAuth(400, "negocio_invalido", "Escribe el nombre del negocio.");
    }
    if (nombreDueno === "") {
      throw new ErrorAuth(400, "nombre_invalido", "Escribe tu nombre.");
    }
    const errorPin = validarPin(input.pin);
    if (errorPin) throw new ErrorAuth(400, "pin_invalido", errorPin);

    const ahora = this.ahora();
    const negocio: FilaNegocio = {
      id: nuevoId(),
      nombre: nombreNegocio,
      moneda: "USD",
      creadoEn: ahora,
    };
    const usuarioId = nuevoId();
    const pinHash = await hashearPin(input.pin);

    await this.repo.crearNegocio({
      negocio,
      usuario: {
        id: usuarioId,
        nombre: nombreDueno,
        pinHash,
        creadoEn: ahora,
      },
      membresia: {
        id: nuevoId(),
        negocioId: negocio.id,
        usuarioId,
        rol: "dueña",
      },
    });

    const sesion = await this.abrirSesion(negocio.id, usuarioId, nombreDueno, "dueña", ahora);
    return {
      negocio: {
        id: negocio.id,
        nombre: negocio.nombre,
        moneda: "USD",
        creadoEn: negocio.creadoEn,
      },
      sesion,
    };
  }

  /** Sólo la dueña invita (C7.1/T-05). Devuelve el código en claro UNA vez. */
  async crearInvitacion(
    negocioId: string,
    usuarioId: string,
    rol: Rol,
  ): Promise<CrearInvitacionRespuesta> {
    if (rol !== "dueña") {
      throw new ErrorAuth(403, "solo_duena", "Sólo la dueña puede invitar.");
    }

    const ahora = this.ahora();
    const codigo = generarCodigo();
    await this.repo.crearInvitacion({
      id: nuevoId(),
      negocioId,
      codigoHash: hashearCodigo(codigo),
      expiraEn: ahora + DURACION_INVITACION_MS,
      usadaEn: null,
      createdBy: usuarioId,
      creadoEn: ahora,
    });

    return { codigo, expiraEn: ahora + DURACION_INVITACION_MS };
  }

  async unirseConCodigo(input: UnirseInput): Promise<UnirseRespuesta> {
    const nombre = input.nombre.trim();
    if (nombre === "") {
      throw new ErrorAuth(400, "nombre_invalido", "Escribe tu nombre.");
    }
    const errorPin = validarPin(input.pin);
    if (errorPin) throw new ErrorAuth(400, "pin_invalido", errorPin);

    const codigo = normalizarCodigo(input.codigo);
    if (!codigo) throw new ErrorAuth(400, "codigo_invalido", ERROR_CODIGO);

    const ahora = this.ahora();
    const invitacion = await this.repo.buscarInvitacionPorCodigo(hashearCodigo(codigo));
    if (!invitacion || invitacion.usadaEn !== null || invitacion.expiraEn <= ahora) {
      // Mismo mensaje para inexistente, usado o vencido: no filtra.
      throw new ErrorAuth(400, "codigo_invalido", ERROR_CODIGO);
    }

    const negocio = await this.repo.buscarNegocio(invitacion.negocioId);
    if (!negocio) throw new ErrorAuth(400, "codigo_invalido", ERROR_CODIGO);

    const usuarioId = nuevoId();
    const token = nuevoToken();
    const sesion: FilaSesion = {
      id: nuevoId(),
      negocioId: negocio.id,
      usuarioId,
      tokenHash: hashearToken(token),
      rol: "empleado",
      expiraEn: ahora + DURACION_SESION_MS,
      revocadaEn: null,
      ultimoUsoEn: null,
      creadoEn: ahora,
    };

    // Canje atómico: si otro request usó el código primero, no se crea nada.
    const canjeado = await this.repo.canjearInvitacion({
      invitacionId: invitacion.id,
      ahora,
      usuario: {
        id: usuarioId,
        nombre,
        pinHash: await hashearPin(input.pin),
        creadoEn: ahora,
      },
      membresia: {
        id: nuevoId(),
        negocioId: negocio.id,
        usuarioId,
        rol: "empleado",
      },
      sesion,
    });
    if (!canjeado) throw new ErrorAuth(400, "codigo_invalido", ERROR_CODIGO);

    return {
      negocio: {
        id: negocio.id,
        nombre: negocio.nombre,
        moneda: "USD",
        creadoEn: negocio.creadoEn,
      },
      sesion: this.cuentaSesion(token, sesion, nombre),
    };
  }

  async autenticarToken(token: string): Promise<SesionCuenta> {
    const { sesion, usuario } = await this.resolver(token);
    await this.repo.marcarUsoSesion(sesion.id, this.ahora());
    return this.cuentaSesion(token, sesion, usuario.nombre);
  }

  /** Rotación: el token anterior queda revocado en el mismo paso. */
  async renovarSesion(token: string): Promise<RenovarSesionRespuesta> {
    const { sesion, usuario } = await this.resolver(token);
    const ahora = this.ahora();
    const tokenNuevo = nuevoToken();
    const nueva: FilaSesion = {
      id: nuevoId(),
      negocioId: sesion.negocioId,
      usuarioId: sesion.usuarioId,
      tokenHash: hashearToken(tokenNuevo),
      rol: sesion.rol,
      expiraEn: ahora + DURACION_SESION_MS,
      revocadaEn: null,
      ultimoUsoEn: null,
      creadoEn: ahora,
    };

    const rotada = await this.repo.rotarSesion(sesion.id, nueva);
    if (!rotada) throw new ErrorAuth(401, "sesion_invalida", ERROR_SESION);

    return { sesion: this.cuentaSesion(tokenNuevo, nueva, usuario.nombre) };
  }

  /** Idempotente: salir dos veces no es un error. */
  async cerrarSesion(token: string): Promise<void> {
    if (token === "") return;
    const sesion = await this.repo.buscarSesionPorToken(hashearToken(token));
    if (!sesion || sesion.revocadaEn !== null) return;
    await this.repo.revocarSesion(sesion.id, this.ahora());
  }

  private async abrirSesion(
    negocioId: string,
    usuarioId: string,
    nombre: string,
    rol: Rol,
    ahora: number,
  ): Promise<SesionCuenta> {
    const token = nuevoToken();
    const sesion: FilaSesion = {
      id: nuevoId(),
      negocioId,
      usuarioId,
      tokenHash: hashearToken(token),
      rol,
      expiraEn: ahora + DURACION_SESION_MS,
      revocadaEn: null,
      ultimoUsoEn: null,
      creadoEn: ahora,
    };
    await this.repo.crearSesion(sesion);
    return this.cuentaSesion(token, sesion, nombre);
  }

  private async resolver(token: string): Promise<{
    sesion: FilaSesion;
    usuario: { id: string; nombre: string };
  }> {
    if (token === "") throw new ErrorAuth(401, "sesion_invalida", ERROR_SESION);
    const sesion = await this.repo.buscarSesionPorToken(hashearToken(token));
    if (!sesion || sesion.revocadaEn !== null || sesion.expiraEn <= this.ahora()) {
      throw new ErrorAuth(401, "sesion_invalida", ERROR_SESION);
    }
    const usuario = await this.repo.buscarUsuario(sesion.usuarioId);
    if (!usuario) throw new ErrorAuth(401, "sesion_invalida", ERROR_SESION);
    return { sesion, usuario };
  }

  private cuentaSesion(token: string, sesion: FilaSesion, nombre: string): SesionCuenta {
    return {
      token,
      negocioId: sesion.negocioId,
      usuarioId: sesion.usuarioId,
      nombre,
      rol: sesion.rol,
      expiraEn: sesion.expiraEn,
    };
  }
}
