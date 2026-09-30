import { describe, expect, it } from "vitest";
import { buscarProductos } from "./indice";
import type { Producto } from "./tipos";

function prod(
  id: string,
  nombre: string,
  categoria: string,
  codigoBarras: string | null,
): Producto {
  return {
    id,
    nombre,
    categoria,
    codigoBarras,
    unidadBase: "unidad",
    unidadVenta: "unidad",
    factor: 1,
    costoCentavos: 100,
    precioCentavos: 200,
    stockMinimoBase: 1,
    activo: true,
  };
}

const catalogo: Producto[] = [
  prod("p1", "Arroz premium", "Granos", "7501234567890"),
  prod("p2", "Frijol negro", "Granos", null),
  prod("p3", "Coca-Cola 600ml", "Bebidas", "7509999999999"),
  prod("p4", "Jabón de mano", "Aseo", "  ESPACIOS  "),
];

describe("buscarProductos", () => {
  it("filtra por nombre case-insensitive", () => {
    expect(buscarProductos(catalogo, "arroz").map((p) => p.id)).toEqual(["p1"]);
    expect(buscarProductos(catalogo, "ARROZ").map((p) => p.id)).toEqual(["p1"]);
    expect(buscarProductos(catalogo, "PreM").map((p) => p.id)).toEqual(["p1"]);
  });

  it("filtra por categoría", () => {
    expect(buscarProductos(catalogo, "granos").map((p) => p.id)).toEqual([
      "p1",
      "p2",
    ]);
    expect(buscarProductos(catalogo, "bebidas").map((p) => p.id)).toEqual(["p3"]);
  });

  it("filtra por código de barras", () => {
    expect(
      buscarProductos(catalogo, "7501234567890").map((p) => p.id),
    ).toEqual(["p1"]);
    expect(buscarProductos(catalogo, "9999").map((p) => p.id)).toEqual(["p3"]);
  });

  it("query vacía o en blanco devuelve todo (copia)", () => {
    expect(buscarProductos(catalogo, "")).toHaveLength(4);
    expect(buscarProductos(catalogo, "   ")).toHaveLength(4);
    expect(buscarProductos(catalogo, "")).not.toBe(catalogo);
  });

  it("sin coincidencias devuelve vacío", () => {
    expect(buscarProductos(catalogo, "zzz-no-existe")).toEqual([]);
  });

  it("tolera productos con codigoBarras null", () => {
    expect(buscarProductos(catalogo, "frijol").map((p) => p.id)).toEqual(["p2"]);
    expect(() => buscarProductos(catalogo, "750")).not.toThrow();
  });
});
