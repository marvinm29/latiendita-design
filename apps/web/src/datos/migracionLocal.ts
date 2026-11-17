/** B2 · Traslado explícito, atómico y con respaldo del contexto `local`. */
import {
  CLAVE_TRASLADO_LOCAL,
  stockDerivado,
  type LaTienditaDb,
  type OpOutboxFila,
  type StockCacheFila,
  type UnidadVentaFila,
} from "@latiendita/core";
import { baseApp, NEGOCIO_LOCAL, type BaseLocal } from "./baseLocal";
import type { RespaldoJson } from "./exportar";
import type { Table } from "dexie";

export interface RespaldoLocal extends RespaldoJson {
  unidadesVenta: UnidadVentaFila[];
  outbox: OpOutboxFila[];
  stockCache: StockCacheFila[];
}

export interface ConfirmacionTraslado { negocioId: string; token: string }
export interface ResumenTraslado extends ConfirmacionTraslado {
  nombre: string;
  productos: number;
  movimientos: number;
  clientes: number;
  fiados: number;
  conteos: number;
}
interface TrasladoGuardado { negocioId: string; respaldo: RespaldoLocal }

async function dueñaActual(db: LaTienditaDb) {
  const fila = await db.sesion_local.get("actual");
  if (!fila || fila.bloqueada || fila.sesion.rol !== "dueña" ||
    !fila.sesion.negocioId || fila.sesion.negocioId === NEGOCIO_LOCAL) return null;
  return fila.sesion;
}

async function leerOrigen(db: LaTienditaDb): Promise<RespaldoLocal> {
  const esLocal = (fila: { negocioId: string }) => fila.negocioId === NEGOCIO_LOCAL;
  const [productos, movimientos, clientes, fiados, categorias, conteos, outbox, stockCache] = await Promise.all([
    db.productos.filter(esLocal).toArray(), db.movimientos.filter(esLocal).toArray(),
    db.clientes.filter(esLocal).toArray(), db.fiados.filter(esLocal).toArray(),
    db.categorias.filter(esLocal).toArray(), db.conteos.filter(esLocal).toArray(),
    db.outbox.filter(esLocal).toArray(), db.stock_cache.filter(esLocal).toArray(),
  ]);
  const ids = new Set(productos.map((p) => p.id));
  const unidadesVenta = await db.unidades_venta.filter((u) => ids.has(u.productoId)).toArray();
  return { version: 1, exportadoEn: new Date().toISOString(), negocioId: NEGOCIO_LOCAL,
    productos, movimientos, clientes, fiados, categorias, conteos, unidadesVenta, outbox, stockCache };
}

/** No siembra, mueve ni borra nada. Sólo la dueña desbloqueada recibe el resumen. */
export async function prepararTrasladoLocal(base: BaseLocal = baseApp): Promise<ResumenTraslado | null> {
  const { db } = base;
  await db.open();
  return db.transaction("r", db.tables, async () => {
    const sesion = await dueñaActual(db);
    if (!sesion || await db.meta.get(CLAVE_TRASLADO_LOCAL)) return null;
    const datos = await leerOrigen(db);
    if (![datos.productos, datos.movimientos, datos.clientes, datos.fiados, datos.categorias, datos.conteos!, datos.outbox, datos.stockCache].some((filas) => filas.length)) return null;
    return { negocioId: sesion.negocioId, token: sesion.token, nombre: sesion.nombre,
      productos: datos.productos.length, movimientos: datos.movimientos.length,
      clientes: datos.clientes.length, fiados: datos.fiados.length, conteos: datos.conteos!.length };
  });
}

/** El respaldo no se expone al cambiar de negocio ni estando bloqueada la app. */
export async function leerRespaldoLocal(base: BaseLocal = baseApp): Promise<RespaldoLocal | null> {
  const { db } = base;
  await db.open();
  return db.transaction("r", db.sesion_local, db.meta, async () => {
    const sesion = await dueñaActual(db);
    const guardado = (await db.meta.get(CLAVE_TRASLADO_LOCAL))?.valor as TrasladoGuardado | undefined;
    return sesion && guardado?.negocioId === sesion.negocioId ? guardado.respaldo : null;
  });
}

/** Reasigna el negocio y descarta confirmaciones del origen; conserva marcas LWW. */
function cambiarContexto(valor: unknown, negocioId: string, productos: Set<string>, clientes: Set<string>, movimientos: Set<string>): unknown {
  if (Array.isArray(valor)) return valor.map((v) => cambiarContexto(v, negocioId, productos, clientes, movimientos));
  if (typeof valor !== "object" || valor === null) return valor;
  return Object.fromEntries(Object.entries(valor).map(([clave, v]) => {
    if (clave === "negocioId") {
      if (v !== NEGOCIO_LOCAL) throw new Error("Hay datos de otro negocio en la cola anterior.");
      return [clave, negocioId];
    }
    if (clave === "serverSeq") return [clave, null];
    if ((clave === "productoId" && !productos.has(v as string)) ||
      (clave === "clienteId" && !clientes.has(v as string)) ||
      (clave === "corrigeA" && v !== undefined && !movimientos.has(v as string))) {
      throw new Error("Los datos anteriores tienen una referencia de otro negocio o incompleta.");
    }
    return [clave, cambiarContexto(v, negocioId, productos, clientes, movimientos)];
  }));
}

/** La llamada explícita representa la confirmación; revalida cuenta y rol en la tx. */
export async function trasladarDatosLocales(confirmacion: ConfirmacionTraslado, base: BaseLocal = baseApp): Promise<void> {
  const { db } = base;
  await db.open();
  await db.transaction("rw", db.tables, async () => {
    const sesion = await dueñaActual(db);
    if (!sesion || sesion.negocioId !== confirmacion.negocioId || sesion.token !== confirmacion.token) {
      throw new Error("La cuenta cambió o está bloqueada. Revisa los datos con la dueña de la tienda.");
    }
    const guardado = (await db.meta.get(CLAVE_TRASLADO_LOCAL))?.valor as TrasladoGuardado | undefined;
    if (guardado) {
      if (guardado.negocioId !== sesion.negocioId) throw new Error("Los datos ya se trasladaron a otra cuenta.");
      return;
    }
    const tablas: Table<{ negocioId: string; serverSeq?: number | null }, string>[] =
      [db.productos, db.movimientos, db.clientes, db.fiados, db.categorias, db.conteos, db.outbox, db.stock_cache];
    for (const tabla of tablas) {
      if (await tabla.filter((fila) => fila.negocioId === sesion.negocioId).count()) {
        throw new Error("Tu tienda ya tiene datos en este teléfono. Conservamos los anteriores separados para evitar mezclarlos.");
      }
    }
    const respaldo = await leerOrigen(db);
    if (![respaldo.productos, respaldo.movimientos, respaldo.clientes, respaldo.fiados, respaldo.categorias, respaldo.conteos!, respaldo.outbox].some((filas) => filas.length)) {
      throw new Error("No hay datos anteriores para trasladar.");
    }
    const productos = new Set(respaldo.productos.map((p) => p.id));
    const clientes = new Set(respaldo.clientes.map((c) => c.id));
    const movimientos = new Set(respaldo.movimientos.map((m) => m.id));
    const idsPorEntidad: Record<string, Set<string>> = {
      producto: productos, cliente: clientes, movimiento: movimientos,
      fiado: new Set(respaldo.fiados.map((f) => f.id)),
      conteo: new Set(respaldo.conteos!.map((c) => c.id)),
      categoria: new Set(respaldo.categorias.map((c) => c.id)),
      unidad_venta: new Set(respaldo.unidadesVenta.map((u) => u.id)),
    };
    // Validar también referencias de filas sin operación (p. ej. restore antiguo).
    cambiarContexto(respaldo, sesion.negocioId, productos, clientes, movimientos);
    for (const op of respaldo.outbox) {
      const payload = op.payload as { negocioId?: unknown; entidad?: unknown; datos?: unknown } | null;
      if (op.endpoint !== "/sync/push" || !payload || payload.negocioId !== NEGOCIO_LOCAL ||
        !["producto", "unidad_venta", "movimiento", "cliente", "fiado", "categoria", "conteo"].includes(String(payload.entidad)) ||
        typeof payload.datos !== "object" || payload.datos === null) {
        throw new Error("La cola anterior contiene una operación desconocida. Conservamos los datos sin trasladarlos.");
      }
      const datos = payload.datos as Record<string, unknown>;
      const registros = ["alta", "edicion", "baja", "movimiento", "fiado", "cierre"]
        .filter((clave) => datos[clave] !== undefined).map((clave) => datos[clave]);
      if (registros.length !== 1 || registros.some((registro) =>
        typeof registro !== "object" || registro === null ||
        !("id" in registro) || !idsPorEntidad[String(payload.entidad)]!.has(registro.id as string))) {
        throw new Error("Una operación anterior apunta a datos de otro negocio o incompletos.");
      }
    }
    // Primero el respaldo; cualquier error posterior revierte TODO, incluido éste.
    await db.meta.add({ clave: CLAVE_TRASLADO_LOCAL, valor: { negocioId: sesion.negocioId, respaldo } satisfies TrasladoGuardado, actualizadoEn: Date.now() });
    for (const tabla of tablas) {
      await tabla.filter((fila) => fila.negocioId === NEGOCIO_LOCAL).modify((fila) => {
        fila.negocioId = sesion.negocioId;
        if ("serverSeq" in fila) fila.serverSeq = null;
      });
    }
    for (const op of respaldo.outbox) {
      await db.outbox.update(op.id, {
        payload: cambiarContexto(op.payload, sesion.negocioId, productos, clientes, movimientos),
        estado: op.estado === "ok" || op.estado === "enviando" ? "pendiente" : op.estado,
      });
    }
    for (const cache of respaldo.stockCache) {
      await db.stock_cache.put({ ...cache, negocioId: sesion.negocioId,
        stock: stockDerivado(respaldo.movimientos, cache.productoId) });
    }
  });
}
