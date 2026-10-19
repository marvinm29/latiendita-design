import { defineConfig, devices } from "@playwright/test";

/**
 * e2e de la PWA (S2 + C9): flujos C2–C5 sin red, accesibilidad WCAG 2.2 AA y
 * recarga offline con service worker.
 *
 * - Los specs funcionales corren contra `vite dev` (rápido) con los service
 *   workers BLOQUEADOS: así una caché de otra corrida nunca contamina un test.
 * - `pwa.spec.ts` corre contra `vite build && vite preview`, porque el SW solo
 *   existe en el build (C9/T-07). Su contexto sí permite service workers.
 * - Cada test corre en un contexto limpio → IndexedDB vacío y semilla demo
 *   determinista.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  timeout: 30_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL: "http://127.0.0.1:5173",
    viewport: { width: 360, height: 640 },
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: /pwa\.spec\.ts$/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 360, height: 640 },
        serviceWorkers: "block",
      },
    },
    {
      name: "pwa",
      testMatch: /pwa\.spec\.ts$/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://127.0.0.1:4173",
        viewport: { width: 360, height: 640 },
        serviceWorkers: "allow",
      },
    },
  ],
  webServer: [
    {
      command: "pnpm dev --host 127.0.0.1 --port 5173",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      // El SW necesita el build real; preview replica el proxy de /auth y /off.
      command: "pnpm build && pnpm preview --host 127.0.0.1 --port 4173",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
