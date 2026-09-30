import type { VNode } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { formatearUsd } from "@latiendita/core";
import { ChipStock } from "../../componentes/ChipStock";
import { useCatalogo } from "../../datos/catalogoRepo";
import { navigate } from "../../router";
import {
  editarTexto,
  formatoCantidad,
  parametroBusqueda,
  TecladoNumerico,
  TEXTO_UNIDAD,
  useHref,
  type Tecla,
} from "../compartido";
import type { ControlCamara, MotivoCamara } from "./camara";
import "./escanear.css";

/** Estados de la pantalla 04: cámara, manual, conocido, desconocido, error. */
type Vista =
  | { estado: "camara" }
  | { estado: "manual" }
  | { estado: "resultado"; productoId: string }
  | { estado: "desconocido"; codigo: string }
  | { estado: "error"; motivo: MotivoCamara };

const TITULO_POR_VISTA: Record<Vista["estado"], string> = {
  camara: "Escanear",
  manual: "Escribir el código",
  resultado: "Código detectado",
  desconocido: "Código desconocido",
  error: "Escanear",
};

const COPIA_ERROR: Record<MotivoCamara, { titulo: string; texto: string }> = {
  permiso: {
    titulo: "No pudimos usar la cámara",
    texto: "Revisa el permiso de la cámara en tu teléfono, o escribe el código a mano: siempre funciona.",
  },
  detector: {
    titulo: "Escaneo con cámara no disponible",
    texto: "Este navegador no soporta detección de códigos. Escribe el código a mano: siempre funciona.",
  },
  fallo: {
    titulo: "No pudimos usar la cámara",
    texto: "Algo falló con la cámara de tu teléfono. Escribe el código a mano: siempre funciona.",
  },
};

/**
 * Pantalla 4 — Escáner (C3): BarcodeDetector nativo → teclado manual (C3.2).
 * La cámara vive en ./camara.ts, cargada con import() perezoso (chunk aparte).
 * Con ?destino=conteo, el código detectado continúa el conteo asistido (C5.2).
 */
export function Escanear(): VNode {
  const { items, estado, recargar } = useCatalogo();
  const href = useHref();
  const destinoConteo = parametroBusqueda(href, "destino") === "conteo";

  const [vista, setVista] = useState<Vista>({ estado: "camara" });
  const [codigoTexto, setCodigoTexto] = useState("");
  const [linternaActiva, setLinternaActiva] = useState(false);
  const [linternaSoportada, setLinternaSoportada] = useState(false);
  const [enLinea, setEnLinea] = useState(() => navigator.onLine);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlRef = useRef<ControlCamara | null>(null);

  // Título de página por estado (el router fija el de la ruta).
  useEffect(() => {
    document.title = `${TITULO_POR_VISTA[vista.estado]} · LaTiendita`;
  }, [vista.estado]);

  // Línea “sin conexión” (estado 4 del mockup; el banner global ya existe).
  useEffect(() => {
    const conectar = (): void => setEnLinea(true);
    const desconectar = (): void => setEnLinea(false);
    window.addEventListener("online", conectar);
    window.addEventListener("offline", desconectar);
    return () => {
      window.removeEventListener("online", conectar);
      window.removeEventListener("offline", desconectar);
    };
  }, []);

  /** Resolución del código: conocido → movimiento/conteo; desconocido → crear. */
  const manejarCodigo = (codigo: string): void => {
    const limpio = codigo.trim();
    if (limpio === "") return;
    const item = items.find((i) => i.producto.codigoBarras === limpio);
    if (item) {
      if (destinoConteo) {
        navigate(`/conteo?p=${encodeURIComponent(item.producto.id)}`);
        return;
      }
      setVista({ estado: "resultado", productoId: item.producto.id });
    } else if (destinoConteo) {
      navigate(`/conteo?codigo=${encodeURIComponent(limpio)}`);
    } else {
      setVista({ estado: "desconocido", codigo: limpio });
    }
  };

  // Ref para que el loop de la cámara siempre llame al handler vigente.
  const manejarRef = useRef(manejarCodigo);
  manejarRef.current = manejarCodigo;

  // Cámara perezosa: el código de getUserMedia/BarcodeDetector vive en
  // ./camara.ts y sólo entra a este chunk con import() (nunca al inicial).
  useEffect(() => {
    if (vista.estado !== "camara") return;
    let cancelado = false;
    void import("./camara")
      .then(async (mod) => {
        if (cancelado || !videoRef.current) return;
        const resultado = await mod.encender(videoRef.current, (codigo) => {
          if (cancelado) return;
          cancelado = true;
          controlRef.current?.apagar();
          manejarRef.current(codigo);
        });
        if (cancelado) {
          if (resultado.ok) resultado.control.apagar();
          return;
        }
        if (resultado.ok) {
          controlRef.current = resultado.control;
          setLinternaSoportada(resultado.control.linternaDisponible);
        } else {
          setVista({ estado: "error", motivo: resultado.motivo });
        }
      })
      .catch(() => {
        if (!cancelado) setVista({ estado: "error", motivo: "fallo" });
      });
    return () => {
      cancelado = true;
      controlRef.current?.apagar();
      controlRef.current = null;
    };
  }, [vista.estado]);

  // Tras el error de cámara, el foco va al teclado manual (C3.2).
  useEffect(() => {
    if (vista.estado === "manual" || vista.estado === "error") {
      document.getElementById("esc-teclado")?.focus();
    }
  }, [vista.estado]);

  const alPulsarCodigo = (tecla: Tecla): void => {
    if (tecla === ".") return; // los códigos de barras no llevan punto
    setCodigoTexto((actual) => editarTexto(actual, tecla));
  };

  // ---- Estados de catálogo ----
  if (estado === "cargando") {
    return <p class="card-meta">Cargando tu catálogo…</p>;
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
          <p class="card-title">No pudimos cargar tu catálogo</p>
          <p class="card-meta">Tus productos siguen en el teléfono — toca Reintentar.</p>
          <button type="button" class="btn btn-secondary" onClick={recargar}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const apagarLinterna = (): void => {
    void controlRef.current
      ?.alternarLinterna()
      .then((activa) => setLinternaActiva(activa));
  };

  if (vista.estado === "camara") {
    return (
      <>
        <p class="card-title escaner-instruccion">Apunta al código de barras</p>
        <p class="card-meta escaner-instruccion">
          Sostén el teléfono sobre el código. Se detecta solo.
        </p>
        <div class="escaner-visor" role="img" aria-label="Vista de la cámara apuntando a un código de barras">
          <video ref={videoRef} muted playsinline />
          <div class="escaner-marco" aria-hidden="true">
            <svg class="icono-lg">
              <use href="#i-barcode" />
            </svg>
          </div>
          <span class="escaner-laser" aria-hidden="true" />
        </div>
        {!enLinea ? (
          <p class="card-meta escaner-instruccion" role="status">
            Puedes escanear sin conexión. Lo que agregues se marcará para sincronizar al reconectar.
          </p>
        ) : null}
        <div class="escaner-acciones">
          <button
            type="button"
            class="btn btn-secondary"
            aria-pressed={linternaActiva}
            aria-label={linternaActiva ? "Apagar linterna" : "Encender linterna"}
            disabled={!linternaSoportada}
            onClick={apagarLinterna}
          >
            <svg class="icono" aria-hidden="true">
              <use href="#i-flashlight" />
            </svg>
            Linterna
          </button>
          <button
            type="button"
            class="btn btn-secondary"
            onClick={() => setVista({ estado: "manual" })}
          >
            <svg class="icono" aria-hidden="true">
              <use href="#i-keyboard" />
            </svg>
            Escribir código
          </button>
        </div>
      </>
    );
  }

  if (vista.estado === "manual") {
    return (
      <>
        <p class="card-title escaner-instruccion">Escribir el código</p>
        <p class="field-label escaner-instruccion" id="esc-codigo-label">
          Código de barras
        </p>
        <div id="esc-teclado" tabIndex={-1} class="escaner-teclado">
          <TecladoNumerico
            valor={codigoTexto}
            alPulsar={alPulsarCodigo}
            etiqueta={`Código escrito: ${codigoTexto === "" ? "vacío" : codigoTexto.split("").join(" ")}`}
          />
        </div>
        <p class="field-help escaner-instruccion">
          El teclado está siempre disponible — el flujo nunca depende de la cámara.
        </p>
        <button
          type="button"
          class="btn btn-primary btn-bloque"
          disabled={codigoTexto === ""}
          onClick={() => {
            const codigo = codigoTexto;
            setCodigoTexto("");
            manejarCodigo(codigo);
          }}
        >
          Buscar producto
        </button>
        <button
          type="button"
          class="btn btn-secondary btn-bloque"
          onClick={() => setVista({ estado: "camara" })}
        >
          Volver a la cámara
        </button>
      </>
    );
  }

  if (vista.estado === "resultado") {
    const item = items.find((i) => i.producto.id === vista.productoId);
    if (!item) {
      return (
        <section class="card">
          <p class="card-title">No encontramos ese producto</p>
          <p class="card-meta">Revisa el catálogo o vuelve a escanear.</p>
          <button
            type="button"
            class="btn btn-secondary"
            style="margin-top: var(--space-3);"
            onClick={() => setVista({ estado: "camara" })}
          >
            Volver a escanear
          </button>
        </section>
      );
    }
    return (
      <>
        <p class="card-title">Código detectado</p>
        <section class="card">
          <div class="escaner-producto-top">
            <div class="escaner-producto-titulos">
              <h3 class="card-title">{item.producto.nombre}</h3>
              <p class="card-meta">
                {item.producto.codigoBarras ? `${item.producto.codigoBarras} · ` : ""}
                {TEXTO_UNIDAD[item.producto.unidadVenta]}
              </p>
            </div>
            <ChipStock stock={item.stock} minimo={item.producto.stockMinimoBase} />
          </div>
          <div class="escaner-producto-precio">
            <span class="product-price">{formatearUsd(item.producto.precioCentavos)}</span>
            <span class="card-meta tabular">{formatoCantidad(item.stock)} uds</span>
          </div>
        </section>
        <button
          type="button"
          class="btn btn-primary btn-bloque"
          onClick={() => navigate(`/movimiento/${encodeURIComponent(item.producto.id)}`)}
        >
          Registrar entrada
        </button>
        <button
          type="button"
          class="btn btn-secondary btn-bloque"
          onClick={() => navigate(`/productos/${encodeURIComponent(item.producto.id)}`)}
        >
          Abrir producto
        </button>
        <button
          type="button"
          class="btn btn-secondary btn-bloque"
          onClick={() => setVista({ estado: "camara" })}
        >
          Escanear otro código
        </button>
      </>
    );
  }

  if (vista.estado === "desconocido") {
    return (
      <>
        <section class="card aviso-error">
          <span class="aviso-error-icono">
            <svg class="icono" aria-hidden="true">
              <use href="#i-circle_alert" />
            </svg>
          </span>
          <div class="aviso-error-cuerpo">
            <p class="card-title">No encontramos ese código en tu catálogo</p>
            <p class="card-meta">
              El código {vista.codigo} no está registrado. Puedes crearlo ahora o seguir escaneando.
            </p>
          </div>
        </section>
        <button
          type="button"
          class="btn btn-primary btn-bloque"
          onClick={() => navigate(`/productos/nuevo?codigo=${encodeURIComponent(vista.codigo)}`)}
        >
          Crear producto
        </button>
        <button
          type="button"
          class="btn btn-secondary btn-bloque"
          onClick={() => setVista({ estado: "camara" })}
        >
          Volver a escanear
        </button>
      </>
    );
  }

  // vista.estado === "error"
  const copia = COPIA_ERROR[vista.motivo];
  return (
    <>
      <div class="card aviso-error" role="alert">
        <span class="aviso-error-icono">
          <svg class="icono" aria-hidden="true">
            <use href="#i-alert_triangle" />
          </svg>
        </span>
        <div class="aviso-error-cuerpo">
          <p class="card-title">{copia.titulo}</p>
          <p class="card-meta">{copia.texto}</p>
        </div>
      </div>
      <button
        type="button"
        class="btn btn-primary btn-bloque"
        onClick={() => setVista({ estado: "manual" })}
      >
        <svg class="icono" aria-hidden="true">
          <use href="#i-keyboard" />
        </svg>
        Escribir el código
      </button>
      <button
        type="button"
        class="btn btn-secondary btn-bloque"
        onClick={() => setVista({ estado: "camara" })}
      >
        <svg class="icono" aria-hidden="true">
          <use href="#i-refresh_cw" />
        </svg>
        Reintentar cámara
      </button>
    </>
  );
}
