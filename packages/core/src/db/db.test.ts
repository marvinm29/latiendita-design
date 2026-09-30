import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { abrirDb, borrarDb, nombreDeBase, solicitarPersistencia } from "./db";
import { guardarCursorServidor, leerCursorServidor } from "./meta";
import type { LaTienditaDb } from "./schema";

const abiertas: LaTienditaDb[] = [];

function abrir(nombre?: string): LaTienditaDb {
  const db = abrirDb(nombre);
  abiertas.push(db);
  return db;
}

afterEach(async () => {
  const pendientes = abiertas.splice(0, abiertas.length);
  for (const db of pendientes) {
    try {
      await borrarDb(db);
    } catch {
      /* ya borrada */
    }
  }
});

describe("abrirDb", () => {
  it("es singleton por nombre y distinta entre nombres", () => {
    const a = abrir();
    expect(abrir()).toBe(a);
    const b = abrir("negocio-distinto");
    expect(b).not.toBe(a);
    expect(b.name).not.toBe(a.name);
  });

  it("deriva el nombre de la base desde el negocio", () => {
    expect(nombreDeBase()).toBe("latiendita");
    expect(nombreDeBase("Mi Tienda")).toBe("latiendita-mi-tienda");
    expect(nombreDeBase("LaTiendita")).toBe("latiendita");
    expect(nombreDeBase("  ¡Café!  ")).toBe("latiendita-cafe");
  });

  it("crea la base con el esquema v1 y sus 10 tablas", async () => {
    const db = abrir("esquema");
    await db.open();
    expect(db.verno).toBe(1);
    expect(db.tables.map((t) => t.name).sort()).toEqual([
      "categorias",
      "clientes",
      "conteos",
      "fiados",
      "meta",
      "movimientos",
      "outbox",
      "productos",
      "stock_cache",
      "unidades_venta",
    ]);
  });

  it("borrarDb deja la base limpia al reabrirla", async () => {
    const db = abrir("limpieza");
    await db.open();
    await db.meta.put({ clave: "x", valor: 1, actualizadoEn: 0 });
    expect(await db.meta.count()).toBe(1);
    await borrarDb(db);
    abiertas.splice(abiertas.indexOf(db), 1); // ya borrada: no repetir en afterEach
    const otra = abrir("limpieza");
    expect(otra).not.toBe(db);
    expect(await otra.meta.count()).toBe(0);
  });
});

describe("solicitarPersistencia", () => {
  it("devuelve false en entorno sin window (Node/servidor)", async () => {
    expect(typeof window).toBe("undefined");
    expect(await solicitarPersistencia()).toBe(false);
  });
});

describe("cursor de sync (meta/server_seq)", () => {
  it("arranca en 0, guarda por negocio y valida el valor", async () => {
    const db = abrir("cursors");
    await db.open();
    expect(await leerCursorServidor(db, "neg-a")).toBe(0);
    await guardarCursorServidor(db, "neg-a", 42);
    expect(await leerCursorServidor(db, "neg-a")).toBe(42);
    expect(await leerCursorServidor(db, "neg-b")).toBe(0);
    await expect(guardarCursorServidor(db, "neg-a", -1)).rejects.toThrow(/serverSeq/);
  });
});
