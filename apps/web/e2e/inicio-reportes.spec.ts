import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { teclear } from "./ayudas";

/**
 * Inicio (C5.1) y Reportes (C11), 100 % locales (C8.1).
 *
 * Siembra el catálogo demo, crea un fiado de $5.00 y un abono de $2.00 con la
 * UI real, y comprueba: stock bajo en Inicio, valor de inventario y resumen de
 * fiados en Reportes, persistencia al recargar y WCAG 2.2 AA en ambas rutas.
 */

async function sembrarFiado(page: Page): Promise<void> {
  await page.goto("/fiados");
  await page.getByRole("link", { name: "Crear cliente" }).click();

  await page.getByLabel("Nombre del cliente").fill("Doña Rosa");
  await page.getByRole("button", { name: "Crear cliente" }).click();
  await expect(page).toHaveURL(/\/fiados\/[^/]+$/);

  await page.getByRole("button", { name: "Fiar", exact: true }).click();
  await teclear(page, "5");
  await page.getByRole("button", { name: "Registrar fiado" }).click();
  await expect(page.getByRole("status")).toContainText("Fiaste $5.00 a Doña Rosa");

  await page.getByRole("button", { name: "Abonar", exact: true }).click();
  await teclear(page, "2");
  await page.getByRole("button", { name: "Registrar abono" }).click();
  await expect(page.getByRole("status")).toContainText("Abono de $2.00 registrado");
}

async function auditar(page: Page): Promise<void> {
  await page.waitForTimeout(300);
  const resultado = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(resultado.violations).toEqual([]);
}

test.describe("Inicio y reportes locales", () => {
  test("Inicio muestra stock bajo, fiado total y persiste al recargar", async ({
    page,
  }) => {
    await page.goto("/inicio");

    await expect(page.getByRole("heading", { level: 1, name: "Hola" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Lo que falta" })).toBeVisible();

    // Semilla demo: leche agotada, café crítico y harina bajo mínimo.
    await expect(
      page.getByRole("link", { name: /Leche Doña Vera 1 L/ }),
    ).toBeVisible();
    await expect(page.getByText("Agotado", { exact: true })).toBeVisible();
    await expect(page.getByText("Stock crítico", { exact: true })).toBeVisible();
    await expect(page.getByText("Bajo mínimo", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /Fiado total \$0\.00/ })).toBeVisible();

    await sembrarFiado(page);
    await page.goto("/inicio");

    const fiado = page.getByRole("link", { name: /Fiado total \$3\.00/ });
    await expect(fiado).toBeVisible();
    await expect(fiado).toContainText("1 cliente con saldo");

    // Últimos movimientos y accesos reales.
    await expect(page.getByRole("heading", { name: "Últimos movimientos" })).toBeVisible();
    await expect(page.getByText("Refresco Big Cola 355ml").first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Conteo/ }).last()).toBeVisible();
    await expect(page.getByRole("link", { name: /Reportes/ }).last()).toBeVisible();

    // Recargar: todo sale de IndexedDB.
    await page.reload();
    await expect(page.getByRole("link", { name: /Fiado total \$3\.00/ })).toBeVisible();
    await expect(page.getByText("Agotado", { exact: true })).toBeVisible();
  });

  test("Reportes calcula inventario, fiados y ranking por rango", async ({
    page,
  }) => {
    await sembrarFiado(page);
    await page.goto("/mas/reportes");

    await expect(page.getByRole("heading", { name: "Inventario" })).toBeVisible();

    const costo = page.getByRole("article").filter({ hasText: "Valor al costo" });
    const precio = page.getByRole("article").filter({ hasText: "Valor a precio" });
    await expect(costo).toContainText("$62.35");
    await expect(precio).toContainText("$86.60");
    await expect(page.getByText("5 productos con stock")).toBeVisible();

    const fiado = page.getByRole("article").filter({ hasText: "Total fiado" });
    const cobrado = page.getByRole("article").filter({ hasText: "Total cobrado" });
    const saldo = page.getByRole("article").filter({ hasText: "Saldo total" });
    await expect(fiado).toContainText("$5.00");
    await expect(cobrado).toContainText("$2.00");
    await expect(saldo).toContainText("$3.00");
    await expect(page.getByText("1 cliente con saldo pendiente")).toBeVisible();

    await expect(page.getByRole("heading", { name: "Lo que más se movió" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Refresco Big Cola 355ml" }),
    ).toBeVisible();

    // Rango accesible: 30 días por defecto y “Todo” con aria-pressed.
    const treinta = page.getByRole("button", { name: "Últimos 30 días" });
    const todo = page.getByRole("button", { name: "Todo", exact: true });
    await expect(treinta).toHaveAttribute("aria-pressed", "true");
    await expect(todo).toHaveAttribute("aria-pressed", "false");
    await todo.click();
    await expect(todo).toHaveAttribute("aria-pressed", "true");
    await expect(treinta).toHaveAttribute("aria-pressed", "false");

    // Persistencia tras recargar.
    await page.reload();
    await expect(
      page.getByRole("article").filter({ hasText: "Valor al costo" }),
    ).toContainText("$62.35");
    await expect(
      page.getByRole("article").filter({ hasText: "Saldo total" }),
    ).toContainText("$3.00");
  });

  test("sin violaciones AA en Inicio y Reportes con datos", async ({ page }) => {
    await sembrarFiado(page);

    await page.goto("/inicio");
    await expect(page.getByRole("heading", { name: "Lo que falta" })).toBeVisible();
    await auditar(page);

    await page.goto("/mas/reportes");
    await expect(page.getByRole("heading", { name: "Inventario" })).toBeVisible();
    await auditar(page);
  });
});
