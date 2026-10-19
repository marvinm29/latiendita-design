# TRASPASO · LaTiendita — contexto completo para una sesión nueva

> **Para quién:** agentes de IA (opencode y similares) y personas que retoman el repositorio.
> `AGENTS.md` es la **entrada corta**; este documento es el **paquete de contexto**: estado real,
> arquitectura, invariantes, trampas, deuda y protocolo de trabajo.
>
> **Última actualización:** 18 de octubre de 2026 (cierre de **S3 · cuentas y acceso**).
> Si cambias código, actualiza §2, §3 y §14 al final de la sesión.

---

## 0. Cómo usar este documento

| Si vas a… | Lee |
|---|---|
| Arrancar una sesión | §1 → §2 → §5 → §10 → §11 |
| Tocar UI / accesibilidad | §4.2 · §4.5 + `design/DESIGN.md` + `design/ACCESSIBILITY.md` |
| Tocar datos, offline o sync | §4.3 · §4.4 + `specs/003-plan-tecnico.md` §4–§5 |
| Planificar el siguiente sprint | §8 · §9 + `specs/006-plan-sprints.md` |
| Entender una decisión cerrada | `AGENTS.md` §3 + `design/decisions.md` |

**No leas todo el repo.** Usa este mapa, `grep` y `find`; el contexto es finito.

---

## 1. Resumen ejecutivo (1 minuto)

- **Producto:** PWA **offline-first** de inventario + fiados para tiendas de colonia de El Salvador.
  Usuarios: **Marta** (dueña, baja alfabetización digital, Android gama baja), **José** (empleado),
  **Carlos** (instalador). Open source, sin costo, **español primero**.
- **Estado:** SDD y diseño (F1–F4) completos. **M0 ✅** · **M1 ✅** (núcleo offline + C5 persistente)
  · **M2 🟡 S3 ✅** (negocio, invitación+PIN, sesión y desbloqueo offline). **S4/S5 pendientes.**
- **Números:** 115 tests unitarios (85 core + 16 web + 14 api) · 14 e2e (offline C2–C5 + conteo +
  acceso/PIN + OFF + axe AA) · bundle inicial **85.6 KB gzip** (presupuesto 150 KB) · 13 pantallas /
  60 marcos · WCAG 2.2 AA.
- **Siguiente:** **S4 · M2** — `/sync/push|pull`, RLS en uso y aislamiento A/B; luego **S5** (LWW,
  backoff, cierre de M2).

---

## 2. Estado verificado (no confiar en la memoria: re-verificar)

Comandos y resultados al cierre de S2 (18/10/2026):

| Gate | Comando | Resultado |
|---|---|---|
| Tipos | `pnpm typecheck` | ✅ 0 errores (api, core, tokens, ui, web) |
| Lint | `pnpm lint` | ✅ 0 errores (ESLint flat config) |
| Unitarios | `pnpm test` | ✅ **115** (85 core + 16 web + 14 api) |
| e2e | `pnpm --filter @latiendita/web test:e2e` | ✅ **14/14** |
| Build | `pnpm build` | ✅ |
| Presupuesto | `pnpm size` | ✅ **87 673 B gzip** / 153 600 B (57.1 %) |
| Contraste | `python3 design/tokens/verify_contrast.py` | ✅ 60/60 pares AA |
| QA diseño | `python3 design/tools/qa.py` | ✅ 13 pantallas · 60 marcos · 0 hallazgos |

**Árbol de trabajo:** S1, S2, S2+ y S3 quedaron **commiteados** al cierre (ver §14). Aun así, antes
de empezar ejecuta `git status --short` y **no borres ni reviertas** archivos que no entiendas.

**Lo que NO está hecho (no lo asumas):**

- Sin service worker / Workbox → **no hay recarga ni instalación offline** (C9, M3).
- **S3 verificado con repo en memoria**: el adaptador Postgres/RLS compila pero **no se probó contra
  una instancia real**; `/auth` busca código/token con rol dueño (bypass RLS) hasta `SECURITY DEFINER` (S4).
- La sesión **no cambia aún** el `negocioId` local ni dispara pull/sync (S4). Sin sesión, la app sigue
  en **modo local M1** (C2–C5) para no romper los flujos offline existentes.
- Sin botón de “cerrar sesión / usar otra cuenta” en la UI (el repo ya lo soporta).
- Sin endpoints de sync (`/sync/push`, `/sync/pull`) ni uso real de PostgreSQL en la API.
- Lighthouse CI sigue pendiente (el gate de tamaño propio ya es real).
- Fiados, reportes, empleados, respaldo e Inicio son **placeholders** de UI.
- El escáner no se ha probado en dispositivos reales (formatos y linterna sí están implementados).

---

## 3. Qué se construyó (changelog)

### S0 · M0 — cimientos ✅

- Monorepo pnpm (`apps/web`, `apps/api`, `packages/core|tokens|ui`), TypeScript estricto.
- CI base, `docker-compose` (api + Postgres 16 + Caddy opcional), migración `0001_init.sql` con RLS.
- `pnpm lint` (ESLint), `pnpm size` (gate real), `pnpm build`, `pnpm typecheck`, `pnpm test`.

### S1 · M1 — persistencia real de movimiento y conteo ✅

- `apps/web/src/datos/baseLocal.ts`: **una sola base** (`latiendita`), un `negocioId` local, siembra
  demo idempotente y `asegurarBaseLista()`.
- `apps/web/src/datos/movimientosRepoDexie.ts`: libro sobre `repos.movimientos.crearMovimientoConOp`
  (movimiento + op de outbox + caché de stock en **una transacción**).
- `apps/web/src/datos/movimientosRepo.ts`: contrato + hooks + instancia activa; se conserva
  `MovimientosRepoMemoria` para tests/historias.
- `catalogoRepoDexie.ts` usa la base compartida; `Movimiento.tsx` y `Conteo.tsx` consumen el repo Dexie.
- 4 tests de integración web (vitest + `fake-indexeddb`).

### S2 · M1 — offline e2e + OFF ✅

- `apps/web/e2e/` (Playwright): offline C2–C5, OFF y accesibilidad AA.
- `apps/web/playwright.config.ts`, `apps/web/vitest.config.ts`.
- `apps/api/src/off.ts`: proxy `GET /off/:codigo` con caché TTL y degradación `sin_red`.
- `apps/web/src/datos/off.ts`: caché local en IndexedDB + autocompletado manual-first.
- `FormProducto` autocompleta el nombre desde `?codigo=` (nunca bloquea).
- Job `e2e` en `.github/workflows/ci.yml`.
- Correcciones: aviso de movimiento que se perdía (remontaje de ruta) y WCAG 2.5.3 en filas de producto.

### S2+ · M1 — conteo persistente y reanudable ✅ (trabajo no bloqueado)

- `packages/core/src/db/repos/conteoRepo.ts`: `cerrarConAjustes(conteoId)` cierra la sesión y crea un
  `ajuste` + su op por cada diferencia, en **una transacción** con `conteos`/`movimientos`/`outbox`/
  `stock_cache`; si algo falla no queda nada. `cerrar()` sigue archivando sin ajustes.
- `apps/web/src/datos/conteosRepo*.ts`: contrato + adaptador Dexie sobre `repos.conteo`, con arranque
  perezoso compartido.
- `Conteo.tsx`: retoma `listarAbierta()` al montar, registra cada captura en la sesión y cierra con
  `cerrarConAjustes`; recargar o cambiar de pantalla ya no pierde lo contado.
- Pruebas: +2 core (ajustes y atomicidad), +2 web (retomar/cerrar y conteo sin diferencias) y
  `e2e/conteo-persistente.spec.ts` (recarga + sesión cerrada + ops).
- Correcciones menores: se eliminó el estado/import sin uso (`nuevoOpId`) y se separó el error de
  captura del error de cierre.

### S3 · M2 — cuentas y acceso ✅ (P1/P2 cerradas)

- **P1:** licencia **AGPL-3.0** (`LICENSE` + `"license": "AGPL-3.0-only"`); issue #2 cerrada.
- **P2:** login **código de un solo uso + PIN**; issue #1 cerrada.
- **API** (`apps/api/src/auth/`): rutas `/auth/negocio|invitacion|unirse|yo|renovar|salir`; código
  base32 de 8 caracteres (7 días, un uso), argon2id para PIN, token opaco (hash SHA-256, 30 días,
  rotación/revocación), rate-limit 5/10 min. 14 tests con repositorio en memoria.
- **Core/web:** contrato `packages/core/src/auth.ts`; Dexie v2 con `sesion_local`; PBKDF2-SHA-256
  local para desbloqueo offline; pantallas de crear tienda, unirse y bloqueo; cierre de sesión desde
  «Más»; sesión sólo en IndexedDB. 5 tests web + 4 e2e.
- **M0:** ESLint real (`pnpm lint` ya no es alias de typecheck) y `pnpm size` **falla** si JS+CSS
  supera 150 KB gzip; CI actualizado.
- **Diseño:** DS-31 “Sin mínimo” (issue #4 cerrada) y pantalla 05 regenerada.

---

## 4. Mapa de la implementación

### 4.1 Árbol relevante

```
.
├── AGENTS.md                      # entrada corta para agentes
├── docs/TRASPASO.md               # ESTE documento (contexto completo)
├── specs/                         # SDD: 000–006 + README
├── design/                        # sistema de diseño + 13 pantallas (sin build)
├── packages/
│   ├── core/                      # dominio puro + Dexie (compartido cliente/servidor)
│   │   └── src/
│   │       ├── tipos.ts           # Producto, Movimiento, Fiado, OpOutbox…
│   │       ├── libro.ts           # crearMovimiento, aplicarMovimiento, invertir…
│   │       ├── stock.ts           # stockDerivado, estadoStock (semáforo)
│   │       ├── unidades.ts        # conversión base ↔ venta, redondeo 3 decimales
│   │       ├── fiados.ts          # cargos/abonos, saldo derivado
│   │       ├── outbox.ts          # crearOp, backoff, idempotencia por op_id
│   │       ├── indice.ts          # búsqueda local por nombre/código
│   │       ├── auth.ts            # contrato C1/T-05 (sesión, invitación, PIN)
│   │       └── db/
│   │           ├── schema.ts      # Dexie v2: 11 tablas + índices (sesion_local)
│   │           ├── db.ts          # abrirDb() singleton, borrarDb, persistencia
│   │           ├── meta.ts        # cursores de sync y flags
│   │           └── repos/         # productos, movimientos, fiados, outbox, conteo
│   ├── tokens/                    # tokens DTCG → CSS (design/tokens)
│   └── ui/                        # (reservado; la UI vive en apps/web)
├── apps/
│   ├── web/                       # Preact + Vite (PWA)
│   │   ├── src/
│   │   │   ├── main.tsx           # render + sprite Lucide + persistencia
│   │   │   ├── app.tsx            # shell, rutas, header, nav inferior
│   │   │   ├── router.tsx         # router propio (History API + popstate)
│   │   │   ├── datos/             # repos (catálogo, libro, conteos, sesión), authApi, OFF
│   │   │   ├── componentes/       # BannerOffline, ChipStock, EstadoVacio
│   │   │   └── paginas/           # auth, productos, escanear, movimiento, conteo
│   │   ├── e2e/                   # Playwright (offline, OFF, auth/PIN, axe)
│   │   ├── vite.config.ts         # proxy /off y /auth → :3000
│   │   ├── vitest.config.ts       # node + fake-indexeddb
│   │   └── playwright.config.ts   # webServer = pnpm dev
│   └── api/                       # Fastify
│       └── src/
│           ├── server.ts          # /health + registrarOff + registrarAuth
│           ├── off.ts             # proxy OFF + caché TTL
│           ├── auth/              # servicio, plugin, repo memoria/postgres, argon2id
│           ├── migrations/        # 0001_init.sql (negocio, usuario, membresía, invitación, sesión)
│           └── db/                # drizzle + client perezoso
├── infra/                         # docker-compose, Caddyfile, Dockerfile
└── .github/workflows/ci.yml       # jobs: ci (tipos/tests/build/size) + e2e
```

### 4.2 Capas y dependencias

```
UI (Preact)  →  datos/ (repos web)  →  @latiendita/core/db (Dexie)  →  IndexedDB
                        │
                        └── dominio puro (@latiendita/core: libro, stock, unidades, fiados, outbox)

API (Fastify) →  /off/:codigo  →  Open Food Facts (solo servidor; nunca el cliente)
              →  /auth/*       →  PostgreSQL (S3 probado con repo en memoria; S4 conecta RLS)
```

Regla: **la UI no escribe IndexedDB directamente** (excepto lecturas de apoyo en los repos web).
Toda escritura de negocio pasa por un repo de `core` que abre **una transacción `rw`**.

### 4.3 Flujo de una escritura offline (ejemplo: salida)

1. La persona toca **Registrar salida** en `Movimiento.tsx`.
2. Se crea un `Movimiento` validado (`crearMovimiento`) con `opId = nuevoOpId()`.
3. `repoMovimientos.agregar(mov)` → `MovimientosRepoDexie.agregar` →
   `repos.movimientos.crearMovimientoConOp(mov)`.
4. `core` abre **una transacción** `[movimientos, outbox, stock_cache]`:
   - inserta el movimiento (append-only, nunca update/delete),
   - inserta la op en `outbox` (idempotente por `op_id`),
   - refresca `stock_cache` con `aplicarMovimiento`.
5. La UI se suscribe con `liveQuery`; el stock y el historial se recalculan solos.
6. Al reconectar (M2), el push leerá `outbox` y enviará cada op a `/sync/push`.

### 4.4 Modelo local (Dexie v1 — `packages/core/src/db/schema.ts`)

| Tabla | Clave | Notas |
|---|---|---|
| `productos` | `id` | fila mutable: `updatedAt`, `deletedAt` (tombstone), `serverSeq`, `rev` |
| `unidades_venta` | `id` | unidad de venta por producto |
| `movimientos` | `id` | **append-only**; `ocurridoAt` espeja `creadoEn` |
| `clientes` | `id` | fila mutable |
| `fiados` | `id` | **append-only**; `tipo` da el signo |
| `categorias` | `id` | fila mutable |
| `conteos` | `id` | sesión `abierto`/`cerrado` con ítems; la UI la retoma al montar (C5.2) |
| `outbox` | `id` (`op_id`) | ops pendientes; índice por estado y `proximoIntentoEn` |
| `meta` | `clave` | cursores `server_seq:<negocio>`, flag de siembra, caché OFF |
| `stock_cache` | `productoId` | **solo velocidad**; la verdad es el libro |
| `sesion_local` | `id` (`"actual"`) | sesión + verificador PBKDF2 del PIN; token sólo en IndexedDB (S3) |

- Base: `latiendita` (singleton), **Dexie v2** (v1 + `sesion_local`, migración aditiva).
  `negocioId = "local"` en M1; S3 guarda la sesión real pero **aún no cambia** el `negocioId` local
  (eso llega con el pull de S4).
- Semilla demo: flag `demo:sembrado:v1`; ids de movimiento deterministas
  `demo-semilla:entrada:<productoId>`; el stock inicial **entra por el libro**, nunca a mano.

### 4.5 Rutas de la app (`apps/web/src/app.tsx`)

| Ruta | Pantalla | Estado |
|---|---|---|
| `/` | crear tienda (nombre + PIN) | ✅ C1.1 |
| `/unirse` | unirse con código + PIN | ✅ C1.2 |
| `/inicio` | resumen | placeholder (M3) |
| `/productos` · `/productos/nuevo` · `/productos/:id` | catálogo / alta / edición | ✅ C2 |
| `/escanear` | escáner (cámara → ZXing → manual) | ✅ C3 |
| `/movimiento` · `/movimiento/:id` · `/movimiento?producto=` | libro | ✅ C4 |
| `/conteo` | conteo asistido (sesión persistente, se reanuda) | ✅ C5 (sin entrada en la nav; se abre por URL) |
| `/fiados` · `/fiados/:id` | fiados | placeholder (M3) |
| `/mas` · `/mas/reportes` · `/mas/empleados` · `/mas/respaldo` | más | placeholders |

Nav inferior: Inicio · Productos · **Escanear (FAB)** · Fiados · Más. Movimiento y conteo no tienen
entrada directa en la nav (ver §8).

---

## 5. Invariantes — no romper

1. **El libro manda.** El stock es `stockDerivado(movimientos)`; `stock_cache` es un atajo que debe
   coincidir siempre. Nunca escribas stock a mano.
2. **Append-only.** Movimientos y fiados no se editan ni se borran; las correcciones son movimientos
   nuevos (`corrigeA`). Un movimiento **nunca se pierde** (C8.4).
3. **Una transacción.** Toda escritura de negocio = libro/índice + op de outbox (+ caché) en la misma
   transacción `rw`. Si algo falla, no queda ni el registro ni la op.
4. **Idempotencia.** Cada op tiene `op_id` único; repetir un push no duplica.
5. **Multi-negocio.** Toda fila de negocio lleva `negocioId`; los repos filtran por él (paridad con RLS).
6. **Dinero en centavos enteros.** Nunca floats para dinero.
7. **Cantidades en unidad base.** La conversión (`cantidad × factor`) ocurre en el dominio; el libro
   guarda la base.
8. **OFF nunca bloquea.** Sin red, sin datos o con error → `null` y formulario manual.
9. **Accesibilidad es contrato.** WCAG 2.2 AA, targets ≥48 px, nunca color solo, foco visible.
10. **El spec manda.** Si el código contradice `specs/002`, se actualiza el spec **primero**.
11. **Español primero**, tú neutro, lenguaje llano; sin emojis en la UI.
12. **Sin secretos en el cliente.** OFF se proxya; ninguna credencial de DB en la web.

---

## 6. Comandos (copiar/pegar)

```bash
# --- Implementación ---
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm size

# e2e (una vez: instala Chromium)
pnpm --filter @latiendita/web test:e2e:install
pnpm --filter @latiendita/web test:e2e

# Desarrollo
pnpm --filter @latiendita/web dev     # Vite en :5173
pnpm --filter @latiendita/api dev     # API en :3000 (/health, /off/:codigo)

# --- Diseño (sin build) ---
python3 -m http.server 8000           # design/preview.html y design/screens/*.html
python3 design/tokens/verify_contrast.py
python3 design/tools/qa.py
python3 design/tokens/generate.py
python3 design/tools/batch1.py && python3 design/tools/batch2.py && python3 design/tools/batch3.py

# --- Infra ---
docker compose -f infra/docker-compose.yml up -d   # requiere plugin compose
gh issue list
```

**Definición de hecho (DoD):** tipos ✅ + tests ✅ (unitarios y, si toca UI/datos, e2e) + build ✅ +
copy en español + docs actualizados + sin romper los invariantes de §5.

---

## 7. Trampas conocidas (aprendidas a golpes)

1. **`setOffline` corta también `localhost`.** En e2e, no uses `page.goto()` estando offline: la
   navegación debe ser **SPA** (clic en enlaces o `navigate`). La recarga offline no existe hasta que
   haya service worker (M3). El patrón correcto está en `e2e/offline-c2-c5.spec.ts`.
2. **Rutas que deben preservar estado usan el MISMO componente.** `/movimiento` y `/movimiento/:id`
   apuntaban a dos funciones distintas; Preact remontaba y se perdía el aviso “Movimiento registrado”.
   Si dos rutas renderizan la misma pantalla, comparten la misma referencia de componente.
3. **WCAG 2.5.3 (`label-content-name-mismatch`).** No pongas `aria-label` en una fila/tarjeta cuyo
   texto visible no esté incluido en ese label. Lo más robusto es **no poner `aria-label`** y dejar que
   el contenido sea el nombre accesible. Axe lo detecta; el test está en `e2e/accesibilidad.spec.ts`.
4. **La semilla demo no se escribe a mano.** Productos + entradas iniciales por el libro, con ids
   deterministas y flag en `meta`. Si cambias `demo.ts`, sube la clave de siembra (`demo:sembrado:v1`).
5. **No escribas `stock_cache` directamente.** Usa `registrarEntrada/Salida/crearMovimientoConOp`.
6. **`agregar` acepta un `Movimiento` completo.** El adaptador lo pasa a `crearMovimientoConOp`; core
   conserva `id`, `creadoEn` y `opId` si vienen. No regeneres ids a mano.
7. **`noUncheckedIndexedAccess` está activo.** Los accesos por índice devuelven `T | undefined`.
8. **Tests web en Node.** `vitest.config.ts` usa entorno `node` + `fake-indexeddb/auto`; no hay DOM.
   Para UI se usa Playwright, no jsdom.
9. **El proxy OFF es `/off/:codigo`.** En dev lo enruta Vite (`vite.config.ts`); en producción Caddy
   manda todo a la API. Si el endpoint falla, el cliente devuelve `null` (manual-first).
10. **La API no necesita DB para `/health` ni `/off`.** `getDb()` es perezoso; no la levantes para
    probar esos endpoints.
11. **`pnpm lint` ya es ESLint real** (flat config) y `pnpm typecheck` va aparte. `pnpm size` también
    es un gate real: falla si JS+CSS supera 150 KB gzip. No los trates como placeholders.
12. **Caddy aún no sirve el `dist/` web** (solo proxya la API). Es deuda de M4, no la “arregles” sin
    spec.
13. **No commitees sin que se pida.** El árbol puede tener cambios del dueño o de la sesión anterior.
14. **La sesión local bloquea la app en cada apertura.** `App` llama `repoSesion.bloquear()` si hay
    sesión; sin sesión NO se bloquea (modo local M1) para no romper los e2e C2–C5. Si cambias ese
    guard, actualiza `e2e/auth.spec.ts` y los flujos offline.
15. **El PIN local es un candado de conveniencia, no una frontera fuerte** (T-05 §7). Se guarda un
    verificador PBKDF2, nunca el PIN; el token vive sólo en IndexedDB, jamás en `localStorage`.
16. **`cerrarSesion()` borra local y revoca best-effort.** Si no hay red, la sesión del servidor queda
    hasta que expire; no la reportes como “revocada” sin red.

---

## 8. Deuda técnica y huecos conocidos

| # | Hueco | Impacto | Cuándo |
|---|---|---|---|
| 1 | Sin service worker/Workbox | no hay instalación ni recarga offline (C9) | M3 / S7 |
| 2 | ~~La UI de conteo no persiste la sesión en `conteos`~~ | ✅ resuelto en S2+: reanuda y cierra con ajustes atómicos | — |
| 3 | `/conteo` no tiene entrada en la nav ni en Inicio | se llega solo por URL | M3 (Inicio real) |
| 4 | ~~Sin ESLint~~ | ✅ resuelto: `pnpm lint` = ESLint flat config | — |
| 5 | Lighthouse CI pendiente | falta el gate de rendimiento en navegador (el tamaño ya es real) | M0/M4 |
| 6 | API auth probada con repo en memoria; **sync pendiente** | M2 completo pendiente | S4–S5 |
| 7 | Caché OFF del servidor en memoria | se pierde al reiniciar (la caché local del cliente sí persiste) | M2 (junto a DB) |
| 8 | Caddy no sirve la web | despliegue real incompleto | M4 |
| 9 | ~~Sin `LICENSE`~~ | ✅ resuelto: AGPL-3.0 (P1 cerrada) | — |
| 10 | Escáner sin prueba en dispositivo real | formatos/linterna sin validar | campo / S9 |
| 11 | Fiados, reportes, empleados, respaldo, Inicio | placeholders | M3 |
| 12 | Adaptador Postgres/RLS de auth **sin probar** contra una instancia real | riesgo de fallo sólo en despliegue | S4 |
| 13 | `/auth` busca código/token con rol dueño (bypass RLS) | esas consultas no pasan por RLS | S4 (`SECURITY DEFINER`) |
| 14 | Sin botón de cerrar sesión / usar otra cuenta en la UI | no se puede salir desde la app | S3b / M3 |
| 15 | La sesión no cambia el `negocioId` local ni dispara pull | la app sigue en modo local hasta S4 | S4 |

---

## 9. Próximos pasos

### Decisiones cerradas (P1/P2)

- **P1 · Licencia** ([#2](https://github.com/marvinm29/latiendita-design/issues/2)): ✅ **AGPL-3.0**;
  `LICENSE` + `"license": "AGPL-3.0-only"`.
- **P2 · Login de empleados** ([#1](https://github.com/marvinm29/latiendita-design/issues/1)): ✅
  **código de invitación de un solo uso + PIN** (T-05). Desbloquea S3.

### S3 · M2 — Cuentas y acceso ✅

Criterios cumplidos:
- ✅ Crear negocio (C1.1) y unirse con código de un solo uso (base32, 7 días, rate-limit).
- ✅ PIN con argon2id en servidor; sesión opaca en IndexedDB; rotación y revocación.
- ✅ **Desbloqueo offline por PIN local** (PBKDF2, sin red).
- ✅ Gate: invitar ↔ unirse (API, repo memoria); la sesión sobrevive recarga; el PIN desbloquea sin red.
- ⚠️ Deuda honesta: adaptador Postgres/RLS sin probar contra instancia real y `/auth` con bypass de RLS
  hasta `SECURITY DEFINER` → **S4**.

### S4 · M2 — API y sincronización (siguiente)

- `/sync/push` idempotente por `op_id` (`op_log`) y `/sync/pull` por `server_seq` (T-04).
- Fastify + Drizzle + Postgres + **RLS efectiva**; matriz de permisos por rol (C7).
- Probar la migración real, mover búsquedas de auth a `SECURITY DEFINER` y conectar el `negocioId`
  local de la web a la sesión (dejar el modo local M1 atrás).
- **Gate:** repetir un lote no duplica; aislamiento A/B; migración aditiva.

### Otros pendientes no bloqueados

1. **Endurecer M0:** Lighthouse CI y `drizzle-kit` (ESLint y gate de tamaño ya activos).
2. **Historial de conteos:** los datos ya se guardan en `conteos`; falta mostrarlos (M3).
3. **Entrada a Conteo** desde Inicio/Más cuando exista Inicio real (M3).
4. **DS-26** ([#3](https://github.com/marvinm29/latiendita-design/issues/3)); #4 ya cerrada con DS-31.
5. **`pb-20` vs FAB** ([#5](https://github.com/marvinm29/latiendita-design/issues/5)) con datos reales.

---

## 10. Protocolo de trabajo para agentes de IA

### 10.1 Ciclo obligatorio

1. **Leer** `AGENTS.md` → este doc → el spec que toque. Confirmar el estado en una frase.
2. **Verificar la base** antes de tocar nada: `git status --short`, `pnpm typecheck`, `pnpm test`.
3. **Planear** el incremento más pequeño que entregue valor; escribirlo (3–6 pasos) antes de editar.
4. **Implementar** respetando estructura, nombres y estilo del código vecino.
5. **Probar** el comportamiento nuevo (unitario y, si toca UI/datos, e2e).
6. **Actualizar docs** (§10.4).
7. **Reportar** con evidencia: comandos ejecutados y resultados, archivos tocados, riesgos.

### 10.2 Reglas duras

- **No reabrir decisiones cerradas** (`AGENTS.md` §3). Si algo las contradice, para y pregunta.
- **Spec-first:** cambio de alcance → primero `specs/002` (y `006` si cambia el plan).
- **No commitear ni pushear** sin pedido explícito.
- **No añadir dependencias** sin justificar alternativa y tamaño.
- **No borrar** archivos que no entiendas; investiga primero.
- **No inventar** datos, endpoints ni métricas. Si no está verificado, dilo.
- **Español** en docs, UI y mensajes de commit; tú neutro y lenguaje llano.

### 10.3 Definición de hecho

- `pnpm typecheck` ✅ · `pnpm test` ✅ · `pnpm build` ✅.
- Si toca UI/datos: `pnpm --filter @latiendita/web test:e2e` ✅ (y axe si hay pantalla nueva).
- Comportamiento cubierto por una prueba que **fallaría** sin el cambio.
- Copy revisado (singular/plural, sin tecnicismos, sin emojis).
- Docs de estado actualizados (§10.4).
- Invariantes de §5 intactos.

### 10.4 Qué actualizar al cerrar una sesión

1. `AGENTS.md` §2 (tabla de estado y números).
2. `README.md` (tabla de estado, números y hoja de ruta).
3. `specs/006-plan-sprints.md` (sprint en curso, checklist, gates).
4. `specs/README.md` (tabla y árbol de estado).
5. `docs/TRASPASO.md` §2 (estado verificado), §3 (changelog) y §14 (registro de sesión).
6. Si cambió una decisión: `design/decisions.md` + issue correspondiente.

### 10.5 Anti-patrones (evítalos)

- Reescribir un archivo entero cuando basta un cambio puntual.
- Añadir estado global o un store nuevo sin necesidad.
- “Arreglar” accesibilidad quitando texto o roles.
- Saltarse la transacción de outbox “para simplificar”.
- Confundir `stock_cache` con la verdad.
- Meter lógica de negocio en componentes de UI.
- Documentar solo al final “si queda tiempo”.

### 10.6 Gestión de contexto

- Prefiere `grep`/`find` y lecturas por rangos (`offset`/`limit`) sobre volcar archivos enormes.
- Los specs largos se consultan por sección (§). No los pegues completos.
- Si una tarea es grande, divídela en incrementos verificables y reporta cada uno.
- Cuando el contexto se acerque al límite, escribe un resumen en §14 antes de continuar.

---

## 11. Checklist de arranque de sesión

- [ ] Leí `AGENTS.md` y este documento.
- [ ] `git status --short` (entiendo los cambios sin commitear).
- [ ] `pnpm typecheck && pnpm test` en verde (o sé por qué no).
- [ ] Confirmé el sprint actual en `specs/006-plan-sprints.md`.
- [ ] Identifiqué si mi tarea está bloqueada por P1/P2/DS-26.
- [ ] Escribí el plan del incremento (3–6 pasos) y su criterio de aceptación.
- [ ] Sé qué pruebas voy a añadir y qué docs voy a actualizar.

---

## 12. Prompt de traspaso (copiar/pegar)

```text
Retoma el proyecto LaTiendita (PWA offline-first de inventario y fiados para tiendas de colonia de
El Salvador). Raíz del repo: /home/varm/Documents/testModels.

Antes de hacer nada, lee en este orden:
1. AGENTS.md (entrada corta, decisiones cerradas, comandos)
2. docs/TRASPASO.md (contexto completo: estado, arquitectura, invariantes, trampas, protocolo)
3. specs/README.md (índice SDD)
4. specs/002-especificacion-funcional.md (fuente de verdad: C1–C11, NFRs, métricas, P1–P5)
5. specs/003-plan-tecnico.md (stack, offline/sync, modelo de datos, pruebas)
6. specs/006-plan-sprints.md (sprint en curso y siguientes)
7. design/DESIGN.md y design/ACCESSIBILITY.md (contrato de UI y WCAG 2.2 AA)

Estado verificado: SDD y diseño (F1–F4) completos. M0 ✅ · M1 ✅ (dominio + Dexie + UI C2–C5 sobre
IndexedDB, C5 persistente) · M2 en curso (S3 ✅: negocio, invitación/PIN, sesión, desbloqueo offline;
115 tests + 14 e2e). P1 (AGPL-3.0) y P2 (código+PIN) cerradas. Siguiente: S4 (sync + RLS).

Protocolo: verifica la base (git status, typecheck, test) → plan pequeño → implementa → prueba →
actualiza docs → reporta con evidencia. El spec manda; español primero; WCAG 2.2 AA es contrato;
nunca color solo; no commitees sin que se te pida; no reabras decisiones cerradas.

Empieza confirmando que leíste el estado y proponme el siguiente incremento (S4: sync + RLS, o el
trabajo no bloqueado de docs/TRASPASO.md §9).
```

---

## 13. Índice de documentos

| Documento | Para qué |
|---|---|
| `AGENTS.md` | entrada corta, estado, decisiones cerradas, comandos, prompt |
| `docs/TRASPASO.md` | **este doc**: contexto completo y protocolo |
| `specs/README.md` | índice SDD y estado de la sesión |
| `specs/002-especificacion-funcional.md` | qué se construye (fuente de verdad) |
| `specs/003-plan-tecnico.md` | cómo (stack, offline/sync, modelo, pruebas) |
| `specs/004-roadmap.md` | cuándo/qué hitos (M0–M4, gates) |
| `specs/006-plan-sprints.md` | sprints de 1 semana (S1–S9) |
| `design/DESIGN.md` | sistema de diseño (§0–§12) |
| `design/ACCESSIBILITY.md` | checklist WCAG 2.2 AA |
| `design/decisions.md` | bitácora DS-01…DS-30 |
| `infra/README.md` | despliegue y variables |

---

## 14. Registro de sesiones

### Sesión 3 (18/10/2026) — P1/P2 + S3 · cuentas y acceso

**Objetivo:** cerrar licencia y login, entregar S3 completo (API + web) y la variante “sin mínimo”.

**Cambios:**

- **P1:** `LICENSE` AGPL-3.0, `"license": "AGPL-3.0-only"` en paquetes; spec `002` §7 e issue #2 cerradas.
- **P2:** código de un solo uso + PIN confirmado; issue #1 cerrada.
- **API auth:** `apps/api/src/auth/*` (servicio, plugin, repo memoria/Postgres, argon2id, rate-limit),
  migración `invitacion`/`sesion` + drizzle, 14 tests.
- **Web auth:** `packages/core/src/auth.ts`, Dexie v2 (`sesion_local`), `sesionRepo*`, `authApi`,
  pantallas crear/unirse/bloqueo, cierre de sesión en «Más», 5 tests + 4 e2e.
- **M0:** ESLint real + gate de tamaño real (`pnpm size` falla por encima de 150 KB).
- **Diseño:** DS-31 “Sin mínimo”, pantalla 05 regenerada, issue #4 cerrada.

**Verificación:** lint ✅ · typecheck ✅ · **115 tests** ✅ (85 core + 16 web + 14 api) · **14 e2e** ✅ ·
build ✅ · `pnpm size` **87 673 B gzip** ✅ · QA diseño 13/60/0 ✅ · contraste 60/60 ✅.

**Siguiente:** S4 — sync push/pull + RLS real + conectar `negocioId` a la sesión.

### Sesión 2 (18/10/2026) — C5 · conteo persistente y reanudable

**Objetivo:** cerrar la deuda de C5 (la UI no persistía la sesión de conteo) sin desbloquear M2.

**Cambios:**

- Core: `cerrarConAjustes` en `conteoRepo` (sesión + ajustes + ops en una transacción) y
  `recalcularItems` compartido; 2 pruebas nuevas (ajustes y rollback atómico).
- Web: `datos/conteosRepo.ts` + `conteosRepoDexie.ts`; `Conteo.tsx` retoma/registra/cierra contra
  IndexedDB, con aviso de fallo de captura; 2 pruebas de integración nuevas.
- e2e: `e2e/conteo-persistente.spec.ts` + helper `leerConteos` en `e2e/ayudas.ts`.
- Docs: `AGENTS.md`, `README.md`, `specs/006`, `specs/README`, este documento.

**Verificación:** `pnpm typecheck` ✅ · **96 tests** ✅ · **10 e2e** ✅ · `pnpm build` ✅ ·
`pnpm size` **83 661 B gzip** ✅.

**Siguiente:** P1/P2 siguen abiertas → endurecer M0 (ESLint/size-limit reales), DS-26/#4 o historial
de conteos visible en M3.

### Sesión 1 (18/10/2026) — plan de sprints + S1/S2

**Objetivo:** plan de sprints + S1 (persistencia real) + S2 (e2e offline + OFF) + documentación.

**Cambios (sin commitear):**

- Nuevos: `specs/006-plan-sprints.md`, `docs/TRASPASO.md`, `apps/api/src/off.ts`,
  `apps/web/src/datos/{baseLocal,movimientosRepo,movimientosRepoDexie,off}.ts`,
  `apps/web/src/datos/{repos,off}.test.ts`, `apps/web/e2e/*`, `apps/web/playwright.config.ts`,
  `apps/web/vitest.config.ts`.
- Modificados: `AGENTS.md`, `README.md`, `specs/README.md`, `apps/api/src/server.ts`,
  `apps/web/{package.json,tsconfig.json,vite.config.ts}`, `apps/web/src/app.tsx`,
  `apps/web/src/datos/catalogoRepoDexie.ts`, `apps/web/src/paginas/{movimiento/Movimiento,conteo/Conteo,
  productos/FormProducto,productos/ListaProductos,escanear/Escanear,escanear/camara}.tsx|ts`,
  `.github/workflows/ci.yml`, `.gitignore`, `pnpm-lock.yaml`.
- Eliminado: `apps/web/src/paginas/movimiento/repoLocal.ts` (reemplazado por `datos/movimientosRepo*`).

**Verificación:** typecheck ✅ · 92 tests ✅ · 9 e2e ✅ · build ✅ · size 83.3 KB ✅.

**Siguiente:** cerrar P1/P2 → S3; o trabajo no bloqueado de §9.

> Al cerrar tu sesión, añade aquí una entrada breve (fecha, objetivo, cambios, verificación,
> siguiente paso). Es el historial que evita que la próxima sesión repita trabajo o rompa algo.
