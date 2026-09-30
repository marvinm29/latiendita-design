import type { ComponentChildren, VNode } from "preact";

/**
 * Estado vacío / sin resultados (DS-24): círculo con icono + texto que
 * enseña el primer paso + acciones. Los botones los paga la pantalla.
 */
export function EstadoVacio({
  icono,
  titulo,
  texto,
  children,
}: {
  icono: string;
  titulo: string;
  texto: string;
  children?: ComponentChildren;
}): VNode {
  return (
    <div class="estado-vacio">
      <span class="estado-vacio-icono">
        <svg class="icono-lg" aria-hidden="true">
          <use href={`#${icono}`} />
        </svg>
      </span>
      <p class="card-title">{titulo}</p>
      <p class="card-meta estado-vacio-texto">{texto}</p>
      <div class="estado-vacio-acciones">{children}</div>
    </div>
  );
}
