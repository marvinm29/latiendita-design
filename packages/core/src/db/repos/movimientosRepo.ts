/**
 * Repositorio del libro de movimientos (append-only, 003 §4.2).
 *
 * `crearMovimientoConOp` / `registrarEntrada` / `registrarSalida` escriben el
 * movimiento Y la op de la outbox en UNA transacción `rw`; en la misma tx se
 * refresca `stock_cache` (caché de velocidad, C4.3). Si la op no cabe en la
 * outbox (p. ej. `opId` repetido), la escritura entera se revierte.
 */
import { crearMovimiento, type CrearMovimientoInput } from "../../libro";
import type { Movimiento, OpOutbox } from "../../tipos";
import type { LaTienditaDb, MovimientoFila } from "../schema";
import {
  crearOpDe,
  filaDeMovimiento,
  filaDeOp,
  productoActivo,
  refrescarStock,
  rangoCompuesto,
} from "./comun";

export interface MovimientoConOp {
  movimiento: Movimiento;
  op: OpOutbox;
  /** Stock del producto tras aplicar el movimiento (valor del caché). */
  stock: number;
}

export interface MovimientosRepo {
  /** Historial del producto en orden cronológico (`negocioId+productoId+ocurridoAt`). */
  listarPorProducto(productoId: string): Promise<MovimientoFila[]>;
  /** Últimos movimientos del negocio (para la pantalla de inicio). */
  listarRecientes(limite?: number): Promise<MovimientoFila[]>;
  /** Transacción atómica: movimiento + op (mismo `opId`) + caché de stock. */
  crearMovimientoConOp(input: CrearMovimientoInput): Promise<MovimientoConOp>;
  registrarEntrada(input: Omit<CrearMovimientoInput, "tipo">): Promise<MovimientoConOp>;
  registrarSalida(input: Omit<CrearMovimientoInput, "tipo">): Promise<MovimientoConOp>;
}

export function crearMovimientosRepo(db: LaTienditaDb, negocioId: string): MovimientosRepo {
  async function persistir(input: CrearMovimientoInput): Promise<MovimientoConOp> {
    const opId = input.opId ?? crypto.randomUUID();
    const ahora = input.creadoEn ?? Date.now();
    // rw: valida producto (lectura) + inserta libro + outbox + caché — todo junto.
    return db.transaction(
      "rw",
      db.productos,
      db.movimientos,
      db.outbox,
      db.stock_cache,
      async () => {
        await productoActivo(db, negocioId, input.productoId);
        const movimiento = crearMovimiento({ ...input, opId });
        const op = crearOpDe(negocioId, "movimiento", { movimiento }, { ahora, id: opId });
        await db.movimientos.add(filaDeMovimiento(movimiento, negocioId));
        await db.outbox.add(filaDeOp(op, negocioId));
        const stock = await refrescarStock(db, negocioId, movimiento, ahora);
        return { movimiento, op, stock };
      },
    );
  }

  return {
    async listarPorProducto(productoId: string): Promise<MovimientoFila[]> {
      return rangoCompuesto(db.movimientos, "[negocioId+productoId+ocurridoAt]", [
        negocioId,
        productoId,
      ]).toArray();
    },

    async listarRecientes(limite = 20): Promise<MovimientoFila[]> {
      return rangoCompuesto(db.movimientos, "[negocioId+ocurridoAt]", [negocioId])
        .reverse()
        .limit(limite)
        .toArray();
    },

    crearMovimientoConOp: persistir,
    registrarEntrada: (input) => persistir({ ...input, tipo: "entrada" }),
    registrarSalida: (input) => persistir({ ...input, tipo: "salida" }),
  };
}
