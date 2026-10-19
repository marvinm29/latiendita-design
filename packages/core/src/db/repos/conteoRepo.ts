/**
 * Sesiones de conteo de inventario (C5).
 *
 * Mínimo viable: sesión `abierto`/`cerrado` con sus ítems embebidos (documento
 * pequeño y actualizable en una sola transacción). Cada ítem guarda lo
 * contado, lo que dice el sistema y la diferencia.
 *
 * `cerrar` sólo archiva la sesión; `cerrarConAjustes` además convierte cada
 * diferencia en un movimiento de ajuste del libro (C5.2) — sesión, libro y
 * outbox en una sola transacción, para no perder ningún movimiento (C8.4).
 */
import { crearMovimiento } from "../../libro";
import { redondearCantidad } from "../../unidades";
import type { ConteoFila, ConteoItemFila, LaTienditaDb } from "../schema";
import {
  crearOpDe,
  filaDeMovimiento,
  filaDeOp,
  leerStockLocal,
  productoActivo,
  refrescarStock,
} from "./comun";
import type { MovimientoConOp } from "./movimientosRepo";

/** Resultado de cerrar un conteo aplicando sus diferencias al libro (C5.2). */
export interface CierreConAjustes {
  conteo: ConteoFila;
  /** Un ajuste por cada diferencia; `[]` si el conteo cuadró. */
  ajustes: MovimientoConOp[];
}

export interface ConteoRepo {
  /** Abre una sesión nueva (si ya hay otra abierta, ambas quedan disponibles). */
  iniciar(): Promise<ConteoFila>;
  /** La sesión abierta más reciente, si existe. */
  listarAbierta(): Promise<ConteoFila | undefined>;
  /** Upsert del ítem: `sistema` = stock derivado al momento de contarlo. */
  registrarItem(conteoId: string, productoId: string, contado: number): Promise<ConteoFila>;
  /** Cierra la sesión, recalcula `sistema`/`diferencia` y encola la op. */
  cerrar(conteoId: string): Promise<ConteoFila>;
  /**
   * Cierra la sesión y aplica las diferencias como ajustes del libro, todo en
   * UNA transacción (C5.2): o queda la sesión cerrada con sus ajustes y ops, o
   * no queda nada. El `sistema` se recalcula al cerrar, antes de ajustar.
   */
  cerrarConAjustes(conteoId: string): Promise<CierreConAjustes>;
  /** Sesiones del negocio, más reciente primero. */
  listar(): Promise<ConteoFila[]>;
}

function validarContado(contado: number): void {
  if (!Number.isFinite(contado) || contado < 0) {
    throw new Error(`contado debe ser >= 0, recibido: ${contado}`);
  }
}

export function crearConteoRepo(db: LaTienditaDb, negocioId: string): ConteoRepo {
  async function obtenerAbierta(conteoId: string): Promise<ConteoFila> {
    const sesion = await db.conteos.get(conteoId);
    if (!sesion || sesion.negocioId !== negocioId) {
      throw new Error(`conteo no encontrado: ${conteoId}`);
    }
    if (sesion.estado !== "abierto") throw new Error(`conteo cerrado: ${conteoId}`);
    return sesion;
  }

  /** Recalcula contra el libro al cerrar: el sistema pudo moverse. */
  async function recalcularItems(sesion: ConteoFila): Promise<ConteoItemFila[]> {
    const items: ConteoItemFila[] = [];
    for (const item of sesion.items) {
      const sistema = await leerStockLocal(db, item.productoId);
      items.push({
        ...item,
        sistema,
        diferencia: redondearCantidad(item.contado - sistema),
      });
    }
    return items;
  }

  return {
    async iniciar(): Promise<ConteoFila> {
      const ahora = Date.now();
      const sesion: ConteoFila = {
        id: crypto.randomUUID(),
        negocioId,
        estado: "abierto",
        creadoEn: ahora,
        cerradoEn: null,
        items: [],
      };
      // Sólo se escribe la sesión; la op se encola al cerrar (resultado final).
      await db.conteos.add(sesion);
      return sesion;
    },

    async listarAbierta(): Promise<ConteoFila | undefined> {
      const abiertas = await db.conteos
        .where("[negocioId+estado]")
        .equals([negocioId, "abierto"])
        .toArray();
      abiertas.sort((a, b) => b.creadoEn - a.creadoEn);
      return abiertas[0];
    },

    async registrarItem(
      conteoId: string,
      productoId: string,
      contado: number,
    ): Promise<ConteoFila> {
      validarContado(contado);
      return db.transaction(
        "rw",
        db.conteos,
        db.productos,
        db.movimientos,
        db.stock_cache,
        async () => {
          const sesion = await obtenerAbierta(conteoId);
          await productoActivo(db, negocioId, productoId);
          const sistema = await leerStockLocal(db, productoId);
          const item: ConteoItemFila = {
            productoId,
            contado,
            sistema,
            diferencia: redondearCantidad(contado - sistema),
          };
          const items = sesion.items.filter((i) => i.productoId !== productoId);
          items.push(item);
          const siguiente: ConteoFila = { ...sesion, items };
          await db.conteos.put(siguiente);
          return siguiente;
        },
      );
    },

    async cerrar(conteoId: string): Promise<ConteoFila> {
      const ahora = Date.now();
      return db.transaction(
        "rw",
        db.conteos,
        db.movimientos,
        db.stock_cache,
        db.outbox,
        async () => {
          const sesion = await obtenerAbierta(conteoId);
          const items = await recalcularItems(sesion);
          const cerrada: ConteoFila = { ...sesion, estado: "cerrado", cerradoEn: ahora, items };
          await db.conteos.put(cerrada);
          const op = crearOpDe(negocioId, "conteo", { cierre: cerrada }, { ahora });
          await db.outbox.add(filaDeOp(op, negocioId));
          return cerrada;
        },
      );
    },

    async cerrarConAjustes(conteoId: string): Promise<CierreConAjustes> {
      const ahora = Date.now();
      return db.transaction(
        "rw",
        db.conteos,
        db.movimientos,
        db.productos,
        db.outbox,
        db.stock_cache,
        async () => {
          const sesion = await obtenerAbierta(conteoId);
          const items = await recalcularItems(sesion);
          const cerrada: ConteoFila = {
            ...sesion,
            estado: "cerrado",
            cerradoEn: ahora,
            items,
          };
          await db.conteos.put(cerrada);

          const ajustes: MovimientoConOp[] = [];
          for (const item of items) {
            if (item.diferencia === 0) continue;
            await productoActivo(db, negocioId, item.productoId);
            const opId = crypto.randomUUID();
            const movimiento = crearMovimiento({
              productoId: item.productoId,
              tipo: "ajuste",
              cantidadBase: item.diferencia,
              motivo: "Conteo físico",
              creadoEn: ahora,
              opId,
            });
            const op = crearOpDe(negocioId, "movimiento", { movimiento }, { ahora, id: opId });
            await db.movimientos.add(filaDeMovimiento(movimiento, negocioId));
            await db.outbox.add(filaDeOp(op, negocioId));
            const stock = await refrescarStock(db, negocioId, movimiento, ahora);
            ajustes.push({ movimiento, op, stock });
          }

          // La op del conteo viaja después de los ajustes, en la misma tx.
          const opConteo = crearOpDe(negocioId, "conteo", { cierre: cerrada }, { ahora });
          await db.outbox.add(filaDeOp(opConteo, negocioId));
          return { conteo: cerrada, ajustes };
        },
      );
    },

    async listar(): Promise<ConteoFila[]> {
      const filas = await db.conteos.where("negocioId").equals(negocioId).toArray();
      return filas.sort((a, b) => b.creadoEn - a.creadoEn);
    },
  };
}
