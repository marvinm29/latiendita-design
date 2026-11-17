import type { VNode } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { descargar } from "../../datos/exportar";
import {
  leerRespaldoLocal,
  prepararTrasladoLocal,
  trasladarDatosLocales,
  type RespaldoLocal,
  type ResumenTraslado,
} from "../../datos/migracionLocal";

/** C1.4 · La confirmación de propiedad es independiente del alta de la cuenta. */
export function DatosAnteriores(): VNode | null {
  const [resumen, setResumen] = useState<ResumenTraslado | null>(null);
  const [respaldo, setRespaldo] = useState<RespaldoLocal | null>(null);
  const [revisando, setRevisando] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    let vivo = true;
    Promise.all([prepararTrasladoLocal(), leerRespaldoLocal()]).then(([datos, copia]) => {
      if (vivo) { setResumen(datos); setRespaldo(copia); }
    }).catch(() => {
      if (vivo) setError("No pudimos revisar los datos anteriores. Vuelve a abrir esta pantalla.");
    });
    return () => { vivo = false; };
  }, []);

  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  async function trasladar(): Promise<void> {
    if (!resumen || !confirmado || ocupado) return;
    setOcupado(true);
    setError(null);
    try {
      await trasladarDatosLocales(resumen);
      setRespaldo(await leerRespaldoLocal());
      setResumen(null);
      setAviso("Datos anteriores trasladados. El respaldo quedó guardado en este teléfono. La sincronización con el servidor sigue pendiente.");
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : "No pudimos trasladar los datos. Los anteriores siguen intactos.");
    } finally { setOcupado(false); }
  }

  async function descargarAnterior(): Promise<void> {
    setError(null);
    try {
      // La pantalla puede seguir abierta después de cambiar la sesión en otra pestaña.
      const actual = await leerRespaldoLocal();
      if (!actual) {
        setError("La cuenta cambió o está bloqueada. Abre el respaldo con la cuenta de la tienda que recibió los datos.");
        return;
      }
      descargar(`latiendita-anterior-${actual.exportadoEn.slice(0, 10)}.json`, JSON.stringify(actual, null, 2), "application/json");
    } catch {
      setError("No pudimos preparar el respaldo anterior. Intenta de nuevo.");
    }
  }

  if (!resumen && !respaldo && !error) return null;
  return (
    <section class="card" aria-labelledby="datos-anteriores-titulo">
      <h2 class="card-title" id="datos-anteriores-titulo">Datos anteriores de este teléfono</h2>
      {resumen ? <>
        <p class="card-meta">
          Hay datos guardados antes de entrar a una cuenta. Pueden mezclar ejemplos y datos reales.
          Sólo la dueña debe confirmar si todos pertenecen a su tienda actual.
        </p>
        {revisando ? <>
          <p class="card-meta">Cuenta de {resumen.nombre}: se trasladarán {resumen.productos} productos,
            {" "}{resumen.movimientos} movimientos, {resumen.clientes} clientes,
            {" "}{resumen.fiados} fiados y {resumen.conteos} conteos, con sus unidades y operaciones pendientes.</p>
          <p class="card-meta">Primero se guardará un respaldo del origen en este teléfono.
            Se conservarán todos los ejemplos e historiales. Tu tienda debe estar vacía en este teléfono.
            Este paso no envía los datos al servidor.</p>
          <label class="card-meta" style="display: flex; align-items: center; gap: var(--space-2); min-height: var(--size-touch-min);">
            <input type="checkbox" checked={confirmado} disabled={ocupado}
              onChange={(evento) => setConfirmado(evento.currentTarget.checked)} />
            Estos datos son de mi tienda
          </label>
          <div style="display: flex; flex-direction: column; gap: var(--space-2); margin-top: var(--space-3);">
            <button class="btn btn-primary btn-bloque" type="button" disabled={!confirmado || ocupado} onClick={() => void trasladar()}>
              {ocupado ? "Trasladando…" : "Guardar respaldo y trasladar"}
            </button>
            <button class="btn btn-secondary btn-bloque" type="button" disabled={ocupado} onClick={() => { setRevisando(false); setConfirmado(false); setError(null); }}>
              Cancelar traslado
            </button>
          </div>
        </> : <button class="btn btn-secondary btn-bloque" type="button" style="margin-top: var(--space-3);" onClick={() => setRevisando(true)}>
          Revisar datos anteriores
        </button>}
      </> : null}
      {respaldo ? <>
        <p class="card-meta">El respaldo anterior al traslado sigue disponible. Descárgalo y guárdalo fuera de este teléfono.</p>
        <button class="btn btn-secondary btn-bloque" type="button" style="margin-top: var(--space-3);" onClick={() => void descargarAnterior()}>Descargar respaldo anterior</button>
      </> : null}
      {aviso ? <p class="card-meta" role="status">{aviso}</p> : null}
      {error ? <p class="field-error" role="alert" tabIndex={-1} ref={errorRef}>{error}</p> : null}
    </section>
  );
}
