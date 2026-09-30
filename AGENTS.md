# AGENTS.md — guía para retomar este repositorio

> Léelo primero en cualquier sesión nueva. Este archivo es el punto de entrada para agentes
> (opencode y similares) y para cualquier persona que retome el trabajo.

## 0. Qué es este repositorio

**LaTiendita** — PWA **offline-first** de **inventario + fiados** para tiendas de colonia de El Salvador.
Open source, sin costo, **español primero**. Usuarios: **Marta** (dueña, poca alfabetización digital,
Android gama baja), **José** (empleado), **Carlos** (instalador técnico).

Este repo contiene la **especificación (SDD)**, el **sistema de diseño** y los **mockups de pantalla**,
y el **plan técnico + roadmap**. La **implementación aún no ha comenzado**.

- Repo: https://github.com/marvinm29/latiendita-design · rama `main`
- Directorio de trabajo: raíz del repo (contiene `specs/` y `design/`)
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
| **Implementación** | ❌ no iniciada — bloqueada por cerrar **P1 (licencia)** y **P2 (login)** |
| Licencia del proyecto | ⏳ sin definir (**P1**: MIT vs AGPL-3.0). **No hay `LICENSE` a propósito.** |

Números: 13 pantallas / 60 marcos a 360×640 · 60/60 pares de contraste AA · 42 iconos Lucide.

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

## 4. Tareas abiertas (pendientes del dueño)

1. **P1 · Licencia** (MIT vs AGPL-3.0) — bloquea `LICENSE`/SPDX y el arranque de implementación.
2. **P2 · Login de empleados** — propuesta: código de invitación + PIN. Bloquea M2.
3. **P3/P4/P5** — una bodega (asumido), OFF manual-first (asumido), límite de fiado (campo reservado).
4. **DS-26** — aprobar la pantalla **Productos** como enmienda al spec `005` §4.
5. Variante **“sin mínimo”** de la tarjeta de producto (sin diseñar).
6. Confirmar que el `pb-20` de la nav despeja el FAB central con datos reales.

## 5. Comandos verificables (sin build para ver el diseño)

```bash
python3 -m http.server 8000        # abre design/preview.html y design/screens/*.html
python3 design/tokens/verify_contrast.py   # matriz WCAG 2.2 AA (60 pares) → 0 fallos
python3 design/tools/qa.py                 # QA estática de pantallas → 13 pantallas · 60 marcos · 0 hallazgos
python3 design/tools/batch1.py             # regenera pantallas 01–04
python3 design/tools/batch2.py             # regenera pantallas 05–09
python3 design/tools/batch3.py             # regenera pantallas 10–13
python3 design/tokens/generate.py          # regenera tokens DTCG/CSS desde Radix vendorizado
```

Todo es HTML/CSS/JS plano, **sin dependencias externas en runtime** (Radix, Lucide, fuente y Tailwind
están vendorizados). No committear sin pedirlo explícitamente.

## 6. Próximos pasos sugeridos (elegir con el dueño)

- **(A)** Abrir issues de **P1/P2** (y DS-26 / tarjeta “sin mínimo”) con `gh` para cerrar decisiones.
- **(B)** Arrancar **M0** (`specs/004` §3): scaffold del monorepo pnpm (`apps/web`, `apps/api`,
  `packages/{core,tokens,ui}`, `infra/`), CI con `size-limit` + Lighthouse, Postgres+RLS base.
- **(C)** Iniciar **M1** (núcleo offline) en paralelo: dominio puro en `packages/core` con unit tests.

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
