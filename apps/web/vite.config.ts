import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

export default defineConfig({
  plugins: [preact()],
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
    },
  },
});
