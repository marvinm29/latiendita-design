import { describe, expect, it } from "vitest";
import { crearMovimiento } from "./libro";
import { actualizarCache, estadoStock, stockDerivado } from "./stock";
import type { Movimiento } from "./tipos";

function mov(
  productoId: string,
  tipo: Movimiento["tipo"],
  cantidadBase: number,
  id: string,
): Movimiento {
  return crearMovimiento({ productoId, tipo, cantidadBase, id, creadoEn: 1 });
}

describe("stockDerivado", () => {
  it("suma entradas, resta salidas y aplica ajustes de un producto", () => {
    const movs = [
      mov("p1", "entrada", 10, "m1"),
      mov("p1", "salida", 3, "m2"),
      mov("p2", "entrada", 99, "m3"),
      mov("p1", "ajuste", -1, "m4"),
    ];
    expect(stockDerivado(movs, "p1")).toBe(6);
    expect(stockDerivado(movs, "p2")).toBe(99);
    expect(stockDerivado(movs, "p3")).toBe(0);
  });

  it("ignora movimientos de otros productos", () => {
    expect(stockDerivado([mov("otro", "entrada", 5, "x")], "p1")).toBe(0);
  });
});

describe("actualizarCache", () => {
  it("acumula incrementalmente igual que stockDerivado", () => {
    const cache = new Map<string, number>();
    const movs = [
      mov("p1", "entrada", 10, "m1"),
      mov("p1", "salida", 4, "m2"),
      mov("p1", "ajuste", 1, "m3"),
      mov("p2", "entrada", 2, "m4"),
    ];
    for (const m of movs) actualizarCache(cache, m.productoId, m);

    expect(cache.get("p1")).toBe(stockDerivado(movs, "p1"));
    expect(cache.get("p2")).toBe(stockDerivado(movs, "p2"));
    expect(cache.get("p1")).toBe(7);
  });

  it("inicializa en 0 si la clave no existe", () => {
    const cache = new Map<string, number>();
    actualizarCache(cache, "nuevo", mov("nuevo", "entrada", 5, "m"));
    expect(cache.get("nuevo")).toBe(5);
  });
});

describe("estadoStock", () => {
  // Regla del dominio (documentada en DESIGN chips: rojo/ámbar/verde):
  // - stock === 0           → 'agotado'  (rojo)
  // - stock < 0             → 'critico'  (rojo)
  // - 0 < stock < min × 0.5 → 'critico'  (rojo)
  // - 0 < stock < min       → 'bajo'     (ámbar)
  // - si no                 → 'ok'       (verde)
  it("stock 0 es agotado", () => {
    expect(estadoStock(0, 10)).toBe("agotado");
    expect(estadoStock(0, 0)).toBe("agotado");
  });

  it("stock negativo es crítico", () => {
    expect(estadoStock(-1, 10)).toBe("critico");
    expect(estadoStock(-0.5, 0)).toBe("critico");
  });

  it("stock bajo la mitad del mínimo es crítico", () => {
    expect(estadoStock(4, 10)).toBe("critico");
    expect(estadoStock(1, 3)).toBe("critico");
    expect(estadoStock(4.999, 10)).toBe("critico");
  });

  it("stock entre mitad del mínimo y mínimo es bajo", () => {
    expect(estadoStock(5, 10)).toBe("bajo");
    expect(estadoStock(9.999, 10)).toBe("bajo");
    expect(estadoStock(7, 10)).toBe("bajo");
  });

  it("stock >= mínimo es ok", () => {
    expect(estadoStock(10, 10)).toBe("ok");
    expect(estadoStock(100, 10)).toBe("ok");
    expect(estadoStock(1, 0)).toBe("ok");
    expect(estadoStock(1, -5)).toBe("ok");
  });
});
