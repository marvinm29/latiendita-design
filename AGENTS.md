# AGENTS.md — guía para retomar este repositorio

> Léelo primero en cualquier sesión nueva. Este archivo es el punto de entrada para agentes
> (opencode y similares) y para cualquier persona que retome el trabajo.

## 0. Qué es este repositorio

**LaTiendita** — PWA **offline-first** de **inventario + fiados** para tiendas de colonia de El Salvador.
Open source, sin costo, **español primero**. Usuarios: **Marta** (dueña, poca alfabetización digital,
Android gama baja), **José** (empleado), **Carlos** (instalador técnico).

Este repo contiene la **especificación (SDD)**, el **sistema de diseño** y los **mockups de pantalla**,
el **plan técnico + roadmap**, y el **monorepo de implementación** (M0 + M1 + cuentas, fiados, PWA y export).

- Repo: https://github.com/marvinm29/latiendita-design · rama `main`
- Directorio de trabajo: raíz del repo (`specs/`, `design/`, `apps/`, `packages/`, `infra/`)
- Idioma del proyecto: **español** (docs e interfaz). UI con **tú neutro** y lenguaje llano.
- Fuente de verdad: `specs/002-especificacion-funcional.md` (§3 alcance, §5 NFRs, §6 métricas, §7 P1–P5).
- **Contexto completo para agentes** (arquitectura, invariantes, trampas, protocolo y prompt):
  [`docs/TRASPASO.md`](docs/TRASPASO.md).

## 1. Orden de lectura (sesión nueva)

1. `docs/TRASPASO.md` — **contexto completo**: estado verificado, arquitectura, invariantes, trampas y protocolo de agentes.
2. `specs/README.md` — índice SDD y estado de la sesión.
3. `specs/002-especificacion-funcional.md` — **qué** se construye (C1–C11, personas, NFRs, métricas, P1–P5).
4. `specs/003-plan-tecnico.md` — **cómo** (stack T-01…T-08, offline/sync, modelo de datos, seguridad, pruebas).
5. `specs/004-roadmap.md` — **cuándo/quién** (M0–M4, gates, adopción D11).
6. `specs/006-plan-sprints.md` — **sprints de 1 semana** desde el estado real hasta v1.0 (S1–S9).
7. `design/DESIGN.md` — sistema de diseño completo (§0–§12).
8. `design/ACCESSIBILITY.md` — checklist WCAG 2.2 AA (contrato de implementación).
9. `design/decisions.md` — bitácora DS-01…DS-30 + ledger de verificación.

## 2. Estado actual

| Área | Estado |
|---|---|
| SDD (000–006) | ✅ completo |
| Diseño F1 fundaciones · F2 componentes · F3 pantallas (13) · F4 cierre WCAG | ✅ entregado |
| Plan técnico (`003`) | ✅ escrito — pendiente de revisión del dueño |
| Roadmap (`004`) | ✅ escrito — pendiente de revisión del dueño |
| Plan de sprints (`006`) | ✅ escrito — **M1 y S3 entregados; M2 en curso; M3 con sync y backup del servidor pendientes** |
| **M0 · Cimientos** | 🟡 scaffold monorepo + CI + RLS base + docker-compose + **ESLint real** + **gate de tamaño real**; Lighthouse y despliegue completo pendientes |
| **M1 · Núcleo offline** | ✅ dominio puro (64 tests) + capa Dexie (21 tests, libro+outbox+conteo) + **UI C2–C5 toda sobre Dexie** (catálogo, libro y conteo comparten base; escáner BarcodeDetector lazy → **ZXing-wasm perezoso** → teclado manual) + **conteo persistente y reanudable (C5.2)** + 11 tests web + **10 e2e offline C2–C5 + conteo persistente + axe AA** + **OFF** (proxy + caché local) |
| **M2 · Cuentas y sync** | 🟡 **S3 ✅ · A ✅ · B1 ✅ · B2a ✅** (auth/RLS PG16, aislamiento local y traslado explícito de heredados con respaldo) · **B parcial** (renovación/reingreso pendientes) · C/D sync pendientes |
| **M3 · Producto** | 🟡 fiados, PWA, import/export, reportes e Inicio implementados; restore local corregido; faltan integración con sync y backup del servidor |
| Licencia del proyecto | ✅ **AGPL-3.0** (P1 cerrada 18/10/2026): `LICENSE` + `"license": "AGPL-3.0-only"` en los paquetes. |

Números: 13 pantallas / 60 marcos a 360×640 · 60/60 pares de contraste AA · 42 iconos Lucide · **186 tests regulares** (96 core + 70 web + 20 api) + **2 integraciones PostgreSQL optativas** (9 casos auth + bitácora sync) + **33 e2e** · bundle **118 513 B gzip** / 153 600 B (total medido de JS+CSS, incluidos SW y Workbox).

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
- **Calidad:** aplicar de forma proporcionada las prácticas de [SWEBOK v4](https://www.computer.org/education/bodies-of-knowledge/software-engineering): requisitos verificables, diseño, pruebas de riesgos y regresiones, seguridad y mantenimiento; usar los gates existentes y evitar burocracia adicional.

## 4. Tareas abiertas (issues en GitHub)

1. ~~**P1 · Licencia**~~ — [#2](https://github.com/marvinm29/latiendita-design/issues/2) ✅ **AGPL-3.0** (cerrada 18/10/2026).
2. ~~**P2 · Login de empleados**~~ — [#1](https://github.com/marvinm29/latiendita-design/issues/1) ✅ **código de un solo uso + PIN** (cerrada 18/10/2026).
3. **DS-26** — [#3](https://github.com/marvinm29/latiendita-design/issues/3) aprobar pantalla Productos (enmienda spec `005` §4).
4. ~~**Tarjeta “sin mínimo”**~~ — [#4](https://github.com/marvinm29/latiendita-design/issues/4) ✅ **DS-31** (chip neutral, cerrada 18/10/2026).
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
pnpm --filter @latiendita/web test:e2e:install   # una vez: Chromium de Playwright
pnpm --filter @latiendita/web test:e2e           # e2e offline C2–C5 + axe AA
pnpm --filter @latiendita/api dev          # API en :3000 (health + /off/:codigo)
pnpm --filter @latiendita/web dev          # Vite en :5173
docker compose -f infra/docker-compose.yml up -d   # api + db; Caddy requiere --profile tls

gh issue list                              # decisiones abiertas DS-26/#5/…
```

Diseño: HTML/CSS/JS plano, **sin dependencias externas en runtime**. Implementación: pnpm workspaces.
No committear sin pedirlo explícitamente.

## 6. Plan de continuidad tras auditoría del 14/11/2026

**Objetivo:** cerrar M2 sin perder datos locales y después completar operación y validación de v1.
**Arquitectura:** conservar Preact/Dexie + Fastify/PostgreSQL 16; escrituras locales atómicas con
outbox, push idempotente, pull por secuencia, LWW por campo y libros append-only.
**Spec vinculante:** `specs/002-especificacion-funcional.md`; arquitectura en `003`, sprints en `006`.
Este plan ordena los pendientes existentes; no cambia alcance ni autoriza commit/push/despliegue.

### 6.1 Base auditada y límites de la evidencia

- Revisión: `f631449ff35f80eca2cbc3a6819eb2d7f40fde3f`; árbol limpio durante la auditoría.
  La edición posterior de este AGENTS.md contiene el plan de continuidad.
- Entorno: Node 26.11.1, pnpm 9.15.9. CI configura Node 22; no confundir ambos entornos.
- Pasaron tipos, lint, 164 pruebas (96 core + 48 web + 20 API), build, tamaño
  **115 689 / 153 600 B gzip**, contraste 60/60 y QA de diseño 13 pantallas/60 marcos/0 hallazgos.
- Pasaron **31 e2e en Chromium/PWA sin reintentos**. Tests y e2e necesitaron ejecución fuera del
  sandbox por restricciones de sockets. Esos bloqueos iniciales no fueron fallos del producto.
- **No se ejecutó PostgreSQL**: no había servidor local disponible ni daemon Docker activo.
  No se verificaron CI remoto, dispositivos reales, lector de pantalla, zoom manual ni campo.
- `apps/api/src/server.ts` no registra sync. `apps/api/src/sync/repoPostgres.ts` sólo materializa
  movimientos en tablas experimentales; no habilitar rutas sólo porque sus tests pasen.
- `apps/web/src/datos/baseLocal.ts` fija el negocio a `local`; la sesión no selecciona sus datos.
- Auth usa consultas con rol dueño y Compose conecta con el usuario de inicialización de PG.
  Los tests de auth usan memoria; los e2e de acceso simulan HTTP. No prueban RLS de producción.
- Corrección respecto a docs antiguas: **CSV sí encola operaciones** mediante
  `base.repos.productos.crear`; **restore JSON no encola**. El gate de tamaño incluye SW/Workbox.
- Estado: M1 funcional localmente; M0/M2/M3 parciales; M4 pendiente. No declarar v1 lista.

### 6.2 Método para sesiones con menor costo

Trabajar con un solo agente, un incremento por sesión, sin delegación automática. El modelo se
elige en la interfaz de la siguiente sesión; este archivo no lo cambia. No asumir equivalencia
de calidad ni tarifas entre modelos: la aceptación depende de las pruebas descritas aquí.
Si está disponible, usar `superpowers:executing-plans` para ejecución secuencial y
`verificar-latiendita` para gates; prevalecen las instrucciones y el alcance de esta sección.

1. Leer este plan, el traspaso y las secciones del spec que afecte el incremento. Inspeccionar
   los archivos indicados; evitar volver a auditar todo el repositorio o investigar otro stack.
2. Ejecutar `git status --short`, `pnpm typecheck` y `pnpm test`. Conservar cambios existentes.
   Si falla el entorno, distinguirlo del producto y pedir la escalación concreta si corresponde.
3. Tomar el primer incremento pendiente con sus dependencias satisfechas. Antes de editar,
   escribir una lista breve de archivos, comportamiento y pruebas; resolver contratos contra los
   tipos existentes, sin inventar una API paralela.
4. Para cada comportamiento nuevo, añadir una prueba de riesgo/regresión, confirmar que falla
   por la causa esperada, implementar y verificar. No sustituir PG o transporte real por mocks
   para dar por cerrado un criterio que exige integración.
5. Ejecutar gates afectados y los de cierre (§6.4). Marcar la casilla sólo con evidencia.
   Actualizar el registro §6.5 y los docs de estado indicados en `docs/TRASPASO.md` §10.4.
6. Detenerse al completar el incremento acordado; dejar el siguiente paso exacto. No repetir
   gates verdes sin cambios nuevos ni afirmar que una prueba omitida pasó.

### 6.3 Incrementos ordenados

#### A — Auth PostgreSQL y mínimo privilegio (primera sesión; C1/C7)

**Archivos:** `apps/api/src/auth/{repoPostgres,servicio,plugin,tipos}.ts`,
`apps/api/src/db/{client,schema}.ts`, `apps/api/src/migrations/`, `infra/docker-compose.yml`.
**Prueba nueva propuesta:** `apps/api/src/auth/repoPostgres.test.ts`.

- [x] Preparar PG16 desechable con conexión explícita; nunca usar una base de una tienda.
  Revisar el fixture de `sync/repoPostgres.test.ts` y reutilizar su estrategia de limpieza.
- [x] Probar migraciones reales desde base vacía, alta → invitación → unión → sesión → rotación
  → revocación y aislamiento A/B con filas de ambos negocios. Añadir canje concurrente:
  una invitación permite exactamente una incorporación.
- [x] Separar rol migrador/administrativo del rol de aplicación. Implementar las búsquedas
  previas de auth previstas en T-04/T-05 mediante funciones acotadas `SECURITY DEFINER`, con
  `search_path` fijo y permisos mínimos; revisar también las escrituras iniciales de negocio.
  Evitar conceder acceso general a tablas para hacer pasar el flujo.
- [x] Probar lectura y escritura cruzadas denegadas con el rol usado por la API, sin superusuario
  ni BYPASSRLS. Documentar cómo se provisiona el rol conservando el máximo de 5 variables externas.
- [x] **Salida:** auth real y aislamiento pasan en PG16; pruebas existentes verdes. Si no hay
  PG disponible, registrar bloqueo y no cerrar A. No habilitar sync todavía.

#### B — Negocio local vinculado a sesión y continuidad de acceso (depende de A; C1/C7/C8)

**Archivos:** `apps/web/src/datos/{baseLocal,sesionRepoDexie,authApi}.ts`, adaptadores Dexie
vecinos, `packages/core/src/db/`, tests `sesionRepo.test.ts`, `repos.test.ts` y e2e de acceso.

- [x] Probar cambio de sesión A → B, cierre/reapertura y desbloqueo offline: B no ve ni modifica
  filas, stock, conteos o cola de A; salir no borra operaciones pendientes.
- [x] B1: resolver el negocio desde `sesion_local` por operación, con contexto estable para
  catálogo/libros/conteos/fiados/reportes/import/export y suscripciones. Cuentas reales sin semillas.
  Stock y referencias de restore comprueban negocio; un PIN pendiente de A no desbloquea B.
- [x] Sustituir el contexto fijo `local` por repositorios del negocio activo y revisar claves e
  índices globales de IndexedDB. Definir una migración transaccional de datos heredados `local`:
  respaldar, preservar IDs/libros/cola, distinguir demo y datos reales y no asignarlos a otro
  negocio silenciosamente. Si la propiedad de los datos es ambigua, pedir una decisión concreta.
  **B2a (16/11/2026):** dueña confirma pertenencia de todo el origen, incluidos ejemplos;
  respaldo y traslado atómicos a destino vacío. Se mantienen base e IDs globales.
  C1.4 documenta la política elegida; la marca terminal impide resiembra/escrituras tardías.
- [ ] Conectar renovación antes del vencimiento y probar fallos de red/rotación. Revisar el
  reingreso después de salir o perder la sesión sin reutilizar invitaciones consumidas; si exige
  un nuevo flujo de producto, acordarlo y actualizar `002` antes de implementarlo.
- [ ] **Salida:** aislamiento local probado, datos heredados preservados y acceso recuperable.
  No presentar recuperación desde servidor hasta completar D.

#### C — Persistencia y protocolo sync completos (depende de A; S4/S5)

**Archivos:** `apps/api/src/sync/`, `apps/api/src/migrations/`, `packages/core/src/lww.ts`,
`packages/core/src/tipos.ts` y repositorios que producen payloads.

- [ ] Enumerar payloads reales de la outbox y fijar contrato validado de push/pull para productos,
  categorías, clientes, movimientos, fiados y conteos. Mantener compatibilidad con ops antiguas.
- [ ] Completar materialización y LWW por campo de entidades mutables; ledger append-only.
  Probar por entidad: reenvío del mismo op_id, mismo ID con distinto contenido, rollback entre
  evento y entidad, referencias cruzadas y tombstones. Reconciliar eventos experimentales
  anteriores a la materialización sin duplicar asientos ni confirmar efectos inexistentes.
- [ ] Probar convergencia en ambos órdenes, campos distintos/iguales, desempate por dispositivo
  y operaciones antiguas sin marcas. Documentar política compatible antes de migrarlas.
- [ ] Probar pull paginado bajo concurrencia y commit tardío: ninguna secuencia se pierde.
  Autorizar negocio desde sesión, nunca desde un payload no confiable.
- [ ] **Salida:** integración PG16 por entidad e aislamiento A/B correctos; contrato listo para
  el cliente. Dividir C por entidad si no cabe en una sesión y registrar la siguiente exacta.

#### D — Cliente sync y restauración sincronizable (depende de B/C; C8/C10)

**Archivos:** `packages/core/src/db/repos/outboxRepo.ts`, `packages/core/src/outbox.ts`,
`apps/web/src/datos/{baseLocal,importar}.ts`, `apps/api/src/server.ts`.
**Archivos nuevos propuestos:** `apps/web/src/datos/sync.ts`, `sync.test.ts`,
`apps/web/e2e/sync.spec.ts` y configuración de integración con API/PG reales.

- [ ] Implementar transporte autenticado, confirmación después de commit, backoff y recuperación
  de ops en envío tras caída. Aplicar pull y cursor en una transacción local; impedir que una
  respuesta pendiente de A se aplique después de cambiar a B.
- [ ] Reintentar al recuperar conexión/foco y mostrar estado real de cola. Conservar el banner
  exacto de §3; no mostrar «sincronizado» sólo por `navigator.onLine`.
- [ ] Restaurar JSON y encolar sus cambios en una transacción, preservando IDs del libro y sin
  copiar confirmaciones/cursor del dispositivo origen. Verificar también CSV, que ya encola.
- [ ] Registrar las rutas de producción sólo con materialización, auth y permisos completos.
  Probar dos navegadores contra API/PG reales, sin interceptar `/sync`: 100 operaciones con
  cortes reproducibles, igualdad de IDs/contenido, stock y saldos; reenvío sin duplicados.
- [ ] Probar restauración repetida, sincronización posterior y perfil limpio que recupera el
  negocio correcto. Aclarar el límite inevitable de datos aún no enviados al borrar la app.
- [ ] **Salida:** C8.2–C8.5 demostrados en su alcance, restore integrado y M2 evaluable para cierre.

#### E — Despliegue, migraciones y respaldo (depende de A–D; M0/M3)

**Archivos:** `infra/{docker-compose.yml,Caddyfile,api.Dockerfile,README.md}`,
`apps/api/src/migrations/` y scripts de operación nuevos bajo `infra/`.

- [ ] Servir web + API + DB con HTTPS; aplicar migraciones también sobre volúmenes existentes
  mediante un mecanismo versionado, no sólo `initdb.d`. Verificar base vacía y actualización.
- [ ] Implementar pg_dump programado y runbook; restaurar una copia en otra base desechable y
  comprobar libros, saldos, aislamiento y arranque. Un dump generado no demuestra recuperación.
- [ ] **Salida:** instalación limpia siguiendo documentación, actualización con datos y restore
  verificados. Medir el objetivo de ≤15 min; no declararlo cumplido sin medición.

#### F — Cierre de calidad y campo (depende de D/E; M4)

**Archivos:** `.github/workflows/ci.yml`, configuración de rendimiento y documentos de evidencia.

- [ ] Activar Lighthouse/medición de TTI ≤3 s con Moto G4/CPU 4x e interacciones <200 ms.
  Medir cobertura del dominio según roadmap; el número de tests no equivale a cobertura.
- [ ] Resolver explícitamente la discrepancia «sesiones firmadas» de `002` frente a tokens
  opacos de T-05, sin cambiar silenciosamente el requisito. Verificar CSP, permisos y secretos.
- [ ] Validar zoom 200 %, lector de pantalla, cámara/linterna, Android e iOS reales; cerrar
  DS-26 y comprobar FAB con datos reales. No extrapolar axe/Chromium a toda la matriz.
- [ ] Medir conteo de ~200 productos ≤2 h, alta escaneada ≤20 s y empleado sin capacitación.
- [ ] **Salida:** registrar evidencia por requisito y pendientes explícitos antes de etiquetar v1.

### 6.4 Gates de cierre y riesgos que no se pueden omitir

Por incremento: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm size`.
Si cambia UI/datos: `CI=1 pnpm --filter @latiendita/web test:e2e`; no ejecutar en paralelo con
otro build porque la prueba PWA compila. Si cambia diseño: contraste y QA de §5.
Para cambios servidor/RLS: ejecutar integración en PG16 desechable con `SYNC_TEST_PG=1` y
`PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE` explícitos; comprobar que no aparece SKIP.

Riesgos obligatorios: cambio de negocio con cola pendiente (B/D), canje concurrente y revocación
(A/B), eventos antiguos sin entidad (C), cursor adelantado ante commit tardío (C/D), restore con
IDs repetidos y operaciones antiguas sin marcas (C/D). Los casos correspondientes están arriba.

### 6.5 Registro para la siguiente sesión

- **Histórico previo (14/11/2026):** auditoría y plan; PostgreSQL omitido en esa auditoría.
- **Completado (14/11/2026, A):** migración `0004_auth_minimo_privilegio.sql`, adaptadores/servicio
  auth y cliente DB, `infra/permisos-app.sql`, inicialización y Compose con rol `latiendita_api`.
  Alta de negocio/persona/membresía/sesión y canje son atómicos. Se reprodujo primero el rechazo
  de alta con rol restringido y después el alta parcial al fallar la sesión; ambos corregidos.
- **Evidencia:** PG16.15 desechable en `/tmp/latiendita-auth-pg16-data`, puerto 55439, detenido al cierre;
  `SYNC_TEST_PG=1 PGHOST=/tmp PGPORT=55439 PGUSER=sync_admin PGDATABASE=postgres pnpm --filter @latiendita/api test`
  → 31 pruebas API, 0 fallos y **0 SKIP** (incluye 9 casos auth y la integración sync existente).
  `pnpm typecheck`, `pnpm lint`, `pnpm test` (164 regulares; PG ejecutado aparte), `pnpm build`
  y `pnpm size` → correctos; **115 689 / 153 600 B gzip**.
  `CI=1 pnpm --filter @latiendita/web test:e2e` → **31/31, sin reintentos**, fuera del sandbox
  después del bloqueo de arranque de su servidor dentro del sandbox.
- **Decisiones:** trabajar en este árbol con un solo agente, conservando el plan previo y sin
  commit/push/despliegue. Revisión propia del diff; sin revisor independiente. La contraseña
  externa queda en el rol de API; el administrador usa el socket del contenedor y queda sin
  contraseña remota. Se conservan las cinco variables externas.
- **Omitido/límites:** sin Docker daemon ni plugin Compose: sólo sintaxis `sh -n` de sus scripts
  y SQL/permisos contra PG real; no se verificó el arranque ni la transición de volúmenes con Docker.
  Sin CI remoto, dispositivos reales ni campo. Sin cambios de diseño: no se repitió contraste/QA.
- **Siguiente al terminar A (histórico):** B — probar cambio A→B, cierre/reapertura y desbloqueo offline con cola
  pendiente; sustituir el contexto `local` y diseñar su migración sin asignar datos de propiedad
  ambigua. Revisar renovación/reingreso antes de implementar un flujo nuevo. Sync sigue sin registrar.
- **Completado (14/11/2026, B1 sobre `6b2de47`):** `baseLocal.ts` resuelve el negocio desde
  la sesión guardada y devuelve una instantánea por operación; adaptadores Dexie, stock de core,
  reportes, CSV/JSON y suscripciones usan ese contexto. Se conserva una sola base y sus claves
  globales: IDs ajenos se rechazan; la migración de los heredados queda pendiente, sin mover filas.
  `sesionRepoDexie.ts` comprueba de nuevo la sesión dentro de una transacción al desbloquear;
  cierre local atómico y cola intacta. `app.tsx` remonta la página al cambiar cuenta.
- **Evidencia B1:** tipos/lint, **171 pruebas regulares** (96 core + 55 web + 20 API), build,
  **116 186 / 153 600 B gzip** y **32 e2e con CI=1, sin reintentos**, correctos. Siete regresiones
  nuevas: seis de aislamiento/restore/suscripciones y una carrera de PIN (PBKDF2 real pausado).
  La primera corrida e2e tuvo 31 aprobadas y un selector ambiguo en la prueba nueva; se corrigió
  el selector y se volvió a ejecutar el conjunto completo. CI=1 dentro del sandbox no arrancó
  el servidor; la corrida final se ejecutó fuera del sandbox.
- **Límites B1:** PG omitido en esta corrida (2 SKIP); evidencia de PG en A conservada como histórica.
  Auth HTTP del e2e se simula: demuestra aislamiento local, no reingreso real ni sync. Sin cambios
  de diseño: contraste/QA no repetidos. Sin Docker, campo ni dispositivos reales. Revisión propia,
  un solo agente. Commit/push autorizados por la instrucción posterior del usuario en la conversación.
- **Siguiente al terminar B1 (histórico):** acordar la política de propiedad de `local` (pregunta enviada al dueño;
  no se asignó ningún dato), implementar respaldo+migración transaccional explícita y después
  renovación/reingreso recuperable. Si requiere un flujo nuevo, acordarlo y actualizar `002` primero.
  **B permanece abierto**; no pasar a D ni habilitar sync como si estuviera cerrado.
- **Completado (16/11/2026, B2a sobre `acf23df`):** el dueño eligió confirmación de la dueña
  y respaldo antes de trasladar todo. Spec C1.4 actualizado primero; plan/registro en
  `docs/planes/2026-11-16-b2-datos-heredados.md`. `migracionLocal.ts` y tarjeta en Respaldo
  implementan resumen sin escritura, confirmación, respaldo original persistente/descargable
  (incluye unidades, conteos, outbox y caché; sin sesión/PIN), traslado en una transacción,
  rechazo de destino ocupado/referencias ajenas/ops desconocidas y repetición idempotente.
  Conserva IDs, libros, marcas LWW y metadatos de reintento. No copia cursores ni confirmaciones:
  `serverSeq` queda null; ops `ok`/`enviando` vuelven a pendientes. Stock se deriva del libro.
  Core e importador impiden escrituras con contexto `local` capturado antes del traslado;
  al salir no reaparece demo. La descarga revalida la cuenta actual.
- **Evidencia B2a:** tipos, lint, **186 regulares** (96 core + 70 web + 20 API), build y
  **118 513 / 153 600 B gzip** correctos. `CI=1 pnpm --filter @latiendita/web test:e2e --retries=0`
  → **33/33 (24.7 s)**. 15 pruebas web nuevas y un e2e con cancelación, confirmación,
  recarga/desbloqueo offline, descarga real y axe. Pruebas rojas antes de implementar;
  revisión final reprodujo caché 999 frente a stock 10 y descarga con cuenta cambiada,
  ambas corregidas con regresiones rojas→verdes. El conjunto final se ejecutó completo.
- **Límites B2a:** tests/e2e fuera del sandbox tras EPERM de sockets/arranque bloqueado.
  PG omitido (2 SKIP): sin cambios API/SQL, evidencia A sólo histórica. HTTP auth simulado
  en e2e; no demuestra reingreso ni sync. Contraste 60/60 y QA estática de diseño
  13 pantallas/60 marcos/0 hallazgos correctos; axe también. Sin Docker, CI remoto, dispositivos ni campo.
  Revisión propia, un agente. Commit/push autorizados después por el dueño; sin despliegue.
- **Siguiente exacto (B2b):** renovación antes de vencer con fallos de red/rotación y
  definición de reingreso tras salir/perder sesión sin reutilizar invitación consumida.
  Si requiere flujo nuevo, acordarlo y actualizar `002` primero. Destinos con datos
  conservan el origen separado: no hay merge automático. B sigue abierto, sync sin registrar.
- **Al cerrar cada sesión:** añadir fecha, incremento/subtarea, archivos, comandos/resultados,
  pruebas omitidas, decisiones y siguiente acción exacta. Conservar resultados históricos como
  históricos; no reemplazarlos por promesas ni marcar casillas por código que sólo compila.

## 7. Prompt de traspaso (copiar/pegar en una sesión nueva)

```text
Retoma LaTiendita en /home/varm/Documents/testModels. Lee AGENTS.md, especialmente §6
(plan de continuidad auditado el 14/11/2026) y §6.5 (último punto de trabajo), después
el traspaso y los specs relevantes según §1.

Ejecuta el primer incremento pendiente de §6.3 con dependencias satisfechas; actualmente B:
completar continuidad de acceso (B2b). A, B1 y B2a están terminados; `local` ya tiene
traslado explícito con respaldo y confirmación de la dueña a una tienda vacía.
Trabaja secuencialmente con un solo agente,
sin repetir la auditoría completa ni reabrir stack/decisiones. La tarea es implementar y
verificar ese incremento, no quedarse en otro plan. Si requiere varias sesiones, termina
una subtarea verificable y deja la siguiente exacta.

Base de B2a: acf23df; revisión B2a identificable en git log. 186 tests regulares, 33 e2e y 118 513 B gzip.
Las dos integraciones PG pasaron en A (no repetidas en B1/B2a). Sync no está registrado,
restore JSON no encola; CSV sí. No habilites sync prematuramente.

Verifica git status y la base; conserva mis cambios. Usa PG desechable para pruebas, nunca
una base real. Prueba aislamiento A/B con rol restringido y auth real, no sólo mocks.
No hagas commit/push/despliegue. No cambies el alcance sin actualizar primero el spec.
Al terminar ejecuta los gates pertinentes, actualiza casillas y §6.5 con evidencia y bloqueos,
y reporta qué queda para la siguiente sesión. No declares aprobados tests omitidos.
```

## 8. Convenciones de git

- Rama `main`; commits en español con prefijo de área (`specs/`, `design/`, `app/`, `infra/`).
- No commitear secretos. `__pycache__/`, `*.pyc`, `.DS_Store` están en `.gitignore`.
- Solo hacer `commit`/`push` cuando el usuario lo pida (aquí sí se pidió al crear cada fase).
