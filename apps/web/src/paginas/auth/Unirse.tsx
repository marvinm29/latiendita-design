import type { VNode } from "preact";
import { useState } from "preact/hooks";
import { validarPin } from "@latiendita/core";
import { mensajeDeError, unirse } from "../../datos/authApi";
import { repoSesion } from "../../datos/sesionRepo";
import { navigate, onNavClick } from "../../router";
import { enfocarCampo, normalizarCodigo } from "./comun";
import "./auth.css";

type Errores = {
  nombre?: string;
  codigo?: string;
  pin?: string;
  confirmar?: string;
};

const ORDEN_CAMPOS: Array<[keyof Errores, string]> = [
  ["nombre", "unirse-nombre"],
  ["codigo", "unirse-codigo"],
  ["pin", "unirse-pin"],
  ["confirmar", "unirse-pin-confirmar"],
];

const CODIGO_VALIDO = /^[A-Z0-9]{8}$/;

/** Pantalla 2 · unirse con código de un solo uso (C1.2). Requiere internet. */
export function Unirse(): VNode {
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [pin, setPin] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [errores, setErrores] = useState<Errores>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: Event): Promise<void> {
    evento.preventDefault();
    if (enviando) return;

    const codigoLimpio = normalizarCodigo(codigo);
    const nuevos: Errores = {};
    if (nombre.trim() === "") nuevos.nombre = "Escribe tu nombre.";
    if (!CODIGO_VALIDO.test(codigoLimpio)) {
      nuevos.codigo = "Escribe el código de 8 caracteres que te dio la dueña.";
    }
    const problemaPin = validarPin(pin);
    if (problemaPin) nuevos.pin = problemaPin;
    else if (pin !== confirmar) nuevos.confirmar = "Los dos PIN no coinciden.";

    setErrores(nuevos);
    setErrorGeneral(null);

    const primero = ORDEN_CAMPOS.find(([campo]) => nuevos[campo] !== undefined);
    if (primero) {
      enfocarCampo(primero[1]);
      return;
    }

    setEnviando(true);
    try {
      const respuesta = await unirse({
        codigo: codigoLimpio,
        nombre: nombre.trim(),
        pin,
      });
      // La sesión queda desbloqueada: la persona acaba de escribir su PIN.
      await repoSesion.guardarSesion(respuesta.sesion, pin);
      navigate("/inicio");
    } catch (error) {
      setErrorGeneral(mensajeDeError(error));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <section class="auth-intro">
        <h2 class="auth-titulo">Entra a tu tienda</h2>
        <p class="card-meta">
          Pídele a la dueña el código de invitación. Necesitas internet para
          unirte; después podrás entrar sin conexión.
        </p>
      </section>

      <form class="auth-form" novalidate onSubmit={(evento) => void enviar(evento)}>
        <div class={`field${errores.nombre ? " is-error" : ""}`}>
          <label class="field-label" for="unirse-nombre">
            Tu nombre
          </label>
          <input
            class="field-input"
            id="unirse-nombre"
            type="text"
            value={nombre}
            placeholder="José"
            autocomplete="name"
            aria-invalid={errores.nombre ? "true" : undefined}
            aria-describedby={errores.nombre ? "unirse-nombre-err" : "unirse-nombre-ayuda"}
            onInput={(evento) => setNombre(evento.currentTarget.value)}
          />
          {errores.nombre ? (
            <p class="field-error" id="unirse-nombre-err" role="alert">
              <svg class="icono" aria-hidden="true">
                <use href="#i-circle_alert" />
              </svg>
              {errores.nombre}
            </p>
          ) : (
            <p class="field-help" id="unirse-nombre-ayuda">
              Así te verán en el historial.
            </p>
          )}
        </div>

        <div class={`field${errores.codigo ? " is-error" : ""}`}>
          <label class="field-label" for="unirse-codigo">
            Código de invitación
          </label>
          <input
            class="field-input"
            id="unirse-codigo"
            type="text"
            value={codigo}
            placeholder="ABCD-2345"
            maxlength={12}
            autocomplete="off"
            autocapitalize="characters"
            spellcheck={false}
            aria-invalid={errores.codigo ? "true" : undefined}
            aria-describedby={errores.codigo ? "unirse-codigo-err" : "unirse-codigo-ayuda"}
            onInput={(evento) => setCodigo(evento.currentTarget.value)}
          />
          {errores.codigo ? (
            <p class="field-error" id="unirse-codigo-err" role="alert">
              <svg class="icono" aria-hidden="true">
                <use href="#i-circle_alert" />
              </svg>
              {errores.codigo}
            </p>
          ) : (
            <p class="field-help" id="unirse-codigo-ayuda">
              Ocho caracteres, como ABCD-2345.
            </p>
          )}
        </div>

        <div class={`field${errores.pin ? " is-error" : ""}`}>
          <label class="field-label" for="unirse-pin">
            PIN
          </label>
          <input
            class="field-input"
            id="unirse-pin"
            type="password"
            inputmode="numeric"
            maxlength={8}
            value={pin}
            autocomplete="new-password"
            aria-invalid={errores.pin ? "true" : undefined}
            aria-describedby={errores.pin ? "unirse-pin-err" : "unirse-pin-ayuda"}
            onInput={(evento) => setPin(evento.currentTarget.value)}
          />
          {errores.pin ? (
            <p class="field-error" id="unirse-pin-err" role="alert">
              <svg class="icono" aria-hidden="true">
                <use href="#i-circle_alert" />
              </svg>
              {errores.pin}
            </p>
          ) : (
            <p class="field-help" id="unirse-pin-ayuda">
              De 4 a 8 números. Lo usarás para entrar sin internet.
            </p>
          )}
        </div>

        <div class={`field${errores.confirmar ? " is-error" : ""}`}>
          <label class="field-label" for="unirse-pin-confirmar">
            Confirma tu PIN
          </label>
          <input
            class="field-input"
            id="unirse-pin-confirmar"
            type="password"
            inputmode="numeric"
            maxlength={8}
            value={confirmar}
            autocomplete="new-password"
            aria-invalid={errores.confirmar ? "true" : undefined}
            aria-describedby={
              errores.confirmar ? "unirse-pin-confirmar-err" : "unirse-pin-confirmar-ayuda"
            }
            onInput={(evento) => setConfirmar(evento.currentTarget.value)}
          />
          {errores.confirmar ? (
            <p class="field-error" id="unirse-pin-confirmar-err" role="alert">
              <svg class="icono" aria-hidden="true">
                <use href="#i-circle_alert" />
              </svg>
              {errores.confirmar}
            </p>
          ) : (
            <p class="field-help" id="unirse-pin-confirmar-ayuda">
              Escríbelo otra vez para no equivocarte.
            </p>
          )}
        </div>

        {errorGeneral ? (
          <div class="card auth-aviso" role="alert">
            <svg class="icono" aria-hidden="true">
              <use href="#i-circle_alert" />
            </svg>
            <p>{errorGeneral}</p>
          </div>
        ) : null}

        <button class="btn btn-primary auth-submit" type="submit" disabled={enviando}>
          {enviando ? "Uniéndote…" : "Unirme"}
        </button>
      </form>

      <p class="auth-enlace">
        ¿Todavía no tienes tienda?{" "}
        <a class="text-link" href="/" onClick={onNavClick}>
          Crear mi tienda
        </a>
      </p>
    </>
  );
}
