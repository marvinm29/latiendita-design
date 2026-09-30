/**
 * Repositorio del catálogo (índice local).
 *
 * Toda escritura es `rw` sobre [productos, outbox]: se guarda el producto y se
 * encola la op de sync en la MISMA transacción (003 §3). Borrado = tombstone
 * (`deletedAt`); el historial de movimientos nunca se toca (C2.5).
 */
import { buscarProductos } from "../../indice";
import type { Producto, UnidadVenta } from "../../tipos";
import type { LaTienditaDb, ProductoFila } from "../schema";
import { crearOpDe, filaDeOp } from "./comun";

export interface ProductoNuevo {
  nombre: string;
  categoria: string;
  codigoBarras: string | null;
  unidadBase: UnidadVenta;
  unidadVenta: UnidadVenta;
  factor: number;
  costoCentavos: number;
  precioCentavos: number;
  stockMinimoBase: number;
  activo?: boolean;
  /** Sólo para tests/fixtures; en producción se genera con randomUUID. */
  id?: string;
}

export interface ProductosRepo {
  /** Productos vivos del negocio ordenados por nombre. */
  listar(): Promise<ProductoFila[]>;
  /** Búsqueda por nombre/categoría/código vía `buscarProductos` (dominio). */
  buscar(query: string): Promise<ProductoFila[]>;
  crear(entrada: ProductoNuevo): Promise<ProductoFila>;
  /** Actualiza campos y marca `updatedAt` (base del LWW en M2). */
  actualizar(id: string, cambios: Partial<Omit<Producto, "id">>): Promise<ProductoFila>;
  /** Borrado lógico: `deletedAt` + `activo = false`, sin borrar filas. */
  borrar(id: string): Promise<ProductoFila>;
  getById(id: string): Promise<ProductoFila | undefined>;
  getByIdPorCodigo(codigoBarras: string): Promise<ProductoFila | undefined>;
}

function validarProductoNuevo(entrada: ProductoNuevo): void {
  if (!entrada.nombre.trim()) throw new Error("nombre es obligatorio");
  if (!(entrada.factor > 0)) throw new Error(`factor debe ser > 0, recibido: ${entrada.factor}`);
  if (!Number.isInteger(entrada.costoCentavos) || entrada.costoCentavos < 0) {
    throw new Error(`costoCentavos debe ser entero >= 0, recibido: ${entrada.costoCentavos}`);
  }
  if (!Number.isInteger(entrada.precioCentavos) || entrada.precioCentavos < 0) {
    throw new Error(`precioCentavos debe ser entero >= 0, recibido: ${entrada.precioCentavos}`);
  }
  if (!Number.isFinite(entrada.stockMinimoBase) || entrada.stockMinimoBase < 0) {
    throw new Error(`stockMinimoBase debe ser >= 0, recibido: ${entrada.stockMinimoBase}`);
  }
}

export function crearProductosRepo(db: LaTienditaDb, negocioId: string): ProductosRepo {
  /** Unicidad de código de barras viva en el negocio (003 §4.3). Debe correr en tx. */
  async function asegurarCodigoLibre(
    codigoBarras: string | null,
    exceptoId: string,
  ): Promise<void> {
    if (codigoBarras === null) return;
    const iguales = await db.productos
      .where("[negocioId+codigoBarras]")
      .equals([negocioId, codigoBarras])
      .toArray();
    const ocupado = iguales.some((p) => p.id !== exceptoId && p.deletedAt === null);
    if (ocupado) throw new Error(`ya existe un producto con el código ${codigoBarras}`);
  }

  /** Productos vivos del negocio ordenados por nombre. */
  async function listar(): Promise<ProductoFila[]> {
    const filas = await db.productos.where("negocioId").equals(negocioId).toArray();
    return filas
      .filter((p) => p.deletedAt === null)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }

  return {
    listar,

    async buscar(query: string) {
      // Los elementos son ProductoFila; el dominio sólo tipa la forma base.
      return buscarProductos(await listar(), query) as ProductoFila[];
    },

    async crear(entrada: ProductoNuevo): Promise<ProductoFila> {
      validarProductoNuevo(entrada);
      const ahora = Date.now();
      const producto: ProductoFila = {
        ...entrada,
        id: entrada.id ?? crypto.randomUUID(),
        activo: entrada.activo ?? true,
        negocioId,
        updatedAt: ahora,
        deletedAt: null,
        serverSeq: null,
        rev: 0,
      };
      await db.transaction("rw", db.productos, db.outbox, async () => {
        await asegurarCodigoLibre(producto.codigoBarras, producto.id);
        await db.productos.add(producto);
        const op = crearOpDe(negocioId, "producto", { alta: producto }, { ahora });
        await db.outbox.add(filaDeOp(op, negocioId));
      });
      return producto;
    },

    async actualizar(
      id: string,
      cambios: Partial<Omit<Producto, "id">>,
    ): Promise<ProductoFila> {
      const ahora = Date.now();
      return db.transaction("rw", db.productos, db.outbox, async () => {
        const fila = await db.productos.get(id);
        if (!fila || fila.negocioId !== negocioId || fila.deletedAt !== null) {
          throw new Error(`producto no encontrado: ${id}`);
        }
        // `undefined` explícito no pisa el valor actual; `null` sí (bajar código).
        const reales = Object.fromEntries(
          Object.entries(cambios).filter(([, v]) => v !== undefined),
        ) as Partial<Omit<Producto, "id">>;
        if (reales.factor !== undefined && !(reales.factor > 0)) {
          throw new Error(`factor debe ser > 0, recibido: ${reales.factor}`);
        }
        const siguiente: ProductoFila = {
          ...fila,
          ...reales,
          id: fila.id,
          negocioId: fila.negocioId,
          updatedAt: ahora,
          // Editada localmente: aún no confirmada por el servidor.
          serverSeq: null,
        };
        await asegurarCodigoLibre(siguiente.codigoBarras, siguiente.id);
        await db.productos.put(siguiente);
        const op = crearOpDe(negocioId, "producto", { edicion: siguiente }, { ahora });
        await db.outbox.add(filaDeOp(op, negocioId));
        return siguiente;
      });
    },

    async borrar(id: string): Promise<ProductoFila> {
      const ahora = Date.now();
      return db.transaction("rw", db.productos, db.outbox, async () => {
        const fila = await db.productos.get(id);
        if (!fila || fila.negocioId !== negocioId || fila.deletedAt !== null) {
          throw new Error(`producto no encontrado: ${id}`);
        }
        const borrado: ProductoFila = {
          ...fila,
          activo: false,
          updatedAt: ahora,
          deletedAt: ahora,
          serverSeq: null,
        };
        await db.productos.put(borrado);
        const op = crearOpDe(negocioId, "producto", { baja: { id, deletedAt: ahora } }, { ahora });
        await db.outbox.add(filaDeOp(op, negocioId));
        return borrado;
      });
    },

    async getById(id: string): Promise<ProductoFila | undefined> {
      const fila = await db.productos.get(id);
      if (!fila || fila.negocioId !== negocioId || fila.deletedAt !== null) return undefined;
      return fila;
    },

    async getByIdPorCodigo(codigoBarras: string): Promise<ProductoFila | undefined> {
      const filas = await db.productos
        .where("[negocioId+codigoBarras]")
        .equals([negocioId, codigoBarras])
        .toArray();
      return filas.find((p) => p.deletedAt === null);
    },
  };
}
