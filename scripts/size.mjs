#!/usr/bin/env node
/**
 * Gate de tamaño de M0: mide el peso gzip de JS+CSS en apps/web/dist contra el
 * presupuesto del spec (JS inicial ≤ 150 KiB = 153 600 B gzip).
 *
 * Sale con código ≠ 0 si el total excede el presupuesto o si falta el build.
 * Es intencionalmente autocontenido (sin size-limit): el proyecto solo tiene un
 * bundle de `apps/web` y este script ya da el desglose por archivo.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const root = resolve(import.meta.dirname, "..");
const dist = join(root, "apps", "web", "dist");
const BUDGET_BYTES = 150 * 1024; // 153 600 B gzip

if (!existsSync(dist)) {
  console.error(
    `size: FAIL — no existe ${dist}. Corre \`pnpm build\` antes de medir el presupuesto.`,
  );
  process.exit(1);
}

/** @param {string} dir @returns {string[]} */
function walk(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const files = walk(dist)
  .filter((file) => [".js", ".css"].includes(extname(file)))
  .sort();

if (files.length === 0) {
  console.error("size: FAIL — no se encontraron archivos .js/.css en apps/web/dist.");
  process.exit(1);
}

let total = 0;
for (const file of files) {
  const gzip = gzipSync(readFileSync(file)).length;
  total += gzip;
  const rel = file.slice(dist.length + 1);
  console.log(`  ${String(gzip).padStart(7)} B gzip  ${rel}`);
}

const pct = ((total / BUDGET_BYTES) * 100).toFixed(1);
console.log(
  `Total JS+CSS gzip: ${total} B · presupuesto ${BUDGET_BYTES} B (≤150KB) · ${pct}%`,
);

if (total > BUDGET_BYTES) {
  const exceso = total - BUDGET_BYTES;
  console.error(
    `size: FAIL — exceso de ${exceso} B gzip (${((exceso / BUDGET_BYTES) * 100).toFixed(1)}% sobre el presupuesto; spec 005 / 003 §8).`,
  );
  process.exit(1);
}

console.log("size: OK — dentro del presupuesto.");
