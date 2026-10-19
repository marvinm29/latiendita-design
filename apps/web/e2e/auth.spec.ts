import { expect, test, type Page } from "@playwright/test";

/**
 * S3 · e2e del acceso (C1 / T-05).
 *
 * La API se intercepta con `page.route` (no hace falta levantarla):
 * - alta de negocio y unión con código,
 * - la sesión sobrevive la recarga y el PIN la desbloquea,
 * - PIN incorrecto muestra un error con texto,
 * - sin red, unirse muestra el aviso y no navega.
 *
 * El desbloqueo es 100 % local (Web Crypto + IndexedDB), igual que en un
 * teléfono sin datos.
 */

const NEGOCIO = {
  id: "negocio-e2e",
  nombre: "Tienda de Marta",
  moneda: "USD",
  creadoEn: 1_760_000_000_000,
};

function sesionDePrueba(nombre: string) {
  return {
    token: "token-e2e",
    negocioId: NEGOCIO.id,
    usuarioId: "usuario-e2e",
    nombre,
    rol: "dueña",
    expiraEn: Date.now() + 30 * 24 * 60 * 60 * 1000,
  };
}

async function interceptarAlta(page: Page): Promise<void> {
  await page.route("**/auth/negocio", (ruta) =>
    ruta.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ negocio: NEGOCIO, sesion: sesionDePrueba("Marta") }),
    }),
  );
}

async function crearTienda(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByLabel("Nombre de tu tienda").fill("Tienda de Marta");
  await page.getByLabel("Tu nombre", { exact: true }).fill("Marta");
  await page.getByLabel("PIN", { exact: true }).fill("1234");
  await page.getByLabel("Confirma tu PIN").fill("1234");
  await page.getByRole("button", { name: "Crear mi tienda" }).click();
}

test.describe("acceso · crear tienda y desbloqueo por PIN", () => {
  test("crea la tienda, navega a Inicio y tras recargar pide el PIN", async ({ page }) => {
    await interceptarAlta(page);
    await crearTienda(page);

    await expect(page).toHaveURL(/\/inicio$/);
    await expect(page.getByRole("heading", { name: "Hola, Marta" })).toBeVisible();

    // La sesión queda en IndexedDB; al recargar, la app pide el PIN.
    await page.reload();
    await expect(page.getByRole("heading", { name: "Escribe tu PIN" })).toBeVisible();

    // PIN incorrecto: error con texto y sin salir de la pantalla.
    await page.getByLabel("PIN", { exact: true }).fill("9999");
    await page.getByRole("button", { name: "Desbloquear" }).click();
    await expect(page.getByRole("alert")).toContainText("El PIN no es correcto");
    await expect(page.getByRole("heading", { name: "Escribe tu PIN" })).toBeVisible();

    // PIN correcto: entra a Inicio sin red (no hay peticiones implicadas).
    await page.getByLabel("PIN", { exact: true }).fill("1234");
    await page.getByRole("button", { name: "Desbloquear" }).click();
    await expect(page).toHaveURL(/\/inicio$/);
    await expect(page.getByRole("heading", { name: "Hola, Marta" })).toBeVisible();
  });

  test("unirse con un código válido guarda la sesión y entra a Inicio", async ({ page }) => {
    await page.route("**/auth/unirse", (ruta) =>
      ruta.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ negocio: NEGOCIO, sesion: sesionDePrueba("José") }),
      }),
    );

    await page.goto("/unirse");
    await page.getByLabel("Tu nombre", { exact: true }).fill("José");
    await page.getByLabel("Código de invitación").fill("ABCD-2345");
    await page.getByLabel("PIN", { exact: true }).fill("5678");
    await page.getByLabel("Confirma tu PIN").fill("5678");
    await page.getByRole("button", { name: "Unirme" }).click();

    await expect(page).toHaveURL(/\/inicio$/);
  });

  test("sin red, unirse muestra el aviso y no navega", async ({ page }) => {
    await page.route("**/auth/unirse", (ruta) => ruta.abort("internetdisconnected"));

    await page.goto("/unirse");
    await page.getByLabel("Tu nombre", { exact: true }).fill("José");
    await page.getByLabel("Código de invitación").fill("ABCD-2345");
    await page.getByLabel("PIN", { exact: true }).fill("5678");
    await page.getByLabel("Confirma tu PIN").fill("5678");
    await page.getByRole("button", { name: "Unirme" }).click();

    await expect(page.getByRole("alert")).toContainText(
      "Necesitas internet para crear la tienda o unirte",
    );
    await expect(page).toHaveURL(/\/unirse$/);
  });
});
