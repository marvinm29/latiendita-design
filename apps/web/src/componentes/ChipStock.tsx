import type { VNode } from "preact";
import { estadoStock, type EstadoStock } from "@latiendita/core";

type ConfigChip = { clase: string; icono: string; texto: string };

/** Icono + texto en cada chip — nunca color solo (DESIGN.md §7/§10). */
const POR_ESTADO: Record<EstadoStock, ConfigChip> = {
  agotado: { clase: "chip chip-danger", icono: "i-package_x", texto: "Agotado" },
  critico: { clase: "chip chip-danger", icono: "i-triangle_alert", texto: "Stock crítico" },
  bajo: { clase: "chip chip-warning", icono: "i-alert_triangle", texto: "Bajo mínimo" },
  ok: { clase: "chip chip-success", icono: "i-package_check", texto: "En stock" },
};

/** Chip de estado de stock para una fila del catálogo. */
export function ChipStock({
  stock,
  minimo,
}: {
  stock: number;
  minimo: number;
}): VNode {
  const cfg = POR_ESTADO[estadoStock(stock, minimo)];
  return (
    <span class={cfg.clase}>
      <svg class="icono" aria-hidden="true">
        <use href={`#${cfg.icono}`} />
      </svg>
      {cfg.texto}
    </span>
  );
}
