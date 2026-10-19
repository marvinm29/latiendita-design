import type { VNode } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import type { SesionCuenta } from "@latiendita/core";
import { repoSesion } from "../../datos/sesionRepo";
import "./auth.css";

/**
 * Pantalla de bloqueo (C1/T-05): se muestra ANTES del shell cuando hay una
 * sesión guardada. El PIN se comprueba en el dispositivo, sin red.
 */
export function PantallaBloqueo({
  sesion,
  onDesbloqueada,
}: {
  sesion: SesionCuenta;
  onDesbloqueada: () => void;
}): VNode {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);

  useEffect(() => {
    entrada.current?.focus();
  }, []);

  async function desbloquear(evento: Event): Promise<void> {
    evento.preventDefault();
    if (verificando) return;
    if (pin === "") {
      setError("Escribe tu PIN.");
      entrada.current?.focus();
      return;
    }

    setVerificando(true);
    setError(null);
    try {
      const correcto = await repoSesion.desbloquear(pin);
      if (correcto) {
        onDesbloqueada();
        return;
      }
      setPin("");
      setError("El PIN no es correcto. Inténtalo de nuevo.");
      entrada.current?.focus();
    } catch {
      setError("No pudimos comprobar el PIN en este teléfono. Intenta de nuevo.");
    } finally {
      setVerificando(false);
    }
  }

  return (
    <div class="pantalla-bloqueo">
      <main class="bloqueo-main" id="contenido">
        <p class="auth-enlace">LaTiendita</p>
        <h1 class="bloqueo-titulo">Escribe tu PIN</h1>
        <p class="bloqueo-nota">
          Hola, {sesion.nombre}. Tus datos siguen en este teléfono.
        </p>

        <form class="auth-form" novalidate onSubmit={(evento) => void desbloquear(evento)}>
          <div class={`field${error ? " is-error" : ""}`}>
            <label class="field-label" for="bloqueo-pin">
              PIN
            </label>
            <input
              ref={entrada}
              class="field-input"
              id="bloqueo-pin"
              type="password"
              inputmode="numeric"
              maxlength={8}
              value={pin}
              autocomplete="current-password"
              aria-invalid={error ? "true" : undefined}
              aria-describedby={error ? "bloqueo-pin-err" : undefined}
              onInput={(evento) => setPin(evento.currentTarget.value)}
            />
            {error ? (
              <p class="field-error" id="bloqueo-pin-err" role="alert">
                <svg class="icono" aria-hidden="true">
                  <use href="#i-circle_alert" />
                </svg>
                {error}
              </p>
            ) : null}
          </div>

          <button class="btn btn-primary auth-submit" type="submit" disabled={verificando}>
            {verificando ? "Comprobando…" : "Desbloquear"}
          </button>
        </form>
      </main>
    </div>
  );
}
