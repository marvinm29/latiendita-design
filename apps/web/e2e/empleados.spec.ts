import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * C1.2 · la dueña genera el código de invitación desde «Más → Empleados».
 * La API se intercepta: el foco es la UI y sus estados (dueña, empleado, sin
 * sesión), no el servidor (ya cubierto por 14 tests de API).
 */

const NEGOCIO = {
  id: "negocio-e2e",
  nombre: "Tienda de Marta",
  moneda: "USD",
  creadoEn: 1_760_000_000_000,
};

function sesion(nombre: string, rol: "dueña" | "empleado") {
  return {
    token: `token-${rol}`,
    negocioId: NEGOCIO.id,
    usuarioId: `usuario-${rol}`,
    nombre,
    rol,
    expiraEn: Date.now() + 30 * 24 * 60 * 60 * 1000,
  };
}

async function crearTienda(page: Page): Promise<void> {
  await page.route("**/auth/negocio", (ruta) =>
    ruta.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ negocio: NEGOCIO, sesion: sesion("Marta", "dueña") }),
    }),
  );
  await page.goto("/");
  await page.getByLabel("Nombre de tu tienda").fill("Tienda de Marta");
  await page.getByLabel("Tu nombre", { exact: true }).fill("Marta");
  await page.getByLabel("PIN", { exact: true }).fill("1234");
  await page.getByLabel("Confirma tu PIN").fill("1234");
  await page.getByRole("button", { name: "Crear mi tienda" }).click();
  await expect(page).toHaveURL(/\/inicio$/);
}

async function irAEmpleados(page: Page): Promise<void> {
  await page.getByRole("link", { name: "Más" }).click();
  await page.getByRole("link", { name: "Empleados" }).click();
  await expect(page).toHaveURL(/\/mas\/empleados$/);
}

test.describe("C1.2 · invitar empleados", () => {
  test("la dueña genera un código de un solo uso y se anuncia", async ({ page }) => {
    await crearTienda(page);
    await page.route("**/auth/invitacion", (ruta) =>
      ruta.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          codigo: "ABCD2345",
          expiraEn: Date.now() + 7 * 24 * 60 * 60 * 1000,
        }),
      }),
    );

    await irAEmpleados(page);
    await page.getByRole("button", { name: "Generar código de invitación" }).click();

    await expect(page.getByText("ABCD-2345")).toBeVisible();
    await expect(page.getByRole("status")).toContainText("Vence el");
    await expect(page.getByRole("status")).toContainText("una sola vez");

    const resultado = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(resultado.violations).toEqual([]);
  });

  test("un empleado no puede invitar", async ({ page }) => {
    await page.route("**/auth/unirse", (ruta) =>
      ruta.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ negocio: NEGOCIO, sesion: sesion("José", "empleado") }),
      }),
    );
    await page.goto("/unirse");
    await page.getByLabel("Tu nombre", { exact: true }).fill("José");
    await page.getByLabel("Código de invitación").fill("ABCD-2345");
    await page.getByLabel("PIN", { exact: true }).fill("5678");
    await page.getByLabel("Confirma tu PIN").fill("5678");
    await page.getByRole("button", { name: "Unirme" }).click();
    await expect(page).toHaveURL(/\/inicio$/);

    await irAEmpleados(page);
    await expect(page.getByText("Solo la dueña puede generar códigos")).toBeVisible();
  });

  test("sin sesión explica que hace falta entrar como dueña", async ({ page }) => {
    await page.goto("/mas/empleados");
    await expect(page.getByText("Inicia sesión como dueña")).toBeVisible();
  });
});
