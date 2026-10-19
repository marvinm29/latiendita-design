import { expect, test, type Page } from "@playwright/test";
import { esperarCatalogo } from "./ayudas";

/**
 * C9 · PWA instalable y recarga offline (T-07).
 *
 * Corre contra `vite preview` (build de producción) porque el service worker
 * solo se genera ahí. La primera visita registra el SW; como `registerType`
 * es "prompt" (sin `clientsClaim`), la recarga online siguiente es la que deja
 * la página controlada. A partir de ahí, `setOffline(true)` + `reload()` debe
 * servir el app-shell desde el precache de Workbox.
 */

/** Espera a que el SW esté activo y controlando la página. */
async function esperarControl(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
    await page.reload();
  }
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), {
      message: "el service worker debe controlar la página tras una recarga",
    })
    .toBe(true);
}

test.describe("C9 · PWA", () => {
  test("recarga sin conexión desde la caché del app-shell", async ({ page, context }) => {
    await page.goto("/productos");
    await esperarCatalogo(page);
    await esperarControl(page);

    await context.setOffline(true);
    await page.reload();

    // El shell (HTML/JS/CSS/fuentes) sale del precache y la semilla demo de
    // IndexedDB sigue disponible: la app vuelve completa, no una página de error.
    await expect(page.getByRole("heading", { name: "Productos" })).toBeVisible();
    await esperarCatalogo(page);
    await expect(page.getByRole("navigation", { name: "Navegación principal" })).toBeVisible();

    await context.setOffline(false);
  });

  test("el manifest es instalable (name, start_url e iconos 192/512)", async ({ request }) => {
    const respuesta = await request.get("/manifest.webmanifest");
    expect(respuesta.status()).toBe(200);

    const manifest = (await respuesta.json()) as {
      name?: string;
      start_url?: string;
      display?: string;
      lang?: string;
      icons?: Array<{ src: string; sizes: string; type: string }>;
    };

    expect(manifest.name).toBe("LaTiendita");
    expect(manifest.start_url).toBe("/inicio");
    expect(manifest.display).toBe("standalone");
    expect(manifest.lang).toBe("es-SV");

    const iconos = manifest.icons ?? [];
    expect(iconos.some((icono) => icono.sizes === "192x192")).toBe(true);
    expect(iconos.some((icono) => icono.sizes === "512x512")).toBe(true);

    for (const icono of iconos) {
      const iconoResp = await request.get(icono.src);
      expect(iconoResp.status(), `icono ${icono.src}`).toBe(200);
    }
  });
});
