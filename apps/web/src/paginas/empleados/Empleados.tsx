import type { VNode } from "preact";
import { useEffect, useState } from "preact/hooks";
import type { SesionCuenta } from "@latiendita/core";
import { crearInvitacion, mensajeDeError } from "../../datos/authApi";
import { repoSesion } from "../../datos/sesionRepo";

function conGuion(codigo: string): string {
  const limpio = codigo.replaceAll("-", "").toUpperCase();
  return limpio.length === 8 ? `${limpio.slice(0, 4)}-${limpio.slice(4)}` : limpio;
}

function fechaCorta(ms: number): string {
  return new Date(ms).toLocaleDateString("es-SV", { day: "numeric", month: "long" });
}

/**
 * Pantalla 11 · Empleados (C1.2 / C7).
 *
 * La dueña genera un código de invitación de un solo uso. El empleado lo
 * ingresa desde su teléfono en `/unirse` y define su PIN. Requiere internet:
 * el código se emite y se valida en el servidor.
 */
export function Empleados(): VNode {
  const [sesion, setSesion] = useState<SesionCuenta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [expiraEn, setExpiraEn] = useState<number | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
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

  async function generar(): Promise<void> {
    if (!sesion || generando) return;
    setGenerando(true);
    setError(null);
    setAviso(null);
    try {
      const respuesta = await crearInvitacion(sesion.token);
      setCodigo(conGuion(respuesta.codigo));
      setExpiraEn(respuesta.expiraEn);
    } catch (fallo) {
      setError(mensajeDeError(fallo));
    } finally {
      setGenerando(false);
    }
  }

  async function compartir(): Promise<void> {
    if (!codigo) return;
    const texto = `Únete a mi tienda en LaTiendita con el código ${codigo}. Vence el ${expiraEn ? fechaCorta(expiraEn) : "pronto"}.`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Invitación a LaTiendita", text: texto });
        setAviso("Invitación compartida.");
        return;
      }
      await navigator.clipboard.writeText(texto);
      setAviso("Código copiado. Envíalo a tu empleado.");
    } catch {
      setAviso(`Copia el código: ${codigo}`);
    }
  }

  if (cargando) {
    return (
      <p class="card-meta" role="status">
        Cargando…
      </p>
    );
  }

  if (!sesion) {
    return (
      <section class="card">
        <p class="card-title">Empleados</p>
        <p class="card-meta">
          Inicia sesión como dueña para invitar a tu equipo. En este teléfono
          todavía no hay una sesión guardada.
        </p>
      </section>
    );
  }

  if (sesion.rol !== "dueña") {
    return (
      <section class="card">
        <p class="card-title">Empleados</p>
        <p class="card-meta">Solo la dueña puede generar códigos de invitación.</p>
      </section>
    );
  }

  return (
    <>
      <section class="card">
        <p class="card-title">Invita a tu equipo</p>
        <p class="card-meta">
          Genera un código de un solo uso. Tu empleado lo escribe en su
          teléfono, elige su PIN y queda dentro de la tienda.
        </p>
        <button
          type="button"
          class="btn btn-primary btn-bloque"
          style="margin-top: var(--space-3);"
          disabled={generando}
          onClick={() => void generar()}
        >
          {generando ? "Generando…" : "Generar código de invitación"}
        </button>
      </section>

      {codigo ? (
        <section class="card" aria-labelledby="codigo-titulo">
          <p class="card-title" id="codigo-titulo">
            Código de invitación
          </p>
          <p
            class="card-title"
            style="font-size: var(--text-2xl); letter-spacing: 0.08em; margin: var(--space-2) 0;"
          >
            {codigo}
          </p>
          <p class="card-meta" role="status">
            Vence el {expiraEn ? fechaCorta(expiraEn) : "pronto"}. Se usa una
            sola vez: si se pierde, genera otro.
          </p>
          <div
            style="display: flex; gap: var(--space-2); margin-top: var(--space-3);"
          >
            <button type="button" class="btn btn-secondary" onClick={() => void compartir()}>
              Compartir
            </button>
            <button type="button" class="btn btn-secondary" onClick={() => void generar()}>
              Generar otro
            </button>
          </div>
        </section>
      ) : null}

      {aviso ? (
        <p class="card-meta" role="status">
          {aviso}
        </p>
      ) : null}

      {error ? (
        <p class="field-error" role="alert">
          <svg class="icono" aria-hidden="true">
            <use href="#i-circle_alert" />
          </svg>
          {error}
        </p>
      ) : null}
    </>
  );
}
