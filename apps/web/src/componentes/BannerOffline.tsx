import type { VNode } from "preact";
import { useEffect, useState } from "preact/hooks";

/**
 * Banner de conexión (DESIGN.md §8): copy exacto, `role="status"`,
 * hermana directa del header — nunca se superpone al contenido.
 * Se muestra con `navigator.onLine === false` y desaparece en los
 * eventos `online`/`offline` reales del navegador.
 */
export function BannerOffline(): VNode | null {
  const [enLinea, setEnLinea] = useState<boolean>(() => navigator.onLine);

  useEffect(() => {
    const alConectar = (): void => setEnLinea(true);
    const alDesconectar = (): void => setEnLinea(false);
    window.addEventListener("online", alConectar);
    window.addEventListener("offline", alDesconectar);
    return () => {
      window.removeEventListener("online", alConectar);
      window.removeEventListener("offline", alDesconectar);
    };
  }, []);

  if (enLinea) return null;

  return (
    <div class="offline-banner" role="status">
      <svg class="icono" aria-hidden="true">
        <use href="#i-wifi_off" />
      </svg>
      <span>Sin conexión — se sincronizará al reconectar</span>
    </div>
  );
}
