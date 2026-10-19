/**
 * Importación local (C10.2/C10.3) — sin servidor y sin dependencias.
 *
 * - `restaurarRespaldo`: combina un respaldo JSON con los datos del teléfono.
 *   El merge es por `id`: si la fila ya existe se deja intacta, así restaurar
 *   dos veces el mismo archivo no duplica nada. El stock NUNCA se importa:
 *   se recalcula desde el libro para los productos afectados (C4.3).
 * - `importarProductosCsv`: migra catálogos desde Excel/LibreOffice con la
 *   plantilla incluida. No importa stock: en LaTiendita el stock entra por
 *   movimientos.
 *
 * Una fila mala no detiene el resto del CSV: se reporta con su número de fila
 * y se sigue. El respaldo, en cambio, se valida completo antes de tocar nada.
 */
import {
  stockDerivado,
  type CategoriaFila,
  type ClienteFila,
  type FiadoFila,
  type MovimientoFila,
  type ProductoFila,
  type UnidadVenta,
} from "@latiendita/core";
import type { Table } from "dexie";
import { asegurarBaseLista, baseApp, type BaseLocal } from "./baseLocal";
import { aCsv, type RespaldoJson } from "./exportar";

/** Conteo de filas nuevas vs. ya presentes para una tabla del respaldo. */
export interface ConteoMerge {
  nuevos: number;
  existentes: number;
}

/** Resultado de combinar un respaldo con la base local. */
export interface ResultadoRestauracion {
  productos: ConteoMerge;
  movimientos: ConteoMerge;
  clientes: ConteoMerge;
  fiados: ConteoMerge;
  categorias: ConteoMerge;
  /** Productos cuyo `stock_cache` se reconstruyó desde el libro. */
  stockRecalculado: number;
}

/** Resumen legible que la UI muestra ANTES de confirmar la restauración. */
export interface ResumenRespaldo {
  exportadoEn: string;
  negocioId: string;
  productos: number;
  movimientos: number;
  clientes: number;
  fiados: number;
  categorias: number;
}

export type ValidacionRespaldo =
  | { ok: true; datos: RespaldoJson; resumen: ResumenRespaldo }
  | { ok: false; error: string };

export interface ErrorFilaCsv {
  /** Número de fila del archivo (la cabecera es la fila 1). */
  fila: number;
  mensaje: string;
}

export interface ResultadoImportacionCsv {
  creados: number;
  omitidos: number;
  errores: ErrorFilaCsv[];
}

/** Columnas obligatorias de la plantilla de productos. */
export const COLUMNAS_PRODUCTOS = [
  "nombre",
  "categoria",
  "codigo_barras",
  "unidad_base",
  "unidad_venta",
  "factor",
  "costo_usd",
  "precio_usd",
  "stock_minimo",
] as const;

const UNIDADES: readonly UnidadVenta[] = ["unidad", "kg", "litro", "caja"];

// ---------------------------------------------------------------- JSON

type Objeto = Record<string, unknown>;

function esObjeto(valor: unknown): valor is Objeto {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function esTexto(valor: unknown): valor is string {
  return typeof valor === "string";
}

function esTextoNoVacio(valor: unknown): valor is string {
  return esTexto(valor) && valor.trim() !== "";
}

function esNumero(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isFinite(valor);
}

function esEnteroNoNegativo(valor: unknown): valor is number {
  return Number.isInteger(valor) && (valor as number) >= 0;
}

function esEnteroPositivo(valor: unknown): valor is number {
  return Number.isInteger(valor) && (valor as number) > 0;
}

function esNuloONumero(valor: unknown): boolean {
  return valor === null || esNumero(valor);
}

function esNuloOEnteroNoNegativo(valor: unknown): boolean {
  return valor === null || esEnteroNoNegativo(valor);
}

/** Campos comunes de las filas mutables (productos, clientes, categorías). */
function errorSync(fila: Objeto, contexto: string): string | null {
  if (!esEnteroNoNegativo(fila.rev)) return `${contexto}: "rev" debe ser un entero >= 0.`;
  if (!esNuloONumero(fila.deletedAt)) {
    return `${contexto}: "deletedAt" debe ser un número o null.`;
  }
  if (!esNumero(fila.updatedAt)) return `${contexto}: "updatedAt" debe ser numérico.`;
  if (!esNuloOEnteroNoNegativo(fila.serverSeq)) {
    return `${contexto}: "serverSeq" debe ser un entero >= 0 o null.`;
  }
  if (!esTextoNoVacio(fila.negocioId)) {
    return `${contexto}: "negocioId" debe ser texto.`;
  }
  return null;
}

function errorProducto(fila: unknown, indice: number): string | null {
  const contexto = `productos, fila ${indice + 1}`;
  if (!esObjeto(fila)) return `${contexto}: debe ser un objeto.`;
  if (!esTextoNoVacio(fila.id)) return `${contexto}: "id" debe ser texto.`;
  if (!esTextoNoVacio(fila.nombre)) return `${contexto}: "nombre" debe ser texto.`;
  if (!esTexto(fila.categoria)) return `${contexto}: "categoria" debe ser texto.`;
  if (fila.codigoBarras !== null && !esTexto(fila.codigoBarras)) {
    return `${contexto}: "codigoBarras" debe ser texto o null.`;
  }
  if (!UNIDADES.includes(fila.unidadBase as UnidadVenta)) {
    return `${contexto}: "unidadBase" debe ser unidad, kg, litro o caja.`;
  }
  if (!UNIDADES.includes(fila.unidadVenta as UnidadVenta)) {
    return `${contexto}: "unidadVenta" debe ser unidad, kg, litro o caja.`;
  }
  if (!esNumero(fila.factor) || fila.factor <= 0) {
    return `${contexto}: "factor" debe ser mayor que 0.`;
  }
  if (!esEnteroNoNegativo(fila.costoCentavos)) {
    return `${contexto}: "costoCentavos" debe ser un entero >= 0.`;
  }
  if (!esEnteroNoNegativo(fila.precioCentavos)) {
    return `${contexto}: "precioCentavos" debe ser un entero >= 0.`;
  }
  if (!esNumero(fila.stockMinimoBase) || fila.stockMinimoBase < 0) {
    return `${contexto}: "stockMinimoBase" debe ser >= 0.`;
  }
  if (typeof fila.activo !== "boolean") return `${contexto}: "activo" debe ser booleano.`;
  return errorSync(fila, contexto);
}

function errorMovimiento(fila: unknown, indice: number): string | null {
  const contexto = `movimientos, fila ${indice + 1}`;
  if (!esObjeto(fila)) return `${contexto}: debe ser un objeto.`;
  if (!esTextoNoVacio(fila.id)) return `${contexto}: "id" debe ser texto.`;
  if (!esTextoNoVacio(fila.productoId)) {
    return `${contexto}: "productoId" debe ser texto.`;
  }
  if (fila.tipo !== "entrada" && fila.tipo !== "salida" && fila.tipo !== "ajuste") {
    return `${contexto}: "tipo" debe ser entrada, salida o ajuste.`;
  }
  if (!esNumero(fila.cantidadBase) || fila.cantidadBase === 0) {
    return `${contexto}: "cantidadBase" debe ser numérica y distinta de 0.`;
  }
  if (fila.tipo !== "ajuste" && fila.cantidadBase < 0) {
    return `${contexto}: una entrada/salida requiere "cantidadBase" > 0.`;
  }
  if (!esNumero(fila.creadoEn)) return `${contexto}: "creadoEn" debe ser numérico.`;
  if (!esNumero(fila.ocurridoAt)) return `${contexto}: "ocurridoAt" debe ser numérico.`;
  if (!esNuloOEnteroNoNegativo(fila.serverSeq)) {
    return `${contexto}: "serverSeq" debe ser un entero >= 0 o null.`;
  }
  if (!esTextoNoVacio(fila.negocioId)) {
    return `${contexto}: "negocioId" debe ser texto.`;
  }
  return null;
}

function errorCliente(fila: unknown, indice: number): string | null {
  const contexto = `clientes, fila ${indice + 1}`;
  if (!esObjeto(fila)) return `${contexto}: debe ser un objeto.`;
  if (!esTextoNoVacio(fila.id)) return `${contexto}: "id" debe ser texto.`;
  if (!esTextoNoVacio(fila.nombre)) return `${contexto}: "nombre" debe ser texto.`;
  if (fila.telefono !== null && !esTexto(fila.telefono)) {
    return `${contexto}: "telefono" debe ser texto o null.`;
  }
  if (!esNuloOEnteroNoNegativo(fila.limiteCentavos)) {
    return `${contexto}: "limiteCentavos" debe ser un entero >= 0 o null.`;
  }
  if (typeof fila.activo !== "boolean") return `${contexto}: "activo" debe ser booleano.`;
  return errorSync(fila, contexto);
}

function errorFiado(fila: unknown, indice: number): string | null {
  const contexto = `fiados, fila ${indice + 1}`;
  if (!esObjeto(fila)) return `${contexto}: debe ser un objeto.`;
  if (!esTextoNoVacio(fila.id)) return `${contexto}: "id" debe ser texto.`;
  if (!esTextoNoVacio(fila.clienteId)) {
    return `${contexto}: "clienteId" debe ser texto.`;
  }
  if (fila.tipo !== "cargo" && fila.tipo !== "abono") {
    return `${contexto}: "tipo" debe ser cargo o abono.`;
  }
  if (!esEnteroPositivo(fila.montoCentavos)) {
    return `${contexto}: "montoCentavos" debe ser un entero > 0.`;
  }
  if (fila.descripcion !== null && !esTexto(fila.descripcion)) {
    return `${contexto}: "descripcion" debe ser texto o null.`;
  }
  if (!esNumero(fila.creadoEn)) return `${contexto}: "creadoEn" debe ser numérico.`;
  if (!esNuloOEnteroNoNegativo(fila.serverSeq)) {
    return `${contexto}: "serverSeq" debe ser un entero >= 0 o null.`;
  }
  if (!esTextoNoVacio(fila.negocioId)) {
    return `${contexto}: "negocioId" debe ser texto.`;
  }
  return null;
}

function errorCategoria(fila: unknown, indice: number): string | null {
  const contexto = `categorias, fila ${indice + 1}`;
  if (!esObjeto(fila)) return `${contexto}: debe ser un objeto.`;
  if (!esTextoNoVacio(fila.id)) return `${contexto}: "id" debe ser texto.`;
  if (!esTextoNoVacio(fila.nombre)) return `${contexto}: "nombre" debe ser texto.`;
  return errorSync(fila, contexto);
}

function validarLista(
  valor: unknown,
  nombre: string,
  validarFila: (fila: unknown, indice: number) => string | null,
): string | null {
  if (!Array.isArray(valor)) return `El respaldo no trae la lista "${nombre}".`;
  for (let i = 0; i < valor.length; i++) {
    const error = validarFila(valor[i], i);
    if (error) return error;
  }
  return null;
}

/**
 * Valida un respaldo JSON completo sin tocar IndexedDB.
 * Devuelve el resumen de conteos para la vista previa o un error en español.
 */
export function validarRespaldoJson(texto: string): ValidacionRespaldo {
  if (texto.trim() === "") {
    return { ok: false, error: "El archivo está vacío. Elige un respaldo JSON." };
  }

  let valor: unknown;
  try {
    valor = JSON.parse(texto);
  } catch {
    return {
      ok: false,
      error: "El archivo no es un JSON válido. Revisa que sea el respaldo completo de LaTiendita.",
    };
  }

  if (!esObjeto(valor)) {
    return { ok: false, error: "El respaldo debe ser un objeto JSON." };
  }
  if (valor.version !== 1) {
    return {
      ok: false,
      error: "Solo aceptamos respaldos de la versión 1. Exporta de nuevo desde LaTiendita.",
    };
  }
  if (!esTexto(valor.exportadoEn)) {
    return { ok: false, error: 'El respaldo no trae la fecha "exportadoEn".' };
  }
  if (!esTextoNoVacio(valor.negocioId)) {
    return { ok: false, error: 'El respaldo no trae un "negocioId" válido.' };
  }

  const error =
    validarLista(valor.productos, "productos", errorProducto) ??
    validarLista(valor.movimientos, "movimientos", errorMovimiento) ??
    validarLista(valor.clientes, "clientes", errorCliente) ??
    validarLista(valor.fiados, "fiados", errorFiado) ??
    validarLista(valor.categorias, "categorias", errorCategoria);
  if (error) return { ok: false, error };

  const datos = valor as unknown as RespaldoJson;
  return {
    ok: true,
    datos,
    resumen: {
      exportadoEn: datos.exportadoEn,
      negocioId: datos.negocioId,
      productos: datos.productos.length,
      movimientos: datos.movimientos.length,
      clientes: datos.clientes.length,
      fiados: datos.fiados.length,
      categorias: datos.categorias.length,
    },
  };
}

// ---------------------------------------------------------------- restore

/**
 * Combina un respaldo con la base local en UNA transacción.
 *
 * Reglas:
 * - Merge por `id`: una fila existente NUNCA se sobrescribe ni se borra.
 * - Las filas importadas pasan al `negocioId` de este teléfono (una sola
 *   tienda local en v1).
 * - El libro es append-only: sólo se agregan movimientos/fiados que falten.
 * - `stock_cache` de los productos afectados se recalcula desde el libro;
 *   nunca se escribe un stock a mano.
 */
export async function restaurarRespaldo(
  datos: RespaldoJson,
  base: BaseLocal = baseApp,
): Promise<ResultadoRestauracion> {
  await asegurarBaseLista(base);
  const { db } = base;
  const negocioId = base.negocioId;
  const ahora = Date.now();

  return db.transaction(
    "rw",
    [db.productos, db.movimientos, db.clientes, db.fiados, db.categorias, db.stock_cache],
    async () => {
      async function fusionar<T extends { id: string }>(
        tabla: Table<T, string>,
        filas: readonly T[],
      ): Promise<{ conteo: ConteoMerge; nuevos: T[] }> {
        const conteo: ConteoMerge = { nuevos: 0, existentes: 0 };
        const nuevos: T[] = [];
        for (const fila of filas) {
          const existente = await tabla.get(fila.id);
          if (existente) {
            conteo.existentes += 1;
            continue;
          }
          await tabla.add(fila);
          conteo.nuevos += 1;
          nuevos.push(fila);
        }
        return { conteo, nuevos };
      }

      // Mutables primero: categorías/productos/clientes antes que el ledger.
      const categorias = await fusionar<CategoriaFila>(
        db.categorias,
        datos.categorias.map((c) => ({ ...c, negocioId })),
      );
      const productos = await fusionar<ProductoFila>(
        db.productos,
        datos.productos.map((p) => ({ ...p, negocioId })),
      );
      const clientes = await fusionar<ClienteFila>(
        db.clientes,
        datos.clientes.map((c) => ({ ...c, negocioId })),
      );
      const movimientos = await fusionar<MovimientoFila>(
        db.movimientos,
        datos.movimientos.map((m) => ({
          ...m,
          negocioId,
          ocurridoAt: m.creadoEn,
        })),
      );
      const fiados = await fusionar<FiadoFila>(
        db.fiados,
        datos.fiados.map((f) => ({ ...f, negocioId })),
      );

      // Productos tocados: los nuevos y los que recibieron movimientos nuevos.
      const afectados = new Set<string>([
        ...productos.nuevos.map((p) => p.id),
        ...movimientos.nuevos.map((m) => m.productoId),
      ]);
      let stockRecalculado = 0;
      for (const productoId of afectados) {
        const producto = await db.productos.get(productoId);
        if (!producto || producto.negocioId !== negocioId) continue;
        const libro = await db.movimientos.where("productoId").equals(productoId).toArray();
        await db.stock_cache.put({
          productoId,
          negocioId,
          stock: stockDerivado(libro, productoId),
          actualizadoEn: ahora,
        });
        stockRecalculado += 1;
      }

      return {
        productos: productos.conteo,
        movimientos: movimientos.conteo,
        clientes: clientes.conteo,
        fiados: fiados.conteo,
        categorias: categorias.conteo,
        stockRecalculado,
      };
    },
  );
}

// ---------------------------------------------------------------- CSV

/**
 * Parser CSV RFC 4180 mínimo: comillas dobles escapadas (`""`), comas y
 * saltos de línea dentro de comillas, finales `\r\n` o `\n` y BOM opcional.
 */
export function parsearCsv(texto: string): string[][] {
  const limpio = texto.replace(/^\uFEFF/, "");
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = "";
  let entreComillas = false;

  for (let i = 0; i < limpio.length; i++) {
    const caracter = limpio[i];
    if (entreComillas) {
      if (caracter === '"') {
        if (limpio[i + 1] === '"') {
          campo += '"';
          i += 1;
        } else {
          entreComillas = false;
        }
      } else {
        campo += caracter;
      }
      continue;
    }

    if (caracter === '"' && campo === "") {
      entreComillas = true;
    } else if (caracter === ",") {
      fila.push(campo);
      campo = "";
    } else if (caracter === "\r" || caracter === "\n") {
      if (caracter === "\r" && limpio[i + 1] === "\n") i += 1;
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = "";
    } else {
      campo += caracter;
    }
  }

  if (campo !== "" || fila.length > 0) {
    fila.push(campo);
    filas.push(fila);
  }
  return filas;
}

function limpiar(valor: string | undefined): string {
  return (valor ?? "").trim();
}

/** Convierte "1,25", "1.25", "$1,234.56"… a centavos enteros. */
function dineroACentavos(texto: string): number | null {
  let limpio = texto.replace(/[\s$]/g, "");
  if (limpio === "") return null;
  if (limpio.includes(",") && limpio.includes(".")) {
    if (limpio.lastIndexOf(",") > limpio.lastIndexOf(".")) {
      limpio = limpio.replaceAll(".", "").replace(",", ".");
    } else {
      limpio = limpio.replaceAll(",", "");
    }
  } else if (limpio.includes(",")) {
    limpio = limpio.replace(",", ".");
  }
  const numero = Number(limpio);
  if (!Number.isFinite(numero)) return null;
  return Math.round(numero * 100);
}

/** Convierte un número decimal del CSV (acepta coma decimal). */
function numeroCsv(texto: string): number | null {
  const limpio = texto.replace(/\s/g, "").replace(",", ".");
  if (limpio === "") return null;
  const numero = Number(limpio);
  return Number.isFinite(numero) ? numero : null;
}

function esUnidad(valor: string): valor is UnidadVenta {
  return UNIDADES.includes(valor as UnidadVenta);
}

/**
 * Lee un CSV de productos con la cabecera de `COLUMNAS_PRODUCTOS`.
 * Tolera BOM, comillas, campos vacíos y columnas extra. Cada fila inválida se
 * reporta y se continúa con la siguiente. No importa stock.
 */
export async function importarProductosCsv(
  texto: string,
  base: BaseLocal = baseApp,
): Promise<ResultadoImportacionCsv> {
  await asegurarBaseLista(base);

  const filas = parsearCsv(texto);
  if (filas.length === 0) {
    throw new Error("El archivo está vacío. Descarga la plantilla y llena tus productos.");
  }

  const cabecera = (filas[0] ?? []).map((campo) => campo.trim().toLowerCase());
  const indice = new Map<string, number>();
  cabecera.forEach((campo, posicion) => {
    if (!indice.has(campo)) indice.set(campo, posicion);
  });
  const faltantes = COLUMNAS_PRODUCTOS.filter((columna) => !indice.has(columna));
  if (faltantes.length > 0) {
    throw new Error(
      `Falta la columna ${faltantes.map((c) => `"${c}"`).join(", ")} en la cabecera. ` +
        "Descarga la plantilla para ver el formato.",
    );
  }

  const resultado: ResultadoImportacionCsv = { creados: 0, omitidos: 0, errores: [] };
  const codigosDelArchivo = new Set<string>();

  for (let i = 1; i < filas.length; i++) {
    const celdas = filas[i] ?? [];
    const numeroFila = i + 1;
    if (celdas.every((celda) => celda.trim() === "")) continue;

    const valor = (columna: string): string => limpiar(celdas[indice.get(columna) ?? -1]);

    const nombre = valor("nombre");
    if (nombre === "") {
      resultado.errores.push({ fila: numeroFila, mensaje: "El nombre es obligatorio." });
      continue;
    }

    const unidadBase = (valor("unidad_base") || "unidad").toLowerCase();
    if (!esUnidad(unidadBase)) {
      resultado.errores.push({
        fila: numeroFila,
        mensaje: "unidad_base debe ser unidad, kg, litro o caja.",
      });
      continue;
    }
    const unidadVenta = (valor("unidad_venta") || "unidad").toLowerCase();
    if (!esUnidad(unidadVenta)) {
      resultado.errores.push({
        fila: numeroFila,
        mensaje: "unidad_venta debe ser unidad, kg, litro o caja.",
      });
      continue;
    }

    const factorTexto = valor("factor");
    const factor = factorTexto === "" ? 1 : numeroCsv(factorTexto);
    if (factor === null || factor <= 0) {
      resultado.errores.push({ fila: numeroFila, mensaje: "factor debe ser mayor que 0." });
      continue;
    }

    const costoTexto = valor("costo_usd");
    const costoCentavos = costoTexto === "" ? 0 : dineroACentavos(costoTexto);
    if (costoCentavos === null || costoCentavos < 0) {
      resultado.errores.push({
        fila: numeroFila,
        mensaje: "costo_usd debe ser un monto válido (por ejemplo 0.75).",
      });
      continue;
    }

    const precioTexto = valor("precio_usd");
    const precioCentavos = precioTexto === "" ? 0 : dineroACentavos(precioTexto);
    if (precioCentavos === null || precioCentavos < 0) {
      resultado.errores.push({
        fila: numeroFila,
        mensaje: "precio_usd debe ser un monto válido (por ejemplo 1.00).",
      });
      continue;
    }

    const minimoTexto = valor("stock_minimo");
    const stockMinimoBase = minimoTexto === "" ? 0 : numeroCsv(minimoTexto);
    if (stockMinimoBase === null || stockMinimoBase < 0) {
      resultado.errores.push({
        fila: numeroFila,
        mensaje: "stock_minimo debe ser un número mayor o igual a 0.",
      });
      continue;
    }

    const codigoBarras = valor("codigo_barras") || null;
    if (codigoBarras !== null) {
      if (codigosDelArchivo.has(codigoBarras)) {
        resultado.omitidos += 1;
        continue;
      }
      const existente = await base.repos.productos.getByIdPorCodigo(codigoBarras);
      if (existente) {
        resultado.omitidos += 1;
        continue;
      }
      codigosDelArchivo.add(codigoBarras);
    }

    const activoTexto = valor("activo").toLowerCase();
    const activo = !["no", "false", "0"].includes(activoTexto);

    try {
      await base.repos.productos.crear({
        nombre,
        categoria: valor("categoria") || "Sin categoría",
        codigoBarras,
        unidadBase,
        unidadVenta,
        factor,
        costoCentavos,
        precioCentavos,
        stockMinimoBase,
        activo,
      });
      resultado.creados += 1;
    } catch (error) {
      resultado.errores.push({
        fila: numeroFila,
        mensaje: error instanceof Error ? error.message : "No se pudo crear el producto.",
      });
    }
  }

  return resultado;
}

/** Plantilla de importación: cabecera exacta + dos filas de ejemplo. */
export function plantillaProductosCsv(): string {
  return aCsv([...COLUMNAS_PRODUCTOS], [
    ["Arroz Diana 1 lb", "Granos", "", "unidad", "unidad", 1, "0.75", "1.00", 2],
    ["Café molido 250 g", "Bebidas", "7501234567890", "unidad", "unidad", 1, "2.10", "3.00", 1],
  ]);
}
