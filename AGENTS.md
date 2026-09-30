# AGENTS.md — guía para retomar este repositorio

> Léelo primero en cualquier sesión nueva. Este archivo es el punto de entrada para agentes
> (opencode y similares) y para cualquier persona que retome el trabajo.

## 0. Qué es este repositorio

**LaTiendita** — PWA **offline-first** de **inventario + fiados** para tiendas de colonia de El Salvador.
Open source, sin costo, **español primero**. Usuarios: **Marta** (dueña, poca alfabetización digital,
Android gama baja), **José** (empleado), **Carlos** (instalador técnico).

Este repo contiene la **especificación (SDD)**, el **sistema de diseño** y los **mockups de pantalla**,
el **plan técnico + roadmap**, y el **monorepo de implementación** (M0 scaffold + núcleo de dominio M1).

- Repo: https://github.com/marvinm29/latiendita-design · rama `main`
- Directorio de trabajo: raíz del repo (`specs/`, `design/`, `apps/`, `packages/`, `infra/`)
- Idioma del proyecto: **español** (docs e interfaz). UI con **tú neutro** y lenguaje llano.
- Fuente de verdad: `specs/002-especificacion-funcional.md` (§3 alcance, §5 NFRs, §6 métricas, §7 P1–P5).

## 1. Orden de lectura (sesión nueva)

1. `specs/README.md` — índice SDD y estado de la sesión.
2. `specs/002-especificacion-funcional.md` — **qué** se construye (C1–C11, personas, NFRs, métricas, P1–P5).
3. `specs/003-plan-tecnico.md` — **cómo** (stack T-01…T-08, offline/sync, modelo de datos, seguridad, pruebas).
4. `specs/004-roadmap.md` — **cuándo/quién** (M0–M4, gates, adopción D11).
5. `design/DESIGN.md` — sistema de diseño completo (§0–§12).
6. `design/ACCESSIBILITY.md` — checklist WCAG 2.2 AA (contrato de implementación).
7. `design/decisions.md` — bitácora DS-01…DS-30 + ledger de verificación.

## 2. Estado actual

| Área | Estado |
|---|---|
| SDD (000–005) | ✅ completo |
| Diseño F1 fundaciones · F2 componentes · F3 pantallas (13) · F4 cierre WCAG | ✅ entregado |
| Plan técnico (`003`) | ✅ escrito — pendiente de revisión del dueño |
| Roadmap (`004`) | ✅ escrito — pendiente de revisión del dueño |
| **M0 · Cimientos** | ✅ scaffold monorepo + CI + RLS base + docker-compose (placeholders Lighthouse/size-limit) |
| **M1 · Núcleo offline** | 🟡 dominio puro en `packages/core` (libro/stock/unidades/fiados/outbox, 64 tests) — falta Dexie + UI C2–C5 |
| **M2+** | ⏳ no iniciada — **P2 (login)** bloquea M2 |
| Licencia del proyecto | ⏳ sin definir (**P1** = issue [#2](https://github.com/marvinm29/latiendita-design/issues/2), rec. AGPL-3.0). **No hay `LICENSE` a propósito.** |

Números: 13 pantallas / 60 marcos a 360×640 · 60/60 pares de contraste AA · 42 iconos Lucide · 64 tests core.

## 3. Decisiones cerradas — NO reabrir

- **Stack (003):** monorepo TS · **Preact + Vite** (CSS compilado, sin Tailwind runtime) ·
  **Dexie/IndexedDB** · **Fastify + PostgreSQL 16 + RLS** · invitación **código+PIN** ·
  **BarcodeDetector → ZXing-wasm perezoso → teclado manual** · **Workbox** · **docker-compose (5 vars)**.
- **Offline/sync:** outbox idempotente por `op_id`; pull por `server_seq`; **LWW por campo** en datos
  mutables; **ledger append-only** (movimientos/fiados) que **nunca pierde un movimiento** (C8.4).
- **Producto:** sin POS/DTE/voz/APK en v1 (D8/D12/D5/D14); multiempleado **gratis** (D4);
  OFF es **acelerador, no dependencia** (D3/P4); una sola bodega en v1 (P3).
- **Diseño:** Radix Colors v3 (Teal acción / Sand neutros / Amber = dinero), base 16px, targets ≥48px,
  banner offline exacto “Sin conexión — se sincronizará al reconectar”, nunca color solo, WCAG 2.2 AA.
- **Regla de oro:** *el spec manda*. Si algo contradice `specs/002`, se actualiza el spec **primero**.

## 4. Tareas abiertas (issues en GitHub)

1. **P1 · Licencia** — [#2](https://github.com/marvinm29/latiendita-design/issues/2) MIT vs AGPL-3.0 (rec. AGPL). Bloquea `LICENSE`/SPDX.
2. **P2 · Login de empleados** — [#1](https://github.com/marvinm29/latiendita-design/issues/1) código+PIN. Bloquea M2.
3. **DS-26** — [#3](https://github.com/marvinm29/latiendita-design/issues/3) aprobar pantalla Productos (enmienda spec `005` §4).
4. **Tarjeta “sin mínimo”** — [#4](https://github.com/marvinm29/latiendita-design/issues/4) variante por diseñar.
5. **`pb-20` vs FAB** — [#5](https://github.com/marvinm29/latiendita-design/issues/5) confirmar con datos reales.
6. P3/P4/P5 — asumidos (una bodega, OFF manual-first, límite de fiado reservado).

## 5. Comandos verificables

```bash
# Diseño (sin build)
python3 -m http.server 8000        # abre design/preview.html y design/screens/*.html
python3 design/tokens/verify_contrast.py   # matriz WCAG 2.2 AA (60 pares) → 0 fallos
python3 design/tools/qa.py                 # QA estática → 13 pantallas · 60 marcos · 0 hallazgos
python3 design/tools/batch1.py             # regenera pantallas 01–04
python3 design/tools/batch2.py             # regenera pantallas 05–09
python3 design/tools/batch3.py             # regenera pantallas 10–13
python3 design/tokens/generate.py          # regenera tokens DTCG/CSS

# Implementación (pnpm)
pnpm install
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm --filter @latiendita/api dev          # API en :3000 (health)
pnpm --filter @latiendita/web dev          # Vite en :5173
docker compose -f infra/docker-compose.yml up -d   # api + db + caddy (requiere plugin compose)

gh issue list                              # decisiones abiertas P1/P2/DS-26/…
```

Diseño: HTML/CSS/JS plano, **sin dependencias externas en runtime**. Implementación: pnpm workspaces.
No committear sin pedirlo explícitamente.

## 6. Próximos pasos sugeridos

- **(1)** Cerrar **P1/P2** vía issues [#2](https://github.com/marvinm29/latiendita-design/issues/2)/[#1](https://github.com/marvinm29/latiendita-design/issues/1) (comentar decisión) → añadir `LICENSE`.
- **(2)** Seguir **M1**: repos Dexie + `storage.persist()`, catálogo/escáner/movimiento/conteo con UI (pantallas 4–8), e2e offline C2–C5.
- **(3)** Endurecer **M0**: size-limit y Lighthouse reales en CI (hoy placeholders), ESLint, `drizzle-kit`.
- **(4)** Aprobar **DS-26** (issue #3) y diseñar tarjeta “sin mínimo” (#4).

## 7. Prompt de traspaso (copiar/pegar en una sesión nueva)

```
Retoma el proyecto LaTiendita (PWA offline-first de inventario y fiados para tiendas de colonia de
El Salvador). Trabaja en la raíz del repo: /home/varm/Documents/testModels (incluye specs/ y design/).

Antes de hacer nada, lee en este orden:
1. specs/README.md (índice y estado)
2. specs/002-especificacion-funcional.md (fuente de verdad: C1–C11, NFRs, métricas, P1–P5)
3. specs/003-plan-tecnico.md (stack, offline/sync, modelo de datos, pruebas)
4. specs/004-roadmap.md (hitos M0–M4, gates, adopción)
5. design/DESIGN.md y design/ACCESSIBILITY.md (contrato de UI y WCAG 2.2 AA)
6. design/decisions.md (DS-01…DS-30)

Estado: SDD y diseño (fases F1–F4) COMPLETOS; implementación NO iniciada (bloqueada por P1 licencia y
P2 login). Todo el diseño se abre sin build con `python3 -m http.server`.

Reglas: español primero (docs y UI, tú neutro, lenguaje llano); el spec manda (si algo contradice 002,
se actualiza el spec antes que el código); nunca color solo; WCAG 2.2 AA es contrato; no commitear sin
que se te pida. Verifica con `python3 design/tokens/verify_contrast.py` y `python3 design/tools/qa.py`.

Empieza confirmando que leíste el estado y proponme el siguiente paso entre: (A) abrir issues de P1/P2,
(B) scaffold de M0, o (C) arrancar M1 (dominio offline + tests). No reabras decisiones cerradas.
```

## 8. Convenciones de git

- Rama `main`; commits en español con prefijo de área (`specs/`, `design/`, `app/`, `infra/`).
- No commitear secretos. `__pycache__/`, `*.pyc`, `.DS_Store` están en `.gitignore`.
- Solo hacer `commit`/`push` cuando el usuario lo pida (aquí sí se pidió al crear cada fase).
