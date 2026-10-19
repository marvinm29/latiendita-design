import type { Fiado, TipoFiado } from "./tipos";

/**
 * Formatea centavos enteros como USD con Intl (en-US).
 * `formatearUsd(500)` → `"$5.00"`.
 */
export function formatearUsd(centavos: number): string {
  if (!Number.isFinite(centavos)) throw new Error(`centavos no finitos: ${centavos}`);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(centavos / 100);
}

/** Saldo en centavos: positivo = el cliente debe; negativo = a su favor. */
export function saldoCliente(fiados: readonly Fiado[], clienteId: string): number {
  let saldo = 0;
  for (const f of fiados) {
    if (f.clienteId !== clienteId) continue;
    if (f.tipo === "cargo") saldo += f.montoCentavos;
    else saldo -= f.montoCentavos;
  }
  return saldo;
}

/** Ordena la libreta por fecha de creación (y id como desempate). Inmutable. */
export function ordenarLibreta(fiados: readonly Fiado[]): Fiado[] {
  return [...fiados].sort((a, b) => {
    if (a.creadoEn !== b.creadoEn) return a.creadoEn - b.creadoEn;
    return a.id.localeCompare(b.id);
  });
}

/** Cómo se ordena la libreta de clientes (C6.3). */
export type OrdenLibreta = "saldo" | "antiguedad";

/** Campos mínimos de un cliente para ordenar la libreta. */
export interface ClienteOrdenable {
  nombre: string;
  saldoCentavos: number;
  /** Epoch ms del último cargo/abono; null = todavía sin movimientos. */
  ultimoMovimientoEn: number | null;
}

function compararAntiguedad(a: ClienteOrdenable, b: ClienteOrdenable): number {
  // Sin movimientos = al final de cualquier empate (recién creado).
  if (a.ultimoMovimientoEn === null && b.ultimoMovimientoEn === null) return 0;
  if (a.ultimoMovimientoEn === null) return 1;
  if (b.ultimoMovimientoEn === null) return -1;
  return a.ultimoMovimientoEn - b.ultimoMovimientoEn;
}

/**
 * Ordena la libreta (C6.3), sin mutar la entrada:
 *
 * - `"saldo"` (por defecto): primero quien más debe; a igual saldo, el
 *   movimiento más antiguo; luego el nombre.
 * - `"antiguedad"`: primero el movimiento más antiguo; a igual fecha, mayor
 *   saldo; luego el nombre.
 *
 * Los clientes sin movimientos quedan al final de los empates.
 */
export function ordenarLibretaClientes<T extends ClienteOrdenable>(
  clientes: readonly T[],
  orden: OrdenLibreta = "saldo",
): T[] {
  return [...clientes].sort((a, b) => {
    if (orden === "antiguedad") {
      const porFecha = compararAntiguedad(a, b);
      if (porFecha !== 0) return porFecha;
      if (b.saldoCentavos !== a.saldoCentavos) return b.saldoCentavos - a.saldoCentavos;
    } else {
      if (b.saldoCentavos !== a.saldoCentavos) return b.saldoCentavos - a.saldoCentavos;
      const porFecha = compararAntiguedad(a, b);
      if (porFecha !== 0) return porFecha;
    }
    return a.nombre.localeCompare(b.nombre, "es");
  });
}

export interface RegistrarFiadoInput {
  clienteId: string;
  montoCentavos: number;
  descripcion?: string | null;
  creadoEn?: number;
  opId?: string;
  /** Solo para tests/fixtures. */
  id?: string;
}

function crearFiado(input: RegistrarFiadoInput, tipo: TipoFiado): Fiado {
  if (!input.clienteId) throw new Error("clienteId es obligatorio");
  if (!Number.isInteger(input.montoCentavos)) {
    throw new Error(`montoCentavos debe ser entero, recibido: ${input.montoCentavos}`);
  }
  if (!(input.montoCentavos > 0)) {
    throw new Error(`montoCentavos debe ser > 0, recibido: ${input.montoCentavos}`);
  }

  const fiado: Fiado = {
    id: input.id ?? crypto.randomUUID(),
    clienteId: input.clienteId,
    tipo,
    montoCentavos: input.montoCentavos,
    descripcion: input.descripcion ?? null,
    creadoEn: input.creadoEn ?? Date.now(),
  };
  if (input.opId !== undefined) fiado.opId = input.opId;
  return fiado;
}

/** Nuevo cargo: el cliente queda debiendo `montoCentavos`. */
export function registrarCargo(input: RegistrarFiadoInput): Fiado {
  return crearFiado(input, "cargo");
}

/** Nuevo abono: el cliente paga y baja su saldo. */
export function registrarAbono(input: RegistrarFiadoInput): Fiado {
  return crearFiado(input, "abono");
}

/**
 * Texto llano (tú neutro) para compartir el estado de cuenta.
 * No inventa saldos: recibe el saldo ya calculado.
 */
export function compartirEstadoCuenta(nombre: string, saldoCentavos: number): string {
  if (saldoCentavos === 0) {
    return `Hola ${nombre}, no tienes saldo pendiente en LaTiendita. ¡Gracias!`;
  }
  const monto = formatearUsd(Math.abs(saldoCentavos));
  if (saldoCentavos > 0) {
    return `Hola ${nombre}, tu saldo en LaTiendita es de ${monto}. Cuando puedas, pásale.`;
  }
  return `Hola ${nombre}, tienes ${monto} a tu favor en LaTiendita. ¡Gracias!`;
}
