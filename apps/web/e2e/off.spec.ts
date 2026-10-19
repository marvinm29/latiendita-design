import { expect, test } from "@playwright/test";
import { teclear } from "./ayudas";

/**
 * Open Food Facts (D3/P4): acelerador, nunca dependencia.
 * - Con datos: autocompleta el nombre al crear por código.
 * - Sin red: el código desconocido abre el formulario y se puede guardar igual.
 */
test.describe("Open Food Facts (D3/P4)", () => {
  test("C2.2 · autocompleta el nombre al crear por código", async ({ page }) => {
    await page.route("**/off/7501000000017", (ruta) =>
      ruta.fulfill({
        json: {
          codigo: "7501000000017",
          encontrado: true,
          nombre: "Refresco Cola 355 ml",
          marca: "Big Cola",
        },
      }),
    );

    await page.goto("/productos/nuevo?codigo=7501000000017");

    await expect(page.getByLabel("Código de barras")).toHaveValue("7501000000017");
    await expect(page.getByLabel("Nombre del producto")).toHaveValue("Refresco Cola 355 ml");
    await expect(
      page.getByText("Nombre sugerido por Open Food Facts; puedes cambiarlo."),
    ).toBeVisible();
  });

  test("C2.2/P4 · sin red, un código desconocido abre el formulario manual", async ({
    page,
    context,
  }) => {
    await page.goto("/escanear");
    await expect(
      page.getByRole("button", { name: /Escribir (el )?código/ }),
    ).toBeVisible();

    await context.setOffline(true);

    await page.getByRole("button", { name: /Escribir (el )?código/ }).click();
    await teclear(page, "7591234500011");
    await page.getByRole("button", { name: "Buscar producto" }).click();

    await expect(
      page.getByText("No encontramos ese código en tu catálogo"),
    ).toBeVisible();
    await page.getByRole("button", { name: "Crear producto" }).click();

    await expect(page.getByLabel("Código de barras")).toHaveValue("7591234500011");
    await expect(page.getByLabel("Nombre del producto")).toHaveValue("");

    // Manual-first: el formulario se completa y guarda sin OFF ni red.
    await page.getByLabel("Nombre del producto").fill("Producto local");
    await page.getByLabel("Precio de venta").fill("1.00");
    await page.getByRole("button", { name: "Guardar producto" }).click();

    await expect(page).toHaveURL(/\/productos$/);
    await expect(page.getByText("Producto local").first()).toBeVisible();
  });
});
