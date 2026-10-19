import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

/**
 * C10.1/C10.2 · exportar desde el teléfono, sin servidor. Comprueba que la
 * descarga contiene datos reales (cabecera + producto demo) y que el respaldo
 * JSON es válido. Además, WCAG 2.2 AA en la pantalla.
 */
test.describe("C10 · respaldo y datos", () => {
  test("exporta productos CSV y respaldo JSON con datos reales", async ({ page }) => {
    await page.goto("/mas/respaldo");
    await expect(page.getByText("Tus datos son tuyos")).toBeVisible();

    const [csv] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Productos (CSV)" }).click(),
    ]);
    expect(csv.suggestedFilename()).toMatch(/^latiendita-productos-\d{4}-\d{2}-\d{2}\.csv$/);
    const rutaCsv = await csv.path();
    expect(rutaCsv).not.toBeNull();
    const textoCsv = await readFile(rutaCsv!, "utf8");
    expect(textoCsv).toContain("nombre,categoria,codigo_barras");
    expect(textoCsv).toContain("Refresco Big Cola 355ml");

    const [json] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Respaldo completo (JSON)" }).click(),
    ]);
    expect(json.suggestedFilename()).toMatch(/^latiendita-respaldo-\d{4}-\d{2}-\d{2}\.json$/);
    const rutaJson = await json.path();
    expect(rutaJson).not.toBeNull();
    const respaldo = JSON.parse(await readFile(rutaJson!, "utf8")) as {
      version: number;
      productos: unknown[];
      movimientos: unknown[];
    };
    expect(respaldo.version).toBe(1);
    expect(respaldo.productos.length).toBeGreaterThan(0);
    expect(respaldo.movimientos.length).toBeGreaterThan(0);
  });

  test("sin violaciones AA en /mas/respaldo", async ({ page }) => {
    await page.goto("/mas/respaldo");
    await expect(page.getByText("Tus datos son tuyos")).toBeVisible();
    await page.waitForTimeout(300);

    const resultado = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(resultado.violations).toEqual([]);
  });
});
