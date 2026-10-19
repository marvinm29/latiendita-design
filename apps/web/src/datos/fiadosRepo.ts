import { useCallback, useEffect, useState } from "preact/hooks";
import type { Cliente, Fiado, OrdenLibreta } from "@latiendita/core";
import { crearRepoFiadosDexie } from "./fiadosRepoDexie";

/**
 * Contrato de la libreta de fiados (C6) desde la UI.
 *
 * La implementación activa es `FiadosRepoDexie` sobre IndexedDB vía
 * `baseApp.repos.fiados` (la MISMA base que catálogo, libro y conteo):
 *
 *  - `listarClientesConSaldo` → clientes vivos + saldo derivado del ledger,
 *    ordenados por saldo descendente o antigüedad (C6.3)
 *  - `obtenerCliente`         → cliente + saldo + último movimiento
 *  - `crearClienteConOp`      → alta + op de outbox en la misma transacción
 *  - `crearCargoConOp` / `crearAbonoConOp` → asiento append-only + op
 *  - `listarMovimientos`      → historial completo del cliente (C6.4)
 *  - `suscribir`              → `liveQuery` de Dexie
 *
 * Todo es local: ninguna operación espera red (C8.1). Los montos siempre viajan
 * en centavos enteros; el saldo nunca se escribe, se deriva del ledger.
 */
export interface ClienteLibreta extends Cliente {
  /** Saldo derivado: positivo = debe; negativo = a su favor. */
  saldoCentavos: number;
  /** Epoch ms del último cargo/abono; null = todavía sin movimientos. */
  ultimoMovimientoEn: number | null;
}

export interface NuevoCliente {
  nombre: string;
  telefono?: string | null;
}

export interface MovimientoFiadoInput {
  clienteId: string;
  montoCentavos: number;
  descripcion?: string | null;
  creadoEn?: number;
}

export interface FiadosRepo {
  listarClientesConSaldo(orden?: OrdenLibreta): Promise<ClienteLibreta[]>;
  obtenerCliente(clienteId: string): Promise<ClienteLibreta | null>;
  crearClienteConOp(entrada: NuevoCliente): Promise<Cliente>;
  crearCargoConOp(input: MovimientoFiadoInput): Promise<Fiado>;
  crearAbonoConOp(input: MovimientoFiadoInput): Promise<Fiado>;
  listarMovimientos(clienteId: string): Promise<Fiado[]>;
  /** Todos los asientos del negocio (resúmenes locales). */
  listarTodosLosMovimientos(): Promise<Fiado[]>;
  suscribir(listener: () => void): () => void;
}

/** Instancia única de la app: IndexedDB local, sin red. */
export const repoFiados: FiadosRepo = crearRepoFiadosDexie();

export type EstadoFiados = "cargando" | "listo" | "error";

/**
 * Libreta reactiva (C6.3). `orden` cambia la vista sin perder datos; cualquier
 * alta de cliente o asiento re-emite por `liveQuery`.
 */
export function useLibreta(orden: OrdenLibreta): {
  clientes: ClienteLibreta[];
  estado: EstadoFiados;
  recargar: () => void;
} {
  const [clientes, setClientes] = useState<ClienteLibreta[]>([]);
  const [estado, setEstado] = useState<EstadoFiados>("cargando");
  const [version, setVersion] = useState(0);
  const recargar = useCallback(() => setVersion((n) => n + 1), []);

  useEffect(() => {
    let vivo = true;
    setEstado("cargando");
    repoFiados
      .listarClientesConSaldo(orden)
      .then((lista) => {
        if (!vivo) return;
        setClientes(lista);
        setEstado("listo");
      })
      .catch(() => {
        if (vivo) setEstado("error");
      });
    const unsubscribe = repoFiados.suscribir(recargar);
    return () => {
      vivo = false;
      unsubscribe();
    };
  }, [orden, version, recargar]);

  return { clientes, estado, recargar };
}

/** Detalle reactivo de un cliente: saldo + historial completo (C6.4). */
export function useClienteFiado(clienteId: string | null): {
  cliente: ClienteLibreta | null;
  movimientos: Fiado[];
  estado: EstadoFiados;
  recargar: () => void;
} {
  const [cliente, setCliente] = useState<ClienteLibreta | null>(null);
  const [movimientos, setMovimientos] = useState<Fiado[]>([]);
  const [estado, setEstado] = useState<EstadoFiados>("cargando");
  const [version, setVersion] = useState(0);
  const recargar = useCallback(() => setVersion((n) => n + 1), []);

  useEffect(() => {
    if (clienteId === null) {
      setCliente(null);
      setMovimientos([]);
      setEstado("error");
      return;
    }
    let vivo = true;
    setEstado("cargando");
    Promise.all([
      repoFiados.obtenerCliente(clienteId),
      repoFiados.listarMovimientos(clienteId),
    ])
      .then(([encontrado, historial]) => {
        if (!vivo) return;
        setCliente(encontrado);
        setMovimientos(historial);
        setEstado("listo");
      })
      .catch(() => {
        if (vivo) setEstado("error");
      });
    const unsubscribe = repoFiados.suscribir(recargar);
    return () => {
      vivo = false;
      unsubscribe();
    };
  }, [clienteId, version, recargar]);

  return { cliente, movimientos, estado, recargar };
}
