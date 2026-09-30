import type { VNode } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import {
  buscarProductos,
  estadoStock,
  formatearUsd,
  type Producto,
  type UnidadVenta,
} from "@latiendita/core";
import { avisoLista } from "../../datos/avisos";
import { useCatalogo, type ItemCatalogo } from "../../datos/catalogoRepo";
import { ChipStock } from "../../componentes/ChipStock";
import { EstadoVacio } from "../../componentes/EstadoVacio";
import { navigate, onNavClick } from "../../router";
import "./productos.css";

type Filtro = "todos" | "bajo" | "agotados";

const FILTROS: { valor: Filtro; etiqueta: string }[] = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "bajo", etiqueta: "Bajo mínimo" },
  { valor: "agotados", etiqueta: "Agotados" },
];

const UNIDAD_TEXTO: Record<UnidadVenta, string> = {
  unidad: "por unidad",
  kg: "por kilo",
  litro: "por litro",
  caja: "por bulto",
};

function metaLinea(producto: Producto): string {
  const partes = [producto.categoria, UNIDAD_TEXTO[producto.unidadVenta]];
  if (producto.codigoBarras) partes.push(producto.codigoBarras);
  return partes.filter((parte) => parte !== "").join(" · ");
}

function cuentaProductos(n: number): string {
  return `${n} producto${n === 1 ? "" : "s"}`;
}

function pasaFiltro(item: ItemCatalogo, filtro: Filtro): boolean {
  if (filtro === "todos") return true;
  const estadoItem = estadoStock(item.stock, item.producto.stockMinimoBase);
  if (filtro === "agotados") return estadoItem === "agotado";
  return estadoItem === "bajo" || estadoItem === "critico";
}

function FilaProducto({ item }: { item: ItemCatalogo }): VNode {
  const { producto, stock } = item;
  const minimo = producto.stockMinimoBase;
  const stockTexto = `${stock} uds${minimo > 0 ? ` · mínimo ${minimo}` : ""}`;
  const etiqueta = `${producto.nombre}, ${formatearUsd(producto.precioCentavos)}, ${stockTexto}. Ver producto.`;

  return (
    <article class="card card-producto">
      <button
        type="button"
        class="card-row"
        aria-label={etiqueta}
        onClick={() => navigate(`/productos/${encodeURIComponent(producto.id)}`)}
      >
        <span class="fila-producto-cuerpo">
          <span class="fila-producto-top">
            <span class="fila-producto-titulos">
              <h3 class="card-title">{producto.nombre}</h3>
              <p class="card-meta">{metaLinea(producto)}</p>
            </span>
            <ChipStock stock={stock} minimo={minimo} />
          </span>
          <span class="fila-producto-precio">
            <span class="product-price">{formatearUsd(producto.precioCentavos)}</span>
            <span class="card-meta tabular">{stockTexto}</span>
          </span>
        </span>
        <svg class="icono card-chevron" aria-hidden="true">
          <use href="#i-chevron_right" />
        </svg>
      </button>
    </article>
  );
}

function EstadoError({ reintentar }: { reintentar: () => void }): VNode {
  return (
    <div class="card aviso-error" role="alert">
      <span class="aviso-error-icono">
        <svg class="icono" aria-hidden="true">
          <use href="#i-alert_triangle" />
        </svg>
      </span>
      <div class="aviso-error-cuerpo">
        <p class="card-title">No se pudieron cargar los productos</p>
        <p class="card-meta">
          Tus productos siguen guardados en el teléfono. Revisa la conexión e
          inténtalo otra vez.
        </p>
        <button type="button" class="btn btn-secondary" onClick={reintentar}>
          Reintentar
        </button>
      </div>
    </div>
  );
}

/** Pantalla 5 — Productos · catálogo local (C2.4 / C2.5). */
export function ListaProductos(): VNode {
  const { items, estado, recargar } = useCatalogo();
  const [consulta, setConsulta] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  // Badge “guardado” que llega desde el formulario (role=status + auto-oculta).
  useEffect(() => {
    if (!avisoLista.value) return;
    const temporizador = setTimeout(() => {
      avisoLista.value = null;
    }, 5000);
    return () => clearTimeout(temporizador);
  }, [avisoLista.value]);

  const visibles = useMemo(() => {
    const porId = new Map(items.map((item) => [item.producto.id, item]));
    return buscarProductos(
      items.map((item) => item.producto),
      consulta,
    )
      .map((producto) => porId.get(producto.id))
      .filter((item): item is ItemCatalogo => item !== undefined)
      .filter((item) => pasaFiltro(item, filtro));
  }, [items, consulta, filtro]);

  const bajos = useMemo(
    () =>
      items.filter((item) => {
        const estadoItem = estadoStock(item.stock, item.producto.stockMinimoBase);
        return estadoItem === "bajo" || estadoItem === "critico";
      }).length,
    [items],
  );

  const aviso = avisoLista.value;

  const resumen =
    consulta.trim() !== ""
      ? `${cuentaProductos(visibles.length)} de ${cuentaProductos(items.length)}`
      : `${cuentaProductos(items.length)} · ${bajos} bajo mínimo`;

  return (
    <>
      {aviso ? (
        <div class="aviso-lista" role="status">
          <span class="chip chip-success">
            <svg class="icono" aria-hidden="true">
              <use href="#i-circle_check" />
            </svg>
            {aviso}
          </span>
        </div>
      ) : null}

      {estado === "cargando" ? (
        <p class="card-meta">Cargando tu catálogo…</p>
      ) : estado === "error" ? (
        <EstadoError reintentar={recargar} />
      ) : items.length === 0 ? (
        <EstadoVacio
          icono="i-package"
          titulo="Agrega tu primer producto"
          texto="Con el código de barras el nombre se llena solo. Así controlas tu inventario y tus fiados."
        >
          <a
            class="btn btn-primary"
            href="/productos/nuevo"
            onClick={onNavClick}
          >
            Agregar producto
          </a>
          <a class="btn btn-secondary" href="/escanear" onClick={onNavClick}>
            Escanear
          </a>
        </EstadoVacio>
      ) : (
        <>
          <div class="field buscador">
            <label class="field-label" for="buscar-producto">
              Buscar producto
            </label>
            <span class="buscador-icono" aria-hidden="true">
              <svg class="icono">
                <use href="#i-search" />
              </svg>
            </span>
            <input
              class="field-input"
              id="buscar-producto"
              type="search"
              value={consulta}
              placeholder="Nombre o código de barras"
              autocomplete="off"
              aria-describedby="buscar-producto-ayuda"
              onInput={(evento) => setConsulta(evento.currentTarget.value)}
            />
            <p class="field-help" id="buscar-producto-ayuda">
              Los resultados aparecen mientras escribes, sin internet.
            </p>
          </div>

          <div class="segment-group" role="group" aria-label="Filtrar">
            {FILTROS.map((opcion) => (
              <button
                key={opcion.valor}
                type="button"
                class="btn btn-secondary btn-segment"
                aria-pressed={filtro === opcion.valor}
                onClick={() => setFiltro(opcion.valor)}
              >
                {opcion.etiqueta}
              </button>
            ))}
          </div>

          <p class="card-meta resumen-catalogo">{resumen}</p>

          {visibles.length === 0 ? (
            consulta.trim() !== "" ? (
              <EstadoVacio
                icono="i-search"
                titulo={`No encontramos “${consulta.trim()}”`}
                texto="Revisa la palabra o agrégalo como producto nuevo: queda con el código que escanees."
              >
                <a
                  class="btn btn-primary"
                  href="/productos/nuevo"
                  onClick={onNavClick}
                >
                  Agregar producto nuevo
                </a>
                <a
                  class="btn btn-secondary"
                  href="/escanear"
                  onClick={onNavClick}
                >
                  Escanear código
                </a>
              </EstadoVacio>
            ) : (
              <EstadoVacio
                icono="i-package"
                titulo="Aquí no hay nada por ahora"
                texto="Ningún producto está en ese estado. Cambia el filtro para ver todo tu catálogo."
              >
                <button
                  type="button"
                  class="btn btn-primary"
                  onClick={() => setFiltro("todos")}
                >
                  Ver todos
                </button>
              </EstadoVacio>
            )
          ) : (
            <div class="lista-productos">
              {visibles.map((item) => (
                <FilaProducto key={item.producto.id} item={item} />
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
