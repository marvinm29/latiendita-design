import type { VNode } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { repoFiados } from "../../datos/fiadosRepo";
import { navigate } from "../../router";
import "./fiados.css";

/**
 * Alta de cliente en el momento (C6.1): sólo nombre y teléfono opcional.
 * Escribe en IndexedDB con su op de outbox y abre el detalle del cliente.
 */
export function NuevoCliente(): VNode {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fallo, setFallo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error !== null) errorRef.current?.focus();
  }, [error]);

  async function guardar(): Promise<void> {
    if (nombre.trim() === "") {
      setError("Escribe el nombre del cliente para guardarlo.");
      return;
    }
    setError(null);
    setFallo(false);
    setGuardando(true);
    try {
      const cliente = await repoFiados.crearClienteConOp({
        nombre,
        telefono: telefono.trim() === "" ? null : telefono,
      });
      navigate(`/fiados/${encodeURIComponent(cliente.id)}`);
    } catch {
      setFallo(true);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form
      class="form-producto"
      onSubmit={(evento) => {
        evento.preventDefault();
        void guardar();
      }}
    >
      {fallo ? (
        <div class="card aviso-error" role="alert">
          <span class="aviso-error-icono">
            <svg class="icono" aria-hidden="true">
              <use href="#i-alert_triangle" />
            </svg>
          </span>
          <div class="aviso-error-cuerpo">
            <p class="card-title">No se pudo crear el cliente</p>
            <p class="card-meta">
              Tus datos siguen en el teléfono. Inténtalo otra vez.
            </p>
          </div>
        </div>
      ) : null}

      <div class="field">
        <label class="field-label" for="cliente-nombre">
          Nombre del cliente
        </label>
        <input
          class="field-input"
          id="cliente-nombre"
          type="text"
          value={nombre}
          autocomplete="off"
          maxLength={80}
          placeholder="Doña Rosa"
          aria-describedby="cliente-nombre-ayuda"
          onInput={(evento) => {
            setNombre(evento.currentTarget.value);
            setError(null);
          }}
        />
        <p class="field-help" id="cliente-nombre-ayuda">
          Así lo vas a reconocer en la libreta. Puedes usar el apodo de siempre.
        </p>
      </div>

      <div class="field">
        <label class="field-label" for="cliente-telefono">
          Teléfono (opcional)
        </label>
        <input
          class="field-input"
          id="cliente-telefono"
          type="tel"
          value={telefono}
          autocomplete="off"
          maxLength={20}
          placeholder="7788-1234"
          aria-describedby="cliente-telefono-ayuda"
          onInput={(evento) => setTelefono(evento.currentTarget.value)}
        />
        <p class="field-help" id="cliente-telefono-ayuda">
          Sirve para encontrarlo rápido. No se envía nada a ningún servidor.
        </p>
      </div>

      {error ? (
        <div class="field-error" role="alert" tabIndex={-1} ref={errorRef}>
          <svg class="icono-sm" aria-hidden="true">
            <use href="#i-circle_alert" />
          </svg>
          {error}
        </div>
      ) : null}

      <div class="cta-sticky">
        <button type="submit" class="btn btn-primary" disabled={guardando}>
          {guardando ? "Guardando…" : "Crear cliente"}
        </button>
      </div>
    </form>
  );
}
