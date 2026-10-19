/** Auxiliares de las pantallas de acceso. */

/**
 * Lleva el foco al primer campo con error (WCAG: el error se anuncia y se
 * puede corregir sin buscar). Espera al siguiente tick para que Preact ya
 * haya pintado el mensaje.
 */
export function enfocarCampo(id: string): void {
  if (typeof document === "undefined") return;
  setTimeout(() => {
    document.getElementById(id)?.focus();
  }, 0);
}

/** Código de invitación: mayúsculas, sin espacios ni guiones. */
export function normalizarCodigo(codigo: string): string {
  return codigo.replace(/[\s-]/g, "").toUpperCase();
}
