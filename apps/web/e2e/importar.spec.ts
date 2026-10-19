import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { Buffer } from "node:buffer";

const CABECERA =
  "nombre,categoria,codigo_barras,unidad_base,unidad_venta,factor,costo_usd,precio_usd,stock_minimo";

/**
 * C10.2/C10.3 · restaurar un respaldo JSON e importar productos desde CSV,
 * todo en el teléfono y sin servidor. Comprueba además que la pantalla
 * inicial de /mas/respaldo sigue sin violaciones WCAG 2.2 AA.
 */
test.describe("C10 · importar y restaurar", () => {
  test("descarga la plantilla e importa un producto CSV", async ({ page }) => {
    await page.goto("/mas/respaldo");
    await expect(page.getByText("Importar productos (CSV)")).toBeVisible();

    const [plantilla] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Descargar plantilla CSV" }).click(),
    ]);
    expect(plantilla.suggestedFilename()).toBe("latiendita-plantilla-productos.csv");
    const rutaPlantilla = await plantilla.path();
    expect(rutaPlantilla).not.toBeNull();
    const textoPlantilla = await readFile(rutaPlantilla!, "utf8");
    expect(textoPlantilla).toContain(CABECERA);
    expect(textoPlantilla.trim().split(/\r?\n/)).toHaveLength(3);

    const csv =
      `\uFEFF${CABECERA}\r\n` +
      '"Producto Importado E2E","Importados",,unidad,unidad,1,"0,85",1.50,2\r\n';

    await page.getByLabel("Archivo CSV de productos").setInputFiles({
      name: "productos.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv, "utf8"),
    });

    await expect(page.getByText("1 producto creado.", { exact: false })).toBeVisible();
    await expect(page.getByText("Resultado de la importación", { exact: true })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "1 creados" })).toBeVisible();

    await page.goto("/productos");
    await expect(page.getByText("Producto Importado E2E").first()).toBeVisible();
  });

  test("restaura un JSON: muestra resumen, confirma y aparece el producto", async ({ page }) => {
    await page.goto("/mas/respaldo");
    const ahora = Date.now();
    const respaldo = {
      version: 1,
      exportadoEn: new Date(ahora).toISOString(),
      negocioId: "local",
      productos: [
        {
          id: "e2e-json-producto",
          nombre: "Producto JSON E2E",
          categoria: "Importados",
          codigoBarras: null,
          unidadBase: "unidad",
          unidadVenta: "unidad",
          factor: 1,
          costoCentavos: 100,
          precioCentavos: 150,
          stockMinimoBase: 1,
          activo: true,
          negocioId: "local",
          updatedAt: ahora,
          deletedAt: null,
          serverSeq: null,
          rev: 0,
        },
      ],
      movimientos: [
        {
          id: "e2e-json-movimiento",
          productoId: "e2e-json-producto",
          tipo: "entrada",
          cantidadBase: 4,
          creadoEn: ahora,
          opId: "e2e-json-op",
          negocioId: "local",
          ocurridoAt: ahora,
          serverSeq: null,
        },
      ],
      clientes: [],
      fiados: [],
      categorias: [],
    };

    await page.getByLabel("Archivo JSON de respaldo").setInputFiles({
      name: "respaldo.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(respaldo), "utf8"),
    });

    const dialogo = page.getByRole("dialog", { name: "Restaurar respaldo" });
    await expect(dialogo).toBeVisible();
    await expect(dialogo).toContainText(
      "Se combinará con tus datos actuales, no se borra nada",
    );
    await expect(dialogo.getByText("respaldo.json")).toBeVisible();
    await expect(dialogo).toContainText("Total de filas");

    await dialogo.getByRole("button", { name: "Restaurar ahora" }).click();
    await expect(page.getByText("Respaldo restaurado", { exact: true })).toBeVisible();
    await expect(page.getByText("Stock recalculado en 1 producto.")).toBeVisible();

    await page.goto("/productos");
    await expect(page.getByText("Producto JSON E2E").first()).toBeVisible();
  });

  test("un JSON inválido muestra el error y le da el foco", async ({ page }) => {
    await page.goto("/mas/respaldo");
    await page.getByLabel("Archivo JSON de respaldo").setInputFiles({
      name: "roto.json",
      mimeType: "application/json",
      buffer: Buffer.from("{ esto no es json", "utf8"),
    });

    const alerta = page.getByRole("alert");
    await expect(alerta).toBeVisible();
    await expect(alerta).toContainText("JSON válido");
    await expect(alerta).toBeFocused();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("sin violaciones AA en el estado inicial de /mas/respaldo", async ({ page }) => {
    await page.goto("/mas/respaldo");
    await expect(page.getByText("Tus datos son tuyos")).toBeVisible();
    await page.waitForTimeout(300);

    const resultado = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(resultado.violations).toEqual([]);
  });
});
