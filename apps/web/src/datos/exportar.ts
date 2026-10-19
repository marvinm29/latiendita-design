/**
 * Exportación local de datos (C10.1/C10.2) — sin servidor y sin dependencias.
 *
 * Los CSV están pensados para abrirse en Excel/LibreOffice (UTF-8 con BOM al
 * descargar, cabeceras en español, campos escapados). El respaldo JSON incluye
 * todas las tablas del negocio para poder llevarse los datos (la puerta de
 * salida es sagrada).
 */
import type {
  CategoriaFila,
  ClienteFila,
  FiadoFila,
  MovimientoFila,
  ProductoFila,
} from "@latiendita/core";
import { asegurarBaseLista, baseApp, type BaseLocal } from "./baseLocal";

export interface RespaldoJson {
  version: 1;
  exportadoEn: string;
  negocioId: string;
  productos: ProductoFila[];
  movimientos: MovimientoFila[];
  clientes: ClienteFila[];
  fiados: FiadoFila[];
  categorias: CategoriaFila[];
}

/** Escapa un campo CSV: comillas dobles, comas, saltos de línea y `;`. */
export function campoCsv(valor: string | number | boolean | null | undefined): string {
  if (valor === null || valor === undefined) return "";
  const texto = String(valor);
  if (/[",\n\r;]/.test(texto)) return `"${texto.replaceAll('"', '""')}"`;
  return texto;
}

/** Filas → CSV con cabecera. `\r\n` para máxima compatibilidad con Excel. */
export function aCsv(cabeceras: string[], filas: Array<Array<string | number | boolean | null>>): string {
  const lineas = [cabeceras.map(campoCsv).join(",")];
  for (const fila of filas) lineas.push(fila.map(campoCsv).join(","));
  return lineas.join("\r\n");
}

function fecha(ms: number): string {
  return new Date(ms).toISOString();
}

function dinero(centavos: number | null | undefined): string {
  if (centavos === null || centavos === undefined) return "";
  return (centavos / 100).toFixed(2);
}

/** CSV de productos vivos del negocio (stock no se exporta: se deriva). */
export async function productosCsv(base: BaseLocal = baseApp): Promise<string> {
  await asegurarBaseLista(base);
  const productos = await base.db.productos
    .where("negocioId")
    .equals(base.negocioId)
    .toArray();
  return aCsv(
    [
      "nombre",
      "categoria",
      "codigo_barras",
      "unidad_base",
      "unidad_venta",
      "factor",
      "costo_usd",
      "precio_usd",
      "stock_minimo",
      "activo",
    ],
    productos
      .filter((p) => p.deletedAt === null)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
      .map((p) => [
        p.nombre,
        p.categoria,
        p.codigoBarras,
        p.unidadBase,
        p.unidadVenta,
        p.factor,
        dinero(p.costoCentavos),
        dinero(p.precioCentavos),
        p.stockMinimoBase,
        p.activo ? "sí" : "no",
      ]),
  );
}

/** CSV del libro completo (append-only), con nombre de producto legible. */
export async function movimientosCsv(base: BaseLocal = baseApp): Promise<string> {
  await asegurarBaseLista(base);
  const [movimientos, productos] = await Promise.all([
    base.db.movimientos.where("negocioId").equals(base.negocioId).toArray(),
    base.db.productos.where("negocioId").equals(base.negocioId).toArray(),
  ]);
  const nombres = new Map(productos.map((p) => [p.id, p.nombre]));
  return aCsv(
    ["fecha", "producto", "tipo", "cantidad_base", "motivo"],
    movimientos
      .sort((a, b) => a.ocurridoAt - b.ocurridoAt)
      .map((m) => [
        fecha(m.ocurridoAt),
        nombres.get(m.productoId) ?? m.productoId,
        m.tipo,
        m.cantidadBase,
        m.motivo ?? "",
      ]),
  );
}

/** CSV de fiados con nombre de cliente y monto en USD. */
export async function fiadosCsv(base: BaseLocal = baseApp): Promise<string> {
  await asegurarBaseLista(base);
  const [fiados, clientes] = await Promise.all([
    base.db.fiados.where("negocioId").equals(base.negocioId).toArray(),
    base.db.clientes.where("negocioId").equals(base.negocioId).toArray(),
  ]);
  const nombres = new Map(clientes.map((c) => [c.id, c.nombre]));
  return aCsv(
    ["fecha", "cliente", "tipo", "monto_usd", "descripcion"],
    fiados
      .sort((a, b) => a.creadoEn - b.creadoEn)
      .map((f) => [
        fecha(f.creadoEn),
        nombres.get(f.clienteId) ?? f.clienteId,
        f.tipo,
        dinero(f.montoCentavos),
        f.descripcion ?? "",
      ]),
  );
}

/** Respaldo JSON completo del negocio (C10.2). */
export async function respaldoJson(base: BaseLocal = baseApp): Promise<RespaldoJson> {
  await asegurarBaseLista(base);
  const [productos, movimientos, clientes, fiados, categorias] = await Promise.all([
    base.db.productos.where("negocioId").equals(base.negocioId).toArray(),
    base.db.movimientos.where("negocioId").equals(base.negocioId).toArray(),
    base.db.clientes.where("negocioId").equals(base.negocioId).toArray(),
    base.db.fiados.where("negocioId").equals(base.negocioId).toArray(),
    base.db.categorias.where("negocioId").equals(base.negocioId).toArray(),
  ]);
  return {
    version: 1,
    exportadoEn: new Date().toISOString(),
    negocioId: base.negocioId,
    productos,
    movimientos,
    clientes,
    fiados,
    categorias,
  };
}

/** Descarga un archivo en el navegador (Blob + enlace temporal). */
export function descargar(nombre: string, contenido: string, tipo: string): void {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(url);
}

/** CSV listo para Excel: BOM UTF-8 al inicio. */
export function conBom(contenido: string): string {
  return `\uFEFF${contenido}`;
}
