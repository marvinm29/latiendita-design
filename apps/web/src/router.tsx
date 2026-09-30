/**
 * Router mínimo propio (~13 rutas, sin librería) — T-02 del plan técnico.
 * History API + popstate; match de params con `:id`. Suficiente para M0;
 * si el routing crece, se evalúa una librería en M2 (sin reabrir T-02 hoy).
 */
import { useEffect, useState } from "preact/hooks";

export type PathParams = Record<string, string>;

type Listener = () => void;
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) listener();
}

/** Navega sin recargar (SPA). `replace` reemplaza la entrada del historial. */
export function navigate(to: string, replace = false): void {
  if (replace) history.replaceState(null, "", to);
  else history.pushState(null, "", to);
  notify();
}

/** Suscribe cambios de ruta (popstate + navigate). Devuelve el cleanup. */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Pathname actual (reactivo). */
export function useLocation(): { pathname: string } {
  const [pathname, setPathname] = useState(window.location.pathname);

  useEffect(() => {
    const update = (): void => setPathname(window.location.pathname);
    window.addEventListener("popstate", update);
    const unsubscribe = subscribe(update);
    update();
    return () => {
      window.removeEventListener("popstate", update);
      unsubscribe();
    };
  }, []);

  return { pathname };
}

/**
 * Compara `pathname` con un patrón tipo `/fiados/:id`.
 * Devuelve los params o `null` si no coincide.
 */
export function matchPath(pattern: string, pathname: string): PathParams | null {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = pathname.split("/").filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;

  const params: PathParams = {};
  for (let i = 0; i < patternParts.length; i++) {
    const expected = patternParts[i]!;
    const actual = pathParts[i]!;
    if (expected.startsWith(":")) {
      params[expected.slice(1)] = decodeURIComponent(actual);
    } else if (expected !== actual) {
      return null;
    }
  }
  return params;
}

/** ¿Está `pathname` en la sección `base`? (para el estado activo de la nav) */
export function isSectionActive(pathname: string, base: string): boolean {
  if (base === "/") return pathname === "/";
  return pathname === base || pathname.startsWith(`${base}/`);
}
