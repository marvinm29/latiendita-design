import type { VNode } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import {
  conBom,
  descargar,
  fiadosCsv,
  movimientosCsv,
  productosCsv,
  respaldoJson,
  type RespaldoJson,
} from "../../datos/exportar";
import {
  importarProductosCsv,
  plantillaProductosCsv,
  restaurarRespaldo,
  validarRespaldoJson,
  type ResultadoImportacionCsv,
  type ResultadoRestauracion,
  type ResumenRespaldo,
} from "../../datos/importar";

type Trabajo =
  | "productos"
  | "movimientos"
  | "fiados"
  | "respaldo"
  | "csv"
  | "restaurar";

interface RespaldoPendiente {
  archivo: string;
  datos: RespaldoJson;
  resumen: ResumenRespaldo;
}

function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}

function mensajeDeError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "No pudimos completar la operación. Intenta de nuevo.";
}

/**
 * Pantalla 13 · Respaldo y datos (C10.1/C10.2/C10.3).
 *
 * Todo pasa en el teléfono: no hay servidor ni dependencias. Los CSV se abren
 * en Excel/LibreOffice; el JSON es el respaldo completo del negocio y se puede
 * volver a cargar para combinar los datos sin borrar nada.
 */
export function Respaldo(): VNode {
  const [trabajo, setTrabajo] = useState<Trabajo | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultadoCsv, setResultadoCsv] = useState<ResultadoImportacionCsv | null>(null);
  const [resultadoRestaurar, setResultadoRestaurar] =
    useState<ResultadoRestauracion | null>(null);
  const [pendiente, setPendiente] = useState<RespaldoPendiente | null>(null);

  const errorRef = useRef<HTMLParagraphElement>(null);
  const dialogoRef = useRef<HTMLDivElement>(null);
  const confirmarRef = useRef<HTMLButtonElement>(null);
  const focoOrigen = useRef<HTMLElement | null>(null);

  // El error se anuncia (role=alert) y además recibe el foco, para que quien
  // usa teclado o lector de pantalla no tenga que buscarlo.
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  // Diálogo de confirmación: foco inicial, Escape para cerrar y Tab encerrado.
  useEffect(() => {
    if (!pendiente) return;
    focoOrigen.current = document.activeElement as HTMLElement | null;
    confirmarRef.current?.focus();

    function alTeclear(evento: KeyboardEvent): void {
      if (evento.key === "Escape") {
        evento.preventDefault();
        setPendiente(null);
        return;
      }
      if (evento.key !== "Tab" || !dialogoRef.current) return;
      const enfocables = dialogoRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );
      if (enfocables.length === 0) return;
      const primero = enfocables[0];
      const ultimo = enfocables[enfocables.length - 1];
      if (!primero || !ultimo) return;
      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primero.focus();
      }
    }

    document.addEventListener("keydown", alTeclear);
    return () => {
      document.removeEventListener("keydown", alTeclear);
      focoOrigen.current?.focus();
    };
  }, [pendiente]);

  async function exportar(cual: Trabajo): Promise<void> {
    if (trabajo !== null) return;
    setTrabajo(cual);
    setAviso(null);
    setError(null);
    setResultadoCsv(null);
    setResultadoRestaurar(null);
    try {
      if (cual === "productos") {
        descargar(`latiendita-productos-${hoy()}.csv`, conBom(await productosCsv()), "text/csv;charset=utf-8");
        setAviso("Productos exportados. Abre el archivo en Excel o LibreOffice.");
      } else if (cual === "movimientos") {
        descargar(`latiendita-movimientos-${hoy()}.csv`, conBom(await movimientosCsv()), "text/csv;charset=utf-8");
        setAviso("Movimientos exportados. El historial no se modifica.");
      } else if (cual === "fiados") {
        descargar(`latiendita-fiados-${hoy()}.csv`, conBom(await fiadosCsv()), "text/csv;charset=utf-8");
        setAviso("Fiados exportados con el saldo de cada movimiento.");
      } else {
        const respaldo = await respaldoJson();
        descargar(
          `latiendita-respaldo-${hoy()}.json`,
          JSON.stringify(respaldo, null, 2),
          "application/json",
        );
        setAviso("Respaldo completo listo. Guárdalo en un lugar seguro.");
      }
    } catch {
      setError("No pudimos preparar el archivo. Intenta de nuevo.");
    } finally {
      setTrabajo(null);
    }
  }

  function descargarPlantilla(): void {
    descargar(
      "latiendita-plantilla-productos.csv",
      conBom(plantillaProductosCsv()),
      "text/csv;charset=utf-8",
    );
    setAviso("Plantilla descargada. Llénala en Excel o LibreOffice y vuelve a subirla.");
    setError(null);
    setResultadoCsv(null);
    setResultadoRestaurar(null);
  }

  async function alElegirCsv(evento: Event): Promise<void> {
    const input = evento.currentTarget as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = "";
    if (!archivo || trabajo !== null) return;

    setTrabajo("csv");
    setAviso(null);
    setError(null);
    setResultadoCsv(null);
    setResultadoRestaurar(null);
    try {
      const resultado = await importarProductosCsv(await archivo.text());
      setResultadoCsv(resultado);
      if (resultado.creados > 0) {
        setAviso(
          `${resultado.creados} ${resultado.creados === 1 ? "producto creado" : "productos creados"}. ` +
            "El stock entrará cuando registres movimientos.",
        );
      }
    } catch (fallo) {
      setError(mensajeDeError(fallo));
    } finally {
      setTrabajo(null);
    }
  }

  async function alElegirRespaldo(evento: Event): Promise<void> {
    const input = evento.currentTarget as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = "";
    if (!archivo || trabajo !== null) return;

    setAviso(null);
    setError(null);
    setResultadoCsv(null);
    setResultadoRestaurar(null);
    try {
      const validacion = validarRespaldoJson(await archivo.text());
      if (!validacion.ok) {
        setError(validacion.error);
        return;
      }
      setPendiente({
        archivo: archivo.name,
        datos: validacion.datos,
        resumen: validacion.resumen,
      });
    } catch (fallo) {
      setError(mensajeDeError(fallo));
    }
  }

  async function confirmarRespaldo(): Promise<void> {
    if (!pendiente || trabajo !== null) return;
    const { datos } = pendiente;
    setTrabajo("restaurar");
    setAviso(null);
    setError(null);
    try {
      const resultado = await restaurarRespaldo(datos);
      setResultadoRestaurar(resultado);
      setAviso("Respaldo restaurado. Tus datos anteriores siguen intactos.");
      setPendiente(null);
    } catch (fallo) {
      setPendiente(null);
      setError(mensajeDeError(fallo));
    } finally {
      setTrabajo(null);
    }
  }

  const totalRespaldo = pendiente
    ? pendiente.resumen.productos +
      pendiente.resumen.movimientos +
      pendiente.resumen.clientes +
      pendiente.resumen.fiados +
      pendiente.resumen.categorias
    : 0;

  return (
    <>
      <section class="card">
        <p class="card-title">Tus datos son tuyos</p>
        <p class="card-meta">
          Exporta el catálogo, el libro y los fiados desde este teléfono. No
          necesitas internet ni pedirle permiso a nadie.
        </p>
      </section>

      <section class="card" aria-labelledby="respaldo-lista">
        <p class="card-title" id="respaldo-lista">
          Exportar
        </p>
        <div style="display: flex; flex-direction: column; gap: var(--space-2); margin-top: var(--space-3);">
          <button
            type="button"
            class="btn btn-secondary btn-bloque"
            disabled={trabajo !== null}
            onClick={() => void exportar("productos")}
          >
            {trabajo === "productos" ? "Preparando…" : "Productos (CSV)"}
          </button>
          <button
            type="button"
            class="btn btn-secondary btn-bloque"
            disabled={trabajo !== null}
            onClick={() => void exportar("movimientos")}
          >
            {trabajo === "movimientos" ? "Preparando…" : "Movimientos (CSV)"}
          </button>
          <button
            type="button"
            class="btn btn-secondary btn-bloque"
            disabled={trabajo !== null}
            onClick={() => void exportar("fiados")}
          >
            {trabajo === "fiados" ? "Preparando…" : "Fiados (CSV)"}
          </button>
          <button
            type="button"
            class="btn btn-primary btn-bloque"
            disabled={trabajo !== null}
            onClick={() => void exportar("respaldo")}
          >
            {trabajo === "respaldo" ? "Preparando…" : "Respaldo completo (JSON)"}
          </button>
        </div>
      </section>

      <section class="card" aria-labelledby="importar-titulo">
        <p class="card-title" id="importar-titulo">
          Importar productos (CSV)
        </p>
        <p class="card-meta" style="margin-top: var(--space-2);">
          Migra tu catálogo desde Excel o LibreOffice. El stock no se importa:
          entra cuando registres entradas y salidas.
        </p>
        <div class="field" style="margin-top: var(--space-3);">
          <label class="field-label" for="csv-productos">
            Archivo CSV de productos
          </label>
          <input
            id="csv-productos"
            class="field-input"
            type="file"
            accept=".csv,text/csv"
            aria-describedby="csv-ayuda"
            disabled={trabajo !== null}
            onChange={(evento) => void alElegirCsv(evento)}
          />
          <p class="field-help" id="csv-ayuda">
            Usa la plantilla: una fila por producto y la primera fila con los
            nombres de las columnas.
          </p>
        </div>
        <button
          type="button"
          class="btn btn-secondary btn-bloque"
          style="margin-top: var(--space-3);"
          disabled={trabajo !== null}
          onClick={descargarPlantilla}
        >
          {trabajo === "csv" ? "Importando…" : "Descargar plantilla CSV"}
        </button>
      </section>

      <section class="card" aria-labelledby="restaurar-titulo">
        <p class="card-title" id="restaurar-titulo">
          Restaurar respaldo (JSON)
        </p>
        <p class="card-meta" style="margin-top: var(--space-2);">
          Vuelve a cargar un respaldo de LaTiendita. Se combina con tus datos
          actuales: no se borra nada.
        </p>
        <div class="field" style="margin-top: var(--space-3);">
          <label class="field-label" for="json-respaldo">
            Archivo JSON de respaldo
          </label>
          <input
            id="json-respaldo"
            class="field-input"
            type="file"
            accept=".json,application/json"
            aria-describedby="json-ayuda"
            disabled={trabajo !== null}
            onChange={(evento) => void alElegirRespaldo(evento)}
          />
          <p class="field-help" id="json-ayuda">
            Primero verás un resumen y después confirmas. Nada se escribe antes
            de que digas que sí.
          </p>
        </div>
      </section>

      {aviso ? (
        <p class="card-meta" role="status">
          {aviso}
        </p>
      ) : null}

      {resultadoRestaurar ? (
        <section class="card" aria-labelledby="resultado-restaurar">
          <p class="card-title" id="resultado-restaurar">
            Respaldo restaurado
          </p>
          <p class="card-meta" role="status">
            {resultadoRestaurar.productos.nuevos +
              resultadoRestaurar.movimientos.nuevos +
              resultadoRestaurar.clientes.nuevos +
              resultadoRestaurar.fiados.nuevos +
              resultadoRestaurar.categorias.nuevos}{" "}
            datos nuevos y{" "}
            {resultadoRestaurar.productos.existentes +
              resultadoRestaurar.movimientos.existentes +
              resultadoRestaurar.clientes.existentes +
              resultadoRestaurar.fiados.existentes +
              resultadoRestaurar.categorias.existentes}{" "}
            que ya tenías. Stock recalculado en{" "}
            {resultadoRestaurar.stockRecalculado}{" "}
            {resultadoRestaurar.stockRecalculado === 1 ? "producto" : "productos"}.
          </p>
        </section>
      ) : null}

      {resultadoCsv ? (
        <section class="card" aria-labelledby="resultado-csv">
          <p class="card-title" id="resultado-csv">
            Resultado de la importación
          </p>
          <p class="card-meta" role="status">
            {resultadoCsv.creados} creados · {resultadoCsv.omitidos} omitidos por
            estar repetidos · {resultadoCsv.errores.length} filas con problemas.
          </p>
          {resultadoCsv.errores.length > 0 ? (
            <div role="alert" style="margin-top: var(--space-2);">
              <p class="card-meta">Revisa estas filas y vuelve a intentarlo:</p>
              <ul class="card-meta">
                {resultadoCsv.errores.map((fila) => (
                  <li key={`${fila.fila}-${fila.mensaje}`}>
                    Fila {fila.fila}: {fila.mensaje}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {error ? (
        <p class="field-error" role="alert" tabIndex={-1} ref={errorRef}>
          <svg class="icono" aria-hidden="true">
            <use href="#i-circle_alert" />
          </svg>
          {error}
        </p>
      ) : null}

      {pendiente ? (
        <div
          style="position: fixed; inset: 0; z-index: 100; display: flex; align-items: flex-end; justify-content: center; padding: var(--space-4); background: var(--color-scrim);"
          onClick={(evento) => {
            if (evento.target === evento.currentTarget) setPendiente(null);
          }}
        >
          <div
            ref={dialogoRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialogo-respaldo-titulo"
            aria-describedby="dialogo-respaldo-texto"
            style="width: 100%; max-width: 480px; display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-4); background: var(--color-surface-card); border: var(--border-hairline) solid var(--color-border-card); border-radius: var(--radius-lg); box-shadow: var(--shadow-xs);"
          >
            <div>
              <h2 class="card-title" id="dialogo-respaldo-titulo">
                Restaurar respaldo
              </h2>
              <p class="card-meta" id="dialogo-respaldo-texto">
                Se combinará con tus datos actuales, no se borra nada. Los
                productos, movimientos, clientes y fiados que ya existen se
                dejan como están.
              </p>
            </div>

            <dl class="card-meta" style="display: grid; grid-template-columns: 1fr auto; gap: var(--space-1) var(--space-3); margin: 0;">
              <dt>Archivo</dt>
              <dd style="margin: 0; text-align: right;">{pendiente.archivo}</dd>
              <dt>Productos</dt>
              <dd style="margin: 0; text-align: right;">{pendiente.resumen.productos}</dd>
              <dt>Movimientos</dt>
              <dd style="margin: 0; text-align: right;">{pendiente.resumen.movimientos}</dd>
              <dt>Clientes</dt>
              <dd style="margin: 0; text-align: right;">{pendiente.resumen.clientes}</dd>
              <dt>Fiados</dt>
              <dd style="margin: 0; text-align: right;">{pendiente.resumen.fiados}</dd>
              <dt>Categorías</dt>
              <dd style="margin: 0; text-align: right;">{pendiente.resumen.categorias}</dd>
              <dt style="font-weight: var(--font-weight-bold);">Total de filas</dt>
              <dd style="margin: 0; text-align: right; font-weight: var(--font-weight-bold);">
                {totalRespaldo}
              </dd>
            </dl>

            <div style="display: flex; gap: var(--space-2);">
              <button
                type="button"
                class="btn btn-secondary"
                style="flex: 1;"
                disabled={trabajo !== null}
                onClick={() => setPendiente(null)}
              >
                Cancelar
              </button>
              <button
                ref={confirmarRef}
                type="button"
                class="btn btn-primary"
                style="flex: 1;"
                disabled={trabajo !== null}
                onClick={() => void confirmarRespaldo()}
              >
                {trabajo === "restaurar" ? "Restaurando…" : "Restaurar ahora"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
