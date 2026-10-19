/**
 * Proxy de Open Food Facts (D3/P4) — 003 §6.
 *
 * El cliente NUNCA llama a OFF directamente: se evitan CORS, cuota y fugas de
 * privacidad. Este endpoint consulta `world.openfoodfacts.org`, cachea en
 * memoria con TTL (positivos 24 h, negativos 1 h) y responde SIEMPRE 200 con
 * `encontrado`. Sin red, timeout o error: `encontrado: false` y el formulario
 * sigue manual-first — OFF nunca es una dependencia dura (P4).
 */
import type { FastifyInstance } from "fastify";

export interface RespuestaOff {
  codigo: string;
  encontrado: boolean;
  nombre?: string;
  marca?: string;
  cantidad?: string;
  /** Sólo cuando `encontrado` es false. */
  motivo?: "invalido" | "no_existe" | "sin_red";
}

const TTL_ENCONTRADO_MS = 24 * 60 * 60 * 1000;
const TTL_NO_ENCONTRADO_MS = 60 * 60 * 1000;
const TIMEOUT_MS = 3_000;
const MAX_ENTRADAS = 500;
const CAMPOS = "product_name,product_name_es,brands,quantity";

interface EntradaCache {
  valor: RespuestaOff;
  expira: number;
}

/** Caché del servidor: evita golpear OFF con el mismo código. */
const cache = new Map<string, EntradaCache>();

function leerCache(codigo: string): RespuestaOff | undefined {
  const entrada = cache.get(codigo);
  if (!entrada) return undefined;
  if (entrada.expira <= Date.now()) {
    cache.delete(codigo);
    return undefined;
  }
  return entrada.valor;
}

function guardarCache(valor: RespuestaOff): void {
  const ttl = valor.encontrado ? TTL_ENCONTRADO_MS : TTL_NO_ENCONTRADO_MS;
  cache.set(valor.codigo, { valor, expira: Date.now() + ttl });
  // Cota simple: un servidor de barrio no debe crecer sin límite.
  if (cache.size > MAX_ENTRADAS) {
    const primero = cache.keys().next().value;
    if (primero !== undefined) cache.delete(primero);
  }
}

function texto(valor: unknown): string | undefined {
  return typeof valor === "string" && valor.trim() !== "" ? valor.trim() : undefined;
}

async function consultarOff(codigo: string): Promise<RespuestaOff> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${codigo}.json?fields=${CAMPOS}`;
  const respuesta = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      // OFF pide un User-Agent identificable (no bloquea, pero es buena práctica).
      "User-Agent":
        "LaTiendita/0.1 (inventario offline; +https://github.com/marvinm29/latiendita-design)",
      accept: "application/json",
    },
  });
  if (!respuesta.ok) {
    return { codigo, encontrado: false, motivo: "sin_red" };
  }

  const datos = (await respuesta.json()) as {
    status?: number;
    product?: Record<string, unknown>;
  };
  const producto = datos.product;
  const nombre =
    texto(producto?.["product_name_es"]) ?? texto(producto?.["product_name"]);

  if (datos.status !== 1 || !nombre) {
    return { codigo, encontrado: false, motivo: "no_existe" };
  }

  return {
    codigo,
    encontrado: true,
    nombre,
    marca: texto(producto?.["brands"]),
    cantidad: texto(producto?.["quantity"]),
  };
}

export function registrarOff(app: FastifyInstance): void {
  app.get<{ Params: { codigo: string } }>("/off/:codigo", async (peticion) => {
    const codigo = peticion.params.codigo.trim();
    if (!/^\d{8,14}$/.test(codigo)) {
      return { codigo, encontrado: false, motivo: "invalido" } satisfies RespuestaOff;
    }

    const cacheado = leerCache(codigo);
    if (cacheado) return cacheado;

    try {
      const valor = await consultarOff(codigo);
      guardarCache(valor);
      return valor;
    } catch {
      // Timeout, DNS, OFF caído… no se cachea el fallo de red (puede volver).
      return { codigo, encontrado: false, motivo: "sin_red" } satisfies RespuestaOff;
    }
  });
}
