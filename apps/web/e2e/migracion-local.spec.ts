import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";

async function cambiarCuentaDesdeOtraPestaña(page: Page) {
  await page.evaluate(async () => {
    const abrir = indexedDB.open("latiendita");
    const db = await new Promise<IDBDatabase>((resolve) => { abrir.onsuccess = () => resolve(abrir.result); });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("sesion_local", "readwrite");
      const tabla = tx.objectStore("sesion_local");
      const peticion = tabla.get("actual");
      peticion.onsuccess = () => tabla.put({ ...peticion.result, sesion: { ...peticion.result.sesion, negocioId: "tienda-b", usuarioId: "b", token: "token-b" } });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
}

test("dueña confirma el traslado, conserva cola/libro y descarga el respaldo tras recargar offline", async ({ page, context }) => {
  // Datos heredados reales de IndexedDB de Chromium antes de crear la cuenta.
  await page.goto("/productos");
  await expect(page.getByText("Refresco Big Cola 355ml").first()).toBeVisible();
  const antes = await page.evaluate(async () => {
    const abrir = indexedDB.open("latiendita");
    const db = await new Promise<IDBDatabase>((resolve) => { abrir.onsuccess = () => resolve(abrir.result); });
    try {
      const leer = (tabla: string) => new Promise<unknown[]>((resolve) => {
        const peticion = db.transaction(tabla).objectStore(tabla).getAll();
        peticion.onsuccess = () => resolve(peticion.result);
      });
      return { productos: await leer("productos"), movimientos: await leer("movimientos"), outbox: await leer("outbox") };
    } finally { db.close(); }
  });
  await page.route("**/auth/negocio", (ruta) => ruta.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({
    negocio: { id: "tienda-marta", nombre: "Tienda de Marta", moneda: "USD", creadoEn: 1 },
    sesion: { token: "token-marta", negocioId: "tienda-marta", usuarioId: "marta", nombre: "Marta", rol: "dueña", expiraEn: Date.now() + 86400000 },
  }) }));
  await page.goto("/");
  await page.getByLabel("Nombre de tu tienda").fill("Tienda de Marta");
  await page.getByLabel("Tu nombre", { exact: true }).fill("Marta");
  await page.getByLabel("PIN", { exact: true }).fill("1234");
  await page.getByLabel("Confirma tu PIN").fill("1234");
  await page.getByRole("button", { name: "Crear mi tienda", exact: true }).click();
  await expect(page).toHaveURL(/\/inicio$/);
  await page.getByRole("link", { name: "Más", exact: true }).click();
  await page.getByRole("link", { name: "Respaldo y datos", exact: true }).click();
  await page.getByRole("button", { name: "Revisar datos anteriores", exact: true }).click();
  await page.getByRole("button", { name: "Cancelar traslado", exact: true }).click();
  await page.getByRole("button", { name: "Revisar datos anteriores", exact: true }).click();
  const confirmar = page.getByRole("button", { name: "Guardar respaldo y trasladar", exact: true });
  await expect(confirmar).toBeDisabled();
  await page.getByLabel("Estos datos son de mi tienda", { exact: true }).check();
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([]);
  await confirmar.click();
  await expect(page.getByRole("status").filter({ hasText: "Datos anteriores trasladados" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Escribe tu PIN" })).toBeVisible();
  await context.setOffline(true);
  await page.getByLabel("PIN", { exact: true }).fill("1234");
  await page.getByRole("button", { name: "Desbloquear", exact: true }).click();
  const [descarga] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Descargar respaldo anterior", exact: true }).click(),
  ]);
  const respaldo = JSON.parse(await readFile((await descarga.path())!, "utf8"));
  expect(respaldo.negocioId).toBe("local");
  expect(respaldo.productos).toEqual(antes.productos);
  expect(respaldo.movimientos).toEqual(antes.movimientos);
  expect(respaldo.outbox).toEqual(antes.outbox);
  expect(JSON.stringify(respaldo)).not.toContain("token-marta");
  // Una pantalla que quedó abierta no debe descargar el respaldo de la cuenta previa.
  await cambiarCuentaDesdeOtraPestaña(page);
  const descargas: string[] = [];
  page.on("download", (archivo) => descargas.push(archivo.suggestedFilename()));
  await page.getByRole("button", { name: "Descargar respaldo anterior", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("cuenta");
  expect(descargas).toEqual([]);
  // Volver a A permite seguir comprobando el catálogo trasladado.
  await page.evaluate(async () => {
    const abrir = indexedDB.open("latiendita");
    const db = await new Promise<IDBDatabase>((resolve) => { abrir.onsuccess = () => resolve(abrir.result); });
    await new Promise<void>((resolve) => {
      const tx = db.transaction("sesion_local", "readwrite");
      const tabla = tx.objectStore("sesion_local");
      const peticion = tabla.get("actual");
      peticion.onsuccess = () => tabla.put({ ...peticion.result, sesion: { ...peticion.result.sesion, negocioId: "tienda-marta", usuarioId: "marta", token: "token-marta" } });
      tx.oncomplete = () => resolve();
    });
    db.close();
  });
  await page.getByRole("link", { name: "Productos", exact: true }).click();
  await expect(page.getByText("Refresco Big Cola 355ml").first()).toBeVisible();
});
