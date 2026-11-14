import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { abrirDb, borrarDb, crearRepos, type LaTienditaDb, type SesionCuenta } from "@latiendita/core";
import { asegurarBaseLista, type BaseLocal } from "./baseLocal";
import { CatalogoRepoDexie } from "./catalogoRepoDexie";
import { MovimientosRepoDexie } from "./movimientosRepoDexie";
import { ConteosRepoDexie } from "./conteosRepoDexie";
import { FiadosRepoDexie } from "./fiadosRepoDexie";
import { SesionRepoDexie } from "./sesionRepoDexie";
import { respaldoJson } from "./exportar";
import { calcularResumenInicio } from "./reportes";
import { restaurarRespaldo } from "./importar";
import { PRODUCTOS_DEMO } from "./demo";

let db: LaTienditaDb;
let base: BaseLocal;
let sesion: SesionRepoDexie;
const cuenta = (negocioId: string): SesionCuenta => ({
  negocioId, token: `token-${negocioId}`, usuarioId: `persona-${negocioId}`,
  nombre: negocioId, rol: "dueña", expiraEn: Date.now() + 86400000,
});
const producto = { ...PRODUCTOS_DEMO[0]!, id: "producto-a", nombre: "Producto exclusivo de A", codigoBarras: null };

beforeEach(() => {
  db = abrirDb(`aislamiento-${crypto.randomUUID()}`);
  base = { db, repos: crearRepos(db, "local"), negocioId: "local", seguirSesion: true };
  sesion = new SesionRepoDexie(base);
  vi.stubGlobal("fetch", () => Promise.reject(new TypeError("sin red")));
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await borrarDb(db);
});

it("una sesión nueva abre su negocio vacío y conserva los datos heredados local", async () => {
  await asegurarBaseLista(base);
  const heredados = await db.productos.toArray();
  const cola = await db.outbox.toArray();
  expect(heredados.length).toBeGreaterThan(0);
  await sesion.guardarSesion(cuenta("a"), "1234");
  expect(await new CatalogoRepoDexie(base).listar()).toEqual([]);
  expect(await db.productos.toArray()).toEqual(heredados);
  expect(await db.outbox.toArray()).toEqual(cola);
});

it("A → B no comparte catálogo, stock, conteos, fiados, reportes ni respaldo", async () => {
  const catalogo = new CatalogoRepoDexie(base);
  const movimientos = new MovimientosRepoDexie(base);
  const conteos = new ConteosRepoDexie(base);
  const fiados = new FiadosRepoDexie(base);
  await sesion.guardarSesion(cuenta("a"), "1234");
  await catalogo.guardar(producto);
  await movimientos.agregar({ productoId: producto.id, tipo: "entrada", cantidadBase: 7, opId: "op-a" });
  const conteo = await conteos.iniciar();
  await conteos.registrarItem(conteo.id, producto.id, 6);
  const cliente = await fiados.crearClienteConOp({ nombre: "Cliente de A" });
  await fiados.crearCargoConOp({ clienteId: cliente.id, montoCentavos: 500 });
  const colaA = await db.outbox.toArray();
  expect(colaA.every((op) => op.negocioId === "a")).toBe(true);
  const datosA = await respaldoJson(base);

  await sesion.guardarSesion(cuenta("b"), "5678");
  expect(await catalogo.listar()).toEqual([]);
  expect(await catalogo.obtener(producto.id)).toBeNull();
  expect(await movimientos.stockDe(producto.id)).toBe(0);
  expect(await movimientos.listarPorProducto(producto.id)).toEqual([]);
  expect(await conteos.retomar()).toBeUndefined();
  expect(await fiados.obtenerCliente(cliente.id)).toBeNull();
  expect(await fiados.listarClientesConSaldo()).toEqual([]);
  expect((await calcularResumenInicio(base)).productos).toBe(0);
  expect((await respaldoJson(base)).negocioId).toBe("b");
  expect((await respaldoJson(base)).productos).toEqual([]);
  await expect(catalogo.guardar(producto)).rejects.toThrow(/otro negocio/);
  await expect(movimientos.agregar({ productoId: producto.id, tipo: "salida", cantidadBase: 1 })).rejects.toThrow(/no encontrado/);
  await expect(conteos.registrarItem(conteo.id, producto.id, 1)).rejects.toThrow(/no encontrad/);
  await expect(fiados.crearCargoConOp({ clienteId: cliente.id, montoCentavos: 100 })).rejects.toThrow(/no encontrado/);
  expect(await db.outbox.toArray()).toEqual(colaA);

  await sesion.cerrarSesion();
  expect(await db.outbox.toArray()).toEqual(colaA);
  await sesion.guardarSesion(cuenta("a"), "1234");
  db.close();
  const retomada = new SesionRepoDexie(base);
  await retomada.bloquear();
  expect(await retomada.desbloquear("5678")).toBe(false);
  expect(await retomada.desbloquear("1234")).toBe(true);
  expect(await movimientos.stockDe(producto.id)).toBe(7);
  expect((await conteos.retomar())?.id).toBe(conteo.id);
  expect((await fiados.obtenerCliente(cliente.id))?.saldoCentavos).toBe(500);
  const recuperados = await respaldoJson(base);
  expect({ ...recuperados, exportadoEn: "" }).toEqual({ ...datosA, exportadoEn: "" });
  expect(await db.outbox.toArray()).toEqual(colaA);
});

it("stock por ID no revela la caché ni el libro de otro negocio", async () => {
  const a: BaseLocal = { db, repos: crearRepos(db, "a"), negocioId: "a", sembrarDemo: false };
  const b: BaseLocal = { db, repos: crearRepos(db, "b"), negocioId: "b", sembrarDemo: false };
  await a.repos.productos.crear(producto);
  await a.repos.movimientos.registrarEntrada({ productoId: producto.id, cantidadBase: 4 });
  expect(await new MovimientosRepoDexie(b).stockDe(producto.id)).toBe(0);
  await db.stock_cache.clear();
  expect(await new MovimientosRepoDexie(b).stockDe(producto.id)).toBe(0);
});

it("restaurar no acepta IDs de otro negocio ni deja filas parciales", async () => {
  await sesion.guardarSesion(cuenta("a"), "1234");
  await new CatalogoRepoDexie(base).guardar(producto);
  const datosA = await respaldoJson(base);
  await sesion.guardarSesion(cuenta("b"), "5678");
  const datos = { ...datosA, categorias: [{ id: "categoria-nueva", nombre: "Nueva", negocioId: "a", updatedAt: 1, deletedAt: null, serverSeq: null, rev: 0 }] };
  await expect(restaurarRespaldo(datos, base)).rejects.toThrow(/otro negocio/);
  expect(await db.categorias.count()).toBe(0);
  expect((await db.productos.get(producto.id))?.negocioId).toBe("a");
});

it("las suscripciones vuelven a consultar el negocio al cambiar de sesión", async () => {
  await sesion.guardarSesion(cuenta("a"), "1234");
  const catalogo = new CatalogoRepoDexie(base);
  await catalogo.guardar(producto);
  const verCatalogo = vi.fn();
  const verMovimientos = vi.fn();
  const verFiados = vi.fn();
  const cancelar = [
    catalogo.suscribir(verCatalogo),
    new MovimientosRepoDexie(base).suscribir(verMovimientos),
    new FiadosRepoDexie(base).suscribir(verFiados),
  ];
  try {
    // Esperar una escritura observable evita confundir la emisión inicial con el cambio de cuenta.
    await vi.waitFor(async () => {
      await catalogo.guardar({ ...producto, nombre: "Nombre actualizado" });
      expect(verCatalogo).toHaveBeenCalled();
    });
    verCatalogo.mockClear();
    await sesion.guardarSesion(cuenta("b"), "5678");
    await vi.waitFor(() => {
      expect(verCatalogo).toHaveBeenCalled();
      expect(verMovimientos).toHaveBeenCalled();
      expect(verFiados).toHaveBeenCalled();
    });
    expect(await catalogo.listar()).toEqual([]);
  } finally {
    cancelar.forEach((fn) => fn());
  }
});

it("restore rechaza referencias a productos ajenos aunque sus IDs no estén en el respaldo", async () => {
  await sesion.guardarSesion(cuenta("a"), "1234");
  await new CatalogoRepoDexie(base).guardar(producto);
  await new MovimientosRepoDexie(base).agregar({ productoId: producto.id, tipo: "entrada", cantidadBase: 7 });
  const datosA = await respaldoJson(base);
  await sesion.guardarSesion(cuenta("b"), "5678");
  const mov = { ...datosA.movimientos[0]!, id: "mov-nuevo", opId: "op-nueva" };
  await expect(restaurarRespaldo({ ...datosA, productos: [], movimientos: [mov] }, base)).rejects.toThrow(/otro negocio|no pertenece/);
  expect(await db.movimientos.get(mov.id)).toBeUndefined();
  expect((await db.stock_cache.get(producto.id))?.stock).toBe(7);
});
