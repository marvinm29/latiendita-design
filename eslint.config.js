import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * ESLint flat config (M0). Reglas recomendadas de JS + TypeScript, sin
 * type-checked (evita ruido y lentitud; `pnpm typecheck` ya cubre los tipos).
 *
 * El diseño (`design/`) es HTML/CSS/JS plano sin build y se valida con
 * `design/tools/qa.py`; no se lintea con ESLint.
 */
export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "design/**",
      "**/coverage/**",
      "**/test-results/**",
      "**/playwright-report/**",
      "**/blob-report/**",
      "infra/data/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.mjs", "**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node },
    },
  },
  {
    files: ["apps/api/**/*.ts"],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ["apps/web/**/*.{ts,tsx}", "packages/ui/**/*.tsx"],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    // Configs de herramientas (Vite, Vitest, Playwright) corren en Node.
    files: ["**/*.config.{ts,mjs,js}", "**/vite.config.ts", "**/vitest.config.ts"],
    languageOptions: { globals: { ...globals.node } },
  },
);
