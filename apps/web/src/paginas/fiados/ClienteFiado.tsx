import type { VNode } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import {
  compartirEstadoCuenta,
  formatearUsd,
  type Fiado,
  type TipoFiado,
} from "@latiendita/core";
import { repoFiados, useClienteFiado } from "../../datos/fiadosRepo";
import { onNavClick } from "../../router";
import {
  editarTexto,
  formatoFecha,
  parseMontoCentavos,
  TecladoNumerico,
  type Tecla,
} from "../compartido";
import "./fiados.css";

const ETIQUETA_TIPO: Record<TipoFiado, string> = {
  cargo: "Fió",
  abono: "Abonó",
};

function ultimoTexto(ms: number | null): string {
  if (ms === null) return "Todavía sin movimientos";
  const dias = Math.floor((Date.now() - ms) / 86_400_000);
  if (dias <= 0) return "Último movimiento hoy";
  if (dias === 1) return "Último movimiento ayer";
  return `Último movimiento hace ${dias} días`;
}

function estadoSaldo(saldo: number): { texto: string; chip: string } {
  if (saldo > 0) return { texto: "Debe", chip: "chip chip-warning" };
  if (saldo < 0) return { texto: "A favor", chip: "chip chip-success" };
  return { texto: "Al día", chip: "chip chip-neutral" };
}

function FilaFiado({ fiado }: { fiado: Fiado }): VNode {
  const esCargo = fiado.tipo === "cargo";
  const firma = `${esCargo ? "+" : "−"}${formatearUsd(fiado.montoCentavos)}`;
  return (
    <article class="card fiado-movimiento">
      <span
        class={esCargo ? "fiado-movimiento-icono es-cargo" : "fiado-movimiento-icono es-abono"}
        aria-hidden="true"
      >
        <svg class="icono" aria-hidden="true">
          <use href={esCargo ? "#i-coins" : "#i-check"} />
        </svg>
      </span>
      <span class="fiado-movimiento-cuerpo">
        <span class="card-title">
          {fiado.descripcion?.trim()
            ? fiado.descripcion
            : esCargo
              ? "Cargo en la libreta"
              : "Abono en efectivo"}
        </span>
        <span class="card-meta">
          {ETIQUETA_TIPO[fiado.tipo]} · {formatoFecha(fiado.creadoEn)}
        </span>
      </span>
      <span
        class={esCargo ? "fiado-movimiento-monto es-cargo" : "fiado-movimiento-monto es-abono"}
      >
        {firma}
      </span>
    </article>
  );
}

/**
 * Pantalla 10 — Detalle del cliente (C6.2/C6.4/C6.5).
 *
 * Saldo grande, historial append-only (fecha, monto y nota), y acciones
 * “Fiar”/“Abonar” con teclado numérico. El estado de cuenta se genera en el
 * teléfono y se comparte con `navigator.share`/portapapeles, sin backend.
 */
export function ClienteFiado({ params }: { params: { id?: string } }): VNode {
  const clienteId = params["id"] ?? null;
  const { cliente, movimientos, estado, recargar } = useClienteFiado(clienteId);

  const [modo, setModo] = useState<TipoFiado | null>(null);
  const [texto, setTexto] = useState("");
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fallo, setFallo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [avisoCompartir, setAvisoCompartir] = useState<string | null>(null);
  const [mostrarTexto, setMostrarTexto] = useState(false);

  const errorRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLHeadingElement>(null);
  const textoRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (error !== null) errorRef.current?.focus();
  }, [error]);

  useEffect(() => {
    if (modo !== null) formRef.current?.focus();
  }, [modo]);

  const abrir = (tipo: TipoFiado): void => {
    setModo(tipo);
    setTexto("");
    setNota("");
    setError(null);
    setFallo(false);
    setAviso(null);
  };

  const cerrar = (): void => {
    setModo(null);
    setTexto("");
    setNota("");
    setError(null);
  };

  async function guardar(): Promise<void> {
    if (cliente === null || modo === null) return;
    const montoCentavos = parseMontoCentavos(texto);
    if (montoCentavos === null || montoCentavos <= 0) {
      setError("Escribe un monto mayor a $0.00 para continuar.");
      return;
    }
    setError(null);
    setFallo(false);
    setGuardando(true);
    try {
      const entrada = {
        clienteId: cliente.id,
        montoCentavos,
        descripcion: nota.trim() === "" ? null : nota.trim(),
      };
      if (modo === "cargo") {
        await repoFiados.crearCargoConOp(entrada);
        setAviso(`Fiaste ${formatearUsd(montoCentavos)} a ${cliente.nombre}.`);
      } else {
        await repoFiados.crearAbonoConOp(entrada);
        setAviso(
          `Abono de ${formatearUsd(montoCentavos)} registrado para ${cliente.nombre}.`,
        );
      }
      cerrar();
    } catch {
      setFallo(true);
    } finally {
      setGuardando(false);
    }
  }

  function textoEstadoCuenta(): string {
    if (cliente === null) return "";
    const lineas = [compartirEstadoCuenta(cliente.nombre, cliente.saldoCentavos)];
    const ultimos = movimientos.slice(-5).reverse();
    if (ultimos.length > 0) {
      lineas.push("", "Últimos movimientos:");
      for (const fiado of ultimos) {
        const detalle = fiado.descripcion?.trim() ? ` — ${fiado.descripcion.trim()}` : "";
        lineas.push(
          `${formatoFecha(fiado.creadoEn)}: ${ETIQUETA_TIPO[fiado.tipo]} ${formatearUsd(fiado.montoCentavos)}${detalle}`,
        );
      }
    }
    return lineas.join("\n");
  }

  async function copiar(textoCompartir: string): Promise<void> {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(textoCompartir);
        setMostrarTexto(false);
        setAvisoCompartir("Mensaje copiado. Pégalo en WhatsApp o donde quieras.");
        return;
      }
    } catch {
      // Sin permiso de portapapeles: se muestra el texto seleccionable.
    }
    setMostrarTexto(true);
    setAvisoCompartir("Copia el mensaje de abajo y envíalo tú.");
    requestAnimationFrame(() => textoRef.current?.focus());
  }

  async function compartir(): Promise<void> {
    const mensaje = textoEstadoCuenta();
    setAvisoCompartir(null);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: `Estado de cuenta de ${cliente?.nombre ?? "cliente"}`,
          text: mensaje,
        });
        setMostrarTexto(false);
        setAvisoCompartir("Estado de cuenta listo para enviar.");
        return;
      } catch (falloCompartir) {
        if (
          falloCompartir instanceof DOMException &&
          falloCompartir.name === "AbortError"
        ) {
          return;
        }
        // Si el teléfono no puede compartir, se copia como respaldo.
      }
    }
    await copiar(mensaje);
  }

  if (estado === "cargando") {
    return <p class="card-meta">Cargando el estado de cuenta…</p>;
  }

  if (estado === "error") {
    return (
      <div class="card aviso-error" role="alert">
        <span class="aviso-error-icono">
          <svg class="icono" aria-hidden="true">
            <use href="#i-alert_triangle" />
          </svg>
        </span>
        <div class="aviso-error-cuerpo">
          <p class="card-title">No se pudo cargar el historial</p>
          <p class="card-meta">
            El saldo sigue guardado en tu teléfono. Revisa la conexión e inténtalo
            otra vez.
          </p>
          <button type="button" class="btn btn-secondary" onClick={recargar}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (cliente === null) {
    return (
      <section class="card">
        <p class="card-title">No encontramos ese cliente</p>
        <p class="card-meta">
          Puede que se haya quitado de la libreta. Vuelve para elegir otro.
        </p>
        <a
          class="btn btn-secondary"
          href="/fiados"
          onClick={onNavClick}
          style="margin-top: var(--space-3); display: inline-flex;"
        >
          Volver a Fiados
        </a>
      </section>
    );
  }

  const saldo = cliente.saldoCentavos;
  const estadoCuenta = estadoSaldo(saldo);
  const tituloFormulario =
    modo === "cargo" ? `Fiar a ${cliente.nombre}` : `Abonar de ${cliente.nombre}`;

  return (
    <>
      {aviso ? (
        <p class="chip chip-success fiados-aviso" role="status">
          <svg class="icono" aria-hidden="true">
            <use href="#i-circle_check" />
          </svg>
          {aviso}
        </p>
      ) : null}

      {fallo ? (
        <div class="card aviso-error" role="alert">
          <span class="aviso-error-icono">
            <svg class="icono" aria-hidden="true">
              <use href="#i-alert_triangle" />
            </svg>
          </span>
          <div class="aviso-error-cuerpo">
            <p class="card-title">No se pudo guardar</p>
            <p class="card-meta">
              Tus datos siguen en el teléfono. Inténtalo otra vez.
            </p>
            <button type="button" class="btn btn-secondary" onClick={() => void guardar()}>
              Reintentar
            </button>
          </div>
        </div>
      ) : null}

      <article class="card fiado-cabecera">
        <h2 class="card-title fiado-nombre">{cliente.nombre}</h2>
        <p class="balance-label">Saldo</p>
        <p class="card-amount balance-amount fiado-saldo-grande">
          <svg class="icono" aria-hidden="true">
            <use href="#i-coins" />
          </svg>
          <span class="tabular">{formatearUsd(saldo)}</span>
        </p>
        <p class="card-meta">
          {cliente.telefono ? `${cliente.telefono} · ` : ""}
          {ultimoTexto(cliente.ultimoMovimientoEn)}
        </p>
        <p>
          <span class={estadoCuenta.chip}>{estadoCuenta.texto}</span>
        </p>
      </article>

      {modo === null ? (
        <div class="fiados-acciones">
          <button type="button" class="btn btn-primary" onClick={() => abrir("cargo")}>
            <svg class="icono" aria-hidden="true">
              <use href="#i-coins" />
            </svg>
            Fiar
          </button>
          <button type="button" class="btn btn-secondary" onClick={() => abrir("abono")}>
            <svg class="icono" aria-hidden="true">
              <use href="#i-check" />
            </svg>
            Abonar
          </button>
        </div>
      ) : (
        <section class="card fiado-formulario" aria-labelledby="fiado-form-titulo">
          <h2 class="card-title" id="fiado-form-titulo" ref={formRef} tabIndex={-1}>
            {tituloFormulario}
          </h2>
          <div class="field">
            <p class="field-label" id="fiado-monto-label">
              Monto en dólares
            </p>
            <TecladoNumerico
              valor={texto}
              prefijo="$"
              alPulsar={(tecla: Tecla) => {
                setTexto((actual) => editarTexto(actual, tecla));
                setError(null);
              }}
              etiqueta={`Monto a ${modo === "cargo" ? "fiar" : "abonar"}: ${
                texto === "" ? "vacío" : texto
              }`}
            />
          </div>
          <div class="field">
            <label class="field-label" for="fiado-nota">
              Nota (opcional)
            </label>
            <input
              class="field-input"
              id="fiado-nota"
              type="text"
              value={nota}
              autocomplete="off"
              maxLength={120}
              placeholder={modo === "cargo" ? "Qué se fió" : "Cómo pagó"}
              onInput={(evento) => setNota(evento.currentTarget.value)}
            />
            <p class="field-help">
              Cada cargo o abono queda para siempre; si te equivocas, registra el
              movimiento contrario.
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

          <div class="fiados-acciones">
            <button
              type="button"
              class="btn btn-primary"
              disabled={guardando}
              onClick={() => void guardar()}
            >
              {guardando
                ? "Guardando…"
                : modo === "cargo"
                  ? "Registrar fiado"
                  : "Registrar abono"}
            </button>
            <button
              type="button"
              class="btn btn-secondary"
              disabled={guardando}
              onClick={cerrar}
            >
              Cancelar
            </button>
          </div>
        </section>
      )}

      <section aria-labelledby="fiado-historial-titulo">
        <h2 class="fiados-subtitulo" id="fiado-historial-titulo">
          Cargos y abonos
        </h2>
        {movimientos.length === 0 ? (
          <div class="card">
            <p class="card-title">Sin movimientos todavía</p>
            <p class="card-meta">
              Cuando le fíes o te abone, cada cargo y abono queda aquí con fecha y
              nota. El saldo se calcula solo.
            </p>
          </div>
        ) : (
          <div class="lista-productos">
            {[...movimientos].reverse().map((fiado) => (
              <FilaFiado key={fiado.id} fiado={fiado} />
            ))}
          </div>
        )}
      </section>

      <section class="card fiados-compartir" aria-labelledby="fiado-compartir-titulo">
        <h2 class="card-title" id="fiado-compartir-titulo">
          Compartir estado de cuenta
        </h2>
        <p class="card-meta">
          El mensaje se arma en tu teléfono, sin internet. Tú eliges a quién
          enviarlo.
        </p>
        <div class="fiados-acciones">
          <button type="button" class="btn btn-primary" onClick={() => void compartir()}>
            <svg class="icono" aria-hidden="true">
              <use href="#i-share_2" />
            </svg>
            Compartir estado de cuenta
          </button>
          <button
            type="button"
            class="btn btn-secondary"
            onClick={() => void copiar(textoEstadoCuenta())}
          >
            Copiar mensaje
          </button>
        </div>
        {avisoCompartir ? (
          <p class="field-help" role="status">
            {avisoCompartir}
          </p>
        ) : null}
        {mostrarTexto ? (
          <div class="field">
            <label class="field-label" for="fiado-texto-compartir">
              Mensaje listo para copiar
            </label>
            <textarea
              class="field-input fiados-texto-compartir"
              id="fiado-texto-compartir"
              ref={textoRef}
              readOnly
              rows={7}
              value={textoEstadoCuenta()}
            />
          </div>
        ) : null}
      </section>

      <p class="card-meta">
        <a class="text-link" href="/fiados" onClick={onNavClick}>
          Volver a la libreta
        </a>
      </p>
    </>
  );
}
