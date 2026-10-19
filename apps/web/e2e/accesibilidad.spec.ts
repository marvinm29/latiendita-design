import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * WCAG 2.2 AA es contrato (design/ACCESSIBILITY.md). Se auditan las pantallas
 * de C2–C5 en su estado inicial; los flujos con teclado/diálogos se cubren en
 * los e2e funcionales (S2) y el cierre formal con lector de pantalla es S8.
 */
const RUTAS = [
  { ruta: "/productos", listo: "Refresco Big Cola 355ml" },
  { ruta: "/movimiento/p-refresco-big-cola", listo: "Stock actual" },
  { ruta: "/conteo", listo: "Escanea el primer producto" },
  { ruta: "/escanear", listo: /Apunta al código de barras|Escaneo con cámara/ },
];

for (const { ruta, listo } of RUTAS) {
  test(`sin violaciones AA en ${ruta}`, async ({ page }) => {
    await page.goto(ruta);
    await page.getByText(listo).first().waitFor();
    await page.waitForTimeout(300); // deja asentar liveQuery y transiciones

    const resultado = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();

    expect(resultado.violations).toEqual([]);
  });
}
