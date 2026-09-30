import type { Movimiento, MovimientoTipo } from "./tipos";
import { redondearCantidad } from "./unidades";

export interface CrearMovimientoInput {
  productoId: string;
  tipo: MovimientoTipo;
  cantidadBase: number;
  costoCentavos?: number;
  motivo?: string;
  creadoEn?: number;
  opId?: string;
  /** Solo para tests/fixtures; en producción se genera con randomUUID. */
  id?: string;
}

function nuevoId(): string {
  return crypto.randomUUID();
}

/**
 * Crea un movimiento validado. Entrada/salida exigen cantidadBase > 0;
 * ajuste acepta ± pero no 0. Nunca muta el input.
 */
export function crearMovimiento(input: CrearMovimientoInput): Movimiento {
  if (!input.productoId) throw new Error("productoId es obligatorio");
  if (!Number.isFinite(input.cantidadBase)) {
    throw new Error(`cantidadBase no finita: ${input.cantidadBase}`);
  }
  if (input.costoCentavos !== undefined && !Number.isInteger(input.costoCentavos)) {
    throw new Error(`costoCentavos debe ser entero, recibido: ${input.costoCentavos}`);
  }

  if (input.tipo === "ajuste") {
    if (input.cantidadBase === 0) throw new Error("ajuste no puede ser 0");
  } else if (!(input.cantidadBase > 0)) {
    throw new Error(`${input.tipo} requiere cantidadBase > 0, recibido: ${input.cantidadBase}`);
  }

  const mov: Movimiento = {
    id: input.id ?? nuevoId(),
    productoId: input.productoId,
    tipo: input.tipo,
    cantidadBase: redondearCantidad(input.cantidadBase),
    creadoEn: input.creadoEn ?? Date.now(),
  };
  if (input.costoCentavos !== undefined) mov.costoCentavos = input.costoCentavos;
  if (input.motivo !== undefined) mov.motivo = input.motivo;
  if (input.opId !== undefined) mov.opId = input.opId;
  return mov;
}

function invertirTipo(tipo: MovimientoTipo): MovimientoTipo {
  switch (tipo) {
    case "entrada":
      return "salida";
    case "salida":
      return "entrada";
    case "ajuste":
      return "ajuste";
  }
}

/**
 * Devuelve el movimiento inverso con `corrigeA = original.id`.
 * Nunca muta el original (append-only).
 */
export function invertirMovimiento(
  original: Movimiento,
  meta?: { motivo?: string; creadoEn?: number; id?: string },
): Movimiento {
  const tipo = invertirTipo(original.tipo);
  let cantidadBase: number;
  if (original.tipo === "ajuste") {
    cantidadBase = -original.cantidadBase;
  } else {
    cantidadBase = Math.abs(original.cantidadBase);
  }

  const inverso: Movimiento = {
    ...original,
    id: meta?.id ?? nuevoId(),
    tipo,
    cantidadBase,
    corrigeA: original.id,
    motivo: meta?.motivo ?? `Corrección de ${original.id}`,
    creadoEn: meta?.creadoEn ?? Date.now(),
  };
  return inverso;
}

/** Aplica un movimiento sobre el stock actual (redondea a 3 decimales). No muta argumentos. */
export function aplicarMovimiento(stockActual: number, mov: Movimiento): number {
  switch (mov.tipo) {
    case "entrada":
      return redondearCantidad(stockActual + mov.cantidadBase);
    case "salida":
      return redondearCantidad(stockActual - mov.cantidadBase);
    case "ajuste":
      // cantidadBase lleva signo propio en ajustes
      return redondearCantidad(stockActual + mov.cantidadBase);
  }
}
