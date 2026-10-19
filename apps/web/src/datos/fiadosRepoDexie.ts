/**
 * Implementación de `FiadosRepo` sobre la capa Dexie de @latiendita/core.
 *
 * La libreta comparte la MISMA base que el catálogo y el libro (baseLocal.ts):
 * un cliente o un cargo/abono se escribe con su op de outbox en la misma
 * transacción (003 §3). El saldo nunca se guarda: `repos.fiados` lo deriva del
 * ledger con `saldoCliente` (C6.3).
 *
 * Arranque perezoso compartido (`asegurarBaseLista`): abre IndexedDB y siembra
 * la demo una sola vez. Nada aquí depende de red (C8.1).
 */
import { liveQuery } from "dexie";
import type {
  Cliente,
  ClienteConSaldo,
  Fiado,
  FiadoFila,
  OrdenLibreta,
} from "@latiendita/core";
import { asegurarBaseLista, baseApp, type BaseLocal } from "./baseLocal";
import type {
  ClienteLibreta,
  FiadosRepo,
  MovimientoFiadoInput,
  NuevoCliente,
} from "./fiadosRepo";

/** Quita los campos de sync: la UI sólo conoce el `Fiado` puro. */
function filaAFiado(fila: FiadoFila): Fiado {
  return {
    id: fila.id,
    clienteId: fila.clienteId,
    tipo: fila.tipo,
    montoCentavos: fila.montoCentavos,
    descripcion: fila.descripcion,
    creadoEn: fila.creadoEn,
    ...(fila.opId !== undefined ? { opId: fila.opId } : {}),
  };
}

function aClienteLibreta(fila: ClienteConSaldo | null): ClienteLibreta | null {
  if (!fila) return null;
  return {
    id: fila.id,
    nombre: fila.nombre,
    telefono: fila.telefono,
    limiteCentavos: fila.limiteCentavos,
    activo: fila.activo,
    saldoCentavos: fila.saldoCentavos,
    ultimoMovimientoEn: fila.ultimoMovimientoEn,
  };
}

export class FiadosRepoDexie implements FiadosRepo {
  private readonly base: BaseLocal;

  constructor(base: BaseLocal = baseApp) {
    this.base = base;
  }

  private get listo(): Promise<void> {
    return asegurarBaseLista(this.base);
  }

  async listarClientesConSaldo(orden: OrdenLibreta = "saldo"): Promise<ClienteLibreta[]> {
    await this.listo;
    const filas = await this.base.repos.fiados.listarClientes(orden);
    return filas.map((fila) => ({
      id: fila.id,
      nombre: fila.nombre,
      telefono: fila.telefono,
      limiteCentavos: fila.limiteCentavos,
      activo: fila.activo,
      saldoCentavos: fila.saldoCentavos,
      ultimoMovimientoEn: fila.ultimoMovimientoEn,
    }));
  }

  async obtenerCliente(clienteId: string): Promise<ClienteLibreta | null> {
    await this.listo;
    return aClienteLibreta(await this.base.repos.fiados.obtenerCliente(clienteId));
  }

  /** Alta de cliente + op de sync en una sola transacción (core). */
  async crearClienteConOp(entrada: NuevoCliente): Promise<Cliente> {
    await this.listo;
    const nombre = entrada.nombre.trim();
    if (nombre === "") throw new Error("nombre es obligatorio");
    const telefono = entrada.telefono?.trim() ?? "";
    const fila = await this.base.repos.fiados.crearCliente({
      nombre,
      telefono: telefono === "" ? null : telefono,
    });
    return {
      id: fila.id,
      nombre: fila.nombre,
      telefono: fila.telefono,
      limiteCentavos: fila.limiteCentavos,
      activo: fila.activo,
    };
  }

  async crearCargoConOp(input: MovimientoFiadoInput): Promise<Fiado> {
    await this.listo;
    const { fiado } = await this.base.repos.fiados.crearCargoConOp(input);
    return fiado;
  }

  async crearAbonoConOp(input: MovimientoFiadoInput): Promise<Fiado> {
    await this.listo;
    const { fiado } = await this.base.repos.fiados.crearAbonoConOp(input);
    return fiado;
  }

  async listarMovimientos(clienteId: string): Promise<Fiado[]> {
    await this.listo;
    const filas = await this.base.repos.fiados.historialPorCliente(clienteId);
    return filas.map(filaAFiado);
  }

  async listarTodosLosMovimientos(): Promise<Fiado[]> {
    await this.listo;
    const filas = await this.base.repos.fiados.listarFiados();
    return filas.sort((a, b) => a.creadoEn - b.creadoEn).map(filaAFiado);
  }

  suscribir(listener: () => void): () => void {
    // liveQuery emite el valor inicial al suscribirse: se ignora para no
    // realimentar el `recargar` del hook (bucle effect↔suscripción).
    let primera = true;
    const subcripcion = liveQuery(() =>
      Promise.all([
        this.base.db.clientes.where("negocioId").equals(this.base.negocioId).toArray(),
        this.base.db.fiados.where("negocioId").equals(this.base.negocioId).toArray(),
      ]).then(([clientes, fiados]) => {
        // Firma barata y estable: cambia con altas, ediciones y asientos.
        const clientesFirma = clientes
          .map((c) => `${c.id}:${c.updatedAt}:${c.deletedAt ?? ""}`)
          .join(",");
        return `${clientesFirma}|${fiados.length}|${fiados.map((f) => f.id).join(",")}`;
      }),
    ).subscribe({
      next: () => {
        if (primera) {
          primera = false;
          return;
        }
        listener();
      },
      // El error real lo reporta cada lectura vía el estado "error" de la UI.
      error: () => undefined,
    });
    return () => subcripcion.unsubscribe();
  }
}

/** Repo de la libreta sobre IndexedDB (implementación activa de la app). */
export function crearRepoFiadosDexie(base: BaseLocal = baseApp): FiadosRepo {
  return new FiadosRepoDexie(base);
}
