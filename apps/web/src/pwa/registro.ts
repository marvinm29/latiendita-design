import { signal } from "@preact/signals";
import { registerSW } from "virtual:pwa-register";

/**
 * C9.2 / T-07 — registro del service worker con aviso, nunca recarga forzada.
 *
 * `registerType: "prompt"` (vite.config.ts) hace que el SW nuevo quede
 * esperando: nadie recarga hasta que la persona pulsa “Reiniciar”. En `vite
 * dev` el módulo virtual es un no-op (devOptions desactivado), así que la app
 * arranca igual sin SW.
 */

/** ¿Hay una versión nueva esperando? La consume el aviso (C9.2). */
export const actualizacionLista = signal(false);

type AplicarActualizacion = (reloadPage?: boolean) => Promise<void>;
let aplicar: AplicarActualizacion | null = null;

/** Activa el SW pendiente y recarga. Solo lo dispara una persona. */
export function aplicarActualizacion(): void {
  actualizacionLista.value = false;
  void aplicar?.(true);
}

/** Descarta el aviso y sigue con la versión actual (no recarga). */
export function posponerActualizacion(): void {
  actualizacionLista.value = false;
}

const INTERVALO_REVISION_MS = 60 * 60 * 1000;

export function registrarServiceWorker(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  aplicar = registerSW({
    immediate: true,
    onNeedRefresh() {
      actualizacionLista.value = true;
    },
    onRegisteredSW(_swUrl, registro) {
      if (!registro) return;
      // Busca versiones nuevas al volver a la app y cada hora, sin recargar.
      const comprobar = (): void => {
        if (navigator.onLine) void registro.update();
      };
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") comprobar();
      });
      window.setInterval(comprobar, INTERVALO_REVISION_MS);
    },
    onRegisterError(error) {
      // El SW es una mejora (D3): si falla, la app sigue funcionando online.
      console.warn("No se pudo registrar el service worker:", error);
    },
  });
}
