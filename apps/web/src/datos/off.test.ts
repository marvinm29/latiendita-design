import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { abrirDb, borrarDb, type LaTienditaDb } from "@latiendita/core";
import { buscarEnOff } from "./off";

let db: LaTienditaDb;

beforeEach(() => {
  db = abrirDb(`off-prueba-${crypto.randomUUID()}`);
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await borrarDb(db);
});

function respuesta(cuerpo: unknown, ok = true): Response {
  return { ok, json: async () => cuerpo } as Response;
}

describe("buscarEnOff (D3/P4 · manual-first)", () => {
  it("consulta el proxy una vez y reutiliza la caché local", async () => {
    const fetchFalso = vi.fn().mockResolvedValue(
      respuesta({
        encontrado: true,
        nombre: "Refresco Cola",
        marca: "Big Cola",
        cantidad: "355 ml",
      }),
    );
    vi.stubGlobal("fetch", fetchFalso);

    const primero = await buscarEnOff("7501000000017", db);
    expect(primero).toEqual({ nombre: "Refresco Cola", marca: "Big Cola", cantidad: "355 ml" });
    expect(fetchFalso).toHaveBeenCalledTimes(1);

    const segundo = await buscarEnOff("7501000000017", db);
    expect(segundo?.nombre).toBe("Refresco Cola");
    expect(fetchFalso).toHaveBeenCalledTimes(1); // caché de IndexedDB
  });

  it("sin red devuelve null y no lanza (el formulario sigue manual)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(buscarEnOff("7501000000024", db)).resolves.toBeNull();
  });

  it("cachea el “no existe” y no repite la consulta", async () => {
    const fetchFalso = vi.fn().mockResolvedValue(respuesta({ encontrado: false }));
    vi.stubGlobal("fetch", fetchFalso);

    expect(await buscarEnOff("7501000000099", db)).toBeNull();
    expect(await buscarEnOff("7501000000099", db)).toBeNull();
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });

  it("un código inválido no consulta la red", async () => {
    const fetchFalso = vi.fn();
    vi.stubGlobal("fetch", fetchFalso);

    expect(await buscarEnOff("abc", db)).toBeNull();
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it("una respuesta 500 se trata como sin datos", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuesta({}, false)));
    await expect(buscarEnOff("7501000000031", db)).resolves.toBeNull();
  });
});
