# 006 · Plan de sprints — LaTiendita

> Artefacto SDD. Traduce los hitos M0–M4 de `004-roadmap.md` a **sprints de 1 semana**
> (cadencia de `004` §1), retomando desde el **estado real del repositorio** (M1 en curso),
> no desde el plan teórico. No reabre decisiones cerradas (`AGENTS.md` §3).
>
> Insumos: `004-roadmap.md` (§2 hitos, §3 detalle, §6 gates), `003-plan-tecnico.md`
> (stack/arquitectura/pruebas), `002-especificacion-funcional.md` (C1–C11, métricas §6).
>
> Estado: **borrador vivo**. Cada sprint se cierra con su *gate* (§5) y una demo. El plan se
> revisa al cerrar cada sprint; lo que cambie de alcance pasa primero por `002`.

---

## 0. Cómo leer este documento

| Si buscas… | Ve a |
|---|---|
| El calendario de sprints de un vistazo | §2 |
| De qué estado real se parte | §1 |
| El detalle del sprint en curso | §3 |
| Qué viene después | §4 |
| Los gates que no se negocian | §5 |

---

## 1. Punto de partida (estado verificado)

Comprobado en el repo a la fecha de este documento:

- `pnpm lint` ✅ (ESLint real) · `pnpm typecheck` ✅ · `pnpm test` ✅ **125 tests** (88 `packages/core` + 23 web + 14 api) · `pnpm test:e2e` ✅ **20 e2e** · `pnpm build` ✅ · `pnpm size` ✅ 105 608 B / 153 600 B.
- Bundle web: **~83 KB gzip** de JS inicial (presupuesto del spec: ≤150 KB, `003` §8).
- **M0 · Cimientos** ✅ (monorepo, CI, RLS base, docker-compose, **ESLint real** y **gate de tamaño real**; Lighthouse sigue pendiente).
- **M1 · Núcleo offline** ✅:
  - ✅ dominio puro + capa Dexie de core (esquema, `abrirDb`, repos tipados, transacción libro+outbox).
  - ✅ UI C2–C5 (catálogo, producto, movimiento, conteo, escáner) **toda sobre Dexie**: catálogo, libro y
    conteo comparten la base local (`datos/baseLocal.ts`); el libro es la única fuente de stock.
  - ✅ fallback **ZXing-wasm perezoso** (BarcodeDetector → ZXing → teclado manual).
  - ✅ **movimiento y conteo** sobre el repo Dexie (S1) + **4 tests de integración web**.
  - ✅ **e2e offline C2–C5** con Playwright `setOffline` + **axe AA** (S2) y **OFF** con proxy de servidor
    + caché local en IndexedDB (manual-first si no hay red).
- ✅ **C5 persistente (S2+)**: la sesión de conteo vive en `conteos`, se reanuda tras recarga y al
    cerrar aplica sus diferencias como ajustes en una sola transacción.
- ✅ **S3 (M2)**: cuentas y acceso — negocio, invitación de un solo uso, argon2id, sesión rotativa,
    desbloqueo offline por PIN. **P1** (AGPL-3.0) y **P2** (código+PIN) cerradas.
- **S4/S5** ⏳ pendientes: sync push/pull, RLS en uso, LWW y cierre de M2.
- **S6 ✅ (C6 fiados)** y **S7 parcial ✅ (C9 PWA + C10 export)**; faltan reportes, import/restore e Inicio.

Conclusión: M1 completo, S3 entregado y M3 parcial (fiados/PWA/export). Siguiente: **S4** (sync + RLS).

---

## 2. Sprints de un vistazo

| Sprint | Hito | Objetivo | Criterio de salida (resumen) |
|---|---|---|---|
| **S0** | M0 | Cimientos (hecho) | Pipeline verde; `docker compose up` levanta web+api+db |
| **S1** | M1 | **Persistencia real de movimiento y conteo** (UI → Dexie) | El libro en IndexedDB es la única fuente de stock; tests de integración web |
| **S2** | M1 | **Offline e2e C2–C5** + OFF + cierre de escáner | `context.setOffline(true)` recorre alta→movimiento→conteo→stock sin red |
| **S2+** | M1 | **C5 persistente** (trabajo no bloqueado por P1/P2) | Recargar no pierde el conteo; sesión cerrada + ajustes atómicos |
| **S3** | M2 | Cuentas: negocio, invitación+PIN, sesión, desbloqueo offline | Alta de negocio + invitación + operar offline tras login |
| **S4** | M2 | API sync: `/sync/push` (idempotente) + `/sync/pull` (server_seq) + RLS | Push repetido no duplica; A≠B aislado |
| **S5** | M2 | **LWW por campo**, outbox con backoff, banner/badge, reinstalación | **Métrica 3: 0 movimientos perdidos** con cortes aleatorios |
| **S6** | M3 | Fiados (C6) + reportes mínimos (C11) | e2e C6/C11; saldo derivado; estado de cuenta local |
| **S7** | M3 | Datos (C10 export/import/restore) + PWA install/update (C9) | Export abrible en Excel; restore probado; PWA instalable |
| **S8** | M4 | Rendimiento + accesibilidad (axe AA) + seguridad | TTI ≤3s Moto G4; axe sin violaciones AA; CSP/rate-limit |
| **S9** | M4 | Campo (métricas 1/2/4/5) + demo docker + docs → **v1.0** | Métricas de `002` §6 verificadas y registradas |

> Sprints S3+ dependen de **P2 (login)** e **P1 (licencia)**. Mientras no se cierren, S1–S2
> (M1) avanzan en paralelo y sin bloqueo, tal como prevé `004` §4.
>
> **Estado:** S0 ✅ · S1 ✅ · **S2 ✅** · **S2+ ✅** (conteo) · **S3 ✅** (acceso) · **S6 ✅** (fiados)
> · **S7 parcial ✅** (PWA + export) → **M1 cerrado; M2/M3 en curso**. Siguiente: **S4** (sync + RLS).

---

## 3. Sprint en curso — S1 · Persistencia real de movimiento y conteo

**Meta:** que el catálogo, el libro de movimientos y el conteo usen **una sola base local**
(IndexedDB vía `@latiendita/core`). Ninguna pantalla debe depender de un repo en memoria:
el **libro es la única fuente de stock** (C4.3) y toda escritura deja su op en la outbox (C8).

**Alcance (checklist):**

- [x] **Base local compartida** (`apps/web/src/datos/baseLocal.ts`): `negocioId`, `abrirDb()`,
      `crearRepos()` y la **siembra demo idempotente** en un solo lugar; expone `asegurarBaseLista()`.
- [x] `CatalogoRepoDexie` usa la base compartida (deja de duplicar `NEGOCIO_LOCAL` y la semilla).
- [x] **`MovimientosRepoDexie`** que implementa la interfaz actual de movimiento/conteo sobre
      `repos.movimientos.crearMovimientoConOp` (libro + outbox en una transacción) y `leerStockLocal`.
- [x] `Movimiento.tsx` y `Conteo.tsx` consumen el repo Dexie (mismo contrato, sin tocar su UI).
- [x] **Pruebas de integración web** (vitest + `fake-indexeddb`) para el adaptador: alta en el
      catálogo y movimiento comparten libro; stock derivado == caché; ajuste de conteo persiste.
- [x] Verificar el **fallback ZXing-wasm** (typecheck + build + chunk aparte) — chunk `camara-*.js`
      y `zxing_reader-*.wasm` separados del bundle inicial.

**Fuera de alcance de S1:** login (M2), OFF (S2), fiados UI (M3), e2e (S2).

**Gate de salida (definición de hecho, `004` §6):**

- `pnpm typecheck` ✅ · `pnpm test` ✅ (core **+ web**) · `pnpm build` ✅ · bundle ≤150 KB gzip.
- DoD por tarea (`004` §1): código + tipos + prueba + copy español llano + doc en el PR.
- No se commitea sin que el dueño lo pida.

---

## 4. Sprints siguientes (detalle)

### S2 · M1 · Offline e2e C2–C5 + OFF + cierre de escáner ✅

- ✅ **e2e Playwright** con `context.setOffline(true)`: alta → escaneo manual → movimiento → conteo →
  stock, **sin red** (`apps/web/e2e/offline-c2-c5.spec.ts`, 3 flujos). Incluye
  `@axe-core/playwright` sobre C2–C5 (`accesibilidad.spec.ts`, 4 pantallas, 0 violaciones AA) y
  2 e2e de OFF (`off.spec.ts`: autocompletado y manual-first sin red).
- ✅ **Open Food Facts vía API** con caché local: proxy `GET /off/:codigo` (TTL servidor 24 h/1 h) +
  caché en IndexedDB (30 días) y autocompletado del nombre al venir de `?codigo=`; sin red, el
  formulario sigue manual-first (D3/P4).
- 🟡 Formatos EAN-13/8, UPC-A, Code128 y linterna: cubiertos en `camara.ts`; **falta probarlos en
  dispositivos reales** (se cierra en campo, S9).
- ✅ **Gate:** e2e offline de C2–C5 verde (10/10 incl. conteo persistente) y axe AA sin violaciones;
  **M1 cerrado**. La métrica 2 (alta escaneada ≤20 s) se mide en campo (S9).

### S2+ · M1 · C5 · Sesión de conteo persistente ✅ (trabajo no bloqueado)

- ✅ `apps/web/src/datos/conteosRepo*.ts`: contrato y adaptador Dexie sobre `repos.conteo`.
- ✅ `Conteo.tsx` retoma la sesión abierta desde IndexedDB, registra cada captura y cierra con
  `cerrarConAjustes` (sesión + ajustes + ops en una transacción, C5.2/C8.4).
- ✅ Pruebas: 2 unitarias de core (ajustes y atomicidad), 2 de integración web y 1 e2e de recarga +
  sesión `cerrada` con diferencia.
- ✅ **Gate:** recargar `/conteo` no pierde lo contado; al terminar queda **una** sesión cerrada con
  `contado`/`sistema`/`diferencia` y el stock igual a lo contado.

### S3 · M2 · Cuentas y acceso ✅

- ✅ **API** (`apps/api/src/auth/`): `POST /auth/negocio`, `/auth/invitacion`, `/auth/unirse`,
  `GET /auth/yo`, `POST /auth/renovar|salir`. Código base32 de 8 chars, un solo uso, 7 días;
  argon2id para PIN; token opaco con hash SHA-256, expiración 30 días, rotación y revocación;
  rate-limit 5/10 min por IP y código. 14 tests.
- ✅ **Web** (`apps/web/src/paginas/auth/`): crear tienda, unirse con código, pantalla de bloqueo,
  desbloqueo **offline** con PBKDF2-SHA-256 local y cierre de sesión desde «Más». Sesión en IndexedDB
  (`sesion_local`, Dexie v2), nunca en `localStorage`. 5 tests + 4 e2e.
- ✅ **M0 endurecido:** ESLint real (`pnpm lint` ya no es alias) y `pnpm size` falla si JS+CSS supera
  150 KB gzip. Lighthouse CI sigue pendiente.
- ✅ **P1/P2:** AGPL-3.0 + código de un solo uso/PIN (issues #1/#2 cerradas).
- **Gate:** ✅ invitar ↔ unirse funciona (API con repo en memoria); ✅ la sesión sobrevive recarga;
  ✅ el PIN desbloquea sin red. **Pendiente honesto:** probar el adaptador Postgres/RLS contra una
  instancia real y mover la búsqueda de código/token a `SECURITY DEFINER` (S4).

### S4 · M2 · API y sincronización

- `/sync/push` idempotente por `op_id` (`op_log`) y `/sync/pull` por `server_seq` (T-04).
- Fastify + Drizzle + Postgres + **RLS por `negocio_id`**; matriz de permisos por rol (C7).
- **Gate:** repetir un lote no duplica; prueba de **aislamiento A/B**; migración aditiva.

### S5 · M2 · Convergencia y cierre de sync

- **LWW por campo** en `producto`/`cliente` (`field_meta` jsonb) y **ledger append-only** (C8.4).
- Outbox con backoff, reintento en foco/online, banner + badge “por sincronizar” (C8.2);
  reinstalación = pull completo (C8.5).
- **Gate:** **métrica 3 ≈ 100 operaciones con cortes aleatorios → 0 movimientos perdidos**; cierre de M2.

### S6 · M3 · Fiados y reportes 🟡 (fiados ✅)

- ✅ **Fiados (C6):** clientes, cargos/abonos inmutables, saldo derivado, orden por saldo/antigüedad,
  detalle en 2 toques y compartir estado de cuenta **generado localmente** (C6.5). 3 tests web +
  2 e2e (flujo + axe).
- ⏳ **Reportes mínimos (C11):** valor de inventario, “lo que más se movió” y resumen de fiados.
- **Gate parcial:** e2e C6 verde; falta C11.

### S7 · M3 · Datos y PWA 🟡 (PWA + export ✅)

- ✅ **Datos (C10.1/C10.2):** export CSV de productos/movimientos/fiados y respaldo JSON completo;
  4 tests web + 2 e2e (descarga real + axe).
- ✅ **PWA (C9):** Workbox, manifest, A2HS, recarga offline y aviso “hay una nueva versión — reiniciar”
  (T-07); 2 e2e contra `vite preview`.
- ⏳ Import/restore JSON y **importar CSV** con plantilla; backups del servidor (`pg_dump` + runbook).
- **Gate parcial:** export abrible en Excel ✅; PWA instalable/offline ✅; falta restore/import.

### S8 · M4 · Endurecimiento

- Rendimiento: presupuesto por pieza (`003` §8), interacciones <200 ms, TTI ≤3 s en Moto G4.
- Accesibilidad: `axe` sin violaciones AA + lector de pantalla real + zoom 200 %.
- Seguridad: CSP, rate-limits, revisión de RLS, pentest básico.
- **Gate:** budgets y a11y en verde en CI real (gate de tamaño ya activo; Lighthouse se activa aquí).

### S9 · M4 · Campo y v1.0

- Métricas 1, 2, 4, 5 medidas (`002` §6): conteo de ~200 productos en ≤2 h, alta ≤20 s,
  instalación limpia por Carlos ≤15 min, empleado nuevo opera sin capacitación.
- Demo docker con datos sembrados + videos cortos (D11) + FAQ.
- **Gate:** todas las métricas verificadas + gates en verde + **release `v1.0.0`** tageado.

---

## 5. Gates por sprint (heredados de `004` §6, no negociables)

| Gate | Herramienta | Umbral |
|---|---|---|
| Lint + tipos | `eslint .` + `tsc --noEmit` | 0 errores |
| Unit | Vitest (`packages/core` + `apps/web`) | 0 fallos; cobertura de dominio ≥90 % |
| Integración | contenedor efímero (desde S4) | 0 fallos; A≠B probado |
| e2e + offline | Playwright (`setOffline`) desde S2 | C1–C11 verde; métrica 3 = 0 perdidos |
| Accesibilidad | `@axe-core/playwright` desde S2 | 0 violaciones AA |
| Rendimiento | gate propio (`pnpm size`) + Lighthouse CI | JS+CSS ≤150 KB gzip (activo); TTI ≤3 s Moto G4 (Lighthouse pendiente) |
| Copy | revisión | español llano; sin tecnicismos ni emojis |

---

## 6. Riesgos y seguimiento

- **P1/P2 sin cerrar frenan S3+.** Mitigación: S1–S2 (M1) avanzan sin bloqueo; escalar la decisión.
- **Un solo maintainer.** Mitigación: gates automatizados, todo documentado en el repo (D11).
- **Alcance v2 que se cuela.** Mitigación: alcance v1 cerrado en `002` §3 (POS/DTE/voz/APK = fuera).
- **Seguimiento:** issues con `type:`/`area:`/`priority:`/`milestone:` (`004` §11); tablero por sprint.
- **Fuente de verdad:** `002` (qué) · `003` (cómo) · `004` (cuándo) · `006` (sprint en curso).

---

## 7. Referencias

- `004-roadmap.md` §2 (hitos), §3 (detalle), §4 (camino crítico), §6 (gates), §11 (seguimiento).
- `003-plan-tecnico.md` §3 (stack), §4 (modelo de datos), §5 (sync), §8 (rendimiento), §10 (pruebas).
- `002-especificacion-funcional.md` §3 (alcance), §5 (NFRs), §6 (métricas), §7 (P1–P5).
- `AGENTS.md` §2 (estado), §3 (decisiones cerradas), §6 (próximos pasos).
