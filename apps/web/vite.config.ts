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
  },
});
