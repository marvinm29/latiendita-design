import type { VNode } from "preact";
import { useEffect, useState } from "preact/hooks";
import type { SesionCuenta } from "@latiendita/core";
import {
  isSectionActive,
  matchPath,
  navigate,
  onNavClick,
  useLocation,
  type PathParams,
} from "./router";
import { BannerOffline } from "./componentes/BannerOffline";
import { repoSesion } from "./datos/sesionRepo";
import { CrearTienda } from "./paginas/auth/CrearTienda";
import { Unirse } from "./paginas/auth/Unirse";
import { PantallaBloqueo } from "./paginas/auth/PantallaBloqueo";
import { SesionActual } from "./paginas/auth/SesionActual";
import { ListaProductos } from "./paginas/productos/ListaProductos";
import { FormProducto } from "./paginas/productos/FormProducto";
import { Escanear } from "./paginas/escanear/Escanear";
import { Movimiento } from "./paginas/movimiento/Movimiento";
import { Conteo } from "./paginas/conteo/Conteo";

type PageProps = { params: PathParams };
type Page = (props: PageProps) => VNode;

/** Acción del header (un solo botón, espejo de design/tools/shell.py). */
type HeaderAccion = { href: string; etiqueta: string; icono: string };

type Route = {
  path: string;
  title: string;
  /** Muestra la nav inferior (5 destinos) en esta ruta. */
  nav: boolean;
  page: Page;
  /** Botón “← Volver” a la izquierda del header (flujos centrados). */
  volver?: string;
  /** Acción única a la derecha del header (p. ej. “+” Agregar producto). */
  accion?: HeaderAccion;
  /** La página trae CTA pegajoso al pie: el contenido ocupa todo el bajo. */
  pie?: boolean;
};

function Placeholder({ title, note }: { title: string; note: string }): VNode {
  return (
    <section class="card">
      <p class="card-title">{title}</p>
      <p class="card-meta">{note}</p>
    </section>
  );
}

const crearTienda: Page = () => <CrearTienda />;

const unirse: Page = () => <Unirse />;

const inicio: Page = () => (
  <>
    <Placeholder
      title="Hola, Marta"
      note="Pantalla 3 — resumen, búsqueda local y lo urgente: stock bajo y fiado (C2.4)."
    />
    <div class="card">
      <p class="card-meta">M0 · cimientos: el contenido real llega con M1 (catálogo offline).</p>
    </div>
  </>
);

const escanear: Page = () => <Escanear />;

const productos: Page = () => <ListaProductos />;

const productoNuevo: Page = () => <FormProducto params={{}} />;

const productoEditar: Page = ({ params }) => <FormProducto params={params} />;

const movimiento: Page = ({ params }) => <Movimiento params={params} />;

const conteo: Page = () => <Conteo />;

const fiados: Page = () => (
  <Placeholder
    title="Fiados"
    note="Pantalla 9 — saldo por cliente en ámbar (D10). UI de cargo/abono en M3."
  />
);

const cliente: Page = ({ params }) => (
  <Placeholder
    title={`Cliente ${params["id"] ?? ""}`}
    note="Pantalla 10 — historial cargo/abono y compartir texto local (C6.4/C6.5)."
  />
);

const mas: Page = () => (
  <>
    <section class="card">
      <p class="card-title">Más</p>
      <p class="card-meta">Reportes, empleados y respaldo viven aquí.</p>
    </section>
    <SesionActual />
    <nav aria-label="Secciones de Más" style="display: flex; flex-direction: column; gap: var(--space-2);">
      <a class="card card-row" href="/mas/reportes" onClick={onNavClick}>
        <span class="card-title" style="flex: 1; min-width: 0;">
          Reportes
        </span>
        <span aria-hidden="true">→</span>
      </a>
      <a class="card card-row" href="/mas/empleados" onClick={onNavClick}>
        <span class="card-title" style="flex: 1; min-width: 0;">
          Empleados
        </span>
        <span aria-hidden="true">→</span>
      </a>
      <a class="card card-row" href="/mas/respaldo" onClick={onNavClick}>
        <span class="card-title" style="flex: 1; min-width: 0;">
          Respaldo y datos
        </span>
        <span aria-hidden="true">→</span>
      </a>
    </nav>
  </>
);

const reportes: Page = () => (
  <Placeholder
    title="Reportes"
    note="Pantalla 12 — valor de inventario y resumen de fiados por rango (C11)."
  />
);

const empleados: Page = () => (
  <Placeholder
    title="Empleados"
    note="Pantalla 11 — dueña invita; empleado opera (C7 / D4). Login en M2 (P2)."
  />
);

const respaldo: Page = () => (
  <Placeholder
    title="Respaldo y datos"
    note="Pantalla 13 — exportar CSV/JSON y llevarse tus datos (C10)."
  />
);

/** ~13 rutas — espejo de design/screens (01–13) + hub /mas. */
const routes: Route[] = [
  { path: "/", title: "Crear mi tienda", nav: false, page: crearTienda },
  { path: "/unirse", title: "Unirme a una tienda", nav: false, page: unirse },
  { path: "/inicio", title: "Hola, Marta", nav: true, page: inicio },
  { path: "/escanear", title: "Escanear", nav: true, page: escanear },
  { path: "/productos", title: "Productos", nav: true, page: productos, accion: {
    href: "/productos/nuevo",
    etiqueta: "Agregar producto",
    icono: "i-plus",
  } },
  { path: "/productos/nuevo", title: "Producto nuevo", nav: false, page: productoNuevo, volver: "/productos", pie: true },
  { path: "/productos/:id", title: "Editar producto", nav: false, page: productoEditar, volver: "/productos", pie: true },
  { path: "/movimiento", title: "Movimiento", nav: true, page: movimiento },
  { path: "/movimiento/:id", title: "Movimiento", nav: true, page: movimiento },
  { path: "/conteo", title: "Conteo", nav: true, page: conteo },
  { path: "/fiados", title: "Fiados", nav: true, page: fiados },
  { path: "/fiados/:id", title: "Cliente", nav: true, page: cliente },
  { path: "/mas", title: "Más", nav: true, page: mas },
  { path: "/mas/reportes", title: "Reportes", nav: true, page: reportes },
  { path: "/mas/empleados", title: "Empleados", nav: true, page: empleados },
  { path: "/mas/respaldo", title: "Respaldo y datos", nav: true, page: respaldo },
];

function findRoute(pathname: string): { route: Route; params: PathParams } | null {
  for (const route of routes) {
    const params = matchPath(route.path, pathname);
    if (params) return { route, params };
  }
  return null;
}

type NavDestination = {
  key: string;
  href: string;
  label: string;
  icon: string;
  center?: boolean;
};

/** Nav inferior: 4 destinos + FAB central “Escanear” (design/tools/shell.py). */
const navDestinations: NavDestination[] = [
  { key: "inicio", href: "/inicio", label: "Inicio", icon: "i-house" },
  { key: "productos", href: "/productos", label: "Productos", icon: "i-package" },
  { key: "escanear", href: "/escanear", label: "Escanear", icon: "i-scan_barcode", center: true },
  { key: "fiados", href: "/fiados", label: "Fiados", icon: "i-book_open" },
  { key: "mas", href: "/mas", label: "Más", icon: "i-menu" },
];

function BottomNav({ pathname }: { pathname: string }): VNode {
  return (
    <nav class="bottom-nav" aria-label="Navegación principal">
      {navDestinations.map((dest) => {
        const active = isSectionActive(pathname, dest.href);
        const icon = (
          <svg class="icono" aria-hidden="true">
            <use href={`#${dest.icon}`} />
          </svg>
        );
        const ariaCurrent = active ? "page" : undefined;
        if (dest.center) {
          return (
            <a
              class="nav-item nav-center"
              href={dest.href}
              aria-current={ariaCurrent}
              onClick={onNavClick}
            >
              <span class="fab-scan" aria-hidden="true">
                {icon}
              </span>
              <span class="nav-label">{dest.label}</span>
            </a>
          );
        }
        return (
          <a
            class={active ? "nav-item is-active" : "nav-item"}
            href={dest.href}
            aria-current={ariaCurrent}
            onClick={onNavClick}
          >
            {icon}
            <span class="nav-label">{dest.label}</span>
          </a>
        );
      })}
    </nav>
  );
}

function NotFound(): VNode {
  return (
    <section class="card">
      <p class="card-title">No encontramos esa pantalla</p>
      <p class="card-meta">Revisa la dirección o vuelve al inicio.</p>
      <a
        class="btn btn-primary"
        href="/inicio"
        onClick={onNavClick}
        style="margin-top: var(--space-3); display: inline-flex;"
      >
        Ir a Inicio
      </a>
    </section>
  );
}

type EstadoCuenta = {
  cargando: boolean;
  sesion: SesionCuenta | null;
  bloqueada: boolean;
};

export function App(): VNode {
  const { pathname } = useLocation();

  // S3: al abrir la app se comprueba la sesión local. Si existe, se bloquea y
  // se pide el PIN antes de mostrar el shell. SIN sesión, la app sigue en modo
  // local M1 (C2–C5) para no romper los flujos offline existentes.
  const [cuenta, setCuenta] = useState<EstadoCuenta>({
    cargando: true,
    sesion: null,
    bloqueada: false,
  });

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const sesion = await repoSesion.sesionActual();
        if (!vivo) return;
        if (!sesion) {
          setCuenta({ cargando: false, sesion: null, bloqueada: false });
          return;
        }
        // La sesión sobrevive la recarga; el PIN la desbloquea sin red.
        await repoSesion.bloquear();
        if (!vivo) return;
        setCuenta({ cargando: false, sesion, bloqueada: true });
      } catch {
        // IndexedDB no disponible: modo local, sin bloquear la app.
        if (vivo) setCuenta({ cargando: false, sesion: null, bloqueada: false });
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const match = findRoute(pathname);
  const route = match?.route;
  const bloqueada = !cuenta.cargando && cuenta.sesion !== null && cuenta.bloqueada;
  const title = bloqueada ? "Escribe tu PIN" : (route?.title ?? "LaTiendita");
  const showNav = route?.nav ?? false;
  const Page = route?.page;

  // Título de la pestaña por ruta (DESIGN: una pantalla = un título).
  useEffect(() => {
    document.title = title === "LaTiendita" ? title : `${title} · LaTiendita`;
  }, [title]);

  // Bloqueo: se muestra antes del shell, sin header ni nav inferior.
  if (bloqueada && cuenta.sesion) {
    return (
      <PantallaBloqueo
        sesion={cuenta.sesion}
        onDesbloqueada={() => setCuenta((actual) => ({ ...actual, bloqueada: false }))}
      />
    );
  }

  const rutaVolver = route?.volver;
  const volver = rutaVolver ? (
    <button
      type="button"
      class="btn btn-icon"
      aria-label="Volver"
      onClick={() => navigate(rutaVolver)}
    >
      <svg class="icono" aria-hidden="true">
        <use href="#i-arrow_left" />
      </svg>
    </button>
  ) : null;

  const accion = route?.accion ? (
    <a
      class="btn btn-icon"
      href={route.accion.href}
      aria-label={route.accion.etiqueta}
      onClick={onNavClick}
    >
      <svg class="icono" aria-hidden="true">
        <use href={`#${route.accion.icono}`} />
      </svg>
    </a>
  ) : null;

  const relleno = <span class="header-relleno" aria-hidden="true" />;

  return (
    <div class="app">
      <header class="page-header">
        {volver ?? (accion ? relleno : null)}
        <h1>{title}</h1>
        {accion ?? (volver ? relleno : null)}
      </header>
      <BannerOffline />
      <main
        class={
          (showNav ? "app-main" : "app-main no-nav") + (route?.pie ? " con-pie" : "")
        }
        id="contenido"
      >
        {cuenta.cargando ? (
          <p class="route-note" role="status">
            Cargando…
          </p>
        ) : Page && match ? (
          <Page params={match.params} />
        ) : (
          <NotFound />
        )}
      </main>
      {showNav ? <BottomNav pathname={pathname} /> : null}
    </div>
  );
}
