import { defineConfig } from "vitest/config";

/**
 * Tests de la web: lógica de datos (repos sobre IndexedDB) en entorno Node con
 * `fake-indexeddb` — mismo enfoque que `packages/core`. Las pantallas (Preact)
 * se prueban con e2e/Playwright en S2; aquí no se necesita DOM.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
