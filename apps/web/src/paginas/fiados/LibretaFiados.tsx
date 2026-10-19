import type { VNode } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import { formatearUsd, type OrdenLibreta } from "@latiendita/core";
import { EstadoVacio } from "../../componentes/EstadoVacio";
import {
  repoFiados,
  useLibreta,
  type ClienteLibreta,
} from "../../datos/fiadosRepo";
import { onNavClick } from "../../router";
import "./fiados.css";

const ORDENES: { valor: OrdenLibreta; etiqueta: string }[] = [
  { valor: "saldo", etiqueta: "Por saldo" },
  { valor: "antiguedad", etiqueta: "Por antigüedad" },
];

/** Minúsculas y sin acentos: buscar “maria” encuentra “María”. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function ultimoTexto(ms: number | null): string {
  if (ms === null) return "Todavía sin movimientos";
  const dias = Math.floor((Date.now() - ms) / 86_400_000);
  if (dias <= 0) return "Último movimiento hoy";
  if (dias === 1) return "Último movimiento ayer";
  return `Último movimiento hace ${dias} días`;
}

function estadoSaldo(saldo: number): { texto: string; chip: string } {
  if (saldo > 0) return { texto: "Debe", chip: "chip chip-warning" };
  if (saldo < 0) return { texto: "A favor", chip: "chip chip-success" };
  return { texto: "Al día", chip: "chip chip-neutral" };
}

function FilaCliente({ cliente }: { cliente: ClienteLibreta }): VNode {
  const estado = estadoSaldo(cliente.saldoCentavos);
  const monto = formatearUsd(cliente.saldoCentavos);
  const telefono = cliente.telefono ? `${cliente.telefono} · ` : "";
  return (
    <article class="card fiado-fila-card">
      <a
        class="card-row fiado-fila"
        href={`/fiados/${encodeURIComponent(cliente.id)}`}
        onClick={onNavClick}
      >
        <span class="fiado-fila-cuerpo">
          <span class="fiado-fila-top">
            <span class="fiado-fila-titulos">
              <h3 class="card-title">{cliente.nombre}</h3>
              <p class="card-meta">
                {telefono}
                {ultimoTexto(cliente.ultimoMovimientoEn)}
              </p>
            </span>
            <span class="fiado-saldo">
              <span class={cliente.saldoCentavos > 0 ? "fiado-monto es-deuda" : "fiado-monto"}>
                {monto}
              </span>
              <span class={estado.chip}>{estado.texto}</span>
            </span>
          </span>
        </span>
        <svg class="icono card-chevron" aria-hidden="true">
          <use href="#i-chevron_right" />
        </svg>
      </a>
    </article>
  );
}

/**
 * Pantalla 9 — Libreta de fiados (C6.1/C6.3).
 *
 * Lista clientes con su saldo derivado del ledger, ordenados por saldo
 * descendente o antigüedad. Buscador local, resumen y alta de cliente en el
 * momento. Todo sale de IndexedDB: funciona sin conexión (C8.1).
 */
export function LibretaFiados(): VNode {
  const [orden, setOrden] = useState<OrdenLibreta>("saldo");
  const { clientes, estado, recargar } = useLibreta(orden);
  const [consulta, setConsulta] = useState("");
  const [cobradoMes, setCobradoMes] = useState(0);

  // “Cobrado este mes”: abonos del mes en curso, siempre desde el ledger local.
  useEffect(() => {
    let vivo = true;
    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).getTime();
    const finMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1).getTime();
    repoFiados
      .listarTodosLosMovimientos()
      .then((movimientos) => {
        if (!vivo) return;
        setCobradoMes(
          movimientos
            .filter(
              (m) =>
                m.tipo === "abono" && m.creadoEn >= inicioMes && m.creadoEn < finMes,
            )
            .reduce((total, m) => total + m.montoCentavos, 0),
        );
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [clientes]);

  const visibles = useMemo(() => {
    const termino = normalizar(consulta.trim());
    if (termino === "") return clientes;
    return clientes.filter(
      (cliente) =>
        normalizar(cliente.nombre).includes(termino) ||
        (cliente.telefono ?? "").includes(termino),
    );
  }, [clientes, consulta]);

  const saldoTotal = useMemo(
    () => clientes.reduce((total, cliente) => total + cliente.saldoCentavos, 0),
    [clientes],
  );
  const conSaldo = clientes.filter((cliente) => cliente.saldoCentavos > 0).length;

  if (estado === "cargando") {
    return <p class="card-meta">Cargando tu libreta…</p>;
  }

  if (estado === "error") {
    return (
      <div class="card aviso-error" role="alert">
        <span class="aviso-error-icono">
          <svg class="icono" aria-hidden="true">
            <use href="#i-alert_triangle" />
          </svg>
        </span>
        <div class="aviso-error-cuerpo">
          <p class="card-title">No se pudieron cargar los fiados</p>
          <p class="card-meta">
            Los saldos siguen guardados en el teléfono. Revisa la conexión e
            inténtalo otra vez.
          </p>
          <button type="button" class="btn btn-secondary" onClick={recargar}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (clientes.length === 0) {
    return (
      <EstadoVacio
        icono="i-book_open"
        titulo="Agrega el primer cliente"
        texto="Guarda quién te debe y cuánto. Después puedes fiar y abonar en segundos, con o sin internet."
      >
        <a class="btn btn-primary" href="/fiados/nuevo" onClick={onNavClick}>
          Crear cliente
        </a>
        <a class="btn btn-secondary" href="/productos" onClick={onNavClick}>
          Ver productos
        </a>
      </EstadoVacio>
    );
  }

  return (
    <>
      <section aria-labelledby="fiados-resumen-titulo">
        <h2 class="fiados-subtitulo" id="fiados-resumen-titulo">
          Resumen
        </h2>
        <div class="fiados-resumen">
          <article class="card fiados-resumen-card">
            <p class="fiados-resumen-label">
              <svg class="icono-sm" aria-hidden="true">
                <use href="#i-coins" />
              </svg>
              Saldo total
            </p>
            <p class="card-amount balance-amount tabular">{formatearUsd(saldoTotal)}</p>
          </article>
          <article class="card fiados-resumen-card">
            <p class="fiados-resumen-label">
              <svg class="icono-sm" aria-hidden="true">
                <use href="#i-users" />
              </svg>
              Con saldo
            </p>
            <p class="card-amount tabular">{conSaldo}</p>
          </article>
          <article class="card fiados-resumen-card">
            <p class="fiados-resumen-label">
              <svg class="icono-sm" aria-hidden="true">
                <use href="#i-check" />
              </svg>
              Cobrado este mes
            </p>
            <p class="card-amount tabular">{formatearUsd(cobradoMes)}</p>
          </article>
        </div>
      </section>

      <div class="field buscador">
        <label class="field-label" for="buscar-cliente">
          Buscar cliente
        </label>
        <span class="buscador-icono" aria-hidden="true">
          <svg class="icono">
            <use href="#i-search" />
          </svg>
        </span>
        <input
          class="field-input"
          id="buscar-cliente"
          type="search"
          value={consulta}
          placeholder="Nombre o teléfono"
          autocomplete="off"
          aria-describedby="buscar-cliente-ayuda"
          onInput={(evento) => setConsulta(evento.currentTarget.value)}
        />
        <p class="field-help" id="buscar-cliente-ayuda">
          Los resultados aparecen mientras escribes, sin internet.
        </p>
      </div>

      <div class="segment-group" role="group" aria-label="Ordenar la libreta">
        {ORDENES.map((opcion) => (
          <button
            key={opcion.valor}
            type="button"
            class="btn btn-secondary btn-segment"
            aria-pressed={orden === opcion.valor}
            onClick={() => setOrden(opcion.valor)}
          >
            {opcion.etiqueta}
          </button>
        ))}
      </div>

      <p class="card-meta fiados-resumen-texto" role="status">
        {visibles.length === clientes.length
          ? `${clientes.length} cliente${clientes.length === 1 ? "" : "s"}`
          : `${visibles.length} de ${clientes.length} clientes`}
        {consulta.trim() === "" && conSaldo > 0
          ? ` · ${conSaldo} con saldo pendiente`
          : ""}
      </p>

      {visibles.length === 0 ? (
        <EstadoVacio
          icono="i-search"
          titulo={`No encontramos “${consulta.trim()}”`}
          texto="Revisa el nombre o el teléfono. También puedes crear el cliente ahora mismo."
        >
          <button
            type="button"
            class="btn btn-primary"
            onClick={() => setConsulta("")}
          >
            Ver todos
          </button>
          <a class="btn btn-secondary" href="/fiados/nuevo" onClick={onNavClick}>
            Crear cliente
          </a>
        </EstadoVacio>
      ) : (
        <div class="lista-productos">
          {visibles.map((cliente) => (
            <FilaCliente key={cliente.id} cliente={cliente} />
          ))}
        </div>
      )}

      {visibles.length > 0 && consulta.trim() === "" ? (
        <p class="card-meta fiados-pie">
          Ordenado por {orden === "saldo" ? "saldo y antigüedad" : "antigüedad"}.
        </p>
      ) : null}
    </>
  );
}
