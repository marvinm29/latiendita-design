import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  abrirDb,
  borrarDb,
  crearRepos,
  type LaTienditaDb,
  type SesionCuenta,
} from "@latiendita/core";
import type { BaseLocal } from "./baseLocal";
import { SesionRepoDexie } from "./sesionRepoDexie";

const PIN = "1234";

function sesionDePrueba(): SesionCuenta {
  return {
    token: "token-opaco-de-prueba",
    negocioId: "negocio-1",
    usuarioId: "usuario-1",
    nombre: "Marta",
    rol: "dueña",
    expiraEn: Date.now() + 30 * 24 * 60 * 60 * 1000,
  };
}

let db: LaTienditaDb;
let base: BaseLocal;
let repo: SesionRepoDexie;

beforeEach(() => {
  db = abrirDb(`sesion-prueba-${crypto.randomUUID()}`);
  base = { db, repos: crearRepos(db, "negocio-1"), negocioId: "negocio-1" };
  repo = new SesionRepoDexie(base);
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await borrarDb(db);
});

describe("sesionRepo · guardar y retomar (T-05)", () => {
  it("guarda la sesión y su verificador; al retomar sigue desbloqueada", async () => {
    const sesion = sesionDePrueba();
    await repo.guardarSesion(sesion, PIN);

    expect(await repo.sesionActual()).toEqual(sesion);
    expect(await repo.estaBloqueada()).toBe(false);

    const fila = await db.sesion_local.get("actual");
    expect(fila?.verificadorPin.sal.length).toBeGreaterThan(0);
    expect(fila?.verificadorPin.hash.length).toBeGreaterThan(0);
    expect(fila?.verificadorPin.iteraciones).toBeGreaterThan(10_000);
    // El PIN nunca se guarda en claro (sólo su hash PBKDF2).
    expect(JSON.stringify(fila)).not.toContain(`"${PIN}"`);
  });
});

describe("sesionRepo · bloqueo y desbloqueo sin red", () => {
  it("bloquea, rechaza un PIN incorrecto y desbloquea con el correcto", async () => {
    await repo.guardarSesion(sesionDePrueba(), PIN);

    await repo.bloquear();
    expect(await repo.estaBloqueada()).toBe(true);

    // Sin red: el desbloqueo usa sólo Web Crypto + IndexedDB.
    const conRedOriginal = globalThis.fetch;
    vi.stubGlobal("fetch", () => Promise.reject(new TypeError("sin red")));

    expect(await repo.desbloquear("9999")).toBe(false);
    expect(await repo.estaBloqueada()).toBe(true);

    expect(await repo.desbloquear(PIN)).toBe(true);
    expect(await repo.estaBloqueada()).toBe(false);
    expect(await repo.sesionActual()).not.toBeNull();

    vi.stubGlobal("fetch", conRedOriginal);
  });

  it("sin sesión, desbloquear no valida nada y sigue bloqueada=false", async () => {
    expect(await repo.estaBloqueada()).toBe(false);
    expect(await repo.desbloquear(PIN)).toBe(false);
    expect(await repo.sesionActual()).toBeNull();
  });
});

describe("sesionRepo · cerrar sesión", () => {
  it("borra la sesión local e intenta avisar al servidor (best-effort)", async () => {
    const fetchFalso = vi.fn(() => Promise.reject(new TypeError("sin red")));
    vi.stubGlobal("fetch", fetchFalso);

    await repo.guardarSesion(sesionDePrueba(), PIN);
    await repo.cerrarSesion();

    expect(await repo.sesionActual()).toBeNull();
    expect(await db.sesion_local.get("actual")).toBeUndefined();
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    const [url, opciones] = fetchFalso.mock.calls[0] as unknown as [
      string,
      { method: string; headers: Record<string, string> },
    ];
    expect(url).toBe("/auth/salir");
    expect(opciones.method).toBe("POST");
    expect(opciones.headers["Authorization"]).toBe("Bearer token-opaco-de-prueba");
  });

  it("sin red, cerrar igualmente borra la sesión local", async () => {
    await repo.guardarSesion(sesionDePrueba(), PIN);
    vi.stubGlobal("fetch", () => Promise.reject(new TypeError("sin red")));

    await expect(repo.cerrarSesion()).resolves.toBeUndefined();
    expect(await repo.sesionActual()).toBeNull();
  });
});
