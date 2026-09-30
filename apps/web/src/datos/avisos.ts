import { signal } from "@preact/signals";

/**
 * Aviso transitorio para la lista de productos (badge “guardado”).
 * La lista lo muestra con `role="status"` y lo limpia a los pocos segundos.
 */
export const avisoLista = signal<string | null>(null);
