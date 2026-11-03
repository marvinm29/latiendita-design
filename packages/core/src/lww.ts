/** Fusión determinista por campo para datos mutables (003 §5.4). */
export type ValorLww = string | number | boolean | null;

export interface CampoLww {
  valor: ValorLww;
  actualizadoEn: number;
  dispositivoId: string;
}

export type CamposLww = Readonly<Record<string, CampoLww>>;

function validarCampo(nombre: string, campo: CampoLww): void {
  if (!nombre || ["__proto__", "constructor", "prototype"].includes(nombre)) {
    throw new Error("Nombre de campo inválido");
  }
  if (!Number.isSafeInteger(campo.actualizadoEn) || campo.actualizadoEn < 0 || !campo.dispositivoId) {
    throw new Error(`Marca inválida: ${nombre}`);
  }
  if (campo.valor !== null && !["string", "number", "boolean"].includes(typeof campo.valor)) {
    throw new Error(`Valor inválido: ${nombre}`);
  }
  if (typeof campo.valor === "number" && !Number.isFinite(campo.valor)) {
    throw new Error(`Valor inválido: ${nombre}`);
  }
}

/** Aplica únicamente las marcas ganadoras, sin modificar ninguno de los argumentos. */
export function aplicarCambiosLww(actual: CamposLww, cambios: CamposLww): CamposLww {
  const resultado: Record<string, CampoLww> = Object.create(null) as Record<string, CampoLww>;
  for (const [nombre, campo] of Object.entries(actual)) {
    validarCampo(nombre, campo);
    resultado[nombre] = { ...campo };
  }
  for (const [nombre, entrante] of Object.entries(cambios)) {
    validarCampo(nombre, entrante);
    const previo = resultado[nombre];
    if (!previo || entrante.actualizadoEn > previo.actualizadoEn ||
        (entrante.actualizadoEn === previo.actualizadoEn && entrante.dispositivoId > previo.dispositivoId)) {
      resultado[nombre] = { ...entrante };
    } else if (entrante.actualizadoEn === previo.actualizadoEn && entrante.dispositivoId === previo.dispositivoId && entrante.valor !== previo.valor) {
      throw new Error(`Una misma marca no puede representar valores distintos: ${nombre}`);
    }
  }
  return resultado;
}
