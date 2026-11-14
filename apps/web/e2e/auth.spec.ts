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

  test("cerrar sesión desde Más vuelve al alta y no pide PIN al recargar", async ({ page }) => {
    await interceptarAlta(page);
    await page.route("**/auth/salir", (ruta) =>
      ruta.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' }),
    );
    await crearTienda(page);
    await expect(page).toHaveURL(/\/inicio$/);

    await page.getByRole("link", { name: "Más" }).click();
    await expect(page.getByText("Entraste como Marta · dueña")).toBeVisible();
    await page.getByRole("button", { name: "Cerrar sesión" }).click();

    const dialogo = page.getByRole("alertdialog");
    await expect(dialogo).toBeVisible();
    await dialogo.getByRole("button", { name: "Cerrar sesión" }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "Tu tienda en el teléfono" })).toBeVisible();

    // Sin sesión local, recargar no vuelve a pedir PIN.
    await page.reload();
    await expect(page.getByRole("heading", { name: "Tu tienda en el teléfono" })).toBeVisible();
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

  test("cambiar de A a B conserva la cola de A y el catálogo de B sigue aislado al desbloquear offline", async ({ page, context }) => {
    await interceptarAlta(page);
    await page.route("**/auth/salir", (ruta) => ruta.fulfill({ status: 204 }));
    await crearTienda(page);
    await expect(page).toHaveURL(/\/inicio$/);
    await page.getByRole("link", { name: "Productos", exact: true }).click();
    await expect(page.getByText("Refresco Big Cola 355ml")).toHaveCount(0);
    await page.getByRole("banner").getByRole("link", { name: "Agregar producto", exact: true }).click();
    await page.getByLabel("Nombre del producto").fill("Exclusivo tienda A");
    await page.getByLabel("Precio de venta").fill("2.50");
    await page.getByRole("button", { name: "Guardar producto" }).click();
    await expect(page.getByText("Exclusivo tienda A").first()).toBeVisible();

    const colaDeA = () => page.evaluate(async (negocioId) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const abrir = indexedDB.open("latiendita");
        abrir.onsuccess = () => resolve(abrir.result);
        abrir.onerror = () => reject(abrir.error);
      });
      try {
        return await new Promise<unknown[]>((resolve, reject) => {
          const leer = db.transaction("outbox").objectStore("outbox").getAll();
          leer.onsuccess = () => resolve(leer.result.filter((fila: { negocioId: string }) => fila.negocioId === negocioId));
          leer.onerror = () => reject(leer.error);
        });
      } finally {
        db.close();
      }
    }, NEGOCIO.id);
    const pendientesA = await colaDeA();
    expect(pendientesA).toHaveLength(1);

    await page.getByRole("link", { name: "Más", exact: true }).click();
    await page.getByRole("button", { name: "Cerrar sesión", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Cerrar sesión", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    const negocioB = { ...NEGOCIO, id: "negocio-b", nombre: "Tienda B" };
    await page.route("**/auth/negocio", (ruta) => ruta.fulfill({
      status: 201, contentType: "application/json",
      body: JSON.stringify({ negocio: negocioB, sesion: { ...sesionDePrueba("Rosa"), negocioId: negocioB.id, usuarioId: "persona-b", token: "token-b" } }),
    }));
    await crearTienda(page);
    await expect(page).toHaveURL(/\/inicio$/);
    await page.getByRole("link", { name: "Productos", exact: true }).click();
    await expect(page.getByText("Exclusivo tienda A")).toHaveCount(0);
    await page.getByRole("banner").getByRole("link", { name: "Agregar producto", exact: true }).click();
    await page.getByLabel("Nombre del producto").fill("Exclusivo tienda B");
    await page.getByLabel("Precio de venta").fill("1.25");
    await page.getByRole("button", { name: "Guardar producto" }).click();
    await expect(page.getByText("Exclusivo tienda B").first()).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Escribe tu PIN" })).toBeVisible();
    await context.setOffline(true);
    await page.getByLabel("PIN", { exact: true }).fill("1234");
    await page.getByRole("button", { name: "Desbloquear", exact: true }).click();
    await expect(page.getByText("Exclusivo tienda B").first()).toBeVisible();
    await expect(page.getByText("Exclusivo tienda A")).toHaveCount(0);
    expect(await colaDeA()).toEqual(pendientesA);
  });
});
