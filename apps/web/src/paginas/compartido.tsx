import type { VNode } from "preact";
import { useEffect, useState } from "preact/hooks";
import type { UnidadVenta } from "@latiendita/core";
import { subscribe } from "../router";

/**
 * Ayudantes compartidos por las pantallas C3–C5 (escáner, movimiento, conteo).
 * Nada de red ni persistencia aquí: sólo formato, teclado y lectura de query.
 */

/** Texto de unidad de venta (espejo de ListaProductos). */
export const TEXTO_UNIDAD: Record<UnidadVenta, string> = {
  unidad: "por unidad",
  kg: "por kilo",
  litro: "por litro",
  caja: "por bulto",
};

/** Cantidad → texto sin ceros colgantes (numeric(12,3) del spec). */
export function formatoCantidad(n: number): string {
  return String(Math.round(n * 1000) / 1000);
}

/** Epoch ms → fecha corta en español (para el historial de movimientos). */
export function formatoFecha(ms: number): string {
  return new Date(ms).toLocaleDateString("es-SV", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Texto de teclado/input → número (coma o punto; hasta 3 decimales). */
export function parseCantidad(texto: string): number | null {
  const limpio = texto.replace(/\s/g, "").replace(",", ".");
  if (!/^\d{1,9}(\.\d{1,3})?$/.test(limpio)) return null;
  const valor = Number(limpio);
  return Number.isFinite(valor) ? valor : null;
}

/** op_id único para la outbox (idempotencia de sync, T-03). */
export function nuevoOpId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** URL completa actual (pathname + query), reactiva a navigate() y popstate. */
export function useHref(): string {
  const [href, setHref] = useState(() => window.location.href);
  useEffect(() => {
    const update = (): void => setHref(window.location.href);
    window.addEventListener("popstate", update);
    const unsubscribe = subscribe(update);
    update();
    return () => {
      window.removeEventListener("popstate", update);
      unsubscribe();
    };
  }, []);
  return href;
}

/** Lee un parámetro de la query de una URL completa (o `null`). */
export function parametroBusqueda(href: string, clave: string): string | null {
  return new URL(href, window.location.origin).searchParams.get(clave);
}

// ---- Teclado numérico (mockups 04/07/08: botones reales ≥48px) ----

export type Tecla = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "." | "0" | "del";

const TECLAS: { valor: Tecla; aria?: string }[] = [
  { valor: "1" },
  { valor: "2" },
  { valor: "3" },
  { valor: "4" },
  { valor: "5" },
  { valor: "6" },
  { valor: "7" },
  { valor: "8" },
  { valor: "9" },
  { valor: ".", aria: "Punto decimal" },
  { valor: "0" },
  { valor: "del", aria: "Borrar último dígito" },
];

/**
 * Display (role=status) + teclado numérico del mockup (.keypad de ui.css).
 * El display muestra el valor en grande y tabular; el grid nunca depende
 * del teclado del sistema (C3.2 — el flujo manual siempre funciona).
 */
export function TecladoNumerico({
  valor,
  alPulsar,
  etiqueta,
}: {
  valor: string;
  alPulsar: (tecla: Tecla) => void;
  etiqueta: string;
}): VNode {
  return (
    <div class="keypad">
      <div class="keypad-display" role="status" aria-label={etiqueta}>
        <span class="tabular">{valor === "" ? "0" : valor}</span>
      </div>
      <div class="keypad-grid" role="group" aria-label="Teclado numérico">
        {TECLAS.map((tecla) => (
          <button
            key={tecla.valor}
            type="button"
            class="key"
            aria-label={tecla.aria ?? tecla.valor}
            onClick={() => alPulsar(tecla.valor)}
          >
            {tecla.valor === "del" ? (
              <svg class="icono" aria-hidden="true">
                <use href="#i-delete" />
              </svg>
            ) : (
              tecla.valor
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Añade/quita dígitos al texto del keypad (punto sólo una vez). */
export function editarTexto(actual: string, tecla: Tecla): string {
  if (tecla === "del") return actual.slice(0, -1);
  if (tecla === ".") {
    if (actual.includes(".")) return actual;
    return actual === "" ? "0." : `${actual}.`;
  }
  return `${actual}${tecla}`;
}
