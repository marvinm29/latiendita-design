import { expect, test } from "@playwright/test";
import { esperarCatalogo, leerOutbox, teclear } from "./ayudas";

/**
 * S2 · e2e offline de C2–C5.
 *
 * El shell se carga UNA vez con red; a partir de ahí `setOffline(true)` corta
 * todo y los flujos se hacen por navegación SPA (lo que hará Marta sin datos).
 * Al reconectar se recarga para probar que IndexedDB persistió de verdad.
 */
test.describe("offline-first C2–C5", () => {
  test("C2 · alta de producto sin conexión y persiste al reconectar", async ({
    page,
    context,
  }) => {
    await page.goto("/productos");
    await esperarCatalogo(page);

    await context.setOffline(true);

    await page.getByRole("link", { name: "Agregar producto" }).click();
    await expect(page.getByLabel("Nombre del producto")).toBeVisible();

    await page.getByLabel("Nombre del producto").fill("Queso fresco");
    await page.getByLabel("Precio de venta").fill("2.50");
    await page.getByRole("button", { name: "Guardar producto" }).click();

    await expect(page).toHaveURL(/\/productos$/);
    await expect(page.getByText("Queso fresco").first()).toBeVisible();

    const ops = await leerOutbox(page);
    expect(ops.some((op) => op.entidad === "producto")).toBe(true);

    await context.setOffline(false);
    await page.reload();
    await expect(page.getByText("Queso fresco").first()).toBeVisible();
  });

  test("C3+C4 · escanear a mano y registrar salida sin conexión", async ({
    page,
    context,
  }) => {
    await page.goto("/escanear");
    await expect(
      page.getByRole("button", { name: /Escribir (el )?código/ }),
    ).toBeVisible();

    await context.setOffline(true);

    await page.getByRole("button", { name: /Escribir (el )?código/ }).click();
    await teclear(page, "7501000000017");
    await page.getByRole("button", { name: "Buscar producto" }).click();

    await expect(page.getByText("Código detectado")).toBeVisible();
    await expect(page.getByText("Refresco Big Cola 355ml")).toBeVisible();

    await page.getByRole("button", { name: "Registrar entrada" }).click();
    await expect(page).toHaveURL(/\/movimiento\/p-refresco-big-cola/);
    await expect(page.getByText("Stock actual: 12 unidades")).toBeVisible();

    await page.getByRole("button", { name: "Salida", exact: true }).click();
    await teclear(page, "2");
    await page.getByRole("button", { name: "Registrar salida" }).click();

    await expect(page.getByText("Stock actual: 10 unidades")).toBeVisible();
    await expect(page.getByText("Movimiento registrado · por sincronizar")).toBeVisible();

    const ops = await leerOutbox(page);
    expect(ops.some((op) => op.entidad === "movimiento")).toBe(true);

    await context.setOffline(false);
    await page.reload();
    await expect(page.getByText("Stock actual: 10 unidades")).toBeVisible();
    await expect(
      page.getByRole("article", { name: /Salida de 2 unidades/ }),
    ).toBeVisible();
  });

  test("C5 · conteo sin conexión corrige el stock con un ajuste", async ({
    page,
    context,
  }) => {
    await page.goto("/conteo");
    await expect(page.getByText("Escanea el primer producto")).toBeVisible();

    await context.setOffline(true);

    await page.getByRole("button", { name: "Elegir de la lista" }).click();
    await page
      .getByRole("button", { name: /Refresco Big Cola 355ml\. Contar este producto\./ })
      .click();

    await teclear(page, "10");
    await page.getByRole("button", { name: "Capturar" }).click();
    await expect(page.getByText("Faltan 2")).toBeVisible();

    await page.getByRole("button", { name: "Terminar conteo (1)" }).click();
    await expect(page.getByText("1 producto contado")).toBeVisible();

    await page.getByRole("button", { name: "Guardar ajustes" }).click();
    const dialogo = page.getByRole("alertdialog");
    await expect(dialogo).toBeVisible();
    await dialogo.getByRole("button", { name: "Guardar ajustes" }).click();

    await expect(page.getByText("1 ajuste registrado")).toBeVisible();

    const ops = await leerOutbox(page);
    expect(ops.some((op) => op.entidad === "movimiento")).toBe(true);

    await page.getByRole("link", { name: "Ver productos" }).click();
    await expect(page.getByText("10 uds", { exact: false })).toBeVisible();

    await context.setOffline(false);
    await page.reload();
    await expect(page.getByText("10 uds", { exact: false })).toBeVisible();
  });
});
