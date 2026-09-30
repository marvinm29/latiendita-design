import { describe, expect, it } from "vitest";
import {
  compartirEstadoCuenta,
  formatearUsd,
  ordenarLibreta,
  registrarAbono,
  registrarCargo,
  saldoCliente,
} from "./fiados";
import type { Fiado } from "./tipos";

function fiado(
  id: string,
  clienteId: string,
  tipo: Fiado["tipo"],
  montoCentavos: number,
  creadoEn: number,
): Fiado {
  return {
    id,
    clienteId,
    tipo,
    montoCentavos,
    descripcion: null,
    creadoEn,
  };
}

describe("formatearUsd", () => {
  it("formatea centavos como USD en-US", () => {
    expect(formatearUsd(500)).toBe("$5.00");
    expect(formatearUsd(0)).toBe("$0.00");
    expect(formatearUsd(123456)).toBe("$1,234.56");
    expect(formatearUsd(-250)).toBe("-$2.50");
  });
});

describe("saldoCliente", () => {
  it("suma cargos y resta abonos solo del cliente pedido", () => {
    const libreta = [
      fiado("f1", "c1", "cargo", 500, 1),
      fiado("f2", "c1", "cargo", 300, 2),
      fiado("f3", "c1", "abono", 200, 3),
      fiado("f4", "c2", "cargo", 999, 4),
    ];
    expect(saldoCliente(libreta, "c1")).toBe(600);
    expect(saldoCliente(libreta, "c2")).toBe(999);
    expect(saldoCliente(libreta, "c3")).toBe(0);
  });

  it("puede quedar negativo (a favor del cliente)", () => {
    const libreta = [fiado("f1", "c1", "abono", 100, 1)];
    expect(saldoCliente(libreta, "c1")).toBe(-100);
  });
});

describe("ordenarLibreta", () => {
  it("ordena por creadoEn asc y no muta el original", () => {
    const a = fiado("a", "c1", "cargo", 100, 300);
    const b = fiado("b", "c1", "abono", 50, 100);
    const c = fiado("c", "c1", "cargo", 10, 200);
    const entrada = [a, b, c];
    const salida = ordenarLibreta(entrada);
    expect(salida.map((f) => f.id)).toEqual(["b", "c", "a"]);
    expect(entrada.map((f) => f.id)).toEqual(["a", "b", "c"]);
  });

  it("desempata por id cuando coincide creadoEn", () => {
    const x = fiado("x", "c1", "cargo", 1, 100);
    const y = fiado("y", "c1", "abono", 1, 100);
    expect(ordenarLibreta([x, y]).map((f) => f.id)).toEqual(["x", "y"]);
    expect(ordenarLibreta([y, x]).map((f) => f.id)).toEqual(["x", "y"]);
  });
});

describe("registrarCargo / registrarAbono", () => {
  it("crea cargo y abono con montos enteros positivos", () => {
    const cargo = registrarCargo({
      clienteId: "c1",
      montoCentavos: 1500,
      descripcion: "fiado del sábado",
      creadoEn: 100,
      id: "c-1",
    });
    expect(cargo).toMatchObject({
      id: "c-1",
      clienteId: "c1",
      tipo: "cargo",
      montoCentavos: 1500,
      descripcion: "fiado del sábado",
      creadoEn: 100,
    });

    const abono = registrarAbono({
      clienteId: "c1",
      montoCentavos: 500,
      creadoEn: 200,
      id: "a-1",
    });
    expect(abono.tipo).toBe("abono");
    expect(abono.descripcion).toBeNull();
  });

  it("rechaza monto <= 0 o no entero", () => {
    expect(() => registrarCargo({ clienteId: "c1", montoCentavos: 0 })).toThrow(
      /> 0/,
    );
    expect(() => registrarAbono({ clienteId: "c1", montoCentavos: -10 })).toThrow(
      /> 0/,
    );
    expect(() =>
      registrarCargo({ clienteId: "c1", montoCentavos: 10.5 }),
    ).toThrow(/entero/);
  });
});

describe("compartirEstadoCuenta", () => {
  it("redacta texto llano en español para deudor, saldo cero y a favor", () => {
    const deudor = compartirEstadoCuenta("Marta", 500);
    expect(deudor).toContain("Marta");
    expect(deudor).toContain("$5.00");
    expect(deudor).toContain("saldo");

    const alDia = compartirEstadoCuenta("José", 0);
    expect(alDia).toContain("José");
    expect(alDia).toContain("no tienes saldo pendiente");

    const aFavor = compartirEstadoCuenta("Ana", -250);
    expect(aFavor).toContain("$2.50");
    expect(aFavor).toContain("a tu favor");
  });
});
