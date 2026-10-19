/**
 * Cliente de la API de acceso (C1 / T-05).
 *
 * - Sólo crear tienda y unirse REQUIEREN internet; el resto de la app sigue
 *   funcionando offline con la sesión guardada.
 * - La base sale de `VITE_API_URL` (vacío en dev: Vite proxya `/auth` a la API,
 *   igual que `/off`). Nunca hay claves ni secretos en el cliente.
 * - Los mensajes de error están en español y se muestran tal cual en la UI.
 */
import {
  RUTAS_AUTH,
  type CrearNegocioInput,
  type CrearNegocioRespuesta,
  type UnirseInput,
  type UnirseRespuesta,
} from "@latiendita/core";

/** Error de acceso con un mensaje listo para mostrar a la persona. */
export class ErrorAuth extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorAuth";
  }
}

/** Sin red (o la API no responde): crear/unirse son las únicas acciones que la necesitan. */
export const MENSAJE_SIN_RED =
  "Necesitas internet para crear la tienda o unirte";

const BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

function urlDe(ruta: string): string {
  return `${BASE}${ruta}`;
}

interface CuerpoError {
  error?: unknown;
  mensaje?: unknown;
  message?: unknown;
}

/** Mensaje del servidor si es texto; si no, el respaldo por código HTTP. */
function mensajeDelServidor(cuerpo: CuerpoError | null): string | null {
  for (const clave of ["mensaje", "error", "message"] as const) {
    const valor = cuerpo?.[clave];
    if (typeof valor === "string" && valor.trim() !== "") return valor;
  }
  return null;
}

function mensajePorEstado(estado: number, cuerpo: CuerpoError | null): string {
  const delServidor = mensajeDelServidor(cuerpo);
  if (delServidor) return delServidor;
  if (estado === 400) return "Revisa los datos e intenta de nuevo.";
  if (estado === 401 || estado === 403) return "El código o el PIN no son correctos.";
  if (estado === 404) return "El código de invitación no existe o ya venció.";
  if (estado === 409) return "Ese código ya se usó. Pide uno nuevo.";
  if (estado === 429) return "Demasiados intentos. Espera un momento e intenta de nuevo.";
  if (estado >= 500) return "La tienda no está disponible ahora. Intenta de nuevo en un momento.";
  return "No pudimos completar la operación. Intenta de nuevo.";
}

async function leerCuerpo(respuesta: Response): Promise<CuerpoError | null> {
  try {
    const cuerpo: unknown = await respuesta.json();
    return typeof cuerpo === "object" && cuerpo !== null ? (cuerpo as CuerpoError) : null;
  } catch {
    return null;
  }
}

async function pedir<T>(ruta: string, cuerpo: unknown, token?: string): Promise<T> {
  const cabeceras: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (token) cabeceras["Authorization"] = `Bearer ${token}`;

  let respuesta: Response;
  try {
    respuesta = await fetch(urlDe(ruta), {
      method: "POST",
      headers: cabeceras,
      body: JSON.stringify(cuerpo),
    });
  } catch {
    // `fetch` sólo rechaza por red/CORS/URL: es el caso "sin conexión".
    throw new ErrorAuth(MENSAJE_SIN_RED);
  }

  if (!respuesta.ok) {
    throw new ErrorAuth(mensajePorEstado(respuesta.status, await leerCuerpo(respuesta)));
  }

  const texto = await respuesta.text().catch(() => "");
  if (texto.trim() === "") return undefined as T;
  try {
    return JSON.parse(texto) as T;
  } catch {
    throw new ErrorAuth("La respuesta de la tienda no se entendió. Intenta de nuevo.");
  }
}

/** C1.1 · crea el negocio y devuelve la sesión inicial (requiere internet). */
export function crearNegocio(input: CrearNegocioInput): Promise<CrearNegocioRespuesta> {
  return pedir<CrearNegocioRespuesta>(RUTAS_AUTH.negocio, input);
}

/** C1.2 · se une con un código de un solo uso (requiere internet). */
export function unirse(input: UnirseInput): Promise<UnirseRespuesta> {
  return pedir<UnirseRespuesta>(RUTAS_AUTH.unirse, input);
}

/** Cierra la sesión en el servidor. El llamador decide si es best-effort. */
export function salir(token: string): Promise<void> {
  return pedir<void>(RUTAS_AUTH.salir, {}, token);
}

/** Mensaje legible para cualquier fallo de la capa de acceso. */
export function mensajeDeError(error: unknown): string {
  if (error instanceof ErrorAuth) return error.message;
  // Fallo local (IndexedDB/Web Crypto): no es falta de red, no lo disfraces.
  return "No pudimos guardar la sesión en este teléfono. Intenta de nuevo.";
}
