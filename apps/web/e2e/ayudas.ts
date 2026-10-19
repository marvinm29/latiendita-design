import type { Page } from "@playwright/test";

/** Pulsa una tecla del teclado numérico por su etiqueta accesible. */
export async function teclear(page: Page, texto: string): Promise<void> {
  for (const tecla of texto) {
    await page
      .getByRole("button", { name: tecla === "." ? "Punto decimal" : tecla, exact: true })
      .click();
  }
}

/** Espera a que la semilla demo del catálogo esté en pantalla. */
export async function esperarCatalogo(page: Page): Promise<void> {
  await page.getByText("Refresco Big Cola 355ml").first().waitFor();
}

interface OpLeida {
  id: string;
  estado: string;
  entidad: string | undefined;
}

interface ConteoLeido {
  id: string;
  estado: string;
  items: Array<{
    productoId: string;
    contado: number;
    sistema: number;
    diferencia: number;
  }>;
}

/** Lee las sesiones de conteo directo de IndexedDB (C5.2). */
export async function leerConteos(page: Page): Promise<ConteoLeido[]> {
  return page.evaluate(async () => {
    const abrir = indexedDB.open("latiendita");
    const db = await new Promise<IDBDatabase>((resolver, rechazar) => {
      abrir.onsuccess = () => resolver(abrir.result);
      abrir.onerror = () => rechazar(abrir.error);
    });
    const filas = await new Promise<unknown[]>((resolver, rechazar) => {
      const peticion = db.transaction("conteos", "readonly").objectStore("conteos").getAll();
      peticion.onsuccess = () => resolver(peticion.result);
      peticion.onerror = () => rechazar(peticion.error);
    });
    db.close();
    return filas as Array<{
      id: string;
      estado: string;
      items: Array<{
        productoId: string;
        contado: number;
        sistema: number;
        diferencia: number;
      }>;
    }>;
  });
}

/**
 * Lee la outbox local directo de IndexedDB (C8.4). Sirve para comprobar que
 * cada escritura offline dejó su op pendiente, sin exponer nada en la UI.
 */
export async function leerOutbox(page: Page): Promise<OpLeida[]> {
  return page.evaluate(async () => {
    const abrir = indexedDB.open("latiendita");
    const db = await new Promise<IDBDatabase>((resolver, rechazar) => {
      abrir.onsuccess = () => resolver(abrir.result);
      abrir.onerror = () => rechazar(abrir.error);
    });
    const filas = await new Promise<unknown[]>((resolver, rechazar) => {
      const peticion = db.transaction("outbox", "readonly").objectStore("outbox").getAll();
      peticion.onsuccess = () => resolver(peticion.result);
      peticion.onerror = () => rechazar(peticion.error);
    });
    db.close();
    return filas.map((fila) => {
      const op = fila as { id: string; estado: string; payload?: { entidad?: string } };
      return { id: op.id, estado: op.estado, entidad: op.payload?.entidad };
    });
  });
}
