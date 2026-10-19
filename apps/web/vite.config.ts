import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    preact(),
    // C9 / T-07: Workbox envuelto por vite-plugin-pwa. El SW solo existe en el
    // build (devOptions desactivado): en `vite dev` la app arranca sin SW y no
    // se bloquea si el navegador no lo soporta.
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      // El manifest y sus iconos los añade el plugin automáticamente; solo
      // falta el icono de iOS, que no va en el manifest.
      includeAssets: ["icon-180.png"],
      manifest: {
        name: "LaTiendita",
        short_name: "LaTiendita",
        description: "Inventario y fiados para tu tienda. Funciona sin internet.",
        lang: "es-SV",
        dir: "ltr",
        start_url: "/inicio",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        // Tokens de marca: Sand 1 (fondo) y Teal 9 (acción/tema).
        background_color: "#fdfdfc",
        theme_color: "#12a594",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
        ],
      },
      workbox: {
        // App-shell: HTML, JS, CSS y fuentes. `precache` ya es cache-first y
        // con revisión por hash en cada build; el manifest y sus iconos los
        // añade el plugin, y el icono de iOS entra por `includeAssets`.
        globPatterns: ["**/*.{js,css,html,woff2}"],
        navigateFallback: "/index.html",
        // Nunca devolver el shell ante rutas de API: /auth, /off y /sync deben
        // fallar como red (la app ya las trata como best-effort/offline).
        navigateFallbackDenylist: [/^\/auth/, /^\/off/, /^\/sync/],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Estáticos que no entren al precache (p. ej. iconos futuros):
            // cache-first con expiración. Solo mismo origen y destinos de
            // assets; JSON de API (destination "") no pasa por aquí.
            urlPattern: ({ request, sameOrigin }) =>
              sameOrigin &&
              ["font", "image", "style", "script"].includes(request.destination),
            handler: "CacheFirst",
            options: {
              cacheName: "latiendita-estaticos",
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    target: "es2022",
    // Presupuesto del spec: JS inicial ≤150KB gzip (003 §8). El gate fino
    // llega con size-limit en CI; aquí evitamos sourcemaps en prod por defecto.
    sourcemap: false,
  },
  server: {
    port: 5173,
    // OFF se consulta a través de la API (003 §6): sin CORS ni claves en el
    // cliente. En producción, Caddy enruta /off a api:3000.
    proxy: {
      "/off": "http://127.0.0.1:3000",
      // Acceso (C1/T-05): el cliente nunca conoce la URL interna de la API.
      "/auth": "http://localhost:3000",
    },
  },
  // `vite preview` (e2e de PWA) replica el proxy de dev para /auth y /off.
  preview: {
    port: 4173,
    proxy: {
      "/off": "http://127.0.0.1:3000",
      "/auth": "http://localhost:3000",
    },
  },
});
