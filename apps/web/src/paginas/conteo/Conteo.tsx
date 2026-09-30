import type { VNode } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import { buscarProductos, crearMovimiento } from "@latiendita/core";
import { EstadoVacio } from "../../componentes/EstadoVacio";
import { useCatalogo } from "../../datos/catalogoRepo";
import { navigate, onNavClick } from "../../router";
import {
  editarTexto,
  formatoCantidad,
  nuevoOpId,
  parseCantidad,
  parametroBusqueda,
  TecladoNumerico,
  useHref,
  type Tecla,
} from "../compartido";
import { repoMovimientos } from "../movimiento/repoLocal";
import "./conteo.css";

type FilaConteo = {
  productoId: string;
  nombre: string;
  /** Contado por la persona (unidades base). */
  contado: number;
  /** Sistema = stock derivado del libro al momento de capturar. */
  sistema: number;
};

type Fase = "conteo" | "resumen" | "fin";

function textoDiferencia(fila: FilaConteo): { clase: string; icono: string; texto: string } {
  const dif = Math.round((fila.contado - fila.sistema) * 1000) / 1000;
  if (dif > 0) {
    return { clase: "chip chip-success", icono: "i-circle_check", texto: `Sobran ${formatoCantidad(dif)}` };
  }
  if (dif < 0) {
    return {
      clase: "chip chip-danger",
      icono: "i-circle_alert",
      texto: `Faltan ${formatoCantidad(Math.abs(dif))}`,
    };
  }
  return { clase: "chip", icono: "i-check", texto: "Sin diferencia" };
}

/**
 * Pantalla 8 — Conteo asistido (C5.2): escanear/teclear → capturar contado →
 * lista de diferencias → ajustes del diferencial con confirmación previa
 * (3.3.4). Nada se aplica sin confirmar; el stock queda igual a lo contado.
 *
 * Con ?p=id llega el producto escaneado en /escanear?destino=conteo;
 * con ?codigo=X llega un código desconocido (estado del mockup).
 */
export function Conteo(): VNode {
  const { items, estado, recargar } = useCatalogo();
  const href = useHref();

  const [fase, setFase] = useState<Fase>("conteo");
  const [filas, setFilas] = useState<FilaConteo[]>([]);
  const [actualId, setActualId] = useState<string | null>(null);
  const [origenActual, setOrigenActual] = useState<"escaneado" | "lista">("escaneado");
  const [sistemaActual, setSistemaActual] = useState(0);
  const [texto, setTexto] = useState("");
  const [consulta, setConsulta] = useState("");
  const [elegirLista, setElegirLista] = useState(false);
  const [desconocido, setDesconocido] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState(false);
  const [ajustesRegistrados, setAjustesRegistrados] = useState(0);
  const [enLinea, setEnLinea] = useState(() => navigator.onLine);

  // Línea “sin conexión” (estado del mockup; el banner global ya existe).
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

  // Producto escaneado (?p=) o código desconocido (?codigo=) desde el escáner.
  useEffect(() => {
    const p = parametroBusqueda(href, "p");
    if (p !== null && items.some((i) => i.producto.id === p)) {
      setOrigenActual("escaneado");
      setActualId(p);
      setTexto("");
      setDesconocido(null);
      setElegirLista(false);
      return;
    }
    const codigo = parametroBusqueda(href, "codigo");
    if (codigo !== null) setDesconocido(codigo);
  }, [href, items]);

  // Sistema = stock actual del producto en espera (derivado del libro).
  useEffect(() => {
    if (actualId === null) return;
    let vivo = true;
    repoMovimientos.stockDe(actualId).then((stock) => {
      if (vivo) setSistemaActual(stock);
    });
    return () => {
      vivo = false;
    };
  }, [actualId]);

  // La confirmación de ajustes (3.3.4) toma el foco en Cancelar.
  useEffect(() => {
    if (confirmando) document.getElementById("conteo-cancelar")?.focus();
  }, [confirmando]);

  const actual =
    actualId !== null ? (items.find((i) => i.producto.id === actualId) ?? null) : null;

  const candidatos = useMemo(
    () => buscarProductos(items.map((i) => i.producto), consulta).slice(0, 8),
    [items, consulta],
  );

  const contadoActual = parseCantidad(texto);
  const conDiferencia = filas.filter((f) => f.contado !== f.sistema).length;

  function capturar(): void {
    if (actualId === null || contadoActual === null) return;
    const nombre = actual?.producto.nombre ?? "";
    setFilas((previas) => {
      const existente = previas.find((f) => f.productoId === actualId);
      if (existente) {
        return previas.map((f) =>
          f.productoId === actualId ? { ...f, contado: contadoActual } : f,
        );
      }
      return [
        ...previas,
        { productoId: actualId, nombre, contado: contadoActual, sistema: sistemaActual },
      ];
    });
    setActualId(null);
    setTexto("");
    setSistemaActual(0);
  }

  /**
   * Genera un ajuste por cada diferencia (tipo ajuste, cantidad con signo).
   * Los ajustes viajan con op_id propio; el stock queda igual a lo contado.
   */
  async function guardarAjustes(): Promise<void> {
    setGuardando(true);
    setFallo(false);
    try {
      const diferencias = filas.filter((f) => f.contado !== f.sistema);
      for (const fila of diferencias) {
        await repoMovimientos.agregar({
          productoId: fila.productoId,
          tipo: "ajuste",
          cantidadBase: Math.round((fila.contado - fila.sistema) * 1000) / 1000,
          motivo: "Conteo físico",
          opId: nuevoOpId(),
        });
      }
      setAjustesRegistrados(diferencias.length);
      setConfirmando(false);
      setFase("fin");
    } catch {
      setFallo(true);
    } finally {
      setGuardando(false);
    }
  }

  function nuevoConteo(): void {
    setFase("conteo");
    setFilas([]);
    setActualId(null);
    setSistemaActual(0);
    setTexto("");
    setConsulta("");
    setElegirLista(false);
    setDesconocido(null);
    setConfirmando(false);
    setAjustesRegistrados(0);
  }

  const alPulsar = (tecla: Tecla): void =>
    setTexto((valor) => editarTexto(valor, tecla));

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

  // ---- Fase fin: “n ajustes registrados” ----
  if (fase === "fin") {
    return (
      <div role="status">
        <EstadoVacio
          icono="i-circle_check"
          titulo={
            ajustesRegistrados === 0
              ? "Conteo guardado"
              : `${ajustesRegistrados} ajustes registrados`
          }
          texto="El stock ahora coincide con lo contado. Los ajustes se sincronizan al reconectar."
        >
          <button type="button" class="btn btn-primary" onClick={nuevoConteo}>
            Nuevo conteo
          </button>
          <a class="btn btn-secondary" href="/productos" onClick={onNavClick}>
            Ver productos
          </a>
        </EstadoVacio>
      </div>
    );
  }

  // ---- Fase resumen: qué se guardará, nada se aplica sin confirmar ----
  if (fase === "resumen") {
    return (
      <>
        <section class="card" aria-labelledby="conteo-resumen-titulo">
          <p class="card-title" id="conteo-resumen-titulo">
            Terminar conteo
          </p>
          <p class="card-meta conteo-resumen-texto">
            {formatoCantidad(filas.length)} productos contados. {formatoCantidad(conDiferencia)}{" "}
            {conDiferencia === 1 ? "tiene" : "tienen"} diferencia y se guardarán como
            ajustes; el conteo queda en el historial.
          </p>
        </section>

        {confirmando ? (
          <div
            class="card conteo-dialogo"
            role="alertdialog"
            aria-labelledby="conteo-dialogo-titulo"
            aria-describedby="conteo-dialogo-texto"
          >
            <p class="card-title" id="conteo-dialogo-titulo">
              ¿Guardar los ajustes?
            </p>
            <p class="card-meta" id="conteo-dialogo-texto">
              Se registrarán {formatoCantidad(conDiferencia)} movimiento
              {conDiferencia === 1 ? "" : "s"} de ajuste y el stock quedará igual a lo
              contado. El conteo no se puede deshacer, pero se corrige con otro conteo.
            </p>
            <div class="conteo-dialogo-acciones">
              <button
                type="button"
                id="conteo-cancelar"
                class="btn btn-secondary"
                onClick={() => setConfirmando(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                class="btn btn-primary"
                disabled={guardando}
                onClick={() => void guardarAjustes()}
              >
                {guardando ? "Guardando…" : "Guardar ajustes"}
              </button>
            </div>
          </div>
        ) : (
          <div class="conteo-acciones">
            <button
              type="button"
              class="btn btn-primary"
              disabled={guardando}
              onClick={() => setConfirmando(true)}
            >
              Guardar ajustes
            </button>
            <button type="button" class="btn btn-secondary" onClick={() => setFase("conteo")}>
              Seguir contando
            </button>
          </div>
        )}

        {fallo ? (
          <div class="card aviso-error" role="alert">
            <span class="aviso-error-icono">
              <svg class="icono" aria-hidden="true">
                <use href="#i-alert_triangle" />
              </svg>
            </span>
            <div class="aviso-error-cuerpo">
              <p class="card-title">No se pudo guardar.</p>
              <p class="card-meta">Tus datos están en el teléfono — toca Reintentar.</p>
              <button
                type="button"
                class="btn btn-secondary"
                onClick={() => void guardarAjustes()}
              >
                Reintentar
              </button>
            </div>
          </div>
        ) : null}
      </>
    );
  }

  // ---- Fase conteo ----
  return (
    <>
      {!enLinea ? (
        <p class="card-meta conteo-offline" role="status">
          Puedes contar sin conexión. Los ajustes se guardan al terminar y se
          sincronizan al reconectar.
        </p>
      ) : null}

      {desconocido !== null ? (
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
                El código {desconocido} no está registrado. Puedes crearlo ahora o
                seguir contando.
              </p>
            </div>
          </section>
          <div class="conteo-acciones">
            <button
              type="button"
              class="btn btn-primary"
              onClick={() =>
                navigate(`/productos/nuevo?codigo=${encodeURIComponent(desconocido)}`)
              }
            >
              Crear producto
            </button>
            <button
              type="button"
              class="btn btn-secondary"
              onClick={() => setDesconocido(null)}
            >
              Saltar
            </button>
          </div>
        </>
      ) : null}

      {filas.length === 0 && actualId === null && !elegirLista ? (
        <EstadoVacio
          icono="i-scan_barcode"
          titulo="Escanea el primer producto"
          texto="Cuenta los productos escaneándolos uno por uno. Al terminar, el sistema calcula las diferencias solo."
        >
          <button
            type="button"
            class="btn btn-primary"
            onClick={() => navigate("/escanear?destino=conteo")}
          >
            Escanear producto
          </button>
          <button
            type="button"
            class="btn btn-secondary"
            onClick={() => setElegirLista(true)}
          >
            Elegir de la lista
          </button>
          <button type="button" class="btn btn-secondary" disabled>
            Terminar conteo (0)
          </button>
        </EstadoVacio>
      ) : null}

      {elegirLista ? (
        <section class="conteo-elegir" aria-label="Elegir producto de la lista">
          <div class="field buscador">
            <label class="field-label" for="conteo-buscar">
              Buscar producto
            </label>
            <span class="buscador-icono" aria-hidden="true">
              <svg class="icono">
                <use href="#i-search" />
              </svg>
            </span>
            <input
              class="field-input"
              id="conteo-buscar"
              type="search"
              value={consulta}
              placeholder="Nombre o código de barras"
              autocomplete="off"
              onInput={(evento) => setConsulta(evento.currentTarget.value)}
            />
          </div>
          {candidatos.length === 0 ? (
            <EstadoVacio
              icono="i-search"
              titulo={`No encontramos “${consulta.trim()}”`}
              texto="Revisa la palabra o escanéalo con la cámara."
            />
          ) : (
            <div class="lista-productos">
              {candidatos.map((producto) => (
                <article class="card card-producto" key={producto.id}>
                  <button
                    type="button"
                    class="card-row"
                    aria-label={`${producto.nombre}. Contar este producto.`}
                    onClick={() => {
                      setOrigenActual("lista");
                      setActualId(producto.id);
                      setTexto("");
                      setElegirLista(false);
                      setConsulta("");
                    }}
                  >
                    <span class="conteo-selector-cuerpo">
                      <h3 class="card-title">{producto.nombre}</h3>
                    </span>
                    <svg class="icono card-chevron" aria-hidden="true">
                      <use href="#i-chevron_right" />
                    </svg>
                  </button>
                </article>
              ))}
            </div>
          )}
          <button
            type="button"
            class="btn btn-secondary btn-bloque"
            onClick={() => setElegirLista(false)}
          >
            Cerrar lista
          </button>
        </section>
      ) : null}

      {actualId !== null || filas.length > 0 ? (
        <div class="card conteo-progreso">
          <p class="card-title">Conteo asistido</p>
          <p class="card-meta">
            {formatoCantidad(filas.length)} de {formatoCantidad(items.length)} productos
          </p>
        </div>
      ) : null}

      {actual !== null ? (
        <article
          class="card conteo-actual"
          aria-label={`Contando ${actual.producto.nombre}`}
        >
          <h3 class="card-title">{actual.producto.nombre}</h3>
          <p class="card-meta">
            {origenActual === "escaneado" ? "Escaneado" : "Elegido de la lista"} · el
            sistema dice {formatoCantidad(sistemaActual)} uds
          </p>
          <p class="field-label conteo-pregunta" id="conteo-cantidad-label">
            ¿Cuántas unidades contaste?
          </p>
          <TecladoNumerico
            valor={texto}
            alPulsar={alPulsar}
            etiqueta={`Cantidad contada de ${actual.producto.nombre}: ${texto === "" ? "vacía" : texto}`}
          />
          <button
            type="button"
            class="btn btn-primary btn-bloque conteo-capturar"
            disabled={contadoActual === null}
            onClick={capturar}
          >
            Capturar
          </button>
        </article>
      ) : null}

      {filas.length > 0 ? (
        <section aria-labelledby="conteo-lista-titulo">
          <p class="field-label" id="conteo-lista-titulo">
            Ya contados
          </p>
          <div class="lista-productos">
            {filas.map((fila) => {
              const dif = textoDiferencia(fila);
              return (
                <article
                  class="card conteo-fila"
                  key={fila.productoId}
                  aria-label={`${fila.nombre}: contado ${formatoCantidad(fila.contado)}, sistema ${formatoCantidad(fila.sistema)}, ${dif.texto}.`}
                >
                  <div class="conteo-fila-cuerpo">
                    <p class="card-title">{fila.nombre}</p>
                    <p class="card-meta">
                      Contado {formatoCantidad(fila.contado)} · sistema{" "}
                      {formatoCantidad(fila.sistema)}
                    </p>
                  </div>
                  <span class={dif.clase}>
                    <svg class="icono" aria-hidden="true">
                      <use href={`#${dif.icono}`} />
                    </svg>
                    {dif.texto}
                  </span>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {actualId === null && filas.length > 0 ? (
        <div class="conteo-acciones">
          <button
            type="button"
            class="btn btn-primary"
            onClick={() => navigate("/escanear?destino=conteo")}
          >
            Escanear producto
          </button>
          <button
            type="button"
            class="btn btn-secondary"
            onClick={() => setElegirLista(true)}
          >
            Elegir de la lista
          </button>
        </div>
      ) : null}

      {filas.length > 0 ? (
        <button
          type="button"
          class="btn btn-primary btn-bloque"
          onClick={() => setFase("resumen")}
        >
          Terminar conteo ({formatoCantidad(filas.length)})
        </button>
      ) : null}
    </>
  );
}
