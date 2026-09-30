import type { VNode } from "preact";
import { useEffect } from "preact/hooks";
import {
  isSectionActive,
  matchPath,
  navigate,
  onNavClick,
  useLocation,
  type PathParams,
} from "./router";
import { BannerOffline } from "./componentes/BannerOffline";
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

const welcome: Page = () => (
  <>
    <Placeholder
      title="Crear mi tienda"
      note="Pantalla 1 — bienvenida y alta del negocio (C1.1). Llega en M2 con invitación + PIN."
    />
    <p class="route-note">
      ¿Ya tienes código? El flujo “Unirme a una tienda” está en{" "}
      <a class="text-link" href="/unirse" onClick={onNavClick}>
        /unirse
      </a>
      .
    </p>
  </>
);

const unirse: Page = () => (
  <Placeholder
    title="Unirme a una tienda"
    note="Pantalla 2 — código de invitación de un solo uso (C1.2 / T-05). Requiere internet."
  />
);

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

const movimiento: Page = () => <Movimiento params={{}} />;

const movimientoDirecto: Page = ({ params }) => <Movimiento params={params} />;

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
  { path: "/", title: "LaTiendita", nav: false, page: welcome },
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
  { path: "/movimiento/:id", title: "Movimiento", nav: true, page: movimientoDirecto },
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

export function App(): VNode {
  const { pathname } = useLocation();
  const match = findRoute(pathname);
  const route = match?.route;
  const title = route?.title ?? "LaTiendita";
  const showNav = route?.nav ?? false;
  const Page = route?.page;

  // Título de la pestaña por ruta (DESIGN: una pantalla = un título).
  useEffect(() => {
    document.title = title === "LaTiendita" ? title : `${title} · LaTiendita`;
  }, [title]);

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
        {Page && match ? <Page params={match.params} /> : <NotFound />}
      </main>
      {showNav ? <BottomNav pathname={pathname} /> : null}
    </div>
  );
}
