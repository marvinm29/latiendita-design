#!/usr/bin/env node
/**
 * Mide el peso gzip de JS+CSS en apps/web/dist contra el presupuesto del spec
 * (JS inicial ≤150KB gzip). Placeholder de M0: cuando exista size-limit con
 * rutas iniciales reales, este script queda como apoyo local.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const root = resolve(import.meta.dirname, "..");
const dist = join(root, "apps", "web", "dist");
const BUDGET_BYTES = 150 * 1024;

if (!existsSync(dist)) {
  console.log("size: apps/web/dist no existe — corre `pnpm build` primero (placeholder OK).");
  process.exit(0);
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

let total = 0;
for (const file of files) {
  const gzip = gzipSync(readFileSync(file)).length;
  total += gzip;
  const rel = file.slice(dist.length + 1);
  console.log(`  ${String(gzip).padStart(7)} B gzip  ${rel}`);
}

console.log(`Total JS+CSS gzip: ${total} B · presupuesto ${BUDGET_BYTES} B (≤150KB)`);

if (total > BUDGET_BYTES) {
  console.error("size: fuera de presupuesto (spec 005 / 003 §8).");
  process.exit(1);
}

console.log("size: OK (placeholder — gate definitivo con size-limit en CI).");
