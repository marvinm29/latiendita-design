/** Adaptador HTTP experimental; requiere repositorio inyectado, no se registra en producción. */
import type { FastifyInstance, FastifyReply } from "fastify";
import { leerToken } from "../auth/plugin";
import type { ServicioAuth } from "../auth/servicio";
import { ErrorAuth } from "../auth/tipos";
import { ErrorSync, ServicioSync, type RepositorioSync } from "./servicio";

export interface OpcionesSync {
  auth: ServicioAuth;
  repositorio: RepositorioSync;
}

function responderError(respuesta: FastifyReply, error: unknown): FastifyReply {
  if (error instanceof ErrorAuth) return respuesta.code(error.estado).send({ codigo: error.codigo, error: error.message });
  if (error instanceof ErrorSync) {
    const estado = error.codigo === "op_conflictiva" ? 409 : error.codigo === "negocio_invalido" ? 403 : 400;
    return respuesta.code(estado).send({ codigo: error.codigo, error: "No pudimos procesar la sincronización." });
  }
  throw error;
}

/** El repositorio de memoria es solo para pruebas; falta materialización y PostgreSQL. */
export function registrarSyncExperimental(app: FastifyInstance, opciones: OpcionesSync): void {
  const sync = new ServicioSync(opciones.repositorio);
  app.post("/sync/push", async (peticion, respuesta) => {
    try {
      const sesion = await opciones.auth.autenticarToken(leerToken(peticion.headers.authorization));
      const cuerpo = peticion.body as { operaciones?: unknown } | null;
      const resultados = await sync.recibir(sesion, cuerpo?.operaciones);
      return respuesta.send({ resultados });
    } catch (error) {
      return responderError(respuesta, error);
    }
  });

  app.get("/sync/pull", async (peticion, respuesta) => {
    try {
      const sesion = await opciones.auth.autenticarToken(leerToken(peticion.headers.authorization));
      const query = peticion.query as { since?: unknown; limit?: unknown };
      const desde = query.since === undefined ? "0" : query.since;
      const limite = query.limit === undefined ? "100" : query.limit;
      if (typeof desde !== "string" || !/^\d+$/.test(desde) || typeof limite !== "string" || !/^\d+$/.test(limite)) {
        throw new ErrorSync("datos_invalidos");
      }
      const eventos = await sync.consultar(sesion, Number(desde), Number(limite));
      return respuesta.send({ eventos });
    } catch (error) {
      return responderError(respuesta, error);
    }
  });
}
