import { expect, test } from "@playwright/test";
import { leerConteos, leerOutbox, teclear } from "./ayudas";

/**
 * C5.2 · la sesión de conteo vive en IndexedDB: recargar la app no pierde lo
 * contado y al terminar queda una sesión `cerrada` con sus diferencias, además
 * de los ajustes del libro en la outbox.
 */
test.describe("conteo persistente (C5.2)", () => {
  test("retoma el conteo tras recargar y lo cierra con su ajuste", async ({ page }) => {
    await page.goto("/conteo");
    await expect(page.getByText("Escanea el primer producto")).toBeVisible();

    await page.getByRole("button", { name: "Elegir de la lista" }).click();
    await page
      .getByRole("button", { name: /Refresco Big Cola 355ml\. Contar este producto\./ })
      .click();

    await teclear(page, "10");
    await page.getByRole("button", { name: "Capturar" }).click();
    await expect(page.getByText("Faltan 2")).toBeVisible();

    // Recarga completa: la fila vuelve desde IndexedDB, no de memoria.
    await page.reload();
    await expect(page.getByText("Faltan 2")).toBeVisible();
    await expect(page.getByText(/1 de 6 productos/)).toBeVisible();

    const abiertos = await leerConteos(page);
    expect(abiertos).toHaveLength(1);
    expect(abiertos[0]?.estado).toBe("abierto");
    expect(abiertos[0]?.items[0]).toMatchObject({
      productoId: "p-refresco-big-cola",
      contado: 10,
      sistema: 12,
      diferencia: -2,
    });

    await page.getByRole("button", { name: "Terminar conteo (1)" }).click();
    await page.getByRole("button", { name: "Guardar ajustes" }).click();
    const dialogo = page.getByRole("alertdialog");
    await expect(dialogo).toBeVisible();
    await dialogo.getByRole("button", { name: "Guardar ajustes" }).click();
    await expect(page.getByText("1 ajuste registrado")).toBeVisible();

    const cerrados = await leerConteos(page);
    expect(cerrados).toHaveLength(1);
    expect(cerrados[0]?.estado).toBe("cerrado");
    expect(cerrados[0]?.items[0]).toMatchObject({ contado: 10, diferencia: -2 });

    const ops = await leerOutbox(page);
    expect(ops.some((op) => op.entidad === "conteo")).toBe(true);
    expect(ops.some((op) => op.entidad === "movimiento")).toBe(true);

    // Una sesión cerrada no se vuelve a abrir al entrar a /conteo.
    await page.goto("/conteo");
    await expect(page.getByText("Escanea el primer producto")).toBeVisible();
  });
});
