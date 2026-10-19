import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { teclear } from "./ayudas";

/**
 * C6 · Fiados de punta a punta, 100 % local (C8.1).
 *
 * Alta de cliente, fiar $5.00, abonar $2.00, saldo derivado $3.00 y
 * persistencia al recargar. Además, WCAG 2.2 AA en la libreta y el detalle.
 */

async function crearClienteDonaRosa(page: Page): Promise<void> {
  await page.goto("/fiados");
  await expect(page.getByText("Agrega el primer cliente")).toBeVisible();
  await page.getByRole("link", { name: "Crear cliente" }).click();

  await page.getByLabel("Nombre del cliente").fill("Doña Rosa");
  await page.getByLabel("Teléfono (opcional)").fill("7788-1234");
  await page.getByRole("button", { name: "Crear cliente" }).click();

  await expect(page).toHaveURL(/\/fiados\/[^/]+$/);
  await expect(page.getByText("Doña Rosa").first()).toBeVisible();
  await expect(page.getByText("$0.00", { exact: true })).toBeVisible();
}

test.describe("C6 · libreta de fiados", () => {
  test("crear cliente, fiar $5.00, abonar $2.00 y persistir $3.00", async ({
    page,
  }) => {
    await crearClienteDonaRosa(page);

    // Fiar $5.00 con el teclado numérico de la app.
    await page.getByRole("button", { name: "Fiar", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Fiar a Doña Rosa" })).toBeVisible();
    await teclear(page, "5");
    await page.getByRole("button", { name: "Registrar fiado" }).click();

    await expect(page.getByRole("status")).toContainText("Fiaste $5.00 a Doña Rosa");
    await expect(page.getByText("$5.00", { exact: true })).toBeVisible();

    // Abonar $2.00.
    await page.getByRole("button", { name: "Abonar", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Abonar de Doña Rosa" })).toBeVisible();
    await teclear(page, "2");
    await page.getByRole("button", { name: "Registrar abono" }).click();

    await expect(page.getByRole("status")).toContainText("Abono de $2.00 registrado");
    await expect(page.getByText("$3.00", { exact: true })).toBeVisible();

    // Historial inmutable visible: cargo +$5.00 y abono −$2.00.
    await expect(page.getByText("+$5.00", { exact: true })).toBeVisible();
    await expect(page.getByText("−$2.00", { exact: true })).toBeVisible();

    // Recargar: todo sale de IndexedDB, sin red.
    await page.reload();
    await expect(page.getByText("$3.00", { exact: true })).toBeVisible();
    await expect(page.getByText("+$5.00", { exact: true })).toBeVisible();

    // La libreta muestra el saldo y el estado en palabras (nunca sólo color).
    await page.getByRole("link", { name: "Volver a la libreta" }).click();
    await expect(page).toHaveURL(/\/fiados$/);
    await expect(page.getByText("$3.00", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Debe", { exact: true })).toBeVisible();
  });

  test("sin violaciones AA en la libreta y el detalle", async ({ page }) => {
    await crearClienteDonaRosa(page);

    // Libreta con un cliente (no el estado vacío).
    await page.getByRole("link", { name: "Volver a la libreta" }).click();
    await expect(page).toHaveURL(/\/fiados$/);
    const libreta = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(libreta.violations).toEqual([]);

    // Vuelve al detalle y audita también el historial con un cargo.
    await page.getByRole("link", { name: /Doña Rosa/ }).click();
    await page.getByRole("button", { name: "Fiar", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Fiar a Doña Rosa" })).toBeVisible();
    await teclear(page, "5");
    await page.getByRole("button", { name: "Registrar fiado" }).click();
    await expect(page.getByText("$5.00", { exact: true })).toBeVisible();

    const detalle = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(detalle.violations).toEqual([]);
  });
});
