/**
 * Sesiones de conteo de inventario (C5).
 *
 * Mínimo viable: sesión `abierto`/`cerrado` con sus ítems embebidos (documento
 * pequeño y actualizable en una sola transacción). Cada ítem guarda lo
 * contado, lo que dice el sistema y la diferencia; la lógica de aplicar esa
 * diferencia como movimiento de ajuste se queda en el dominio (libro/ajuste)
 * y no corre aquí.
 */
import { redondearCantidad } from "../../unidades";
import type { ConteoFila, ConteoItemFila, LaTienditaDb } from "../schema";
import { crearOpDe, filaDeOp, leerStockLocal, productoActivo } from "./comun";

export interface ConteoRepo {
  /** Abre una sesión nueva (si ya hay otra abierta, ambas quedan disponibles). */
  iniciar(): Promise<ConteoFila>;
  /** La sesión abierta más reciente, si existe. */
  listarAbierta(): Promise<ConteoFila | undefined>;
  /** Upsert del ítem: `sistema` = stock derivado al momento de contarlo. */
  registrarItem(conteoId: string, productoId: string, contado: number): Promise<ConteoFila>;
  /** Cierra la sesión, recalcula `sistema`/`diferencia` y encola la op. */
  cerrar(conteoId: string): Promise<ConteoFila>;
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
          // Recalcula contra el libro al cierre: el sistema pudo moverse.
          const items: ConteoItemFila[] = [];
          for (const item of sesion.items) {
            const sistema = await leerStockLocal(db, item.productoId);
            items.push({
              ...item,
              sistema,
              diferencia: redondearCantidad(item.contado - sistema),
            });
          }
          const cerrada: ConteoFila = { ...sesion, estado: "cerrado", cerradoEn: ahora, items };
          await db.conteos.put(cerrada);
          const op = crearOpDe(negocioId, "conteo", { cierre: cerrada }, { ahora });
          await db.outbox.add(filaDeOp(op, negocioId));
          return cerrada;
        },
      );
    },

    async listar(): Promise<ConteoFila[]> {
      const filas = await db.conteos.where("negocioId").equals(negocioId).toArray();
      return filas.sort((a, b) => b.creadoEn - a.creadoEn);
    },
  };
}
