import type { VNode } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import { formatearUsd, type Producto } from "@latiendita/core";
import { avisoLista } from "../../datos/avisos";
import { repoCatalogo, useCatalogo } from "../../datos/catalogoRepo";
import { navigate, onNavClick, type PathParams } from "../../router";
import "./productos.css";

type Errores = {
  nombre?: string;
  precio?: string;
  costo?: string;
  stock?: string;
};

/**
 * Precio/costo en texto → centavos enteros (nunca float en el dominio).
 * Acepta coma o punto decimal; redondea (1.1 → 110, no 110.00000000000001).
 */
function parseCentavos(texto: string): number | null {
  const limpio = texto.replace(/\s/g, "").replace(",", ".");
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(limpio)) return null;
  const valor = Number(limpio);
  if (!Number.isFinite(valor)) return null;
  return Math.round(valor * 100);
}

/** Centavos → texto del input ("$1.10" → "1.10"), vía formatearUsd del core. */
function aTextoDolares(centavos: number): string {
  return formatearUsd(centavos).replace(/^\$/, "");
}

function nuevoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function enfocar(id: string): void {
  document.getElementById(id)?.focus();
}

/** Pantallas 6 y edición — alta/edición de producto (C2.1 / C2.5). */
export function FormProducto({ params }: { params: PathParams }): VNode {
  const id = params["id"] ?? null;
  const esEdicion = id !== null;
  const { items, estado, recargar } = useCatalogo();

  const existente =
    esEdicion && id !== null
      ? (items.find((item) => item.producto.id === id)?.producto ?? null)
      : null;

  const [precargado, setPrecargado] = useState(false);
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [precio, setPrecio] = useState("");
  const [costo, setCosto] = useState("");
  const [stockMinimo, setStockMinimo] = useState("");
  const [categoriaSel, setCategoriaSel] = useState("");
  const [categoriaOtra, setCategoriaOtra] = useState("");
  const [errores, setErrores] = useState<Errores>({});
  const [guardando, setGuardando] = useState(false);
  const [falloGuardar, setFalloGuardar] = useState(false);
  const [falloEliminar, setFalloEliminar] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  // Si cambia el id (back/forward entre dos ediciones), reprecarga de cero.
  useEffect(() => {
    setPrecargado(false);
  }, [id]);

  // Precarga al abrir la edición (una sola vez, cuando el repo responde).
  useEffect(() => {
    if (!esEdicion || estado !== "listo" || precargado) return;
    const producto = items.find((item) => item.producto.id === id)?.producto;
    if (!producto) return;
    setNombre(producto.nombre);
    setCodigo(producto.codigoBarras ?? "");
    setPrecio(aTextoDolares(producto.precioCentavos));
    setCosto(producto.costoCentavos > 0 ? aTextoDolares(producto.costoCentavos) : "");
    setStockMinimo(
      producto.stockMinimoBase > 0 ? String(producto.stockMinimoBase) : "",
    );
    setCategoriaSel(producto.categoria);
    setPrecargado(true);
  }, [esEdicion, estado, items, id, precargado]);

  // La confirmación de borrado (3.3.4) toma el foco en Cancelar.
  useEffect(() => {
    if (confirmando) enfocar("confirmar-cancelar");
  }, [confirmando]);

  const opcionesCategoria = useMemo(() => {
    const conjunto = new Set<string>();
    for (const item of items) {
      if (item.producto.categoria) conjunto.add(item.producto.categoria);
    }
    return [...conjunto].sort((a, b) => a.localeCompare(b, "es"));
  }, [items]);

  const categoriaFinal = categoriaSel === "__otra__" ? categoriaOtra.trim() : categoriaSel;
  const listo = nombre.trim() !== "" && precio.trim() !== "";

  function validar(): Errores {
    const encontrados: Errores = {};
    if (nombre.trim() === "") {
      encontrados.nombre = "Escribe el nombre del producto.";
    }
    if (precio.trim() === "") {
      encontrados.precio = "Escribe un precio, por ejemplo 1.25.";
    } else if (parseCentavos(precio.trim()) === null) {
      encontrados.precio = "Ingresa un precio válido, por ejemplo 1.25.";
    }
    if (costo.trim() !== "" && parseCentavos(costo.trim()) === null) {
      encontrados.costo = "Ingresa un costo válido, por ejemplo 0.50.";
    }
    if (stockMinimo.trim() !== "" && !/^\d{1,6}$/.test(stockMinimo.trim())) {
      encontrados.stock = "Ingresa un número entero, por ejemplo 5.";
    }
    return encontrados;
  }

  async function intentarGuardar(): Promise<void> {
    const encontrados = validar();
    setErrores(encontrados);
    setFalloGuardar(false);
    if (encontrados.nombre) {
      enfocar("f-nombre");
      return;
    }
    if (encontrados.precio) {
      enfocar("f-precio");
      return;
    }
    if (encontrados.costo) {
      enfocar("f-costo");
      return;
    }
    if (encontrados.stock) {
      enfocar("f-stock");
      return;
    }

    const precioCentavos = parseCentavos(precio.trim());
    const costoCentavos = costo.trim() === "" ? 0 : parseCentavos(costo.trim());
    if (precioCentavos === null || costoCentavos === null) return;

    const producto: Producto = {
      id: id ?? nuevoId(),
      nombre: nombre.trim(),
      categoria: categoriaFinal,
      codigoBarras: codigo.trim() === "" ? null : codigo.trim(),
      unidadBase: existente?.unidadBase ?? "unidad",
      unidadVenta: existente?.unidadVenta ?? "unidad",
      factor: existente?.factor ?? 1,
      costoCentavos,
      precioCentavos,
      stockMinimoBase: stockMinimo.trim() === "" ? 0 : Number(stockMinimo.trim()),
      activo: true,
    };

    setGuardando(true);
    try {
      await repoCatalogo.guardar(producto);
      avisoLista.value = esEdicion ? "Cambios guardados" : "Producto guardado";
      navigate("/productos");
    } catch {
      setFalloGuardar(true);
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(): Promise<void> {
    if (id === null) return;
    setFalloEliminar(false);
    try {
      await repoCatalogo.borrarLogico(id);
      avisoLista.value = "Producto eliminado";
      navigate("/productos");
    } catch {
      setFalloEliminar(true);
      setConfirmando(false);
    }
  }

  // ---- Estados de apertura de la edición (antes del formulario) ----
  if (esEdicion && estado === "cargando") {
    return <p class="card-meta">Cargando producto…</p>;
  }

  if (esEdicion && estado === "error") {
    return (
      <div class="card aviso-error" role="alert">
        <span class="aviso-error-icono">
          <svg class="icono" aria-hidden="true">
            <use href="#i-alert_triangle" />
          </svg>
        </span>
        <div class="aviso-error-cuerpo">
          <p class="card-title">No pudimos abrir el producto</p>
          <p class="card-meta">
            Tus datos siguen en el teléfono — toca Reintentar.
          </p>
          <button type="button" class="btn btn-secondary" onClick={recargar}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (esEdicion && !existente) {
    return (
      <section class="card">
        <p class="card-title">No encontramos ese producto</p>
        <p class="card-meta">
          Puede que se haya quitado de tu lista. Revisa el catálogo y busca de
          nuevo.
        </p>
        <a
          class="btn btn-secondary"
          href="/productos"
          onClick={onNavClick}
          style="margin-top: var(--space-3); display: inline-flex;"
        >
          Ver productos
        </a>
      </section>
    );
  }

  const errorNombre = errores.nombre;
  const errorPrecio = errores.precio;
  const errorCosto = errores.costo;
  const errorStock = errores.stock;

  return (
    <>
      {falloGuardar ? (
        <div class="card aviso-error" role="alert">
          <span class="aviso-error-icono">
            <svg class="icono" aria-hidden="true">
              <use href="#i-alert_triangle" />
            </svg>
          </span>
          <div class="aviso-error-cuerpo">
            <p class="card-title">No se pudo guardar.</p>
            <p class="card-meta">
              Tus datos están en el teléfono — toca Reintentar.
            </p>
            <button
              type="button"
              class="btn btn-secondary"
              onClick={() => intentarGuardar()}
            >
              Reintentar
            </button>
          </div>
        </div>
      ) : null}

      <form
        id="form-producto"
        class="form-producto"
        novalidate
        onSubmit={(evento) => {
          evento.preventDefault();
          void intentarGuardar();
        }}
      >
        <div class={`field${errorNombre ? " is-error" : ""}`}>
          <label class="field-label" for="f-nombre">
            Nombre del producto
          </label>
          <input
            class="field-input"
            id="f-nombre"
            type="text"
            value={nombre}
            autocomplete="off"
            aria-invalid={errorNombre ? "true" : undefined}
            aria-describedby={errorNombre ? "f-nombre-err" : "f-nombre-ayuda"}
            onInput={(evento) => setNombre(evento.currentTarget.value)}
          />
          {errorNombre ? (
            <p class="field-error" id="f-nombre-err">
              <svg class="icono" aria-hidden="true">
                <use href="#i-circle_alert" />
              </svg>
              {errorNombre}
            </p>
          ) : (
            <p class="field-help" id="f-nombre-ayuda">
              Así se verá en la lista y en el escaneo.
            </p>
          )}
        </div>

        <div class={`field${errorPrecio ? " is-error" : ""}`}>
          <label class="field-label" for="f-precio">
            Precio de venta
          </label>
          <input
            class="field-input"
            id="f-precio"
            type="text"
            inputmode="decimal"
            value={precio}
            autocomplete="off"
            aria-invalid={errorPrecio ? "true" : undefined}
            aria-describedby={errorPrecio ? "f-precio-err" : "f-precio-ayuda"}
            onInput={(evento) => setPrecio(evento.currentTarget.value)}
          />
          {errorPrecio ? (
            <p class="field-error" id="f-precio-err">
              <svg class="icono" aria-hidden="true">
                <use href="#i-circle_alert" />
              </svg>
              {errorPrecio}
            </p>
          ) : (
            <p class="field-help" id="f-precio-ayuda">
              En dólares, por unidad. Ejemplo: 1.25
            </p>
          )}
        </div>

        <div class="field">
          <label class="field-label" for="f-codigo">
            Código de barras
          </label>
          <input
            class="field-input"
            id="f-codigo"
            type="text"
            value={codigo}
            autocomplete="off"
            aria-describedby="f-codigo-ayuda"
            onInput={(evento) => setCodigo(evento.currentTarget.value)}
          />
          <p class="field-help" id="f-codigo-ayuda">
            {codigo !== ""
              ? "Se llenó al escanear. Puedes corregirlo si hace falta."
              : "Si lo tienes, escanéalo o escríbelo aquí. Es opcional."}
          </p>
        </div>

        <div class={`field${errorCosto ? " is-error" : ""}`}>
          <label class="field-label" for="f-costo">
            Costo
          </label>
          <input
            class="field-input"
            id="f-costo"
            type="text"
            inputmode="decimal"
            value={costo}
            autocomplete="off"
            aria-invalid={errorCosto ? "true" : undefined}
            aria-describedby={errorCosto ? "f-costo-err" : "f-costo-ayuda"}
            onInput={(evento) => setCosto(evento.currentTarget.value)}
          />
          {errorCosto ? (
            <p class="field-error" id="f-costo-err">
              <svg class="icono" aria-hidden="true">
                <use href="#i-circle_alert" />
              </svg>
              {errorCosto}
            </p>
          ) : (
            <p class="field-help" id="f-costo-ayuda">
              Cuánto te cuesta a ti. Opcional.
            </p>
          )}
        </div>

        <div class={`field${errorStock ? " is-error" : ""}`}>
          <label class="field-label" for="f-stock">
            Stock mínimo
          </label>
          <input
            class="field-input"
            id="f-stock"
            type="text"
            inputmode="numeric"
            value={stockMinimo}
            autocomplete="off"
            aria-invalid={errorStock ? "true" : undefined}
            aria-describedby={errorStock ? "f-stock-err" : "f-stock-ayuda"}
            onInput={(evento) => setStockMinimo(evento.currentTarget.value)}
          />
          {errorStock ? (
            <p class="field-error" id="f-stock-err">
              <svg class="icono" aria-hidden="true">
                <use href="#i-circle_alert" />
              </svg>
              {errorStock}
            </p>
          ) : (
            <p class="field-help" id="f-stock-ayuda">
              Te avisamos cuando bajes de aquí.
            </p>
          )}
        </div>

        <div class="field">
          <label class="field-label" for="f-categoria">
            Categoría
          </label>
          <select
            class="field-input"
            id="f-categoria"
            value={categoriaSel}
            aria-describedby="f-categoria-ayuda"
            onChange={(evento) => setCategoriaSel(evento.currentTarget.value)}
          >
            <option value="">Sin categoría</option>
            {opcionesCategoria.map((categoria) => (
              <option key={categoria} value={categoria}>
                {categoria}
              </option>
            ))}
            <option value="__otra__">Escribir otra…</option>
          </select>
          <p class="field-help" id="f-categoria-ayuda">
            Opcional. Sirve para agrupar tus productos.
          </p>
        </div>

        {categoriaSel === "__otra__" ? (
          <div class="field">
            <label class="field-label" for="f-categoria-otra">
              Nueva categoría
            </label>
            <input
              class="field-input"
              id="f-categoria-otra"
              type="text"
              value={categoriaOtra}
              autocomplete="off"
              aria-describedby="f-categoria-otra-ayuda"
              onInput={(evento) => setCategoriaOtra(evento.currentTarget.value)}
            />
            <p class="field-help" id="f-categoria-otra-ayuda">
              Escribe el nombre con el que la vas a reconocer.
            </p>
          </div>
        ) : null}

        {esEdicion ? (
          <section class="zona-peligro" aria-labelledby="titulo-zona-peligro">
            <p class="field-label" id="titulo-zona-peligro">
              Quitar de la lista
            </p>
            <p class="field-help">
              El producto deja de aparecer; su historial de movimientos se
              conserva.
            </p>
            {confirmando ? (
              <div
                class="card confirmar-eliminar"
                role="alertdialog"
                aria-labelledby="confirmar-titulo"
                aria-describedby="confirmar-texto"
              >
                <p class="card-title" id="confirmar-titulo">
                  ¿Eliminar “{existente?.nombre ?? ""}”?
                </p>
                <p class="card-meta" id="confirmar-texto">
                  Se quitará de tu lista. Sus movimientos no se borran.
                </p>
                <div class="confirmar-acciones">
                  <button
                    id="confirmar-cancelar"
                    type="button"
                    class="btn btn-secondary"
                    onClick={() => setConfirmando(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    class="btn btn-destructive"
                    onClick={() => void eliminar()}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                class="btn btn-destructive"
                onClick={() => setConfirmando(true)}
              >
                Eliminar producto
              </button>
            )}
            {falloEliminar ? (
              <p class="field-error" role="alert">
                <svg class="icono" aria-hidden="true">
                  <use href="#i-circle_alert" />
                </svg>
                No se pudo eliminar. Tus datos siguen en el teléfono —
                inténtalo otra vez.
              </p>
            ) : null}
          </section>
        ) : null}
      </form>

      <div class="cta-sticky">
        <button
          type="submit"
          form="form-producto"
          class="btn btn-primary"
          disabled={!listo || guardando}
        >
          {guardando ? "Guardando…" : "Guardar producto"}
        </button>
      </div>
    </>
  );
}
