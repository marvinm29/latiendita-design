/**
 * Repositorio de la libreta de fiados (cliente + ledger de cargos/abonos).
 *
 * El saldo NO se almacena: se deriva con `saldoCliente` (C4.3). Cargo y abono
 * se insertan en el ledger con su op de sync en la MISMA transacción `rw`.
 * El límite de fiado (P5) queda reservado: aquí no se valida.
 */
import {
  registrarAbono,
  registrarCargo,
  saldoCliente,
  type RegistrarFiadoInput,
} from "../../fiados";
import type { Fiado, OpOutbox } from "../../tipos";
import type { ClienteFila, FiadoFila, LaTienditaDb } from "../schema";
import { crearOpDe, filaDeOp, rangoCompuesto } from "./comun";

export interface ClienteNuevo {
  nombre: string;
  telefono?: string | null;
  /** Límite en centavos; null/ausente = sin límite. */
  limiteCentavos?: number | null;
  /** Sólo para tests/fixtures; en producción se genera con randomUUID. */
  id?: string;
}

export interface ClienteConSaldo extends ClienteFila {
  /** Saldo derivado del ledger: positivo = debe. */
  saldoCentavos: number;
}

export interface FiadoConOp {
  fiado: Fiado;
  op: OpOutbox;
}

export interface FiadosRepo {
  /** Clientes vivos con su saldo derivado del ledger. */
  listarClientes(): Promise<ClienteConSaldo[]>;
  crearCliente(entrada: ClienteNuevo): Promise<ClienteFila>;
  crearCargoConOp(input: Omit<RegistrarFiadoInput, "opId">): Promise<FiadoConOp>;
  crearAbonoConOp(input: Omit<RegistrarFiadoInput, "opId">): Promise<FiadoConOp>;
  /** Ledger del cliente en orden cronológico (índice `negocioId+clienteId+creadoEn`). */
  historialPorCliente(clienteId: string): Promise<FiadoFila[]>;
}

export function crearFiadosRepo(db: LaTienditaDb, negocioId: string): FiadosRepo {
  async function registrar(
    tipo: "cargo" | "abono",
    input: Omit<RegistrarFiadoInput, "opId">,
  ): Promise<FiadoConOp> {
    const opId = crypto.randomUUID();
    const ahora = input.creadoEn ?? Date.now();
    return db.transaction("rw", db.clientes, db.fiados, db.outbox, async () => {
      const cliente = await db.clientes.get(input.clienteId);
      if (!cliente || cliente.negocioId !== negocioId || cliente.deletedAt !== null) {
        throw new Error(`cliente no encontrado: ${input.clienteId}`);
      }
      const fiado =
        tipo === "cargo" ? registrarCargo({ ...input, opId }) : registrarAbono({ ...input, opId });
      const op = crearOpDe(negocioId, "fiado", { fiado }, { ahora, id: opId });
      await db.fiados.add({ ...fiado, negocioId, serverSeq: null });
      await db.outbox.add(filaDeOp(op, negocioId));
      return { fiado, op };
    });
  }

  return {
    async listarClientes(): Promise<ClienteConSaldo[]> {
      const [clientes, fiados] = await Promise.all([
        db.clientes.where("negocioId").equals(negocioId).toArray(),
        db.fiados.where("negocioId").equals(negocioId).toArray(),
      ]);
      return clientes
        .filter((c) => c.deletedAt === null)
        .map((c) => ({ ...c, saldoCentavos: saldoCliente(fiados, c.id) }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    },

    async crearCliente(entrada: ClienteNuevo): Promise<ClienteFila> {
      if (!entrada.nombre.trim()) throw new Error("nombre es obligatorio");
      if (
        entrada.limiteCentavos !== null &&
        entrada.limiteCentavos !== undefined &&
        (!Number.isInteger(entrada.limiteCentavos) || entrada.limiteCentavos < 0)
      ) {
        throw new Error(`limiteCentavos debe ser entero >= 0, recibido: ${entrada.limiteCentavos}`);
      }
      const ahora = Date.now();
      const cliente: ClienteFila = {
        id: entrada.id ?? crypto.randomUUID(),
        nombre: entrada.nombre,
        telefono: entrada.telefono ?? null,
        limiteCentavos: entrada.limiteCentavos ?? null,
        activo: true,
        negocioId,
        updatedAt: ahora,
        deletedAt: null,
        serverSeq: null,
        rev: 0,
      };
      await db.transaction("rw", db.clientes, db.outbox, async () => {
        await db.clientes.add(cliente);
        const op = crearOpDe(negocioId, "cliente", { alta: cliente }, { ahora });
        await db.outbox.add(filaDeOp(op, negocioId));
      });
      return cliente;
    },

    crearCargoConOp: (input) => registrar("cargo", input),
    crearAbonoConOp: (input) => registrar("abono", input),

    async historialPorCliente(clienteId: string): Promise<FiadoFila[]> {
      return rangoCompuesto(db.fiados, "[negocioId+clienteId+creadoEn]", [
        negocioId,
        clienteId,
      ]).toArray();
    },
  };
}
