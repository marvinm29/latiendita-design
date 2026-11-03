/** Contrato interno de recepción de operaciones. No registra rutas HTTP. */
import { createHash } from "node:crypto";
import { z } from "zod";
import type { SesionCuenta } from "../auth/tipos";

const operacionSchema = z.object({
  id: z.string().min(1).max(128),
  endpoint: z.literal("/sync/push"),
  payload: z.object({
    negocioId: z.string().min(1).max(128),
    entidad: z.enum(["producto", "unidad_venta", "movimiento", "cliente", "fiado", "categoria", "conteo"]),
    datos: z.record(z.unknown()),
  }).strict(),
}).strict();

export type OperacionSync = z.infer<typeof operacionSchema>;

export interface EventoSync {
  secuencia: number;
  operacion: OperacionSync;
}

/** La implementación debe registrar la op y su efecto de manera atómica. */
export interface RepositorioSync {
  registrar(negocioId: string, operacion: OperacionSync, huella: string): Promise<EventoSync>;
  leer(negocioId: string, desde: number, limite: number): Promise<EventoSync[]>;
}

export class ErrorSync extends Error {
  constructor(public readonly codigo: "datos_invalidos" | "negocio_invalido" | "op_conflictiva") {
    super(codigo);
  }
}

function huellaDe(op: OperacionSync): string {
  const json = JSON.stringify(op, (_clave: string, valor: unknown) => {
    if (!valor || typeof valor !== "object" || Array.isArray(valor)) return valor;
    return Object.fromEntries(Object.entries(valor).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
  });
  return createHash("sha256").update(json).digest("hex");
}

/** Comprueba todo el lote antes de escribir; la identidad procede de la sesión autenticada. */
export class ServicioSync {
  constructor(private readonly repositorio: RepositorioSync) {}

  async recibir(sesion: SesionCuenta, lote: unknown): Promise<EventoSync[]> {
    const validacion = z.array(operacionSchema).min(1).max(100).safeParse(lote);
    if (!validacion.success) throw new ErrorSync("datos_invalidos");
    if (validacion.data.some((op) => op.payload.negocioId !== sesion.negocioId)) {
      throw new ErrorSync("negocio_invalido");
    }
    const eventos: EventoSync[] = [];
    for (const op of validacion.data) {
      eventos.push(await this.repositorio.registrar(sesion.negocioId, op, huellaDe(op)));
    }
    return eventos;
  }

  async consultar(sesion: SesionCuenta, desde: number, limite = 100): Promise<EventoSync[]> {
    if (!Number.isSafeInteger(desde) || desde < 0 || !Number.isSafeInteger(limite) || limite < 1 || limite > 100) {
      throw new ErrorSync("datos_invalidos");
    }
    return this.repositorio.leer(sesion.negocioId, desde, limite);
  }
}
