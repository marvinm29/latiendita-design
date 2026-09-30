import { describe, expect, it } from "vitest";
import {
  convertirACantidadBase,
  convertirDesdeBase,
  factorDe,
  redondearCantidad,
} from "./unidades";
import type { Producto } from "./tipos";

const producto: Producto = {
  id: "p1",
  nombre: "Arroz",
  categoria: "Granos",
  codigoBarras: "7501234567890",
  unidadBase: "kg",
  unidadVenta: "kg",
  factor: 1,
  costoCentavos: 1500,
  precioCentavos: 2000,
  stockMinimoBase: 5,
  activo: true,
};

describe("redondearCantidad", () => {
  it("redondea a 3 decimales", () => {
    expect(redondearCantidad(1.23456)).toBe(1.235);
    expect(redondearCantidad(1.2344)).toBe(1.234);
    expect(redondearCantidad(3)).toBe(3);
    expect(redondearCantidad(-2.5)).toBe(-2.5);
  });

  it("rechaza no finitos", () => {
    expect(() => redondearCantidad(NaN)).toThrow();
    expect(() => redondearCantidad(Infinity)).toThrow();
  });
});

describe("convertirACantidadBase", () => {
  it("multiplica por el factor", () => {
    expect(convertirACantidadBase(2, 1)).toBe(2);
    expect(convertirACantidadBase(1.5, 1000)).toBe(1500);
    expect(convertirACantidadBase(0.1, 3)).toBe(0.3);
  });

  it("rechaza factor <= 0", () => {
    expect(() => convertirACantidadBase(1, 0)).toThrow(/factor/);
    expect(() => convertirACantidadBase(1, -2)).toThrow(/factor/);
  });
});

describe("convertirDesdeBase", () => {
  it("divide por el factor", () => {
    expect(convertirDesdeBase(2, 1)).toBe(2);
    expect(convertirDesdeBase(1500, 1000)).toBe(1.5);
    expect(convertirDesdeBase(10, 4)).toBe(2.5);
  });

  it("rechaza factor <= 0", () => {
    expect(() => convertirDesdeBase(1, 0)).toThrow(/factor/);
  });
});

describe("factorDe", () => {
  it("devuelve el factor del producto", () => {
    expect(factorDe(producto)).toBe(1);
    expect(factorDe({ ...producto, factor: 12 })).toBe(12);
  });

  it("rechaza factor inválido", () => {
    expect(() => factorDe({ ...producto, factor: 0 })).toThrow(/factor/);
    expect(() => factorDe({ ...producto, factor: -1 })).toThrow(/factor/);
  });
});
