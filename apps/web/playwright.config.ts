import { defineConfig, devices } from "@playwright/test";

/**
 * e2e de la PWA (S2): flujos C2–C5 sin red + accesibilidad WCAG 2.2 AA.
 *
 * - Cada test corre en un contexto limpio → IndexedDB vacío y semilla demo
 *   determinista.
 * - `setOffline(true)` corta TODA la red (incluido el dev server): por eso los
 *   flujos offline navegan por SPA (el shell ya está cargado), que es el
 *   comportamiento real de la app sin conexión. La recarga offline llegará con
 *   el service worker (C9/M3).
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
      use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 640 } },
    },
  ],
  webServer: {
    command: "pnpm dev --host 127.0.0.1 --port 5173",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
