import type { VNode } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import {
  aplicarMovimiento,
  buscarProductos,
  convertirACantidadBase,
  crearMovimiento,
  invertirMovimiento,
  stockDerivado,
  type Movimiento,
  type MovimientoTipo,
} from "@latiendita/core";
import { ChipStock } from "../../componentes/ChipStock";
import { EstadoVacio } from "../../componentes/EstadoVacio";
import { useCatalogo, type ItemCatalogo } from "../../datos/catalogoRepo";
import { navigate, onNavClick } from "../../router";
import {
  editarTexto,
  formatoCantidad,
  formatoFecha,
  nuevoOpId,
  parseCantidad,
  parametroBusqueda,
  TecladoNumerico,
  TEXTO_UNIDAD,
  useHref,
  type Tecla,
} from "../compartido";
import { repoMovimientos, useMovimientosProducto } from "./repoLocal";
import "./movimiento.css";

const TIPOS: { valor: MovimientoTipo; etiqueta: string }[] = [
  { valor: "entrada", etiqueta: "Entrada" },
  { valor: "salida", etiqueta: "Salida" },
  { valor: "ajuste", etiqueta: "Ajuste" },
];

const ETIQUETA_TIPO: Record<MovimientoTipo, string> = {
  entrada: "Entrada",
  salida: "Salida",
  ajuste: "Ajuste",
};

const ICONO_TIPO: Record<MovimientoTipo, string> = {
  entrada: "i-package_plus",
  salida: "i-package_minus",
  ajuste: "i-arrow_left_right",
};

/** Firma legible de la cantidad (+12 uds / -2 uds / +3 uds en ajustes). */
function firmaCantidad(mov: Movimiento): string {
  if (mov.tipo === "salida") return `-${formatoCantidad(mov.cantidadBase)} uds`;
  return `${mov.cantidadBase >= 0 ? "+" : ""}${formatoCantidad(mov.cantidadBase)} uds`;
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Pantalla 7 — Movimiento rápido (C4): entrada/salida/ajuste con conversión
 * bulto↔unidad, preview del stock resultante y historial append-only con
 * correcciones por movimiento inverso (nunca editar, C8.4).
 *
 * Rutas: /movimiento (selector) · /movimiento/:id (directo) ·
 * /movimiento?producto=id (historial del producto).
 */
export function Movimiento({ params }: { params: { id?: string } }): VNode {
  const { items, estado, recargar } = useCatalogo();
  const href = useHref();

  // Producto por ruta directa, query del historial o selección del buscador.
  const idDirecto = params["id"] ?? parametroBusqueda(href, "producto");
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const productoId = idDirecto ?? seleccion;
  const item = productoId !== null
    ? (items.find((i) => i.producto.id === productoId) ?? null)
    : null;

  const movimientos = useMovimientosProducto(productoId);

  const [consulta, setConsulta] = useState("");
  const [tipo, setTipo] = useState<MovimientoTipo>("entrada");
  const [texto, setTexto] = useState("");
  const [porVenta, setPorVenta] = useState(false);
  const [signo, setSigno] = useState<1 | -1>(1);
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  // Aviso local “por sincronizar” (role=status, auto-oculta).
  useEffect(() => {
    if (aviso === null) return;
    const temporizador = setTimeout(() => setAviso(null), 5000);
    return () => clearTimeout(temporizador);
  }, [aviso]);

  const candidatos = useMemo(() => {
    const porId = new Map(items.map((i) => [i.producto.id, i]));
    return buscarProductos(items.map((i) => i.producto), consulta)
      .map((p) => porId.get(p.id))
      .filter((candidato): candidato is ItemCatalogo => candidato !== undefined)
      .slice(0, 8);
  }, [items, consulta]);

  const producto = item?.producto ?? null;
  const stock = useMemo(
    () => (productoId !== null ? stockDerivado(movimientos, productoId) : 0),
    [movimientos, productoId],
  );

  const factor = producto !== null && producto.factor > 0 ? producto.factor : 1;
  const tieneBulto = producto !== null && producto.factor > 1;
  const cantidadVenta = parseCantidad(texto);
  const cantidadBase =
    cantidadVenta !== null
      ? convertirACantidadBase(cantidadVenta, porVenta ? factor : 1)
      : null;
  const conSigno =
    tipo === "ajuste" && cantidadBase !== null ? cantidadBase * signo : cantidadBase;

  // Validación + preview del stock resultante (aplicarMovimiento sobre el
  // stock derivado del libro — nunca se escribe el stock a mano).
  let error: string | null = null;
  let preview: number | null = null;
  if (productoId !== null && conSigno !== null) {
    if (tipo === "ajuste" && conSigno === 0) {
      error = "El ajuste no puede ser 0.";
    } else if (tipo !== "ajuste" && !(conSigno > 0)) {
      error = "Escribe una cantidad mayor a 0.";
    } else {
      const tentativo: Movimiento = {
        id: "preview",
        productoId,
        tipo,
        cantidadBase: conSigno,
        creadoEn: 0,
      };
      preview = aplicarMovimiento(stock, tentativo);
      if (tipo === "salida" && preview < 0) {
        error = "salida-mayor";
        preview = null;
      }
    }
  }
  const errorSalida = error === "salida-mayor";

  async function guardar(): Promise<void> {
    if (productoId === null || conSigno === null || error !== null) return;
    setGuardando(true);
    setFallo(false);
    try {
      const mov = crearMovimiento({
        productoId,
        tipo,
        cantidadBase: conSigno,
        motivo: nota.trim() === "" ? undefined : nota.trim(),
        opId: nuevoOpId(),
      });
      await repoMovimientos.agregar(mov);
      setTexto("");
      setNota("");
      setAviso("Movimiento registrado · por sincronizar");
      navigate(`/movimiento?producto=${encodeURIComponent(productoId)}`);
    } catch {
      setFallo(true);
    } finally {
      setGuardando(false);
    }
  }

  /** Corrección = movimiento inverso nuevo con corrigeA (el original vive). */
  async function corregir(mov: Movimiento): Promise<void> {
    setFallo(false);
    try {
      const inverso = invertirMovimiento(mov, { motivo: "Corrección manual" });
      // opId nuevo: el inverso es una op distinta en la outbox (idempotencia).
      await repoMovimientos.agregar({ ...inverso, opId: nuevoOpId() });
      setAviso("Corrección registrada · por sincronizar");
    } catch {
      setFallo(true);
    }
  }

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

  if (items.length === 0) {
    return (
      <EstadoVacio
        icono="i-package"
        titulo="Agrega tu primer producto"
        texto="Para registrar entradas y salidas primero necesitas productos en tu catálogo."
      >
        <a class="btn btn-primary" href="/productos/nuevo" onClick={onNavClick}>
          Agregar producto
        </a>
      </EstadoVacio>
    );
  }

  if (productoId !== null && item === null) {
    return (
      <section class="card">
        <p class="card-title">No encontramos ese producto</p>
        <p class="card-meta">Puede que se haya quitado de tu lista. Revisa el catálogo.</p>
        <button
          type="button"
          class="btn btn-secondary"
          style="margin-top: var(--space-3);"
          onClick={() => setSeleccion(null)}
        >
          Elegir otro producto
        </button>
      </section>
    );
  }

  // ---- Vista selector: elegir producto para el movimiento ----
  if (producto === null || item === null) {
    return (
      <>
        <div class="field buscador">
          <label class="field-label" for="mov-buscar">
            Buscar producto
          </label>
          <span class="buscador-icono" aria-hidden="true">
            <svg class="icono">
              <use href="#i-search" />
            </svg>
          </span>
          <input
            class="field-input"
            id="mov-buscar"
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
            {candidatos.map((candidato) => (
              <article class="card card-producto" key={candidato.producto.id}>
                <button
                  type="button"
                  class="card-row"
                  aria-label={`${candidato.producto.nombre}, ${formatoCantidad(candidato.stock)} unidades en stock. Registrar movimiento.`}
                  onClick={() => {
                    setSeleccion(candidato.producto.id);
                    setPorVenta(false);
                  }}
                >
                  <span class="mov-selector-cuerpo">
                    <h3 class="card-title">{candidato.producto.nombre}</h3>
                    <p class="card-meta">
                      {candidato.producto.codigoBarras
                        ? `${candidato.producto.codigoBarras} · `
                        : ""}
                      {TEXTO_UNIDAD[candidato.producto.unidadVenta]}
                    </p>
                  </span>
                  <ChipStock
                    stock={candidato.stock}
                    minimo={candidato.producto.stockMinimoBase}
                  />
                </button>
              </article>
            ))}
          </div>
        )}
      </>
    );
  }

  const nombreUnidades =
    producto.unidadBase === "unidad" ? "unidades" : `${producto.unidadBase}s`;
  const etiquetaVenta = TEXTO_UNIDAD[producto.unidadVenta].replace("por ", "");

  const alPulsarCantidad = (tecla: Tecla): void =>
    setTexto((actual) => editarTexto(actual, tecla));

  return (
    <>
      {aviso ? (
        <div class="mov-aviso" role="status">
          <span class="chip chip-success">
            <svg class="icono" aria-hidden="true">
              <use href="#i-circle_check" />
            </svg>
            {aviso}
          </span>
        </div>
      ) : null}

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
            <button type="button" class="btn btn-secondary" onClick={() => void guardar()}>
              Reintentar
            </button>
          </div>
        </div>
      ) : null}

      <article class="card">
        <div class="mov-cabecera">
          <div class="mov-cabecera-titulos">
            <h3 class="card-title">{producto.nombre}</h3>
            <p class="card-meta">
              {producto.codigoBarras ? `${producto.codigoBarras} · ` : ""}
              {TEXTO_UNIDAD[producto.unidadVenta]}
            </p>
          </div>
          <button
            type="button"
            class="btn btn-secondary"
            onClick={() => setSeleccion(null)}
            aria-label={`Cambiar de producto (actual: ${producto.nombre})`}
          >
            Cambiar
          </button>
        </div>
        <div class="mov-stock">
          <ChipStock stock={stock} minimo={producto.stockMinimoBase} />
          <span class="card-meta tabular">
            Stock actual: {formatoCantidad(stock)} {nombreUnidades}
          </span>
        </div>
      </article>

      <div class="segment-group" role="group" aria-label="Tipo de movimiento">
        {TIPOS.map((opcion) => (
          <button
            key={opcion.valor}
            type="button"
            class="btn btn-secondary btn-segment"
            aria-pressed={tipo === opcion.valor}
            onClick={() => {
              setTipo(opcion.valor);
              setPorVenta(false);
            }}
          >
            {opcion.etiqueta}
          </button>
        ))}
      </div>

      <div class="field">
        <p class="field-label" id="mov-cantidad-label">
          Cantidad
        </p>
        <TecladoNumerico
          valor={texto}
          alPulsar={alPulsarCantidad}
          etiqueta={`Cantidad a ${ETIQUETA_TIPO[tipo].toLowerCase()}: ${texto === "" ? "vacía" : texto}`}
        />
        {tipo === "ajuste" ? (
          <div
            class="segment-group mov-signo"
            role="group"
            aria-label="Sentido del ajuste"
          >
            <button
              type="button"
              class="btn btn-secondary btn-segment"
              aria-pressed={signo === 1}
              onClick={() => setSigno(1)}
            >
              Sumar
            </button>
            <button
              type="button"
              class="btn btn-secondary btn-segment"
              aria-pressed={signo === -1}
              onClick={() => setSigno(-1)}
            >
              Restar
            </button>
          </div>
        ) : null}
      </div>

      {tieneBulto ? (
        <div class="field">
          <p class="field-label" id="mov-unidad-label">
            Se cuenta por
          </p>
          <div class="segment-group" role="group" aria-labelledby="mov-unidad-label">
            <button
              type="button"
              class="btn btn-secondary btn-segment"
              aria-pressed={!porVenta}
              onClick={() => setPorVenta(false)}
            >
              {capitalizar(producto.unidadBase)}
            </button>
            <button
              type="button"
              class="btn btn-secondary btn-segment"
              aria-pressed={porVenta}
              onClick={() => setPorVenta(true)}
            >
              {capitalizar(etiquetaVenta)}
            </button>
          </div>
          {porVenta && cantidadBase !== null && cantidadVenta !== null ? (
            <p class="field-help">
              {formatoCantidad(1)} {etiquetaVenta} = {formatoCantidad(factor)}{" "}
              {nombreUnidades} → son {formatoCantidad(cantidadBase)} {nombreUnidades}.
            </p>
          ) : (
            <p class="field-help">
              Cada movimiento suma o resta al stock. Nunca se edita a mano.
            </p>
          )}
        </div>
      ) : (
        <p class="field-help">
          Cada movimiento suma o resta al stock. Nunca se edita a mano.
        </p>
      )}

      {errorSalida ? (
        <div class="card aviso-error" role="alert">
          <span class="aviso-error-icono">
            <svg class="icono" aria-hidden="true">
              <use href="#i-circle_alert" />
            </svg>
          </span>
          <div class="aviso-error-cuerpo">
            <p class="card-title">No puedes sacar más de lo que hay</p>
            <p class="card-meta">
              Tienes {formatoCantidad(stock)} {nombreUnidades}. Cambia la cantidad
              para continuar.
            </p>
          </div>
        </div>
      ) : preview !== null ? (
        <p class="mov-preview" role="status">
          <svg class="icono" aria-hidden="true">
            <use href="#i-arrow_left_right" />
          </svg>
          Quedarán {formatoCantidad(preview)} {nombreUnidades} en stock.
        </p>
      ) : null}

      <div class="field">
        <label class="field-label" for="mov-nota">
          Nota (opcional)
        </label>
        <input
          class="field-input"
          id="mov-nota"
          type="text"
          value={nota}
          autocomplete="off"
          onInput={(evento) => setNota(evento.currentTarget.value)}
        />
        <p class="field-help">
          Si te equivocas, se corrige con un movimiento nuevo: el historial no se
          borra.
        </p>
      </div>

      <button
        type="button"
        class="btn btn-primary btn-bloque"
        disabled={conSigno === null || error !== null || guardando}
        onClick={() => void guardar()}
      >
        {guardando ? "Guardando…" : `Registrar ${ETIQUETA_TIPO[tipo].toLowerCase()}`}
      </button>

      <section class="mov-historial" aria-labelledby="mov-historial-titulo">
        <p class="field-label" id="mov-historial-titulo">
          Historial de movimientos
        </p>
        {movimientos.length === 0 ? (
          <p class="card-meta">Sin movimientos todavía.</p>
        ) : (
          <div class="lista-productos">
            {[...movimientos].reverse().map((mov) => (
              <article
                class="card mov-fila"
                key={mov.id}
                aria-label={`${ETIQUETA_TIPO[mov.tipo]} de ${formatoCantidad(Math.abs(mov.cantidadBase))} unidades, ${formatoFecha(mov.creadoEn)}${mov.motivo ? `, ${mov.motivo}` : ""}. Corregir.`}
              >
                <span class={`mov-fila-icono mov-tipo-${mov.tipo}`} aria-hidden="true">
                  <svg class="icono">
                    <use href={`#${ICONO_TIPO[mov.tipo]}`} />
                  </svg>
                </span>
                <div class="mov-fila-cuerpo">
                  <p class="card-title">
                    {ETIQUETA_TIPO[mov.tipo]} · <span class="tabular">{firmaCantidad(mov)}</span>
                  </p>
                  <p class="card-meta">
                    {formatoFecha(mov.creadoEn)} · Tú{mov.motivo ? ` · ${mov.motivo}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  class="btn btn-secondary"
                  aria-label={`Corregir el movimiento ${ETIQUETA_TIPO[mov.tipo]} del ${formatoFecha(mov.creadoEn)}`}
                  onClick={() => void corregir(mov)}
                >
                  Corregir
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
