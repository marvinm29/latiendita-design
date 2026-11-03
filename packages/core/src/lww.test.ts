import { describe, expect, it } from "vitest";
import { aplicarCambiosLww, type CamposLww } from "./lww";

describe("LWW por campo", () => {
  const inicial: CamposLww = {
    nombre: { valor: "Original", actualizadoEn: 100, dispositivoId: "a" },
    precio: { valor: 100, actualizadoEn: 100, dispositivoId: "a" },
  };
  const nombre: CamposLww = { nombre: { valor: "Nuevo", actualizadoEn: 200, dispositivoId: "a" } };
  const precio: CamposLww = { precio: { valor: 125, actualizadoEn: 150, dispositivoId: "b" } };

  it("converge ante ediciones concurrentes de campos distintos en cualquier orden", () => {
    const primeroNombre = aplicarCambiosLww(aplicarCambiosLww(inicial, nombre), precio);
    const primeroPrecio = aplicarCambiosLww(aplicarCambiosLww(inicial, precio), nombre);
    expect(primeroNombre).toEqual(primeroPrecio);
    expect(primeroNombre.nombre?.valor).toBe("Nuevo");
    expect(primeroNombre.precio?.valor).toBe(125);
    expect(inicial.nombre?.valor).toBe("Original");
  });

  it("desempata relojes iguales por identificador de dispositivo y es idempotente", () => {
    const a: CamposLww = { nombre: { valor: "A", actualizadoEn: 300, dispositivoId: "a" } };
    const b: CamposLww = { nombre: { valor: "B", actualizadoEn: 300, dispositivoId: "b" } };
    expect(aplicarCambiosLww(aplicarCambiosLww({}, a), b)).toEqual(aplicarCambiosLww(aplicarCambiosLww({}, b), a));
    const resultado = aplicarCambiosLww(inicial, b);
    expect(resultado.nombre?.valor).toBe("B");
    expect(aplicarCambiosLww(resultado, b)).toEqual(resultado);
  });

  it("conserva el tombstone más reciente ante una edición atrasada", () => {
    const borrado: CamposLww = { deletedAt: { valor: 500, actualizadoEn: 500, dispositivoId: "a" } };
    const anterior: CamposLww = { deletedAt: { valor: null, actualizadoEn: 400, dispositivoId: "b" } };
    expect(aplicarCambiosLww(borrado, anterior).deletedAt?.valor).toBe(500);
  });

  it("rechaza marcas inválidas y valores distintos con la misma marca", () => {
    expect(() => aplicarCambiosLww({}, { nombre: { valor: "x", actualizadoEn: NaN, dispositivoId: "a" } })).toThrow();
    expect(() => aplicarCambiosLww(inicial, { nombre: { valor: "Otro", actualizadoEn: 100, dispositivoId: "a" } })).toThrow();
  });
});
