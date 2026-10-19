import type { VNode } from "preact";
import { useEffect, useState } from "preact/hooks";
import {
  formatearUsd,
  type MovimientoTipo,
  type UnidadVenta,
} from "@latiendita/core";
import { ChipStock } from "../../componentes/ChipStock";
import { EstadoVacio } from "../../componentes/EstadoVacio";
import { onNavClick } from "../../router";
import {
  calcularResumenInicio,
  type ResumenInicio,
} from "../../datos/reportes";
import { formatoCantidad, formatoFecha, TEXTO_UNIDAD } from "../compartido";
import "./inicio.css";

const UNIDAD_CORTA: Record<UnidadVenta, string> = {
  unidad: "uds",
  kg: "kg",
  litro: "L",
  caja: "bultos",
};

const TIPO_MOVIMIENTO: Record<MovimientoTipo, string> = {
  entrada: "Entrada",
  salida: "Salida",
  ajuste: "Ajuste",
};

const ICONO_MOVIMIENTO: Record<MovimientoTipo, string> = {
  entrada: "i-package_plus",
  salida: "i-package_minus",
  ajuste: "i-clipboard_list",
};

function signoMovimiento(tipo: MovimientoTipo, cantidadBase: number): string {
  if (tipo === "entrada") return "+";
  if (tipo === "salida") return "−";
  return cantidadBase >= 0 ? "+" : "−";
}

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

function ErrorInicio({ reintentar }: { reintentar: () => void }): VNode {
  return (
    <div class="card aviso-error" role="alert">
      <span class="aviso-error-icono">
        <svg class="icono" aria-hidden="true">
          <use href="#i-alert_triangle" />
        </svg>
      </span>
      <div class="aviso-error-cuerpo">
        <p class="card-title">No se pudo cargar tu resumen</p>
        <p class="card-meta">
          Tus datos siguen guardados en el teléfono. Revisa la conexión e
          inténtalo otra vez.
        </p>
        <button type="button" class="btn btn-secondary" onClick={reintentar}>
          Reintentar
        </button>
      </div>
    </div>
  );
}

/**
 * Pantalla 3 — Inicio (C5.1).
 *
 * Resumen local: lo que falta (agotados / bajo mínimo), fiado total, últimos
 * movimientos, conteo en curso y accesos a Conteo y Reportes. Todo se calcula
 * desde IndexedDB, sin red (C8.1).
 */
export function Inicio(): VNode {
  const [resumen, setResumen] = useState<ResumenInicio | null>(null);
  const [estado, setEstado] = useState<"cargando" | "listo" | "error">("cargando");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vivo = true;
    setEstado("cargando");
    calcularResumenInicio()
      .then((datos) => {
        if (!vivo) return;
        setResumen(datos);
        setEstado("listo");
      })
      .catch(() => {
        if (vivo) setEstado("error");
      });
    return () => {
      vivo = false;
    };
  }, [version]);

  const reintentar = (): void => setVersion((n) => n + 1);

  if (estado === "cargando") {
    return (
      <p class="card-meta" role="status">
        Cargando tu resumen…
      </p>
    );
  }

  if (estado === "error" || resumen === null) {
    return <ErrorInicio reintentar={reintentar} />;
  }

  if (resumen.productos === 0) {
    return (
      <EstadoVacio
        icono="i-package"
        titulo="Agrega tu primer producto"
        texto="Con el código de barras el nombre se llena solo. Así empiezas a controlar tu inventario y tus fiados."
      >
        <a class="btn btn-primary" href="/productos/nuevo" onClick={onNavClick}>
          Agregar producto
        </a>
        <a class="btn btn-secondary" href="/escanear" onClick={onNavClick}>
          Escanear
        </a>
      </EstadoVacio>
    );
  }

  const fiado = resumen.saldoFiadoCentavos;
  const detalleFiado =
    fiado > 0
      ? `${plural(resumen.clientesConSaldo, "cliente con saldo", "clientes con saldo")}`
      : fiado < 0
        ? "Tus clientes tienen saldo a favor"
        : "Nadie debe por ahora";

  return (
    <>
      <section aria-labelledby="inicio-resumen-titulo">
        <h2 class="inicio-subtitulo" id="inicio-resumen-titulo">
          Resumen
        </h2>
        <div class="inicio-resumen">
          <article class="card inicio-resumen-card">
            <p class="inicio-resumen-label">
              <svg class="icono-sm" aria-hidden="true">
                <use href="#i-package" />
              </svg>
              Productos
            </p>
            <p class="card-amount tabular">{resumen.productos}</p>
          </article>
          <article class="card inicio-resumen-card">
            <p class="inicio-resumen-label">
              <svg class="icono-sm" aria-hidden="true">
                <use href="#i-alert_triangle" />
              </svg>
              Por falta
            </p>
            <p class="card-amount tabular inicio-aviso-monto">{resumen.porFaltar}</p>
          </article>
          <article class="card inicio-resumen-card">
            <p class="inicio-resumen-label">
              <svg class="icono-sm" aria-hidden="true">
                <use href="#i-coins" />
              </svg>
              Fiado
            </p>
            <p class="card-amount tabular">{formatearUsd(fiado)}</p>
          </article>
        </div>
      </section>

      {resumen.conteoEnCurso ? (
        <section aria-labelledby="inicio-conteo-titulo">
          <a
            class="card card-row inicio-conteo"
            href="/conteo"
            onClick={onNavClick}
          >
            <span class="inicio-conteo-icono" aria-hidden="true">
              <svg class="icono" aria-hidden="true">
                <use href="#i-clipboard_list" />
              </svg>
            </span>
            <span class="inicio-conteo-cuerpo">
              <span class="card-title" id="inicio-conteo-titulo">
                Conteo en curso
              </span>
              <span class="card-meta">
                {resumen.conteoEnCurso.contados === 0
                  ? "Aún no has contado ningún producto"
                  : `${plural(resumen.conteoEnCurso.contados, "producto contado", "productos contados")} · ${formatoFecha(resumen.conteoEnCurso.creadoEn)}`}
              </span>
              <span class="text-link inicio-enlace">Continuar conteo</span>
            </span>
            <svg class="icono card-chevron" aria-hidden="true">
              <use href="#i-chevron_right" />
            </svg>
          </a>
        </section>
      ) : null}

      <section aria-labelledby="inicio-falta-titulo">
        <div class="inicio-cabecera">
          <h2 class="inicio-subtitulo" id="inicio-falta-titulo">
            Lo que falta
          </h2>
          <a class="text-link inicio-enlace" href="/productos" onClick={onNavClick}>
            Ver todo ({resumen.porFaltar})
          </a>
        </div>

        {resumen.faltantes.length === 0 ? (
          <div class="card">
            <p class="card-title">Todo está por encima del mínimo</p>
            <p class="card-meta">
              Cuando un producto baje del mínimo que le pusiste, aparecerá aquí
              para que lo repongas a tiempo.
            </p>
          </div>
        ) : (
          <ul class="inicio-faltantes">
            {resumen.faltantes.map((faltante) => {
              const { producto, stock, minimo } = faltante;
              return (
                <li class="card inicio-faltante" key={producto.id}>
                  <a
                    class="card-row"
                    href={`/productos/${encodeURIComponent(producto.id)}`}
                    onClick={onNavClick}
                  >
                    <span class="inicio-faltante-cuerpo">
                      <span class="inicio-faltante-top">
                        <span class="inicio-faltante-titulos">
                          <h3 class="card-title">{producto.nombre}</h3>
                          <p class="card-meta">
                            {producto.categoria} · {TEXTO_UNIDAD[producto.unidadVenta]}
                          </p>
                        </span>
                        <ChipStock stock={stock} minimo={minimo} />
                      </span>
                      <span class="inicio-faltante-pie">
                        <span class="product-price">
                          {formatearUsd(producto.precioCentavos)}
                        </span>
                        <span class="card-meta tabular">
                          {formatoCantidad(stock)} {UNIDAD_CORTA[producto.unidadBase]}
                          {minimo > 0 ? ` · mínimo ${formatoCantidad(minimo)}` : ""}
                        </span>
                      </span>
                    </span>
                    <svg class="icono card-chevron" aria-hidden="true">
                      <use href="#i-chevron_right" />
                    </svg>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="inicio-fiado-titulo">
        <h2 class="inicio-subtitulo" id="inicio-fiado-titulo">
          Fiados
        </h2>
        <a
          class="card card-row inicio-fiado"
          href="/fiados"
          onClick={onNavClick}
          aria-label={`Fiado total ${formatearUsd(fiado)}. ${detalleFiado}. Ver libreta`}
        >
          <span class="inicio-fiado-icono" aria-hidden="true">
            <svg class="icono" aria-hidden="true">
              <use href="#i-book_open" />
            </svg>
          </span>
          <span class="inicio-fiado-cuerpo">
            <span class="card-title">Fiado total</span>
            <span class="card-meta">{detalleFiado}</span>
            <span class="text-link inicio-enlace">Ver libreta</span>
          </span>
          <span class="inicio-fiado-monto tabular">{formatearUsd(fiado)}</span>
          <svg class="icono card-chevron" aria-hidden="true">
            <use href="#i-chevron_right" />
          </svg>
        </a>
      </section>

      <section aria-labelledby="inicio-movimientos-titulo">
        <h2 class="inicio-subtitulo" id="inicio-movimientos-titulo">
          Últimos movimientos
        </h2>
        {resumen.recientes.length === 0 ? (
          <div class="card">
            <p class="card-title">Todavía no hay movimientos</p>
            <p class="card-meta">
              Cuando registres una entrada o una salida, aquí verás las últimas
              cinco.
            </p>
            <a
              class="btn btn-secondary inicio-boton"
              href="/movimiento"
              onClick={onNavClick}
            >
              Registrar movimiento
            </a>
          </div>
        ) : (
          <ul class="inicio-movimientos">
            {resumen.recientes.map((movimiento) => (
              <li class="card inicio-movimiento" key={movimiento.id}>
                <span
                  class={
                    movimiento.tipo === "salida"
                      ? "inicio-movimiento-icono es-salida"
                      : "inicio-movimiento-icono"
                  }
                  aria-hidden="true"
                >
                  <svg class="icono" aria-hidden="true">
                    <use href={`#${ICONO_MOVIMIENTO[movimiento.tipo]}`} />
                  </svg>
                </span>
                <span class="inicio-movimiento-cuerpo">
                  <span class="card-title">{movimiento.nombre}</span>
                  <span class="card-meta">
                    {TIPO_MOVIMIENTO[movimiento.tipo]} ·{" "}
                    {formatoFecha(movimiento.ocurridoEn)}
                  </span>
                </span>
                <span class="inicio-movimiento-cantidad tabular">
                  {signoMovimiento(movimiento.tipo, movimiento.cantidadBase)}
                  {formatoCantidad(Math.abs(movimiento.cantidadBase))}{" "}
                  {UNIDAD_CORTA[movimiento.unidad]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <nav class="inicio-accesos" aria-label="Accesos rápidos">
        <a class="card card-row inicio-acceso" href="/conteo" onClick={onNavClick}>
          <svg class="icono" aria-hidden="true">
            <use href="#i-clipboard_list" />
          </svg>
          <span class="inicio-acceso-cuerpo">
            <span class="card-title">Conteo</span>
            <span class="card-meta">Cuenta lo que hay en tu tienda</span>
          </span>
          <svg class="icono card-chevron" aria-hidden="true">
            <use href="#i-chevron_right" />
          </svg>
        </a>
        <a
          class="card card-row inicio-acceso"
          href="/mas/reportes"
          onClick={onNavClick}
        >
          <svg class="icono" aria-hidden="true">
            <use href="#i-bar_chart_3" />
          </svg>
          <span class="inicio-acceso-cuerpo">
            <span class="card-title">Reportes</span>
            <span class="card-meta">Valor del inventario y los movimientos</span>
          </span>
          <svg class="icono card-chevron" aria-hidden="true">
            <use href="#i-chevron_right" />
          </svg>
        </a>
      </nav>
    </>
  );
}
