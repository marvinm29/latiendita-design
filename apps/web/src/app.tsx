import type { VNode } from "preact";
import { isSectionActive, matchPath, navigate, useLocation, type PathParams } from "./router";

type PageProps = { params: PathParams };
type Page = (props: PageProps) => VNode;

type Route = {
  path: string;
  title: string;
  /** Muestra la nav inferior (5 destinos) en esta ruta. */
  nav: boolean;
  page: Page;
};

function Placeholder({ title, note }: { title: string; note: string }): VNode {
  return (
    <section class="card">
      <p class="card-title">{title}</p>
      <p class="card-meta">{note}</p>
    </section>
  );
}

/** Navegación SPA en cualquier `<a href="/…">` del shell. */
function onNavClick(event: MouseEvent): void {
  const anchor = event.currentTarget as HTMLAnchorElement;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigate(anchor.pathname);
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

const escanear: Page = () => (
  <Placeholder
    title="Escanear"
    note="Pantalla 4 — BarcodeDetector → ZXing-wasm perezoso → teclado manual (T-06). Chunk perezoso en M1."
  />
);

const productos: Page = () => (
  <Placeholder
    title="Productos"
    note="Pantalla 5 — catálogo local con búsqueda sin internet (C2). Alta y edición en M1."
  />
);

const productoNuevo: Page = () => (
  <Placeholder
    title="Producto nuevo"
    note="Pantalla 6 — alta escaneada o manual, sin bloquear si no hay red (D3/P4, métrica 2)."
  />
);

const movimiento: Page = () => (
  <Placeholder
    title="Movimiento"
    note="Pantalla 7 — entrada/salida/ajuste con conversión bulto↔unidad (C2.3 / C4)."
  />
);

const conteo: Page = () => (
  <Placeholder
    title="Conteo"
    note="Pantalla 8 — conteo asistido que genera los ajustes del diferencial (C5.2)."
  />
);

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
  { path: "/productos", title: "Productos", nav: true, page: productos },
  { path: "/productos/nuevo", title: "Producto nuevo", nav: true, page: productoNuevo },
  { path: "/movimiento", title: "Movimiento", nav: true, page: movimiento },
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
          <svg class="w-icon h-icon" aria-hidden="true">
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
  const title = match?.route.title ?? "LaTiendita";
  const showNav = match?.route.nav ?? false;
  const Page = match?.route.page;

  return (
    <div class="app">
      <header class="page-header">
        <h1>{title}</h1>
      </header>
      <main class={showNav ? "app-main" : "app-main no-nav"} id="contenido">
        {Page && match ? <Page params={match.params} /> : <NotFound />}
      </main>
      {showNav ? <BottomNav pathname={pathname} /> : null}
    </div>
  );
}
