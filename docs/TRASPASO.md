# TRASPASO · LaTiendita — contexto completo para una sesión nueva

> **Para quién:** agentes de IA (opencode y similares) y personas que retoman el repositorio.
> `AGENTS.md` es la **entrada corta**; este documento es el **paquete de contexto**: estado real,
> arquitectura, invariantes, trampas, deuda y protocolo de trabajo.
>
> **Última actualización de estado:** 14 de noviembre de 2026 (B1: aislamiento local por sesión).
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
- **Estado:** SDD y diseño (F1–F4) entregados. **M0 🟡** (gates/despliegue pendientes) · **M1 ✅**
  · **M2 🟡 S3 entregado** · **M3 🟡** (funciones locales implementadas; integración con sync y backup
  de servidor pendiente). **S4/S5 pendientes.**
- **Números:** 171 tests regulares (96 core + 55 web + 20 api) y 2 integraciones PostgreSQL optativas
  (9 casos auth + bitácora sync) · 32 e2e (offline C2–C5 + conteo +
  acceso/empleados + fiados + PWA + datos + inicio/reportes + OFF + axe AA) · bundle inicial
  **116 186 B gzip** (presupuesto 153 600 B; incluye SW/Workbox) · 13 pantallas / 60 marcos · WCAG 2.2 AA.
- **A ✅:** auth real, altas atómicas, RLS y rol de API restringido probados en PG16.15.
- **B1 ✅:** selección del negocio por sesión, aislamiento local y cola preservada al salir.
- **Siguiente:** **B2 de `AGENTS.md` §6.3** (propiedad/migración explícita de `local` y
  renovación/reingreso), después C/D (sync, LWW y restore). Docker, backup y campo siguen pendientes.

---

## 2. Estado verificado (no confiar en la memoria: re-verificar)

Comprobación actual (14/11/2026, B1): tipos/lint, **171 pruebas regulares**, build y tamaño
**116 186 / 153 600 B gzip**, correctos. **32 e2e Chromium/PWA con CI=1, sin reintentos**,
fuera del sandbox. La corrida previa tuvo un selector ambiguo en la prueba nueva (31/32);
se corrigió y se ejecutó de nuevo el conjunto completo. Dentro del sandbox, CI=1 no arrancó
su servidor. PG no repetido: dos integraciones omitidas en la corrida regular, con evidencia
previa de A. Sin cambios de diseño: contraste/QA no repetidos. Docker, dispositivos y campo sin ejecutar.

Comprobación histórica inmediatamente anterior (14/11/2026, A): tipos, lint, **164 pruebas regulares**, build y tamaño
**115 689 / 153 600 B gzip**, todos correctos. Integración en PG16.15 desechable: **31 pruebas API,
0 fallos, 0 SKIP**, incluyendo 9 casos auth y la bitácora sync existente. **31 e2e Chromium/PWA
sin reintentos** fuera del sandbox; dentro no arrancó el servidor de Playwright.
`sh -n infra/db-init/001_migrar.sh infra/db-init/002_rol_api.sh` correcto.
No se ejecutaron Docker/Compose (sin daemon ni plugin), CI remoto, contraste/QA de diseño
(sin cambios de diseño), dispositivos reales, zoom/lector manual ni campo. Registro en §14.

Resultados históricos anteriores (no sustituyen la comprobación actual):

Comandos y resultados históricos al cierre de la sesión 5 (18/10/2026); no son una ejecución actual:

Última comprobación local (02/11/2026, sesión 10): `pnpm typecheck`, `pnpm lint`,
`pnpm test` (164 pruebas regulares), `pnpm build` y la integración optativa de sync con
PostgreSQL 16 pasaron. No se volvieron a ejecutar los e2e ni las pruebas de campo en esa sesión.

| Gate | Comando | Resultado |
|---|---|---|
| Tipos | `pnpm typecheck` | ✅ 0 errores (api, core, tokens, ui, web) |
| Lint | `pnpm lint` | ✅ 0 errores (ESLint flat config) |
| Unitarios | `pnpm test` | ✅ **145** (88 core + 43 web + 14 api) |
| e2e | `pnpm --filter @latiendita/web test:e2e` | ✅ **30/30** |
| Build | `pnpm build` | ✅ (incluye `sw.js` + Workbox) |
| Presupuesto | `pnpm size` | ✅ **114 828 B gzip** / 153 600 B (74.8 %) |
| Contraste | `python3 design/tokens/verify_contrast.py` | ✅ 60/60 pares AA |
| QA diseño | `python3 design/tools/qa.py` | ✅ 13 pantallas · 60 marcos · 0 hallazgos |

**Árbol de trabajo:** S1, S2, S2+ y S3 quedaron **commiteados** al cierre (ver §14). Aun así, antes
de empezar ejecuta `git status --short` y **no borres ni reviertas** archivos que no entiendas.

**Lo que NO está hecho (no lo asumas):**

- **PWA:** el SW solo existe en build/`vite preview`, no en `vite dev`. El WASM de ZXing (953 KB) no
  se precachea: el escaneo por cámara necesita red la primera vez (el teclado manual sigue offline).
- **Auth/PG verificado en A:** búsquedas iniciales por hash con funciones acotadas `SECURITY DEFINER`,
  contexto de negocio por transacción y conexión sin superusuario/BYPASSRLS. Los e2e de acceso
  siguen simulando HTTP; no equivalen a navegador → API → PG real.
- La sesión **ya selecciona** el negocio para las operaciones locales (B1), sin disparar pull/sync.
  Las cuentas reales empiezan vacías. Sin sesión sigue el modo local M1; sus datos heredados se
  conservan sin trasladarlos a una cuenta. La política y migración explícita siguen pendientes en B2.
- La UI permite cerrar sesión; el flujo para volver a entrar y la renovación automática deben revisarse.
- Sin endpoints de sync registrados en producción: existe una implementación experimental de bitácora
  y materialización inicial de movimientos. Auth dispone de adaptador PostgreSQL probado en una
  instancia real en A. Restore JSON no genera ops de outbox; CSV **sí encola** mediante el repo.
- Lighthouse CI sigue pendiente (el gate de tamaño propio ya es real).
- **Backups del servidor** (`pg_dump` + runbook) pendientes; dependen de S4.
- El escáner no se ha probado en dispositivos reales (formatos y linterna sí están implementados).

---

## 3. Qué se construyó (changelog)

### B1 · Aislamiento local por sesión ✅ (14/11/2026; B permanece abierto)

- `asegurarBaseLista` devuelve una instantánea del negocio desde `sesion_local`; catálogo, libros,
  conteos, fiados, reportes e import/export mantienen ese contexto hasta terminar. Las suscripciones
  vuelven a consultar cuando cambia la sesión. Una sola base; no hay traslado de datos heredados.
- Stock por negocio en caché/libro; restore rechaza IDs y referencias ajenas con rollback completo.
  Se conservan las claves globales de IndexedDB: las colisiones entre negocios se rechazan.
- Desbloqueo con comprobación transaccional después del PBKDF2: un PIN iniciado para A no puede
  desbloquear B. Cierre local atómico; outbox intacta. La página se remonta al cambiar de cuenta.
- Siete pruebas de regresión nuevas y un e2e de cambio A→B, recarga/desbloqueo offline de B y
  conservación exacta de las operaciones pendientes de A. Auth del e2e simulado; no prueba reingreso real.

### A · Auth PostgreSQL y mínimo privilegio ✅ (14/11/2026)

- `0004_auth_minimo_privilegio.sql`: cuatro funciones acotadas con `search_path` fijo y ejecución
  pública revocada; alta completa y canje atómicos, invitación de un uso/vencimiento y sesión
  válida sólo con negocio/persona/membresía activos. RLS rechaza referencias entre negocios.
- El repositorio fija contexto también al consultar negocio/persona y al usar/revocar sesión.
  El servicio incluye la sesión inicial en el alta; se reprodujo y corrigió su persistencia parcial.
- `infra/permisos-app.sql` y scripts de inicialización: rol de API sin propiedad, superusuario
  ni BYPASSRLS; la única contraseña externa queda en ese rol. Administración por socket local
  dentro del contenedor. Compose conserva las cinco variables externas; arranque Docker sin verificar.
- Integración real con migraciones desde base vacía, rollback de alta/canje, carreras, expiración,
  revocación y aislamiento A/B. SQL de permisos compartido entre fixture y aprovisionamiento.

### S4 · Sync experimental — avance parcial

- Bitácora y movimientos se guardan juntos en PostgreSQL con RLS y validación de asientos; la
  prueba de integración cubre reintentos, colisiones, rollback y aislamiento entre negocios.
- Las rutas no están registradas en producción. Faltan el resto de entidades, la reconciliación
  de eventos anteriores, LWW integrado y el cliente de sincronización.

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

### S6 · M3 — fiados, reportes e Inicio ✅ (C6/C11/C5.1)

- Core: orden de libreta por saldo/antigüedad (`ordenarLibretaClientes`), `obtenerCliente` y
  `listarFiados`; saldo y `ultimoMovimientoEn` derivados del ledger. 3 tests core nuevos.
- Web: `fiadosRepo*` sobre la base compartida; `/fiados`, `/fiados/nuevo` y `/fiados/:id` con
  cargos/abonos inmutables, teclado numérico, validación > 0 y compartir estado de cuenta local
  (`navigator.share` → portapapeles → texto). 3 tests web + 2 e2e (flujo + axe).
- **Reportes (C11)** e **Inicio real**: valor de inventario costo/precio, top de movimientos por
  rango, resumen de fiados, “lo que falta” y últimos movimientos. 9 tests web + 3 e2e.
- **Empleados:** la dueña genera el código de invitación desde la UI (sólo dueña; rol empleado
  recibe un mensaje claro). 3 e2e.

### S7 · M3 — PWA y datos 🟡 (C9/C10; sync y backup del servidor pendientes)

- PWA: `vite-plugin-pwa` (Workbox), manifest, iconos 192/512/180, precache del app-shell,
  `navigateFallback` y denylist `/auth|/off|/sync`; aviso “Hay una nueva versión — Reiniciar”
  sin recarga forzada. 2 e2e contra `vite preview` (recarga offline + manifest).
- Datos: export CSV de productos/movimientos/fiados + respaldo JSON completo (`datos/exportar.ts`),
  descarga local con BOM UTF-8. 4 tests web + 2 e2e (descarga real + axe).
- **Import/restore:** importar productos CSV con plantilla y restaurar JSON con merge idempotente
  (no duplica, recalcula `stock_cache` desde el libro). 11 tests web + 4 e2e.
- Pendiente: backup del servidor (`pg_dump` + runbook), que depende de S4.

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
│   │   │   ├── datos/             # repos (catálogo, libro, conteos, fiados, sesión), authApi, OFF, exportar
│   │   │   ├── componentes/       # BannerOffline, ChipStock, EstadoVacio, AvisoNuevaVersion
│   │   │   ├── pwa/               # registro del SW y señales de actualización
│   │   │   └── paginas/           # auth, productos, escanear, movimiento, conteo, fiados, respaldo
│   │   ├── e2e/                   # Playwright (offline, auth/PIN, fiados, PWA, export, axe)
│   │   ├── vite.config.ts         # VitePWA/Workbox + proxy /off y /auth → :3000
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
              →  /auth/*       →  PostgreSQL (A: auth real, RLS y rol restringido probados)
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
  B1 resuelve el negocio desde la sesión antes de cada operación. `local` sigue siendo el contexto
  sin sesión; sus filas no se asignan automáticamente. Consumir siempre la instantánea devuelta
  por `asegurarBaseLista(base)`; `baseApp` es el selector, no una instantánea de una cuenta.
- Semilla demo: flag `demo:sembrado:v1`; ids de movimiento deterministas
  `demo-semilla:entrada:<productoId>`; el stock inicial **entra por el libro**, nunca a mano.

### 4.5 Rutas de la app (`apps/web/src/app.tsx`)

| Ruta | Pantalla | Estado |
|---|---|---|
| `/` | crear tienda (nombre + PIN) | ✅ C1.1 |
| `/unirse` | unirse con código + PIN | ✅ C1.2 |
| `/inicio` | resumen: lo que falta, fiado, movimientos y conteo en curso | ✅ C5.1 |
| `/productos` · `/productos/nuevo` · `/productos/:id` | catálogo / alta / edición | ✅ C2 |
| `/escanear` | escáner (cámara → ZXing → manual) | ✅ C3 |
| `/movimiento` · `/movimiento/:id` · `/movimiento?producto=` | libro | ✅ C4 |
| `/conteo` | conteo asistido (sesión persistente, se reanuda) | ✅ C5 (sin entrada en la nav; se abre por URL) |
| `/fiados` · `/fiados/nuevo` · `/fiados/:id` | libreta, alta y detalle de cliente | ✅ C6 |
| `/mas/respaldo` | export, import CSV y restore JSON | ✅ C10 |
| `/mas/reportes` | inventario, top de movimientos y fiados | ✅ C11 |
| `/mas/empleados` | la dueña genera el código de invitación | ✅ C1.2/C7 |

Nav inferior: Inicio · Productos · **Escanear (FAB)** · Fiados · Más. Movimiento no tiene entrada
directa en la nav; Inicio enlaza a Conteo (C5.2).

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

# Integración PostgreSQL experimental: instancia desechable; el rol necesita
# crear roles y esquemas. No ejecutar contra una base de producción.
SYNC_TEST_PG=1 PGHOST=/ruta/al/socket PGPORT=5432 PGUSER=usuario_prueba PGDATABASE=postgres pnpm --filter @latiendita/api test

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

1. **`setOffline` corta también `localhost`.** En los specs funcionales (dev, sin SW) no uses
   `page.goto()` estando offline: la navegación debe ser **SPA** (clic o `navigate`). La recarga
   offline real se prueba sólo en `e2e/pwa.spec.ts`, que corre contra `vite preview` con el SW. El
   patrón offline C2–C5 está en `e2e/offline-c2-c5.spec.ts`.
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
17. **La PWA no existe en `vite dev`.** Manifest/SW se generan en `pnpm build`; los specs funcionales
    corren con `serviceWorkers: "block"` y sólo `pwa.spec.ts` usa `vite preview`. No cambies eso sin
    revisar `playwright.config.ts` (dos webServers) ni precaches `/auth`, `/off` o `/sync`.
18. **El WASM de ZXing no está precacheado.** El escaneo por cámara necesita red la primera vez; el
    teclado manual es el camino offline (C3.2). Si se precachea, vigila el presupuesto y el arranque.

---

## 8. Deuda técnica y huecos conocidos

| # | Hueco | Impacto | Cuándo |
|---|---|---|---|
| 1 | ~~Sin service worker/Workbox~~ | ✅ resuelto en S7: PWA instalable y recarga offline (C9) | — |
| 2 | ~~La UI de conteo no persiste la sesión en `conteos`~~ | ✅ resuelto en S2+: reanuda y cierra con ajustes atómicos | — |
| 3 | ~~`/conteo` sin entrada~~ | ✅ resuelto: Inicio enlaza al conteo en curso y a Conteo | — |
| 4 | ~~Sin ESLint~~ | ✅ resuelto: `pnpm lint` = ESLint flat config | — |
| 5 | Lighthouse CI pendiente | falta el gate de rendimiento en navegador (el tamaño ya es real) | M0/M4 |
| 6 | Auth probada en memoria y PG16 con rol restringido; **sync pendiente** | M2 completo pendiente | B–D |
| 7 | Caché OFF del servidor en memoria | se pierde al reiniciar (la caché local del cliente sí persiste) | M2 (junto a DB) |
| 8 | Caddy no sirve la web | despliegue real incompleto | M4 |
| 9 | ~~Sin `LICENSE`~~ | ✅ resuelto: AGPL-3.0 (P1 cerrada) | — |
| 10 | Escáner sin prueba en dispositivo real | formatos/linterna sin validar | campo / S9 |
| 11 | ~~Reportes, empleados e Inicio~~ | ✅ resueltos en S6/S7 | — |
| 12 | ~~Adaptador Postgres/RLS de auth sin probar~~ | ✅ A: migraciones y 9 casos de auth en PG16.15 con rol restringido | — |
| 13 | ~~La conexión `/auth` usa el rol dueño~~ | ✅ A: búsquedas por funciones acotadas; rol de API sin propiedad ni BYPASSRLS | — |
| 14 | ~~Sin botón de cerrar sesión~~ | ✅ resuelto: cierre con confirmación en «Más» | — |
| 15 | B1 liga las operaciones locales a la sesión; migración heredada y pull pendientes | No hay migración implícita de `local` ni recuperación del servidor | B2/D |
| 16 | Import/restore JSON/CSV | restore local corregido; falta integración con sync | S4/S5 (`006` §3) |
| 17 | ~~Reportes mínimos (C11)~~ | ✅ resuelto: inventario, top y fiados | — |
| 18 | Backup del servidor (`pg_dump` + runbook) | no hay respaldo automático de Postgres | S4/S7 |
| 19 | ~~Restore ignora cambios del respaldo en productos demo~~ | corregido para semillas intactas; conserva ediciones locales y rechaza colisiones | — |
| 20 | ~~Respaldo JSON omite `conteos`~~ | corregido; acepta respaldos antiguos sin conteos | — |
| 21 | ~~CSV usa flotantes para dinero~~ | corregido; se rechazan importes con más de dos decimales | — |
| 22 | ~~Diálogo restore desborda en pantalla baja~~ | corregido y probado con teclado en Chromium; zoom 200 % manual pendiente | S8 |
| 23 | API rota tokens, pero la web no llama a `/auth/renovar` | posible pérdida de acceso al vencer; investigar flujo de recuperación | S4 |
| 24 | Spec exige sesiones firmadas; implementación usa tokens opacos | diferencia entre NFR y T-05; resolver explícitamente antes de cerrar seguridad sin asumir equivalencia | S4/S8 |
| 25 | Fusión LWW sin conectar al servidor | núcleo puro y pruebas implementados; faltan persistencia, transporte y convergencia de extremo a extremo | S4/S5 |
| 26 | Sync experimental incompleto | Materialización inicial de movimientos y bitácora en una transacción, probada en PostgreSQL 16 con rol restringido; otras entidades, reconciliación de eventos antiguos, permisos de sync y push/pull real siguen pendientes. Rutas no registradas en producción | C/D |

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
- ✅ A: adaptador Postgres/RLS probado con migraciones reales, rol restringido y funciones
  `SECURITY DEFINER` acotadas. Despliegue con Docker y continuidad del acceso del cliente pendientes.

### Integridad de datos

Los tres defectos reproducidos y el diálogo en pantalla baja se corrigieron (§8, filas 19–22).
La integración de restore con sync y el zoom manual continúan pendientes (`006` §3).

### S4 · M2 — API y sincronización

- `/sync/push` idempotente por `op_id` (`op_log`) y `/sync/pull` por `server_seq` (T-04).
- Fastify + Drizzle + Postgres + **RLS efectiva**; matriz de permisos por rol (C7).
- A y B1 completados. Seguir B2 de `AGENTS.md` §6.3: acordar propiedad/migración de `local`
  y continuidad del acceso; C/D completan persistencia y transporte sync.
- **Gate:** repetir un lote no duplica; aislamiento A/B; migración aditiva.

### Otros pendientes no bloqueados

1. **Backup del servidor:** `pg_dump` por cron + runbook (depende de S4/Postgres).
2. **Endurecer M0:** Lighthouse CI y `drizzle-kit` (ESLint y gate de tamaño ya activos).
3. **DS-26** ([#3](https://github.com/marvinm29/latiendita-design/issues/3)); #4 ya cerrada con DS-31.
4. **`pb-20` vs FAB** ([#5](https://github.com/marvinm29/latiendita-design/issues/5)) con datos reales.

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

Estado verificado: SDD y diseño (F1–F4) completos. M0 🟡 · M1 ✅ (dominio + Dexie + UI C2–C5 sobre
IndexedDB, C5 persistente) · M2 en curso (S3 entregado) · M3 con funciones locales implementadas y
restore local corregido; sync y backup de servidor pendientes. 171 tests + 2 integraciones PG + 32 e2e. P1/P2 cerradas.
A (auth real PG16) y B1 (aislamiento local) completados. Siguiente: B2 de AGENTS.md §6.3.

Protocolo: verifica la base (git status, typecheck, test) → plan pequeño → implementa → prueba →
actualiza docs → reporta con evidencia. El spec manda; español primero; WCAG 2.2 AA es contrato;
nunca color solo; no commitees sin que se te pida; no reabras decisiones cerradas.

Empieza confirmando que leíste el estado y proponme el siguiente incremento de §9.
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

### Sesión 12 (14/11/2026) — B1: aislamiento local sin mover datos heredados

**Base:** `6b2de47`, árbol limpio al empezar. Un solo agente; continuación del plan, sin cambios
de stack ni alcance. La autorización posterior del dueño para commit/push sigue vigente.

**Archivos:** `baseLocal.ts`, adaptadores de catálogo/movimientos/conteos/fiados, import/export,
reportes, `sesionRepoDexie.ts`, `app.tsx`, helpers de stock/conteo de core; nueva prueba
`aislamientoLocal.test.ts`, carrera de PIN en `sesionRepo.test.ts` y e2e de cambio de cuenta.
Se observaron pruebas rojas por demo de A visible en B, stock ajeno, restore con IDs/referencias
cruzadas y PIN de A que desbloqueaba B después del cambio; todas quedaron verdes.

**Decisiones:** conservar la base y los IDs globales actuales, resolver el negocio desde la sesión
por operación y rechazar colisiones/referencias cruzadas. Cuentas reales sin semillas demo.
Los heredados permanecen intactos bajo `local`; se preguntó al dueño la política de propiedad y
no se inició su traslado sin respuesta. B1 no incorpora respaldo/migración heredada ni renovación
automática/reingreso; B sigue abierto. Revisión propia del diff, sin agente revisor.

**Verificación:** `pnpm typecheck`, `pnpm lint`, `pnpm test` → **171 regulares** (96 core + 55 web +
20 API; 2 integraciones PG omitidas), `pnpm build`, `pnpm size` → **116 186 / 153 600 B gzip**.
E2e final: `CI=1 pnpm --filter @latiendita/web test:e2e` → **32/32 sin reintentos**, fuera del sandbox.
La primera corrida ejecutó todo el conjunto (31 aprobadas y un selector ambiguo en la prueba nueva,
corregido después); una corrida CI=1 dentro del sandbox no pudo arrancar su servidor. La repetición
final fue del conjunto completo. Sin nuevas dependencias ni cambios de esquema/índices.

**Límites:** API HTTP de acceso simulada en e2e; el retorno a A inyectado en tests comprueba datos,
no un login recuperable. PG sólo tiene la evidencia histórica de A, no una ejecución nueva.
Sin cambios de diseño, no se repitió contraste/QA; sin Docker, dispositivos, lector/zoom ni campo.

**Siguiente exacto:** B2 — resolver la política de propiedad de `local`; respaldar y migrar sólo
con destino confirmado, de forma transaccional y preservando IDs/libros/cola. Después renovar antes
del vencimiento y definir reingreso sin reutilizar invitaciones consumidas; si necesita un flujo
nuevo, acordarlo y actualizar `002` primero. Sync sigue sin registrar.

### Sesión 11 (14/11/2026) — A: auth PostgreSQL y mínimo privilegio

**Base:** `f631449`; `AGENTS.md` ya contenía cambios del dueño, conservados. Node 26.11.1,
pnpm 9.15.9; un solo agente en el árbol indicado, sin commit/push/despliegue ni cambios de alcance.

**Archivos:** `auth/{repoPostgres,repoMemoria,servicio,tipos}.ts`, `db/client.ts`, nueva integración
`auth/repoPostgres.test.ts`, migración `0004`, `infra/{docker-compose.yml,permisos-app.sql,db-init/*,.env.example,README.md}`,
nombre del job PG de CI y documentos de estado. Cuatro funciones con permisos acotados y RLS
en lecturas/escrituras normales; se corrigió además el alta parcial cuando fallaba la sesión inicial.
Primero fallaron las pruebas por permiso denegado en `negocio` y por filas del alta que sobrevivían
al fallo de sesión; después quedaron verdes. La revisión final fue propia, sin agente revisor,
respetando la instrucción de trabajar con un solo agente.

**Evidencia:** clúster temporal PG16.15 en `/tmp/latiendita-auth-pg16-data`, socket `/tmp`, puerto 55439, detenido al cierre;
no se usaron datos de una tienda. `SYNC_TEST_PG=1 PGHOST=/tmp PGPORT=55439 PGUSER=sync_admin PGDATABASE=postgres pnpm --filter @latiendita/api test`
→ **31 pruebas API, 0 fallos, 0 SKIP** (9 casos auth, su contenedor, bitácora sync y 20 regulares).
Tipos/lint, 164 pruebas regulares, build y tamaño **115 689 B gzip** correctos.
`CI=1 pnpm --filter @latiendita/web test:e2e` → **31/31 sin reintentos**, fuera del sandbox
tras bloqueo de arranque del servidor dentro del sandbox. Sintaxis de ambos scripts shell correcta.

**Límites/decisiones:** Docker sigue sin daemon ni plugin Compose: SQL y permisos probados contra PG
real, scripts de contenedor sólo con `sh -n`; arranque y transición con volúmenes existentes sin ejecutar.
El administrador queda sin contraseña remota y se administra por socket dentro del contenedor;
el rol restringido recibe `POSTGRES_PASSWORD`, conservando las cinco variables externas.
Sin CI remoto, dispositivos, lector/zoom manual ni campo. Sin cambios de diseño, no se repitieron
contraste/QA. Sync no se registró y B–F siguen abiertos.

**Siguiente exacto:** B — probar sesión A→B, cierre/reapertura y desbloqueo offline con cola
pendiente; sustituir el negocio `local` y definir su migración sin apropiación silenciosa de datos.
Investigar renovación/reingreso; si requiere un flujo nuevo, acordarlo y actualizar `002` primero.

### Sesión 10 (02/11/2026) — primer asiento experimental

`0003_sync_movimiento.sql` agrega un libro de movimientos con RLS; el repositorio experimental
valida e inserta el movimiento y su evento en la misma transacción. La integración PostgreSQL 16
verifica reintentos, colisión de ID, rechazo de datos inválidos, rollback y aislamiento con rol
restringido. No habilitar las rutas: faltan las otras entidades, LWW, integración del cliente,
permisos de producción y reconciliar eventos ya registrados antes de esta migración. La prueba
usa un clúster desechable local; no se ha probado en dispositivos ni en campo.

### Sesión 9 (02/11/2026) — bitácora experimental de sync

**Cambios:** ediciones de producto conservan sus campos modificados y una marca monotónica por
dispositivo; servicio y rutas HTTP experimentales, repositorios de prueba en memoria y bitácora
PostgreSQL con transacción y RLS. **No registrado en producción:** el repositorio solo guarda
operaciones, no materializa entidades; faltan integración con cliente, LWW, auth y RLS completas.
**Pruebas:** 164 regulares, 31 e2e y 1 integración adicional con PostgreSQL 16.15 temporal y rol
restringido (negocios A/B con datos, escrituras cruzadas denegadas, concurrencia e idempotencia).
Tipos, lint y build correctos; tamaño **115 689 B gzip**. Se añadió un job de PostgreSQL 16 en CI
para ejecutar la prueba automáticamente; la configuración aún no se ha ejecutado en GitHub.
Ver `apps/api/src/sync/repoPostgres.test.ts`.

### Sesión 8 (02/11/2026) — preparación de sincronización

**Cambios:** la outbox conserva confirmaciones y backoff al reencolar y rechaza colisiones entre
negocios o contenidos; lógica pura LWW por campo con pruebas de convergencia y desempate. Se corrigió
el mensaje de cierre de sesión. **Pendiente:** integrar LWW, push/pull y RLS; esta sesión no implementa
el servidor de sincronización. **Pruebas:** 156 unitarias, tipos, lint, build y 115 564 B gzip.

### Sesión 7 (02/11/2026) — integridad de respaldo y dinero

**Cambios:** backup transaccional incluye conteos y admite JSON v1 anterior; restore recupera cambios
en semillas intactas, conserva ediciones del destino y rechaza colisiones. CSV valida centavos exactos;
diálogo accesible por desplazamiento en pantalla baja. **Pendiente:** outbox de restore, sync y zoom manual.
**Pruebas:** 150 unitarias; Chromium y PWA probados; build, tipos, lint y presupuesto 115 436 B gzip.
La corrida conjunta e2e tuvo un timeout del service worker mientras se compilaba en paralelo; 30 pruebas
pasaron en esa corrida y las 2 de PWA pasaron al repetirlas aisladamente. Para S4, este entorno no tiene
plugin Docker Compose ni servidor PostgreSQL local; `docker info` confirmó que el daemon no está activo.

### Sesión 6 (02/11/2026) — revisión de documentación y plan

**Objetivo:** contrastar estado y planificación con el código y la auditoría de los últimos cinco commits.
**Cambios:** se registran defectos reproducidos de respaldo y dinero, riesgos pendientes y prioridades;
se distinguen el roadmap original y los sprints vigentes, y se aclaran las limitaciones de infraestructura.
**Evidencia previa:** typecheck y 145 pruebas en verde; tres reproducciones fallaron como se esperaba.
La suite e2e y el build indicados arriba son resultados históricos, no ejecutados en esta revisión documental.
**Siguiente:** resolver `006` §3 y continuar con S4/S5.

### Sesión 5 (18/10/2026) — cierre de M3: Inicio, reportes, import/restore y empleados

**Objetivo:** cerrar los huecos locales de M3 y la invitación desde la UI.

**Cambios:**

- **Inicio real + Reportes (C11):** `datos/reportes.ts`; “lo que falta”, fiado, movimientos, conteo
  en curso; valor de inventario, top por rango y resumen de fiados. 9 tests web + 3 e2e.
- **Import/restore (C10.2/C10.3):** `datos/importar.ts` (JSON con merge idempotente + CSV con
  plantilla) y UI con vista previa/confirmación. 11 tests web + 4 e2e.
- **Empleados:** la dueña genera el código de invitación desde `/mas/empleados` (rol empleado y
  sin sesión tienen estados claros). 3 e2e.
- **Documentación:** M3 cerrado; siguientes son S4/S5 (sync + RLS + LWW) y backups.

**Verificación:** lint ✅ · typecheck ✅ · **145 tests** ✅ (88 core + 43 web + 14 api) · **30 e2e** ✅ ·
build ✅ · `pnpm size` **114 828 B gzip** ✅ · QA diseño 13/60/0 ✅ · contraste 60/60 ✅.

**Siguiente:** S4 — sync push/pull + RLS real + `negocioId` desde la sesión.

### Sesión 4 (18/10/2026) — M3: fiados + PWA + export

**Objetivo:** avanzar M3 en paralelo sin tocar sync/DB.

**Cambios:**

- **C6 fiados:** orden de libreta por saldo/antigüedad, `obtenerCliente`/`listarFiados`; adapter web,
  `/fiados`, `/fiados/nuevo`, detalle con cargos/abonos y compartir local. 3 tests core + 3 web + 2 e2e.
- **C9 PWA:** Workbox/`vite-plugin-pwa`, manifest + iconos, recarga offline y aviso de nueva versión;
  2 e2e contra `vite preview`.
- **C10 export:** CSV de productos/movimientos/fiados + respaldo JSON, descarga local; 4 tests web + 2 e2e.
- **UI:** cierre de sesión en «Más»; `/mas/respaldo` real. Docs al día.

**Verificación:** lint ✅ · typecheck ✅ · **125 tests** ✅ (88 core + 23 web + 14 api) · **20 e2e** ✅ ·
build ✅ · `pnpm size` **105 608 B gzip** ✅ · QA diseño 13/60/0 ✅ · contraste 60/60 ✅.

**Siguiente:** S4 (sync + RLS) y resto de M3 (reportes, import/restore, Inicio).

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
