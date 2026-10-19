import type { VNode } from "preact";
import { useState } from "preact/hooks";
import {
  conBom,
  descargar,
  fiadosCsv,
  movimientosCsv,
  productosCsv,
  respaldoJson,
} from "../../datos/exportar";

type Trabajo = "productos" | "movimientos" | "fiados" | "respaldo";

function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Pantalla 13 · Respaldo y datos (C10.1/C10.2).
 *
 * Todo se genera en el teléfono: no hay servidor ni dependencias. Los CSV se
 * abren en Excel/LibreOffice; el JSON es el respaldo completo del negocio.
 */
export function Respaldo(): VNode {
  const [trabajo, setTrabajo] = useState<Trabajo | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function exportar(cual: Trabajo): Promise<void> {
    if (trabajo !== null) return;
    setTrabajo(cual);
    setAviso(null);
    setError(null);
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
