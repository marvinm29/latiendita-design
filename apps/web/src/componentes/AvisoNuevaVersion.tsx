import type { VNode } from "preact";
import { actualizacionLista, aplicarActualizacion, posponerActualizacion } from "../pwa/registro";

/**
 * C9.2 — aviso no intrusivo de versión nueva. No es un modal ni bloquea la
 * operación: aparece sobre la nav inferior, anuncia con `role="status"` y solo
 * recarga si la persona pulsa “Reiniciar”.
 */
export function AvisoNuevaVersion(): VNode | null {
  if (!actualizacionLista.value) return null;

  return (
    <aside class="aviso-version" role="status" aria-live="polite">
      <p class="aviso-version__texto">Hay una nueva versión</p>
      <div class="aviso-version__acciones">
        <button
          class="btn btn-primary"
          type="button"
          aria-label="Reiniciar para actualizar"
          onClick={aplicarActualizacion}
        >
          Reiniciar
        </button>
        <button class="btn btn-secondary" type="button" onClick={posponerActualizacion}>
          Ahora no
        </button>
      </div>
    </aside>
  );
}
