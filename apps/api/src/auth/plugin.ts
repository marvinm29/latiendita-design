/**
 * Rutas de cuentas y acceso (T-05) — prefijo `/auth`.
 *
 * Errores en español y sin filtrar si un código existe: el canje fallido
 * siempre responde el mismo mensaje. El límite de intentos es en memoria
 * (5 por IP y 5 por código cada 10 minutos) y se aplica a `/auth/unirse`.
 */
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { getDb } from "../db/client";
import { normalizarCodigo } from "./codigo";
import { LimitadorIntentos } from "./limitador";
import { RepositorioAuthPostgres } from "./repoPostgres";
import { ServicioAuth } from "./servicio";
import type { UnirseInput } from "./servicio";
import { ErrorAuth, type SesionCuenta } from "./tipos";

const pinSchema = z
  .string({ required_error: "El PIN debe tener entre 4 y 8 números." })
  .regex(/^\d{4,8}$/, "El PIN debe tener entre 4 y 8 números.");

const negocioSchema = z.object({
  nombreNegocio: z
    .string({ required_error: "Escribe el nombre del negocio." })
    .trim()
    .min(1, "Escribe el nombre del negocio.")
    .max(80, "El nombre del negocio es muy largo."),
  nombreDueno: z
    .string({ required_error: "Escribe tu nombre." })
    .trim()
    .min(1, "Escribe tu nombre.")
    .max(80, "El nombre es muy largo."),
  pin: pinSchema,
});

const unirseSchema = z.object({
  codigo: z
    .string({ required_error: "Escribe el código de invitación." })
    .trim()
    .min(1, "Escribe el código de invitación."),
  nombre: z
    .string({ required_error: "Escribe tu nombre." })
    .trim()
    .min(1, "Escribe tu nombre.")
    .max(80, "El nombre es muy largo."),
  pin: pinSchema,
});

export interface OpcionesAuth {
  /** Inyectable en pruebas (implementación memoria). */
  servicio?: ServicioAuth;
  limitador?: LimitadorIntentos;
}

interface ErrorRespuesta {
  error: string;
  codigo: string;
}

function responderError(respuesta: FastifyReply, error: unknown): FastifyReply {
  if (error instanceof ErrorAuth) {
    return respuesta.code(error.estado).send({ error: error.message, codigo: error.codigo });
  }
  throw error;
}

function leerToken(cabecera: string | undefined): string {
  if (!cabecera) throw new ErrorAuth(401, "sesion_invalida", "Tu sesión venció. Vuelve a entrar.");
  const [tipo, token] = cabecera.split(" ");
  if (tipo?.toLowerCase() !== "bearer" || !token) {
    throw new ErrorAuth(401, "sesion_invalida", "Tu sesión venció. Vuelve a entrar.");
  }
  return token;
}

function datosInvalidos(respuesta: FastifyReply, error: z.ZodError): FastifyReply {
  const mensaje = error.issues[0]?.message ?? "Revisa los datos e intenta de nuevo.";
  return respuesta.code(400).send({ error: mensaje, codigo: "datos_invalidos" } satisfies ErrorRespuesta);
}

export function registrarAuth(app: FastifyInstance, opciones: OpcionesAuth = {}): void {
  const limitador = opciones.limitador ?? new LimitadorIntentos();

  // Perezoso: construir el plugin no abre conexiones (health y OFF no tocan DB).
  let servicio = opciones.servicio;
  const obtenerServicio = (): ServicioAuth => {
    servicio ??= new ServicioAuth(new RepositorioAuthPostgres(getDb()));
    return servicio;
  };

  app.post("/auth/negocio", async (peticion, respuesta) => {
    const datos = negocioSchema.safeParse(peticion.body);
    if (!datos.success) return datosInvalidos(respuesta, datos.error);

    try {
      const resultado = await obtenerServicio().crearNegocio(datos.data);
      return respuesta.code(201).send(resultado);
    } catch (error) {
      return responderError(respuesta, error);
    }
  });

  app.post("/auth/invitacion", async (peticion, respuesta) => {
    try {
      const sesion = await obtenerServicio().autenticarToken(
        leerToken(peticion.headers.authorization),
      );
      const resultado = await obtenerServicio().crearInvitacion(
        sesion.negocioId,
        sesion.usuarioId,
        sesion.rol,
      );
      return respuesta.code(201).send(resultado);
    } catch (error) {
      return responderError(respuesta, error);
    }
  });

  app.post("/auth/unirse", async (peticion, respuesta) => {
    const datos = unirseSchema.safeParse(peticion.body);
    if (!datos.success) return datosInvalidos(respuesta, datos.error);

    const cuerpo: UnirseInput = datos.data;
    const codigo = normalizarCodigo(cuerpo.codigo) ?? cuerpo.codigo.trim().toUpperCase();
    const claveIp = `ip:${peticion.ip}`;
    const claveCodigo = `codigo:${codigo}`;

    if (!limitador.permitir(claveIp) || !limitador.permitir(claveCodigo)) {
      return respuesta.code(429).send({
        error: "Demasiados intentos. Espera unos minutos e intenta de nuevo.",
        codigo: "demasiados_intentos",
      } satisfies ErrorRespuesta);
    }

    try {
      const resultado = await obtenerServicio().unirseConCodigo(cuerpo);
      limitador.limpiar(claveCodigo);
      return respuesta.code(201).send(resultado);
    } catch (error) {
      // Sólo los fallos de credenciales/código cuentan para el límite.
      if (error instanceof ErrorAuth && error.estado === 400) {
        limitador.registrarFallo(claveIp);
        limitador.registrarFallo(claveCodigo);
      }
      return responderError(respuesta, error);
    }
  });

  app.get("/auth/yo", async (peticion, respuesta) => {
    try {
      const sesion = await obtenerServicio().autenticarToken(
        leerToken(peticion.headers.authorization),
      );
      return respuesta.send({ sesion } satisfies { sesion: SesionCuenta });
    } catch (error) {
      return responderError(respuesta, error);
    }
  });

  app.post("/auth/renovar", async (peticion, respuesta) => {
    try {
      const resultado = await obtenerServicio().renovarSesion(
        leerToken(peticion.headers.authorization),
      );
      return respuesta.send(resultado);
    } catch (error) {
      return responderError(respuesta, error);
    }
  });

  app.post("/auth/salir", async (peticion, respuesta) => {
    try {
      await obtenerServicio().cerrarSesion(leerToken(peticion.headers.authorization));
      return respuesta.send({ ok: true });
    } catch (error) {
      return responderError(respuesta, error);
    }
  });
}
