/**
 * @latiendita/tokens — fuente única de color/tipografía/espaciado (DESIGN.md §0).
 *
 * El CSS es la fuente de verdad en tiempo de ejecución. Importalo así:
 *
 *   import "@latiendita/tokens/tokens.css";
 *
 * `tokens.css` en este paquete es una COPIA de `design/tokens/tokens.css`.
 * Tras regenerar con `python3 design/tokens/generate.py`, sincroniza con:
 *
 *   pnpm tokens:sync
 */
export const TOKENS_CSS_SPECIFIER = "@latiendita/tokens/tokens.css" as const;
