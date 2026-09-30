import { describe, expect, it } from "vitest";
import { aplicarMovimiento, crearMovimiento, invertirMovimiento } from "./libro";

describe("crearMovimiento", () => {
  it("crea entrada con cantidadBase > 0", () => {
    const m = crearMovimiento({
      productoId: "p1",
      tipo: "entrada",
      cantidadBase: 12,
      creadoEn: 1000,
      id: "m1",
    });
    expect(m).toMatchObject({
      id: "m1",
      productoId: "p1",
      tipo: "entrada",
      cantidadBase: 12,
      creadoEn: 1000,
    });
  });

  it("crea salida con cantidadBase > 0", () => {
    const m = crearMovimiento({
      productoId: "p1",
      tipo: "salida",
      cantidadBase: 3.5,
      creadoEn: 1,
      id: "m2",
    });
    expect(m.cantidadBase).toBe(3.5);
    expect(m.tipo).toBe("salida");
  });

  it("crea ajuste con signo positivo o negativo", () => {
    const pos = crearMovimiento({
      productoId: "p1",
      tipo: "ajuste",
      cantidadBase: -2,
      id: "a1",
      creadoEn: 1,
    });
    const neg = crearMovimiento({
      productoId: "p1",
      tipo: "ajuste",
      cantidadBase: 5,
      id: "a2",
      creadoEn: 1,
    });
    expect(pos.cantidadBase).toBe(-2);
    expect(neg.cantidadBase).toBe(5);
  });

  it("rechaza entrada/salida con cantidadBase <= 0", () => {
    expect(() =>
      crearMovimiento({ productoId: "p1", tipo: "entrada", cantidadBase: 0 }),
    ).toThrow(/entrada requiere/);
    expect(() =>
      crearMovimiento({ productoId: "p1", tipo: "salida", cantidadBase: -1 }),
    ).toThrow(/salida requiere/);
  });

  it("rechaza ajuste con cantidadBase 0", () => {
    expect(() =>
      crearMovimiento({ productoId: "p1", tipo: "ajuste", cantidadBase: 0 }),
    ).toThrow(/ajuste no puede ser 0/);
  });

  it("rechaza productoId vacío y cantidad no finita", () => {
    expect(() =>
      crearMovimiento({ productoId: "", tipo: "entrada", cantidadBase: 1 }),
    ).toThrow(/productoId/);
    expect(() =>
      crearMovimiento({ productoId: "p1", tipo: "entrada", cantidadBase: NaN }),
    ).toThrow(/finita/);
  });

  it("rechaza costoCentavos no entero", () => {
    expect(() =>
      crearMovimiento({
        productoId: "p1",
        tipo: "entrada",
        cantidadBase: 1,
        costoCentavos: 10.5,
      }),
    ).toThrow(/costoCentavos/);
  });

  it("redondea cantidadBase a 3 decimales", () => {
    const m = crearMovimiento({
      productoId: "p1",
      tipo: "entrada",
      cantidadBase: 1.23456,
      id: "r1",
      creadoEn: 1,
    });
    expect(m.cantidadBase).toBe(1.235);
  });
});

describe("invertirMovimiento", () => {
  it("invierte entrada → salida concorrigeA", () => {
    const original = crearMovimiento({
      productoId: "p1",
      tipo: "entrada",
      cantidadBase: 10,
      id: "orig",
      creadoEn: 100,
      motivo: "compra",
    });
    const inv = invertirMovimiento(original, { creadoEn: 200, id: "inv" });
    expect(inv).toMatchObject({
      id: "inv",
      tipo: "salida",
      cantidadBase: 10,
      corrigeA: "orig",
      creadoEn: 200,
      productoId: "p1",
    });
  });

  it("invierte salida → entrada", () => {
    const original = crearMovimiento({
      productoId: "p1",
      tipo: "salida",
      cantidadBase: 4,
      id: "s1",
      creadoEn: 1,
    });
    const inv = invertirMovimiento(original, { id: "s1-inv", creadoEn: 2 });
    expect(inv.tipo).toBe("entrada");
    expect(inv.cantidadBase).toBe(4);
    expect(inv.corrigeA).toBe("s1");
  });

  it("invierte ajuste negando el signo", () => {
    const original = crearMovimiento({
      productoId: "p1",
      tipo: "ajuste",
      cantidadBase: -3,
      id: "a1",
      creadoEn: 1,
    });
    const inv = invertirMovimiento(original, { id: "a1-inv", creadoEn: 2 });
    expect(inv.tipo).toBe("ajuste");
    expect(inv.cantidadBase).toBe(3);
    expect(inv.corrigeA).toBe("a1");
  });

  it("nunca muta el movimiento original", () => {
    const original = crearMovimiento({
      productoId: "p1",
      tipo: "entrada",
      cantidadBase: 7,
      id: "orig",
      creadoEn: 50,
      motivo: "original",
    });
    const copia = { ...original };
    invertirMovimiento(original, { id: "x", creadoEn: 99, motivo: "fix" });
    expect(original).toEqual(copia);
  });
});

describe("aplicarMovimiento", () => {
  it("entrada suma, salida resta, ajuste aplica con signo", () => {
    const entrada = crearMovimiento({
      productoId: "p1",
      tipo: "entrada",
      cantidadBase: 10,
      id: "e",
      creadoEn: 1,
    });
    const salida = crearMovimiento({
      productoId: "p1",
      tipo: "salida",
      cantidadBase: 4,
      id: "s",
      creadoEn: 2,
    });
    const ajuste = crearMovimiento({
      productoId: "p1",
      tipo: "ajuste",
      cantidadBase: -2,
      id: "a",
      creadoEn: 3,
    });

    expect(aplicarMovimiento(0, entrada)).toBe(10);
    expect(aplicarMovimiento(10, salida)).toBe(6);
    expect(aplicarMovimiento(6, ajuste)).toBe(4);
  });
});
