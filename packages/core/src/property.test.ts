import { describe, expect, it } from "vitest";
import { crearMovimiento, invertirMovimiento } from "./libro";
import { actualizarCache, stockDerivado } from "./stock";
import type { Movimiento } from "./tipos";

/**
 * PRNG mulberry32 — semilla fija para reproducibilidad total.
 * No dependemos de fast-check: el loop con semilla cubre la propiedad.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = 0x1a71e5; // semilla fija documentada
const PRODUCTOS = ["p1", "p2", "p3", "p4", "p5"] as const;
const TIPOS = ["entrada", "salida", "ajuste"] as const;

function generarMovimientos(
  rand: () => number,
  cantidad: number,
): Movimiento[] {
  const movs: Movimiento[] = [];
  for (let i = 0; i < cantidad; i++) {
    const productoId = PRODUCTOS[Math.floor(rand() * PRODUCTOS.length)]!;
    const tipo = TIPOS[Math.floor(rand() * TIPOS.length)]!;
    const bruto = Math.round(rand() * 2000) / 10; // 0.0 … 200.0
    let cantidadBase: number;
    if (tipo === "ajuste") {
      const signo = rand() < 0.5 ? -1 : 1;
      cantidadBase = signo * (bruto || 1);
    } else {
      cantidadBase = bruto || 1;
    }
    movs.push(
      crearMovimiento({
        productoId,
        tipo,
        cantidadBase,
        id: `m${i}`,
        creadoEn: i,
      }),
    );
  }
  return movs;
}

describe("property: caché incremental == stockDerivado", () => {
  it("tras aplicar toda la secuencia, cada producto coincide (semilla fija)", () => {
    const rand = mulberry32(SEED);
    const movs = generarMovimientos(rand, 200);

    const cache = new Map<string, number>();
    for (const m of movs) {
      actualizarCache(cache, m.productoId, m);
    }

    for (const productoId of PRODUCTOS) {
      const desdeCache = cache.get(productoId) ?? 0;
      const derivado = stockDerivado(movs, productoId);
      expect(desdeCache).toBe(derivado);
    }
  });

  it("es estable en varias corridas con la misma semilla", () => {
    const a = generarMovimientos(mulberry32(SEED), 80);
    const b = generarMovimientos(mulberry32(SEED), 80);
    expect(a).toEqual(b);

    const cacheA = new Map<string, number>();
    const cacheB = new Map<string, number>();
    for (const m of a) actualizarCache(cacheA, m.productoId, m);
    for (const m of b) actualizarCache(cacheB, m.productoId, m);
    expect(Object.fromEntries(cacheA)).toEqual(Object.fromEntries(cacheB));
  });

  it("invertir toda la secuencia devuelve el stock a 0", () => {
    const rand = mulberry32(SEED);
    const movs = generarMovimientos(rand, 50);
    const inversos = movs.map((m, i) =>
      invertirMovimiento(m, { id: `inv${i}`, creadoEn: 10_000 + i }),
    );

    for (const productoId of PRODUCTOS) {
      const forward = stockDerivado(movs, productoId);
      const total = stockDerivado([...movs, ...inversos], productoId);
      expect(total).toBe(0);
      // el forward puede ser cualquier entero/fracción; el inverso lo cancela
      expect(stockDerivado(inversos, productoId)).toBe(-forward);
    }
  });

  it("prefijos: caché parcial siempre igual a stockDerivado del prefijo", () => {
    const rand = mulberry32(SEED);
    const movs = generarMovimientos(rand, 100);
    const cache = new Map<string, number>();

    for (let i = 0; i < movs.length; i++) {
      const m = movs[i]!;
      actualizarCache(cache, m.productoId, m);
      const prefijo = movs.slice(0, i + 1);
      for (const productoId of PRODUCTOS) {
        expect(cache.get(productoId) ?? 0).toBe(
          stockDerivado(prefijo, productoId),
        );
      }
    }
  });
});
