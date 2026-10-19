import type { VNode } from "preact";
import { useState } from "preact/hooks";
import { validarPin } from "@latiendita/core";
import { crearNegocio, mensajeDeError } from "../../datos/authApi";
import { repoSesion } from "../../datos/sesionRepo";
import { navigate, onNavClick } from "../../router";
import { enfocarCampo } from "./comun";
import "./auth.css";

type Errores = {
  nombreNegocio?: string;
  nombre?: string;
  pin?: string;
  confirmar?: string;
};

const ORDEN_CAMPOS: Array<[keyof Errores, string]> = [
  ["nombreNegocio", "auth-nombre-negocio"],
  ["nombre", "auth-nombre"],
  ["pin", "auth-pin"],
  ["confirmar", "auth-pin-confirmar"],
];

/** Pantalla 1 · crear tienda (C1.1). Requiere internet sólo para el alta. */
export function CrearTienda(): VNode {
  const [nombreNegocio, setNombreNegocio] = useState("");
  const [nombre, setNombre] = useState("");
  const [pin, setPin] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [errores, setErrores] = useState<Errores>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: Event): Promise<void> {
    evento.preventDefault();
    if (enviando) return;

    const nuevos: Errores = {};
    if (nombreNegocio.trim() === "") nuevos.nombreNegocio = "Escribe el nombre de tu tienda.";
    if (nombre.trim() === "") nuevos.nombre = "Escribe tu nombre.";
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
      const respuesta = await crearNegocio({
        nombreNegocio: nombreNegocio.trim(),
        nombreDueno: nombre.trim(),
        pin,
      });
      // Guarda la sesión + verificador y deja la app desbloqueada.
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
        <h2 class="auth-titulo">Tu tienda en el teléfono</h2>
        <p class="card-meta">
          Lleva tu inventario y tus fiados. Necesitas internet para crearla; después
          funciona sin conexión.
        </p>
      </section>

      <form class="auth-form" novalidate onSubmit={(evento) => void enviar(evento)}>
        <div class={`field${errores.nombreNegocio ? " is-error" : ""}`}>
          <label class="field-label" for="auth-nombre-negocio">
            Nombre de tu tienda
          </label>
          <input
            class="field-input"
            id="auth-nombre-negocio"
            type="text"
            value={nombreNegocio}
            placeholder="Tienda de Marta"
            autocomplete="organization"
            aria-invalid={errores.nombreNegocio ? "true" : undefined}
            aria-describedby={
              errores.nombreNegocio ? "auth-nombre-negocio-err" : "auth-nombre-negocio-ayuda"
            }
            onInput={(evento) => setNombreNegocio(evento.currentTarget.value)}
          />
          {errores.nombreNegocio ? (
            <p class="field-error" id="auth-nombre-negocio-err" role="alert">
              <svg class="icono" aria-hidden="true">
                <use href="#i-circle_alert" />
              </svg>
              {errores.nombreNegocio}
            </p>
          ) : (
            <p class="field-help" id="auth-nombre-negocio-ayuda">
              Así lo verás en el encabezado de la app.
            </p>
          )}
        </div>

        <div class={`field${errores.nombre ? " is-error" : ""}`}>
          <label class="field-label" for="auth-nombre">
            Tu nombre
          </label>
          <input
            class="field-input"
            id="auth-nombre"
            type="text"
            value={nombre}
            placeholder="Marta"
            autocomplete="name"
            aria-invalid={errores.nombre ? "true" : undefined}
            aria-describedby={errores.nombre ? "auth-nombre-err" : "auth-nombre-ayuda"}
            onInput={(evento) => setNombre(evento.currentTarget.value)}
          />
          {errores.nombre ? (
            <p class="field-error" id="auth-nombre-err" role="alert">
              <svg class="icono" aria-hidden="true">
                <use href="#i-circle_alert" />
              </svg>
              {errores.nombre}
            </p>
          ) : (
            <p class="field-help" id="auth-nombre-ayuda">
              Así te verán en el historial.
            </p>
          )}
        </div>

        <div class={`field${errores.pin ? " is-error" : ""}`}>
          <label class="field-label" for="auth-pin">
            PIN
          </label>
          <input
            class="field-input"
            id="auth-pin"
            type="password"
            inputmode="numeric"
            maxlength={8}
            value={pin}
            autocomplete="new-password"
            aria-invalid={errores.pin ? "true" : undefined}
            aria-describedby={errores.pin ? "auth-pin-err" : "auth-pin-ayuda"}
            onInput={(evento) => setPin(evento.currentTarget.value)}
          />
          {errores.pin ? (
            <p class="field-error" id="auth-pin-err" role="alert">
              <svg class="icono" aria-hidden="true">
                <use href="#i-circle_alert" />
              </svg>
              {errores.pin}
            </p>
          ) : (
            <p class="field-help" id="auth-pin-ayuda">
              De 4 a 8 números. Lo usarás para entrar sin internet.
            </p>
          )}
        </div>

        <div class={`field${errores.confirmar ? " is-error" : ""}`}>
          <label class="field-label" for="auth-pin-confirmar">
            Confirma tu PIN
          </label>
          <input
            class="field-input"
            id="auth-pin-confirmar"
            type="password"
            inputmode="numeric"
            maxlength={8}
            value={confirmar}
            autocomplete="new-password"
            aria-invalid={errores.confirmar ? "true" : undefined}
            aria-describedby={
              errores.confirmar ? "auth-pin-confirmar-err" : "auth-pin-confirmar-ayuda"
            }
            onInput={(evento) => setConfirmar(evento.currentTarget.value)}
          />
          {errores.confirmar ? (
            <p class="field-error" id="auth-pin-confirmar-err" role="alert">
              <svg class="icono" aria-hidden="true">
                <use href="#i-circle_alert" />
              </svg>
              {errores.confirmar}
            </p>
          ) : (
            <p class="field-help" id="auth-pin-confirmar-ayuda">
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
          {enviando ? "Creando tu tienda…" : "Crear mi tienda"}
        </button>
      </form>

      <p class="auth-enlace">
        ¿Ya tienes un código?{" "}
        <a class="text-link" href="/unirse" onClick={onNavClick}>
          Unirme a una tienda
        </a>
      </p>
    </>
  );
}
