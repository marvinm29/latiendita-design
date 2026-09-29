# 003 · Plan técnico v1 — LaTiendita

> Artefacto SDD. Insumos: `002-especificacion-funcional.md` (C1–C11, personas, NFRs), decisiones
> D1–D14 (`000`/`001`), S1–S8 (`specs/README.md`), sistema de diseño (`design/DESIGN.md`,
> `design/tokens/`, `design/ACCESSIBILITY.md`).
>
> Estado: **borrador para revisión del dueño**. Regla del proyecto: si algo contradice el spec, se
> cambia el spec primero y el diseño después. Este plan **no reabre** lo ya decidido (§1).

---

## 0. Cómo leer este documento

| Si buscas… | Ve a |
|---|---|
| Qué stack se eligió y por qué | §2 |
| Cómo se ve el sistema completo | §3 |
| Tablas y modelo de datos | §4 |
| Cómo funciona el offline y la sincronización | §5 |
| Escaneo, seguridad, rendimiento, PWA | §6–§9 |
| Cómo se prueba todo (y cómo se verifica cada NFR) | §10 |
| Trazabilidad capacidad → módulo → prueba | §11 |
| Instalación de Carlos y operación | §12 |
| Hitos, riesgos y decisiones abiertas | §13–§15 |

Las decisiones técnicas llevan numeración **T-nn** (independiente de D-nn del producto y DS-nn de
diseño). Cada T-nn sigue el formato contexto → decisión → alternativas → consecuencia.

---

## 1. Reglas no reabiertas (insumos vinculantes)

Estas decisiones ya están cerradas y este plan las asume como restricciones, no como opciones:

- **S1 / D1** — PWA mobile-first, **offline-first** con almacenamiento local. Salida de emergencia:
  Capacitor → APK (D14), sólo si la demanda lo pide.
- **D2** — Escaneo: `BarcodeDetector` con fallback **ZXing/WASM**; entrada manual siempre disponible.
- **D3 / P4** — Open Food Facts como **acelerador, no dependencia** (manual-first si no hay datos ni red).
- **D4 / C7** — Multiempleado **gratis**; roles `dueña` / `empleado`; P2 propone **código de invitación + PIN**.
- **D5 / C4** — **Libro de movimientos inmutable** como fuente de verdad del stock.
- **D6 / C2.3** — Conversión de unidades / fraccionado como requisito de primera clase.
- **D7** — Instalación `docker-compose` de **1 comando** + demo sembrada + **≤5 variables de entorno**.
- **D8** — **Sin POS ni DTE**. **D10** — Fiados completo en v1. **D12** — WhatsApp es v2 (aquí sólo
  “compartir texto generado localmente”, C6.5).
- **D9 / S7** — **Español primero**, i18n desde el día 1, moneda USD.
- **C8** — Todo C2–C6 funciona offline; outbox con reintentos; sync incremental; **LWW por campo** para
  datos mutables y **el historial nunca pierde un movimiento**.
- **C9** — PWA instalable, fullscreen, HTTPS obligatorio, aviso de actualización no intrusivo.
- **Spec 005** — presupuesto `JS inicial ≤150KB gzip`, `TTI ≤3s` en Moto G4 (CPU 4x), sin blur/sombras
  pesadas; tokens DTCG + `DESIGN.md` como base de UI; copy en español llano.
- **A11y** — `design/ACCESSIBILITY.md` (WCAG 2.2 AA) es contrato de implementación, no sugerencia.

> **Licencia (P1) sigue abierta.** El plan es compatible tanto con MIT como con AGPL-3.0; si se elige
> AGPL-3.0, se añade `LICENSE` y cabeceras SPDX (ver T-21).

---

## 2. Stack final (decisiones T-01…T-08)

### T-01 · Monorepo TypeScript, un solo lenguaje de punta a punta
**Decisión:** monorepo con **TypeScript** en cliente y servidor, gestionado con **pnpm workspaces**.
Lógica de dominio compartida en un paquete puro (`packages/core`).
**Alternativas:** JS sin tipos (más rápido de empezar, más frágil en sync/dinero); Python/Go en el
servidor (segundo lenguaje, duplica modelos).
**Consecuencia:** un solo modelo de tipos para producto/movimiento/fiado/sync, compartido entre la app
offline y la API; menos divergencia de bugs. Coste: toolchain de builds por workspace.

### T-02 · Cliente: **Preact + TypeScript + Vite**, CSS compilado (sin Tailwind en runtime)
**Decisión:** **Preact** (API tipo React, ~4KB gzip) con `@preact/signals` para estado; **Vite** para
build; utilidades de layout con **Tailwind v3 en tiempo de build** (CSS estático, jamás el runtime/CDN
use que usan los mockups); los componentes consumen **sólo `tokens.css` + clases de `ui.css`**
(portadas desde `design/`). Router mínimo propio (son ~13 rutas).
**Alternativas:** React 18 (~45KB gzip; cómodo por shadcn pero innecesario para 13 pantallas); Svelte
(excelente tamaño, pero shadcn/Radix está pensado en React y ya definimos nuestras clases); vanilla
Web Components (mínimo, pero más trabajo de estado).
**Consecuencia:** holgura clara bajo el presupuesto de 150KB (§8). `shadcn/ui` se mantiene como
**referencia de patrones**, no como dependencia.

### T-03 · Almacenamiento local: **IndexedDB con Dexie**, repos tipados, `navigator.storage.persist()`
**Decisión:** IndexedDB vía **Dexie** (~25KB gzip) con una capa de repositorios tipados
(`packages/core/db`). Se solicita almacenamiento persistente al primer arranque.
**Alternativas:** `idb` (~1KB, más manual); OPFS/SQLite-wasm (potente pero pesado y con soporte
desigual en iOS); localStorage (insuficiente y síncrono).
**Consecuencia:** consultas e índices por `negocio_id`, `server_seq`, `codigo_barras`, y transacciones
atómicas para escribir-libro + encolar-op. Coste: ~25KB, dentro del presupuesto.

### T-04 · Servidor: **Fastify + TypeScript** sobre **PostgreSQL 16** con **RLS**
**Decisión:** API delgada en **Fastify** (validación con **Zod**), acceso a datos con **Drizzle ORM** +
`drizzle-kit` para migraciones. **PostgreSQL con Row-Level Security** por `negocio_id` como frontera de
aislamiento (C7.2). Cada request fija `SET LOCAL app.negocio_id` dentro de la transacción.
**Alternativas:** Supabase (**misma idea** de Postgres+RLS, pero menos control del protocolo de sync e
introduce dependencia de servicio); Hasura (menos control de la lógica de sync/idempotencia); un
framework pesado (Nest, etc.) innecesario para el tamaño.
**Consecuencia:** control total del sync incremental e idempotencia; el aislamiento vive en la base
(mínimo privilegio), no sólo en el código. RLS se prueba explícitamente (§10).

### T-05 · Autenticación: **código de invitación + PIN** (P2), sesión con token rotativo
**Decisión:** dueña crea negocio → `dueña`. Para invitar: código de un solo uso (base32, 8 caracteres,
hash en base, expira 7 días, límite de intentos). El empleado ingresa el código **con internet** (DS-25),
define su **PIN**; el servidor emite una **sesión** (token opaco, rotación, ligado al dispositivo).
Después del primer ingreso, el **desbloqueo offline** verifica el PIN localmente.
**Alternativas:** email+password (fricción y dato personal que el segmento no tiene); OAuth (aún peor).
**Consecuencia:** cero cuentas de correo; multiempleado gratis (D4). **Trade-off explícito:** el
verificador de PIN local es un candado de conveniencia, no una frontera fuerte — los datos ya viven en
el teléfono; el modelo de amenaza se documenta en §7.

### T-06 · Escaneo: **BarcodeDetector → ZXing-wasm perezoso → teclado numérico**
**Decisión:** usar `BarcodeDetector` si existe (Chrome/Android); si no, **cargar ZXing-wasm sólo bajo
demanda** (code-split); la entrada manual con teclado numérico está siempre en pantalla (C3.2). Formatos:
EAN-13, EAN-8, UPC-A, Code128. Linterna vía `MediaStreamTrack` `torch` cuando el equipo lo soporta.
**Consecuencia:** el peso del fallback no entra al bundle inicial (§8).

### T-07 · PWA: **Workbox** para service worker + manifest + flujo de actualización
**Decisión:** precache del app-shell con Workbox; estrategia *cache-first* para estáticos y *network*
para el sync; **no** se depende de `Background Sync` (soporte irregular); la app reintenta el outbox al
recuperar foco/conexión. Actualización: detectar SW nuevo y mostrar **“hay una nueva versión — reiniciar”**
(C9.2), nunca recargar a la fuerza.
**Consecuencia:** funciona instalable y en fullscreen (C9.1) con control del momento de actualizar.

### T-08 · Contenedores: **docker-compose** (api + db + Caddy) con **5 variables** y demo sembrada
**Decisión:** `docker compose up` levanta **API + Postgres + Caddy** (TLS automático de Let's Encrypt).
Variables: `DOMAIN`, `POSTGRES_PASSWORD`, `SESSION_SECRET`, `DEMO_SEED`, `BACKUP_CRON`. Un comando aplica
migraciones y, si `DEMO_SEED=true`, siembra la tienda de demostración (D7).
**Consecuencia:** instalación de Carlos ≤15 min (métrica 4, §13).

---

## 3. Arquitectura

```
┌──────────────────────────── PWA (Preact, offline-first) ────────────────────────────┐
│  UI (tokens.css + ui.css)  ·  señales (@preact/signals)  ·  router mínimo            │
│  ┌───────────────┐   ┌────────────────┐   ┌────────────────────────────────────┐    │
│  │ Índice local  │   │  Libro local   │   │  OUTBOX (ops pendientes)           │    │
│  │ (productos,   │   │ (movimientos,  │   │  {op_id, entidad, payload, ts,     │    │
│  │  clientes…)   │   │  fiados)       │   │   intentos}  → reintentos/backoff  │    │
│  └──────┬────────┘   └───────┬────────┘   └───────────────┬────────────────────┘    │
│         │  Dexie / IndexedDB │                            │                        │
│         └─────────── dominio puro (packages/core) ────────┘                        │
│   Service Worker (Workbox) · manifest · scanner (BD → ZXing lazy) · export CSV/JSON │
└───────────────────────────────────────────┬─────────────────────────────────────────┘
                                             │ HTTPS (Caddy, TLS) · JSON
                        ┌────────────────────▼─────────────────────┐
                        │  API Fastify (Zod)  ·  auth  ·  /sync     │
                        └────────────────────┬─────────────────────┘
                                             │ SET LOCAL app.negocio_id
                        ┌────────────────────▼─────────────────────┐
                        │  PostgreSQL 16  ·  RLS por negocio_id     │
                        │  ledger append-only · tombstones · seq    │
                        └───────────────────────────────────────────┘
```

**Flujo de escritura (siempre igual, con o sin red):** la UI calcula el efecto con `packages/core`
(saldo, stock, conversión de unidades) → escribe en IndexedDB (libro/índice) y encola una op en el
**outbox** en la **misma transacción** → la pantalla muestra el resultado al instante. Si hay red, un
worker empuja el outbox; si no, el banner “Sin conexión…” y el badge “por sincronizar” (C8.2).

**Flujo de lectura:** siempre desde IndexedDB (nunca se bloquea por red). El pull incremental trae
cambios del servidor por `server_seq` y los aplica.

---

## 4. Modelo de datos

### 4.1 Convenciones

- **IDs:** **UUIDv7** generados en el cliente (ordenables por tiempo) → permite crear offline sin
  colisiones y ordenar el libro sin depender del reloj del servidor.
- **Dinero:** entero `monto_centavos bigint` en **USD**. Nunca `float` (C6, C11).
- **Cantidades:** `numeric(12,3)` (soporta granel: 0.5 lb) + `unidad_id` + `cantidad_base` normalizada.
- **Inmutabilidad:** `movimiento` y `fiado` son **append-only** (sin `UPDATE`/`DELETE`); corregir =
  insertar el inverso con `corrige_a`.
- **Borrado lógico:** `deleted_at` (tombstone) en entidades mutables; el historial sobrevive (C2.5).
- **Sync:** toda fila mutable lleva `updated_at` (cliente) + `rev` (servidor) + `server_seq` (orden de
  pull); el ledger lleva sólo `server_seq`.
- **Multi-negocio:** **toda** tabla de negocio lleva `negocio_id` y política RLS.

### 4.2 Tablas principales (esquema lógico)

| Tabla | Campos clave | Naturaleza |
|---|---|---|
| `negocio` | `id`, `nombre`, `moneda='USD'`, `created_at`, `deleted_at`, `server_seq` | mutable |
| `usuario` | `id`, `nombre`, `pin_hash` (argon2id), `created_at`, `deleted_at` | mutable |
| `membresia` | `id`, `negocio_id`, `usuario_id`, `rol` (`dueña`\|`empleado`), `deleted_at` | mutable |
| `invitacion` | `id`, `negocio_id`, `codigo_hash`, `expira_at`, `usada_at`, `created_by` | inmutable (se marca usada) |
| `categoria` | `id`, `negocio_id`, `nombre`, `deleted_at` | mutable |
| `producto` | `id`, `negocio_id`, `nombre`, `codigo_barras` (null), `precio_centavos`, `costo_centavos` (null), `stock_minimo`, `base_unidad`, `categoria_id` (null), `foto_path` (null), `updated_at`, `deleted_at` | mutable (LWW por campo) |
| `unidad_venta` | `id`, `producto_id`, `nombre`, `factor`, `es_base` | mutable |
| `movimiento` | `id`, `negocio_id`, `producto_id`, `tipo` (`entrada`\|`salida`\|`ajuste`), `cantidad`, `unidad_id`, `cantidad_base`, `nota`, `usuario_id`, `ocurrido_at`, `corrige_a` (null) | **append-only** |
| `conteo` | `id`, `negocio_id`, `iniciado_por`, `estado`, `created_at`, `cerrado_at` | mutable |
| `conteo_item` | `conteo_id`, `producto_id`, `contado`, `sistema`, `diferencia` | inmutable |
| `cliente` | `id`, `negocio_id`, `nombre`, `telefono` (null), `limite_centavos` (null, P5), `updated_at`, `deleted_at` | mutable (LWW por campo) |
| `fiado` | `id`, `negocio_id`, `cliente_id`, `tipo` (`cargo`\|`abono`), `monto_centavos`, `nota`, `usuario_id`, `ocurrido_at`, `corrige_a` (null) | **append-only** |
| `op_log` | `negocio_id`, `op_id` (unique), `resultado`, `server_seq`, `created_at` | idempotencia de push |

**Derivados (no se almacenan como verdad, se cachean):**

- `stock(producto) = Σ cantidad_base` de sus movimientos (entrada +, salida −, ajuste ±).
- `saldo(cliente) = Σ monto` de cargos − abonos.
- Valor de inventario = Σ `stock × costo_centavos` y Σ `stock × precio_centavos` (C11.1).

> El stock y el saldo **siempre** se pueden recalcular desde el libro; la caché local es sólo velocidad
> (C4.3). Un test de propiedad verifica que caché == derivado tras cualquier secuencia de operaciones.

### 4.3 Índices e integridad

- `producto(negocio_id, codigo_barras)` único cuando `codigo_barras is not null and deleted_at is null`.
- `movimiento(negocio_id, producto_id, ocurrido_at)`, `(negocio_id, server_seq)`.
- `fiado(negocio_id, cliente_id, ocurrido_at)`, `(negocio_id, server_seq)`.
- `op_log(op_id)` **unique** (idempotencia).
- Checks: `monto_centavos > 0`, `cantidad_base > 0` (salvo ajustes negativos → se modelan con signo en
  `cantidad_base`), `factor > 0`.

---

## 5. Offline-first y sincronización (el corazón del sistema)

### 5.1 Outbox e idempotencia

Cada operación de dominio (alta/edición de producto, movimiento, fiado, conteo) produce una **op** con
`op_id` (UUIDv7). Al empujar, el servidor la registra en `op_log`; si el `op_id` ya existe, devuelve el
resultado anterior **sin volver a aplicar** → reintentos seguros (C8.3, C8.4).

### 5.2 Push

`POST /sync/push` recibe un lote. En una transacción por op:
1. Inserta en `op_log` (o recupera el resultado si ya existía).
2. Aplica la op: **ledger** → `INSERT` (nunca update); **mutable** → *upsert* con **LWW por campo** (§5.4).
3. Asigna `server_seq` (secuencia por negocio) y `server_time`.
4. Devuelve `{op_id, estado, server_seq, rev}`.

### 5.3 Pull

`GET /sync/pull?since=<server_seq>` devuelve, en páginas, todas las filas con `server_seq > since` de
todas las tablas del negocio (incluidas tumbas). El cliente las aplica y avanza su cursor. La
**secuencia de servidor** ordena los cambios aunque los relojes de los dispositivos estén desfasados.

### 5.4 Conflictos: **LWW por campo** + libro que conserva todo

- **Datos mutables** (producto, cliente, categorías): el cliente envía **sólo los campos cambiados** con
  su `updated_at`. El servidor fusiona **campo por campo**: gana el mayor `(updated_at, device_id)`
  (desempate determinista). `producto`/`cliente` guardan un `field_meta` (jsonb) con el sello por campo.
- **Ledger** (`movimiento`, `fiado`, `conteo_item`): append-only; **ambos registros sobreviven** —
  nunca se pierde un movimiento (C8.4). La corrección es un movimiento inverso visible.
- **Descartes de reloj:** si el `updated_at` del cliente difiere mucho del `server_time`, se registra
  una bandera para soporte; no rompe la convergencia porque el orden de pull usa `server_seq`.

### 5.5 Reintentos, conectividad y confirmación

- Detección de red con `navigator.onLine` + el resultado real del request (no se confía sólo en el flag).
- Backoff exponencial con jitter; reintento al recuperar foco, al volver `online` y periódicamente.
- Al reconectar: se drena el outbox → se hace pull → se confirma (“todo sincronizado”) y el badge
  “por sincronizar” desaparece (C8.2). El banner de offline es **siempre visible** mientras dure.

### 5.6 Reinstalación (C8.5)

Borrar la app no pierde datos: el servidor conserva todo y, al reinstalar, el dispositivo descarga su
copia (pull completo desde `server_seq=0`). Por eso el **login inicial requiere conexión**; después, el
trabajo es local.

### 5.7 Estados del sincronizador (para diseño y pruebas)

`inactivo` → `pendiente(n)` → `enviando` → `recibiendo` → `confirmado` · `error(reintentando)` ·
`bloqueado(conflicto)` → `offline`. La UI mapea estos estados al banner y al badge (ya diseñados en
`design/`), sin inventar nuevos.

---

## 6. Escaneo, unidades y Open Food Facts

- **Pipeline:** cámara → `BarcodeDetector` (si existe) → si no, `import('zxing-wasm')` perezoso →
  normalizar (EAN-13/EAN-8/UPC-A/Code128, validar dígito) → buscar en índice local →
  conocido: abrir producto; desconocido: ofrecer crear con el código (C3.3).
- **Entrada manual** con teclado numérico siempre disponible (C3.2); nunca se bloquea por permisos de
  cámara (se explica y se ofrece teclado).
- **Conversión de unidades (D6/C2.3):** `cantidad_base = cantidad × factor(unidad)`. Entradas, salidas y
  conteos se pueden expresar en cualquier unidad del producto; el libro guarda la base y la unidad
  declarada para reconstruir la historia.
- **Open Food Facts (D3/P4):** consulta **a través del servidor** (evita CORS y permite caché propia);
  resultado se cachea localmente por código. Si no hay red ni caché, el formulario abre con el código y
  el usuario escribe nombre/precio (**manual-first**, sin bloquear). OFF **nunca** es dependencia dura.

---

## 7. Seguridad, privacidad y modelo de amenaza

- **Transporte:** HTTPS obligatorio (Caddy + Let's Encrypt), HSTS, redirección de HTTP.
- **Aislamiento:** **RLS** por `negocio_id` en todas las tablas; el token de sesión lleva
  `negocio_id` + `rol`, y la API verifica rol por endpoint (dueña vs empleado). RLS se prueba con dos
  negocios y se verifica que A jamás lee B (C7.2).
- **Credenciales:** PIN con **argon2id** en servidor; `invitacion.codigo_hash` (no el código en claro),
  un solo uso, expira, y **límite de intentos** por IP + por código (frena fuerza bruta).
- **Sesión:** token opaco firmado, rotación, almacenado en IndexedDB (no en `localStorage`), con
  expiración y revocación al cambiar/borrar membresía.
- **Cliente sin secretos:** ninguna credencial de base ni de servicio vive en el cliente; OFF se proxya.
- **CSP:** `default-src 'self'`, sin scripts inline (build de Vite), `frame-ancestors 'none'`,
  sin terceros.
- **Privacidad:** **cero telemetría por defecto** (opt-in explícito) (NFR); exportar/borrar = del negocio;
  la dueña puede cerrar el negocio y llevarse sus datos (C10.2).
- **Modelo de amenaza (resumen):**

| Escenario | Mitigación | Límite aceptado |
|---|---|---|
| Teléfono perdido/robado | PIN + expiración de sesión + revocación | Datos locales del propio negocio son accesibles con PIN; sin PIN, IndexedDB sigue cifrado por el SO si el dispositivo tiene bloqueo |
| Fuerza bruta de códigos de invitación | Código base32 8 chars, un uso, expira, rate-limit | — |
| Empleado curioso / cambio de rol | RLS + verificación de rol en API | `empleado` puede operar por diseño (C7.1) |
| XSS / terceros | CSP estricta, sin inline, sin terceros | — |

---

## 8. Rendimiento (presupuesto verificable)

Presupuesto del spec: **JS inicial ≤150KB gzip**, **TTI ≤3s** en Moto G4 (CPU 4x), **interacciones
<200ms**. Objetivos por pieza (gzip):

| Pieza | Objetivo | Nota |
|---|---|---|
| Preact + signals + router | ≤12KB | framework |
| App inicial (Inicio + shell + tokens CSS) | ≤60KB | ruta inicial |
| Dexie + core (dominio/db) | ≤35KB | núcleo offline |
| Escáner (chunk perezoso) | ≤25KB + ZXing-wasm aparte | sólo si falta BarcodeDetector |
| Reportes/export (chunk perezoso) | ≤15KB | bajo demanda |
| **Total inicial** | **≤150KB** | gate de CI con `size-limit` |

Medidas: code-splitting por ruta/feature; **sin Tailwind en runtime** (CSS estático); fuentes
auto-hospedadas subseteadas (latin + latin-ext, `font-display: swap`); sprite de iconos inline; imágenes
de producto redimensionadas en el cliente antes de guardar; sin CSS-in-JS. Verificación: **Lighthouse CI**
en emulación Moto G4 + `size-limit` como gate obligatorio.

---

## 9. PWA, i18n y accesibilidad

- **PWA (C9):** manifest (nombre, iconos, `display: standalone`, tema claro/oscuro), Workbox para
  app-shell, flujo de actualización con aviso (T-07). Casos iOS 16+: sin `beforeinstallprompt`
  (instrucción “Añadir a pantalla de inicio”), almacenamiento más agresivo → se pide persistencia y se
  advierte en la UI.
- **i18n (D9/S7):** catálogo de mensajes desde el día 1 (`es-SV` por defecto), sin strings en el código;
  formatos de moneda USD (`$5.00`) y números centralizados; lenguaje llano salteño (“entradas”,
  “fiados”, “abono”).
- **A11y:** `design/ACCESSIBILITY.md` (WCAG 2.2 AA) se implementa con los tokens y clases ya diseñados:
  foco 2px+2px, targets ≥48px, `role`/`aria-*` en componentes, banner y estados con `role="status"`.
  Gate: **axe** en cada pantalla (Playwright) + checklist manual pendiente (§10.5).

---

## 10. Estrategia de pruebas (cada NFR → una prueba)

### 10.1 Unitarias (Vitest, `packages/core`)
Stock derivado del libro; saldo de fiados; conversión de unidades (bulto↔unidad, libra); merge **LWW
por campo**; orden y reintento del outbox; idempotencia por `op_id`; **propiedad**: “caché == derivado”
tras secuencias aleatorias de operaciones.

### 10.2 Integración (API + Postgres, contenedor efímero)
**RLS**: negocio A no ve B (C7.2); authn/authz por rol; rate-limit de invitación; push idempotente
(repetir un lote no duplica); migraciones desde cero; pull incremental por `server_seq`.

### 10.3 E2E (Playwright)
Flujos **C1–C10** completos; **offline real** con `context.setOffline(true)`, reinicio del navegador y
sync al reconectar; **métrica 3**: 100 operaciones con cortes de red aleatorios → **0 movimientos
perdidos**; export CSV/JSON abrible; instalación PWA; aviso de actualización.
**a11y:** `@axe-core/playwright` en las 13 pantallas, sin violaciones AA.

### 10.4 Rendimiento
**Lighthouse CI** (Moto G4, CPU 4x): TTI ≤3s, presupuesto de bytes; `size-limit` de bundles; trazas de
interacción <200ms en las operaciones frecuentes.

### 10.5 Pruebas de campo (métricas de éxito, §6 del spec)
Primer conteo de ~200 productos ≤2h (métrica 1); alta escaneada ≤20s cronometrada (métrica 2);
instalación limpia por Carlos ≤15min (métrica 4); empleado nuevo opera sin capacitación (métrica 5);
**lector de pantalla real** y **zoom 200%** (`ACCESSIBILITY.md` §4).

### 10.6 Dispositivos y CI
Matriz: Android 8+ (Chrome/WebView), iOS 16+ (Safari), desktop. **GitHub Actions** como gate
obligatorio: lint + tipos + unit + integración + e2e (contenedor) + size-limit + Lighthouse + axe.

---

## 11. Trazabilidad: capacidad → módulo → prueba

| Capacidad | Módulo principal | Prueba clave |
|---|---|---|
| C1 negocio/cuentas | `api/auth`, `web/onboarding` | integración invitación+PIN; e2e C1 |
| C2 catálogo | `core/catalogo`, `web/productos` | unit conversión; e2e alta offline |
| C3 escaneo | `web/scanner` | e2e EAN-13/EAN-8/UPC-A/Code128 + manual |
| C4 movimientos | `core/libro` | unit stock derivado; e2e corrección inversa |
| C5 stock/conteo | `core/stock`, `web/conteo` | unit urgencia; e2e conteo→ajustes |
| C6 fiados | `core/fiados`, `web/fiados` | unit saldo; e2e cargo/abono offline; compartir (local) |
| C7 roles | `api/rls`, `bd` | integración aislamiento A/B; matriz de permisos |
| C8 offline/sync | `core/sync`, `web/outbox` | e2e 100 ops con cortes (métrica 3); unit LWW |
| C9 PWA | `web/sw`, manifest | e2e instalar/actualizar; Lighthouse |
| C10 respaldo/export | `web/datos`, `core/export` | e2e CSV/JSON + restore |
| C11 reportes | `core/reportes`, `web/reportes` | unit valor inventario; e2e rangos |

---

## 12. Instalación (Carlos) y operación

- **Instalar:** `git clone` → editar `.env` (≤5 variables) → `docker compose up -d`. Caddy obtiene TLS;
  las migraciones corren al arrancar; con `DEMO_SEED=true` queda una tienda de demostración con datos.
- **Actualizar:** `git pull && docker compose up -d --build`; la app avisa del SW nuevo (C9.2). Migraciones
  son aditivas y reversibles.
- **Respaldar:** `pg_dump` programado por `BACKUP_CRON` a un volumen; además, export/restore JSON desde
  la app (C10.2). Runbook de restauración documentado.
- **Observabilidad:** logs estructurados (pino), `/health`, métrica de cola de sync (pendientes por
  negocio) para soporte; errores opt-in.
- **Distribución:** self-host (foco) + free tiers documentados; APK (Capacitor, D14) sólo si se pide.

### 12.1 Estructura del repositorio de implementación (propuesta)

```
apps/
  web/        PWA (Preact + Vite + Workbox)   → usa packages/{tokens,ui,core}
  api/        Fastify + Drizzle + RLS
packages/
  tokens/     design/tokens (DTCG) — fuente única de color/tipografía
  ui/         componentes Preact sobre ui.css + tokens
  core/       dominio puro + repos Dexie + sync (compartible cliente/servidor)
infra/
  docker-compose.yml · Caddyfile · migrations · seed
```

---

## 13. Hitos (insumo para `004-roadmap.md`)

| Hito | Contenido | Criterio de salida |
|---|---|---|
| **M0 · Cimientos** | monorepo, tokens integrados, CI, esqueleto api/web, RLS base | pipeline verde; `size-limit` y Lighthouse configurados |
| **M1 · Núcleo offline** | catálogo, libro, stock, escaneo, conteo — **100% sin servidor** | e2e offline C2–C5; unit de dominio |
| **M2 · Cuentas y sync** | negocio, invitación+PIN, API+Postgres+RLS, outbox push/pull, LWW | métrica 3 (0 perdidos); aislamiento A/B |
| **M3 · Fiados, reportes, datos** | fiados, C11, export/respaldo/import, PWA install/update | e2e C6/C10/C11 + C9 |
| **M4 · Endurecimiento** | rendimiento, a11y, campo, demo docker, docs | métricas 1/2/4/5 + axe/manual a11y |

(El roadmap M0–M4 con fechas y responsables se cierra en `004`.)

---

## 14. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Presupuesto 150KB vs. escáner | TTI alto en gama baja | ZXing sólo perezoso; medir con `size-limit`; priorizar `BarcodeDetector` |
| Evicción de IndexedDB | pérdida de copia local | `storage.persist()` + servidor como respaldo (C8.5) + aviso en iOS |
| RLS mal aplicada | fuga entre negocios | RLS en la base + prueba de integración A/B obligatoria |
| Desfase de relojes | orden incorrecto | orden por `server_seq`; LWW desempata con `(updated_at, device_id)` |
| OFF caído/cambiante | autocompletado ausente | manual-first; caché propia; sin dependencia dura |
| iOS: cámara/PWA | escaneo/instalación limitados | instrucciones A2HS; teclado manual siempre; probar en iOS 16+ |
| PIN local | candado débil offline | documentado en el modelo de amenaza; sesión revocable en línea |
| Licencia sin cerrar (P1) | incompatibilidad | T-21: el código no depende de la licencia; se añade `LICENSE` al decidir |

---

## 15. Decisiones abiertas y dependencias

Técnicas (a resolver antes o durante M0–M2):

1. **T-21 · Licencia** — depende de P1 (MIT vs AGPL-3.0). Mientras: sin cabeceras SPDX, con `LICENSE`
   pendiente.
2. **T-22 · PIN offline** — confirmar parámetros de `argon2id` y política de intentos local.
3. **T-23 · Fotos de producto** — ¿volumen del servidor + ruta, o `bytea`? Decidir en M1; el cliente ya
   redimensiona antes de guardar.
4. **T-24 · Límite de fiado (P5)** — saldo informativo + límite opcional con advertencia, sin bloqueos
   duros (decisión funcional; el modelo ya reserva el campo).
5. **T-25 · Multi-negocio por dispositivo** — soportar más de un negocio en el mismo teléfono (¿cambiar
   de tienda?) — el modelo lo permite (`negocio_id` en todo); falta decidir la UX.
6. **P1–P5 del spec** — P1 (licencia) y P2 (login) impactan directo; P3 (una bodega) ya asumido; P4 (OFF)
   y P5 (límite de fiado) impactan módulos C2 y C6.

---

## 16. Fuentes

- WCAG 2.2 (W3C Rec.) — https://www.w3.org/TR/WCAG22/
- Barcode Detection API (MDN) — https://developer.mozilla.org/docs/Web/API/BarcodeDetector
- ZXing-wasm — https://github.com/Sec-ant/zxing-wasm
- Open Food Facts API — https://openfoodfacts.github.io/openfoodfacts-server/api/
- Preact — https://preactjs.com · @preact/signals — https://preactjs.com/guide/v10/signals
- Dexie — https://dexie.org · Workbox — https://developer.chrome.com/docs/workbox
- Fastify — https://fastify.dev · Drizzle ORM — https://orm.drizzle.team
- PostgreSQL Row Security — https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- JSON Web Token BCP — https://www.rfc-editor.org/rfc/rfc8725 · argon2id — https://www.rfc-editor.org/rfc/rfc9106
- RFC 9562 (UUIDv7) — https://www.rfc-editor.org/rfc/rfc9562
