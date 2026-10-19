import type { VNode } from "preact";
import { useEffect, useState } from "preact/hooks";
import { formatearUsd } from "@latiendita/core";
import { EstadoVacio } from "../../componentes/EstadoVacio";
import { onNavClick } from "../../router";
import {
  calcularReportes,
  etiquetaRango,
  RANGOS,
  type RangoReporte,
  type ReporteC11,
} from "../../datos/reportes";
import { formatoCantidad } from "../compartido";
import "./reportes.css";

/** Cuántos productos entran en “lo que más se movió” (el resto no es ruido). */
const TOP_MOVIDOS = 5;

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

function ErrorReportes({ reintentar }: { reintentar: () => void }): VNode {
  return (
    <div class="card aviso-error" role="alert">
      <span class="aviso-error-icono">
        <svg class="icono" aria-hidden="true">
          <use href="#i-alert_triangle" />
        </svg>
      </span>
      <div class="aviso-error-cuerpo">
        <p class="card-title">No se pudieron calcular los reportes</p>
        <p class="card-meta">
          Tus datos siguen en el teléfono. Revisa la conexión e inténtalo otra
          vez.
        </p>
        <button type="button" class="btn btn-secondary" onClick={reintentar}>
          Reintentar
        </button>
      </div>
    </div>
  );
}

/**
 * Pantalla 12 — Reportes mínimos (C11), 100 % locales.
 *
 * C11.1 valor del inventario al costo y a precio · C11.2 lo que más se movió
 * en el rango elegido · C11.3 total fiado, cobrado y saldo. Sin librerías de
 * gráficos: filas con barra CSS y texto (nunca sólo color).
 */
export function Reportes(): VNode {
  const [rango, setRango] = useState<RangoReporte>("30d");
  const [datos, setDatos] = useState<ReporteC11 | null>(null);
  const [estado, setEstado] = useState<"cargando" | "listo" | "error">("cargando");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vivo = true;
    setEstado("cargando");
    calcularReportes(rango)
      .then((reporte) => {
        if (!vivo) return;
        setDatos(reporte);
        setEstado("listo");
      })
      .catch(() => {
        if (vivo) setEstado("error");
      });
    return () => {
      vivo = false;
    };
  }, [rango, version]);

  const reintentar = (): void => setVersion((n) => n + 1);

  if (estado === "cargando") {
    return (
      <p class="card-meta" role="status">
        Calculando tus reportes…
      </p>
    );
  }

  if (estado === "error" || datos === null) {
    return <ErrorReportes reintentar={reintentar} />;
  }

  if (!datos.hayDatos) {
    return (
      <EstadoVacio
        icono="i-bar_chart_3"
        titulo="Aún no hay datos para reportar"
        texto="Cuando registres entradas, salidas y fiados, aquí verás el valor de tu inventario y lo que más se mueve."
      >
        <a class="btn btn-primary" href="/productos" onClick={onNavClick}>
          Ver productos
        </a>
        <a class="btn btn-secondary" href="/movimiento" onClick={onNavClick}>
          Registrar movimiento
        </a>
      </EstadoVacio>
    );
  }

  const { inventario, fiados, movidos } = datos;
  const visibles = movidos.slice(0, TOP_MOVIDOS);
  const maximo = visibles[0]?.movimientos ?? 0;

  return (
    <>
      <section aria-labelledby="reportes-rango-label">
        <p class="field-label" id="reportes-rango-label">
          Rango de los movimientos
        </p>
        <div class="reportes-rango" role="group" aria-labelledby="reportes-rango-label">
          {RANGOS.map((opcion) => (
            <button
              key={opcion.valor}
              type="button"
              class="btn btn-secondary btn-segment"
              aria-pressed={rango === opcion.valor}
              onClick={() => setRango(opcion.valor)}
            >
              {opcion.etiqueta}
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="reportes-inventario-titulo">
        <h2 class="reportes-subtitulo" id="reportes-inventario-titulo">
          Inventario
        </h2>
        <div class="reportes-resumen">
          <article class="card reportes-resumen-card">
            <p class="reportes-resumen-label">
              <svg class="icono-sm" aria-hidden="true">
                <use href="#i-package" />
              </svg>
              Valor al costo
            </p>
            <p class="card-amount tabular">
              {formatearUsd(inventario.costoCentavos)}
            </p>
          </article>
          <article class="card reportes-resumen-card">
            <p class="reportes-resumen-label">
              <svg class="icono-sm" aria-hidden="true">
                <use href="#i-coins" />
              </svg>
              Valor a precio
            </p>
            <p class="card-amount tabular reportes-precio">
              {formatearUsd(inventario.precioCentavos)}
            </p>
          </article>
        </div>
        <p class="card-meta reportes-nota">
          {plural(inventario.conStock, "producto con stock", "productos con stock")} ·{" "}
          {formatoCantidad(inventario.unidades)} unidades en total.
        </p>
      </section>

      <section aria-labelledby="reportes-fiados-titulo">
        <h2 class="reportes-subtitulo" id="reportes-fiados-titulo">
          Fiados
        </h2>
        <div class="reportes-resumen reportes-resumen-fiados">
          <article class="card reportes-resumen-card">
            <p class="reportes-resumen-label">Total fiado</p>
            <p class="card-amount tabular">
              {formatearUsd(fiados.totalFiadoCentavos)}
            </p>
          </article>
          <article class="card reportes-resumen-card">
            <p class="reportes-resumen-label">Total cobrado</p>
            <p class="card-amount tabular">
              {formatearUsd(fiados.totalCobradoCentavos)}
            </p>
          </article>
          <article class="card reportes-resumen-card">
            <p class="reportes-resumen-label">Saldo total</p>
            <p class="card-amount tabular reportes-saldo">
              {formatearUsd(fiados.saldoTotalCentavos)}
            </p>
          </article>
        </div>
        <p class="card-meta reportes-nota">
          {fiados.saldoTotalCentavos === 0
            ? "No hay saldo pendiente en la libreta."
            : `${plural(datos.clientesConSaldo, "cliente con saldo pendiente", "clientes con saldo pendiente")}.`}{" "}
          Los totales de fiado son de todo el tiempo; el rango aplica sólo a lo
          que más se movió.
        </p>
      </section>

      <section aria-labelledby="reportes-movidos-titulo">
        <div class="reportes-cabecera">
          <h2 class="reportes-subtitulo" id="reportes-movidos-titulo">
            Lo que más se movió
          </h2>
          <span class="card-meta">{etiquetaRango(datos.rango)}</span>
        </div>

        {visibles.length === 0 ? (
          <div class="card">
            <p class="card-title">Sin movimientos en este rango</p>
            <p class="card-meta">
              Prueba con “Todo” o registra una entrada o salida. Los ajustes de
              conteo no cuentan como movimiento.
            </p>
            <a
              class="btn btn-secondary reportes-boton"
              href="/movimiento"
              onClick={onNavClick}
            >
              Registrar movimiento
            </a>
          </div>
        ) : (
          <>
            <ol class="reportes-movidos">
              {visibles.map((movido) => {
                const ancho =
                  maximo > 0
                    ? Math.max(4, Math.round((movido.movimientos / maximo) * 100))
                    : 0;
                return (
                  <li class="card reportes-movido" key={movido.productoId}>
                    <div class="reportes-movido-cabecera">
                      <h3 class="card-title">{movido.nombre}</h3>
                      <span class="card-meta tabular">
                        {plural(movido.movimientos, "mov", "movs")}
                      </span>
                    </div>
                    <div class="reportes-barra" aria-hidden="true">
                      <span style={`width: ${ancho}%`} />
                    </div>
                    <p class="card-meta tabular">
                      {plural(movido.entradas, "entrada", "entradas")} ·{" "}
                      {plural(movido.salidas, "salida", "salidas")}
                    </p>
                  </li>
                );
              })}
            </ol>
            {movidos.length > TOP_MOVIDOS ? (
              <p class="card-meta reportes-nota">
                Mostramos los {TOP_MOVIDOS} productos con más movimientos.
              </p>
            ) : null}
          </>
        )}
      </section>
    </>
  );
}
