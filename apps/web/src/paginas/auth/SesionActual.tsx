import type { VNode } from "preact";
import { useEffect, useState } from "preact/hooks";
import type { SesionCuenta } from "@latiendita/core";
import { repoSesion } from "../../datos/sesionRepo";
import { navigate } from "../../router";

/**
 * Tarjeta de sesión en «Más»: muestra quién entró y permite cerrar sesión
 * (borra la sesión local y revoca en el servidor best-effort). Sin sesión no
 * renderiza nada — el modo local M1 sigue igual.
 */
export function SesionActual(): VNode | null {
  const [sesion, setSesion] = useState<SesionCuenta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [confirmando, setConfirmando] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    repoSesion
      .sesionActual()
      .then((actual) => {
        if (vivo) {
          setSesion(actual);
          setCargando(false);
        }
      })
      .catch(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  if (cargando || !sesion) return null;

  async function cerrar(): Promise<void> {
    if (saliendo) return;
    setSaliendo(true);
    setError(null);
    try {
      await repoSesion.cerrarSesion();
      navigate("/");
    } catch {
      setError("No pudimos cerrar la sesión en este teléfono. Intenta de nuevo.");
      setSaliendo(false);
    }
  }

  return (
    <section class="card" aria-labelledby="sesion-titulo">
      <p class="card-title" id="sesion-titulo">
        Sesión
      </p>
      <p class="card-meta">
        Entraste como {sesion.nombre} · {sesion.rol}.
      </p>

      {confirmando ? (
        <div
          role="alertdialog"
          aria-labelledby="cerrar-sesion-titulo"
          aria-describedby="cerrar-sesion-texto"
        >
          <p class="card-title" id="cerrar-sesion-titulo">
            ¿Cerrar sesión?
          </p>
          <p class="card-meta" id="cerrar-sesion-texto">
            Tus datos siguen guardados en este teléfono. Para volver a entrar
            necesitarás tu PIN.
          </p>
          <div
            style="display: flex; gap: var(--space-2); margin-top: var(--space-3);"
          >
            <button
              type="button"
              class="btn btn-secondary"
              onClick={() => setConfirmando(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              class="btn btn-primary"
              disabled={saliendo}
              onClick={() => void cerrar()}
            >
              {saliendo ? "Cerrando…" : "Cerrar sesión"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          class="btn btn-secondary"
          style="margin-top: var(--space-3);"
          onClick={() => setConfirmando(true)}
        >
          Cerrar sesión
        </button>
      )}

      {error ? (
        <p class="field-error" role="alert">
          <svg class="icono" aria-hidden="true">
            <use href="#i-circle_alert" />
          </svg>
          {error}
        </p>
      ) : null}
    </section>
  );
}
