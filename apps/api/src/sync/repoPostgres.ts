/** Bitácora experimental; sólo materializa movimientos, no habilitar en producción. */
import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import { ErrorSync, type EventoSync, type OperacionSync, type RepositorioSync } from "./servicio";

const movimientoSchema = z.object({
  id: z.string().min(1).max(128),
  productoId: z.string().min(1).max(128),
  tipo: z.enum(["entrada", "salida", "ajuste"]),
  cantidadBase: z.number().finite(),
  costoCentavos: z.number().int().safe().optional(),
  motivo: z.string().optional(),
  corrigeA: z.string().min(1).max(128).optional(),
  creadoEn: z.number().int().safe().nonnegative(),
  opId: z.string().min(1).max(128).optional(),
}).strict().refine((m) => m.tipo === "ajuste" ? m.cantidadBase !== 0 : m.cantidadBase > 0);

interface FilaEvento {
  server_seq: string;
  huella: string;
  operacion: OperacionSync;
}

function evento(fila: FilaEvento): EventoSync {
  const secuencia = Number(fila.server_seq);
  if (!Number.isSafeInteger(secuencia)) throw new Error("Secuencia fuera del rango seguro");
  return { secuencia, operacion: fila.operacion };
}

export class RepositorioBitacoraPostgres implements RepositorioSync {
  constructor(private readonly pool: Pool) {}

  private async transaccion<T>(negocioId: string, ejecutar: (cliente: PoolClient) => Promise<T>): Promise<T> {
    const cliente = await this.pool.connect();
    try {
      await cliente.query("BEGIN");
      await cliente.query("SELECT set_config('app.negocio_id', $1, true)", [negocioId]);
      const resultado = await ejecutar(cliente);
      await cliente.query("COMMIT");
      return resultado;
    } catch (error) {
      await cliente.query("ROLLBACK");
      throw error;
    } finally {
      cliente.release();
    }
  }

  async registrar(negocioId: string, operacion: OperacionSync, huella: string): Promise<EventoSync> {
    return this.transaccion(negocioId, async (cliente) => {
      // Serializa la asignación por negocio hasta el commit; el pull no salta
      // una secuencia aún no confirmada por otra transacción.
      await cliente.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [negocioId]);
      const existente = await cliente.query<FilaEvento>("SELECT server_seq, huella, operacion FROM sync_evento WHERE op_id = $1", [operacion.id]);
      if (existente.rows[0]) {
        if (existente.rows[0].huella !== huella) throw new ErrorSync("op_conflictiva");
        return evento(existente.rows[0]);
      }
      const insertado = await cliente.query<FilaEvento>(
        `INSERT INTO sync_evento (op_id, negocio_id, server_seq, huella, operacion)
         VALUES ($1, $2, (SELECT COALESCE(MAX(server_seq), 0) + 1 FROM sync_evento WHERE negocio_id = $2), $3, $4::jsonb)
         ON CONFLICT (op_id) DO NOTHING RETURNING server_seq, huella, operacion`,
        [operacion.id, negocioId, huella, JSON.stringify(operacion)],
      );
      if (!insertado.rows[0]) throw new ErrorSync("op_conflictiva");
      if (operacion.payload.entidad === "movimiento") {
        const resultado = movimientoSchema.safeParse(operacion.payload.datos.movimiento);
        if (!resultado.success || (resultado.data.opId !== undefined && resultado.data.opId !== operacion.id)) {
          throw new ErrorSync("datos_invalidos");
        }
        const asiento = await cliente.query(
          `INSERT INTO sync_movimiento (negocio_id, id, op_id, datos)
           VALUES ($1, $2, $3, $4::jsonb) ON CONFLICT DO NOTHING RETURNING id`,
          [negocioId, resultado.data.id, operacion.id, JSON.stringify(resultado.data)],
        );
        if (!asiento.rowCount) throw new ErrorSync("op_conflictiva");
      }
      return evento(insertado.rows[0]);
    });
  }

  async leer(negocioId: string, desde: number, limite: number): Promise<EventoSync[]> {
    return this.transaccion(negocioId, async (cliente) => {
      const filas = await cliente.query<FilaEvento>(
        "SELECT server_seq, huella, operacion FROM sync_evento WHERE negocio_id = $1 AND server_seq > $2 ORDER BY server_seq LIMIT $3",
        [negocioId, desde, limite],
      );
      return filas.rows.map(evento);
    });
  }
}
