import { describe, expect, it } from "vitest";
import {
  calcularSiguienteReintento,
  crearOp,
  encolar,
  marcarEnviando,
  marcarError,
  marcarOk,
  opsListasParaEnviar,
} from "./outbox";

describe("crearOp", () => {
  it("crea op pendiente lista para enviar", () => {
    const op = crearOp({
      endpoint: "/ops/movimientos",
      payload: { n: 1 },
      ahora: 1000,
      id: "op1",
    });
    expect(op).toMatchObject({
      id: "op1",
      endpoint: "/ops/movimientos",
      payload: { n: 1 },
      estado: "pendiente",
      intentos: 0,
      creadoEn: 1000,
      proximoIntentoEn: 1000,
      ultimoError: null,
    });
  });

  it("genera id cuando no se pasa (crypto.randomUUID)", () => {
    const op = crearOp({ endpoint: "/x", payload: null, ahora: 1 });
    expect(op.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("rechaza endpoint vacío", () => {
    expect(() => crearOp({ endpoint: "", payload: null })).toThrow(/endpoint/);
  });
});

describe("encolar / marcar*", () => {
  it("encolar devuelve array nuevo", () => {
    const op = crearOp({ endpoint: "/x", payload: 1, ahora: 0, id: "a" });
    const lista = encolar([], op);
    expect(lista).toHaveLength(1);
    expect(lista[0]).toBe(op);
  });

  it("ciclo pendiente → enviando → ok sin mutar la op original", () => {
    const op = crearOp({ endpoint: "/x", payload: null, ahora: 0, id: "a" });
    const original = { ...op };
    const enviando = marcarEnviando(op);
    expect(enviando.estado).toBe("enviando");
    const ok = marcarOk(enviando);
    expect(ok.estado).toBe("ok");
    expect(ok.ultimoError).toBeNull();
    expect(op).toEqual(original);
  });

  it("marcarEnviando rechaza op ya ok", () => {
    const op = marcarOk(crearOp({ endpoint: "/x", payload: null, ahora: 0 }));
    expect(() => marcarEnviando(op)).toThrow(/ok/);
  });
});

describe("calcularSiguienteReintento", () => {
  // rng fijo 0.5 → jitter = 0.8 + 0.5*0.4 = 1.0 exacto
  const rngMedio = () => 0.5;

  it("backoff 1000*2^n con jitter neutro", () => {
    expect(calcularSiguienteReintento(0, rngMedio)).toBe(1000);
    expect(calcularSiguienteReintento(1, rngMedio)).toBe(2000);
    expect(calcularSiguienteReintento(2, rngMedio)).toBe(4000);
    expect(calcularSiguienteReintento(5, rngMedio)).toBe(32000);
  });

  it("capea en 60 s", () => {
    expect(calcularSiguienteReintento(6, rngMedio)).toBe(60_000);
    expect(calcularSiguienteReintento(10, rngMedio)).toBe(60_000);
    expect(calcularSiguienteReintento(100, rngMedio)).toBe(60_000);
  });

  it("jitter ±20%", () => {
    expect(calcularSiguienteReintento(0, () => 0)).toBe(800);
    expect(calcularSiguienteReintento(0, () => 0.999)).toBe(1200); // round(1000×1.1996)
    expect(calcularSiguienteReintento(2, () => 0)).toBe(3200);
    expect(calcularSiguienteReintento(2, () => 1)).toBe(4800);
  });

  it("rechaza n negativo", () => {
    expect(() => calcularSiguienteReintento(-1, rngMedio)).toThrow(/>= 0/);
  });
});

describe("marcarError", () => {
  const rngMedio = () => 0.5;

  it("incrementa intentos y programa reintento con backoff", () => {
    const op = crearOp({ endpoint: "/x", payload: null, ahora: 1000, id: "a" });
    const e1 = marcarError(op, "sin red", 1000, rngMedio);
    expect(e1.estado).toBe("error");
    expect(e1.intentos).toBe(1);
    expect(e1.ultimoError).toBe("sin red");
    expect(e1.proximoIntentoEn).toBe(1000 + 1000);

    const e2 = marcarError(e1, "otra vez", 1000, rngMedio);
    expect(e2.intentos).toBe(2);
    expect(e2.proximoIntentoEn).toBe(1000 + 2000);
  });

  it("no muta la op original", () => {
    const op = crearOp({ endpoint: "/x", payload: null, ahora: 0, id: "a" });
    const copia = { ...op };
    marcarError(op, "fallo", 0, rngMedio);
    expect(op).toEqual(copia);
  });

  it("rechaza marcarError sobre op ok", () => {
    const ok = marcarOk(crearOp({ endpoint: "/x", payload: null, ahora: 0 }));
    expect(() => marcarError(ok, "x")).toThrow(/ok/);
  });
});

describe("opsListasParaEnviar", () => {
  it("incluye pendientes y error vencidas; excluye enviando, ok y futuras", () => {
    const pendiente = crearOp({
      endpoint: "/a",
      payload: null,
      ahora: 0,
      id: "p",
    });
    const errorVencida = {
      ...crearOp({ endpoint: "/b", payload: null, ahora: 0, id: "e" }),
      estado: "error" as const,
      intentos: 1,
      proximoIntentoEn: 100,
      ultimoError: "fallo",
    };
    const errorFutura = {
      ...errorVencida,
      id: "f",
      proximoIntentoEn: 5000,
    };
    const enviando = marcarEnviando(
      crearOp({ endpoint: "/c", payload: null, ahora: 0, id: "en" }),
    );
    const ok = marcarOk(
      crearOp({ endpoint: "/d", payload: null, ahora: 0, id: "ok" }),
    );

    const lista = opsListasParaEnviar(
      [pendiente, errorVencida, errorFutura, enviando, ok],
      200,
    );
    expect(lista.map((o) => o.id).sort()).toEqual(["e", "p"]);
  });
});
