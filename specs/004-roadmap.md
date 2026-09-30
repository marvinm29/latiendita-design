# 004 · Roadmap y plan de adopción — LaTiendita

> Artefacto SDD. Insumos: `002-especificacion-funcional.md` (métricas de éxito §6), `003-plan-tecnico.md`
> (hitos §13, riesgos §14), decisiones D10–D14 (`001-research-global.md`), S1–S8 (`specs/README.md`).
>
> Estado: **borrador para revisión del dueño**. Las fechas se expresan en **semanas relativas** (S1…S16):
> el arranque depende de cerrar **P1 (licencia)** y **P2 (login)** y de la disponibilidad real. Al
> aprobarse, se fijan fechas de calendario.

---

## 0. Cómo leer este documento

| Si buscas… | Ve a |
|---|---|
| Los hitos de un vistazo | §2 |
| El detalle de tareas y criterios de salida | §3 |
| Qué bloquea qué (camino crítico) | §4 |
| Cómo se adopta el producto (D11) | §5 |
| Los gates de calidad obligatorios | §6 |
| Lo que viene después de v1 | §8 |
| Roles, cadencia y seguimiento | §10–§11 |

---

## 1. Supuestos y reglas de planificación

- **Equipo mínimo:** 1 desarrollador full-stack (maintainer) · 1 dueño de producto (Marta-focus, decide
  P1–P5 y valida en campo) · comunidad (issues, pruebas, traducciones, soporte).
- **Cadencia:** iteraciones de 1 semana; demo al final de cada hito; el maintainer no abre una nueva
  capacidad de producto hasta que el hito anterior cumple sus **gates** (§6).
- **Regla del proyecto:** *el spec manda*. Si implementar contradice `002`, se actualiza el spec primero.
  Los artefactos de diseño (`design/`, WCAG AA) son contrato, no referencia.
- **Definition of Done (cada tarea):** código + tipos + prueba automatizada + sin violaciones de axe +
  bundle dentro de presupuesto (si toca el cliente) + copy en español llano + documentación en el PR.
- **Multi-negocio / varias bodegas:** fuera de v1 (P3). El modelo ya lo permite (`negocio_id` en todo).
- **Sin POS, sin DTE, sin telemetría por defecto** (D8, NFR de privacidad).

---

## 2. Resumen de hitos

| Hito | Objetivo | Semanas | Criterio de salida (resumen) |
|---|---|---|---|
| **M0 · Cimientos** | Repo, CI, tokens integrados, esqueleto app/api, RLS base | S1–S2 | Pipeline verde con `size-limit` y Lighthouse; RLS demo A≠B |
| **M1 · Núcleo offline** | Catálogo, libro, stock, escaneo, conteo — **100% sin servidor** | S3–S7 | e2e offline de C2–C5; unit de dominio; métrica 2 (alta ≤20s) usable |
| **M2 · Cuentas y sync** | Negocio, invitación+PIN, API+Postgres+RLS, outbox push/pull, LWW | S8–S11 | **Métrica 3: 0 movimientos perdidos** en 100 ops con cortes; aislamiento A/B probado |
| **M3 · Fiados, reportes y datos** | Fiados, C11, export/respaldo/import, PWA install/update | S12–S14 | e2e de C6/C10/C11 y C9; PWA instalable con aviso de actualización |
| **M4 · Endurecimiento** | Rendimiento, a11y, pruebas de campo, demo docker, docs | S14–S16 | Métricas 1/2/4/5; axe sin violaciones AA; `docker compose up` en máquina limpia |
| **v1.0** | Publicación open source | S16 | Release tageado + demo + videos + anuncio comunitario (D11) |

> Solapamiento deliberado en M3/M4 (S14): el endurecimiento de rendimiento y accesibilidad empieza en
> cuanto hay pantallas completas, sin esperar el cierre funcional.

---

## 3. Detalle por hito

### M0 · Cimientos (S1–S2)

- [ ] Monorepo pnpm (`apps/web`, `apps/api`, `packages/{core,tokens,ui}`, `infra/`) — T-01 (§3.1 de 003).
- [ ] `packages/tokens` = `design/tokens` (DTCG → CSS + Tailwind build-time); **sin Tailwind en runtime**.
- [ ] Esqueleto Preact + Vite + router + señales; shell de navegación reutilizando `design/assets/ui.css`.
- [ ] Fastify + Drizzle + Postgres en contenedor; migración inicial con **RLS** por `negocio_id`.
- [ ] CI (GitHub Actions): lint + tipos + unit + `size-limit` + Lighthouse CI (emulación Moto G4).
- [ ] Cerrar **P1** (licencia) y **P2** (login) con el dueño; añadir `LICENSE` y cabeceras SPDX (T-21).

**Criterio de salida:** `docker compose up` levanta web+api+db; pipeline verde; healthcheck OK.

### M1 · Núcleo offline (S3–S7)

Prioridad absoluta: **la app es útil sin servidor** (el mayor diferenciador, D1/C8).

- [ ] `packages/core`: dominio puro — libro de movimientos inmutable, stock derivado, conversión de
      unidades (D6), saldo de fiados (aún sin UI de fiados) — con unit tests y property test
      “caché == derivado”.
- [ ] Repos Dexie + esquema IndexedDB + `storage.persist()` (T-03).
- [ ] **Catálogo**: alta/edición, búsqueda por nombre/categoría/código (C2.4), borrado lógico (C2.5),
      filas reutilizando los componentes ya diseñados (pantallas 5 y 6).
- [ ] **Escaneo**: BarcodeDetector → ZXing-wasm perezoso → teclado manual (T-06); formatos EAN-13/8,
      UPC-A, Code128; linterna (pantalla 4).
- [ ] **Movimiento rápido** con conversión bulto↔unidad (C2.3/C4) y **conteo asistido** que genera los
      ajustes del diferencial (C5.2) — pantallas 7 y 8.
- [ ] Open Food Facts **vía API** con caché local, sin bloquear si no hay red (D3/P4).

**Criterio de salida:** con `context.setOffline(true)`, un e2e recorre C2→C5 (alta escaneada → movimiento
→ conteo → ver stock) sin red; métrica 2 (alta escaneada ≤20s) alcanzable en dispositivo de gama baja.

### M2 · Cuentas y sincronización (S8–S11)

- [ ] **Negocio y acceso**: crear negocio (C1.1); invitación de un solo uso (base32, expira, rate-limit)
      + PIN (T-05); sesión rotativa; desbloqueo offline por PIN local.
- [ ] API `/sync/push` idempotente por `op_id` (`op_log`) y `/sync/pull` por `server_seq` (T-04/§5 de 003).
- [ ] **LWW por campo** en `producto`/`cliente` (`field_meta` jsonb) y **ledger append-only** (C8.4).
- [ ] Outbox con backoff, reintento en foco/online, y estados → banner + badge “por sincronizar” (C8.2).
- [ ] Reinstalación = pull completo (C8.5).
- [ ] **Prueba de aislamiento A/B** (RLS) y matriz de permisos por rol (C7).

**Criterio de salida:** e2e **métrica 3 ≈ 100 operaciones con cortes de red aleatorios → 0 movimientos
perdidos**; repetir un lote no duplica; negocio A no ve B; convergencia tras edición concurrente de un
producto (gana el campo más reciente, no se pierde ningún movimiento).

### M3 · Fiados, reportes y datos (S12–S14)

- [ ] **Fiados** (D10/C6): clientes, cargos/abonos inmutables, saldo derivado, orden por saldo/antigüedad,
      detalle en 2 toques, compartir estado de cuenta **generado localmente** (C6.5) — pantallas 9 y 10.
- [ ] **Reportes mínimos** (C11): valor de inventario al costo y a precio, “lo que más se movió”, resumen
      de fiados — pantalla 12, calculados localmente (DS-30).
- [ ] **Datos** (C10): export CSV/JSON, respaldo/restore completo, **importar CSV** con plantilla —
      pantalla 13.
- [ ] **PWA** (C9): manifest, instalación A2HS (Android + iOS), fullscreen, aviso “hay una nueva versión —
      reiniciar” (T-07).
- [ ] Backups del servidor: `pg_dump` por `BACKUP_CRON` + runbook de restauración.

**Criterio de salida:** e2e de C6/C10/C11 y C9 verde; export abrible en Excel; restore probado.

### M4 · Endurecimiento y campo (S14–S16)

- [ ] **Rendimiento:** cumplir presupuesto por pieza (§8 de 003); interacciones <200ms; TTI ≤3s en Moto G4.
- [ ] **Accesibilidad:** `axe` sin violaciones AA en las 13 pantallas + **lector de pantalla real**
      (TalkBack/VoiceOver) + zoom 200% (`ACCESSIBILITY.md` §4).
- [ ] **Pruebas de campo (métricas 1, 2, 4, 5):**
  - [ ] Conteo de ~200 productos en ≤2h con escaneo (métrica 1).
  - [ ] Alta escaneada ≤20s cronometrada (métrica 2).
  - [ ] Instalación limpia por Carlos ≤15min siguiendo sólo el README (métrica 4).
  - [ ] Un empleado nuevo opera (entrada + fiado + consulta) sin capacitación (métrica 5).
- [ ] Endurecer seguridad: CSP, rate-limits, revisión de RLS, pentest básico (NFR seguridad).
- [ ] **Demo docker** con datos sembrados + **videos cortos** obligatorios (D11) + FAQ.
- [ ] Cerrar riesgos abiertos de `003` §14.

**Criterio de salida:** todas las métricas de éxito de `002` §6 verificadas y registradas.

---

## 4. Camino crítico y dependencias

```
P1 (licencia) ─┐
P2 (login)   ─┴─► M0 ─► M1 (offline) ─► M2 (sync) ─► M3 (fiados/datos/PWA) ─► M4 ─► v1.0
                                   └─ riel de rendimiento/a11y (S3→S16) ──────────┘
```

- **Bloqueantes de arranque:** P1 (licencia → `LICENSE`/SPDX, T-21) y P2 (login → define M2). Sin P2 se
  puede avanzar M1 (offline) en paralelo, pero M2 no.
- **No bloqueantes:** P3 (una bodega — ya asumido), P4 (OFF — manual-first ya cubierto), P5 (límite de
  fiado → campo opcional ya reservado).
- **Riel transversal:** presupuesto de rendimiento y accesibilidad se miden desde M0 (gates), no se dejan
  para el final.
- **Riesgo de secuencia:** el escáner (M1) y el sync (M2) son los de mayor incertidumbre técnica; por eso
  van temprano y con pruebas dedicadas.

---

## 5. Plan de adopción (D11)

Modelo bifurcado: **usuarios** por comunidad en español, **instaladores** por GitHub/self-host.

| Frente | Acción | Canal | Métrica de adopción (v1) |
|---|---|---|---|
| Usuarios | Demo con datos + videos cortos (1–3 min): primer conteo, fiado, exportar | Facebook/WhatsApp (grupos de tiendas/emprendedores SV) | ≥50 instalaciones de la demo en el primer mes; ≥5 tiendas usando en real |
| Instaladores | README de 1 comando + `docker-compose` + FAQ; releases tageados | GitHub, Foro/Reddit self-host, F-Droid (futuro, D14) | ≥10 self-hosts independientes |
| Confianza | “Tus datos son tuyos”: export/restore visible y documentado (C10) | Repo + video | 0 pérdidas reportadas (métrica 3) |
| Soporte | FAQ + plantillas de respuesta (mitiga R6 de `001`) | Comunidad | — |

**Mensaje central:** open source, self-host gratis, **multiempleado gratis**, en español, funciona sin
internet, y los datos son del negocio. No competimos por features (R4 de `001`) sino por modelo.

**Sostenibilidad (D13):** código libre siempre; nube lista con costo **opcional** sólo si el proyecto
crece (GitHub Sponsors/OpenCollective). No es requisito ni promesa de v1.

---

## 6. Gates de calidad (obligatorios por PR / por hito)

| Gate | Herramienta | Cuándo | Umbral |
|---|---|---|---|
| Lint + tipos | ESLint + `tsc` | cada PR | 0 errores |
| Unit | Vitest (`packages/core`) | cada PR | 0 fallos; cobertura de dominio ≥90% |
| Integración (RLS/authn/idempotencia) | contenedor efímero | cada PR de API | 0 fallos; A≠B probado |
| e2e + offline | Playwright (`setOffline`) | cada PR de flujo | C1–C11 verde; **métrica 3 = 0 perdidos** |
| Accesibilidad | `@axe-core/playwright` | cada PR de UI | 0 violaciones AA |
| Rendimiento | `size-limit` + Lighthouse CI | cada PR de cliente | JS inicial ≤150KB gzip; TTI ≤3s Moto G4 |
| Copy | revisión | cada PR de UI | español llano; sin tecnicismos ni emojis |
| Migraciones | Drizzle | cada PR de esquema | aditivas; reversibles; sin pérdida de datos |

---

## 7. Riesgos del roadmap

Hereda los riesgos técnicos de `003` §14 (presupuesto vs escáner, evicción de IndexedDB, RLS, relojes,
OFF, cámara en iOS, PIN local). Riesgos de planificación propios:

| Riesgo | Mitigación |
|---|---|
| P1/P2 sin cerrar frenan M2 | avanzar M1 (offline) en paralelo; escalar decisión P1/P2 en S1 |
| Dependencia de un solo maintainer | documentar todo en el repo; automatizar gates; reclutar colaboradores desde la comunidad (D11) |
| Alcance v2 se cuela en v1 | alcance v1 cerrado en `002` §3 (POS/DTE/voz/APK = fuera) |
| Pruebas de campo dependen del dueño | agendar sesiones desde S12; métricas 1/2/4/5 medidas, no estimadas |

---

## 8. Después de v1 (v2+, no comprometido)

- **WhatsApp como canal** (D12): compartir/consultar por WhatsApp (v1 ya genera el texto local, C6.5).
- **Entrada por voz** (D5 propuesta como v2).
- **APK vía F-Droid (Capacitor)** (D14) sólo si la demanda lo pide.
- **Multi-bodega** (P3) y **límites de fiado** más ricos (P5).
- **Nube lista opcional** (D13) si el proyecto crece.

---

## 9. Versionado y releases

- **Semver**; `v1.0.0` al cerrar M4. CHANGELOG por release.
- Migraciones de base **aditivas** y reversibles; la app avisa del SW nuevo (C9.2) en lugar de recargar.
- Cada release: tag + notas + (cuando aplique) actualización del compose. Los self-hosters actualizan con
  `git pull && docker compose up -d --build`.

---

## 10. Roles y cadencia

| Rol | Quién | Responsabilidad |
|---|---|---|
| Dueño de producto | Dueño (Marta-focus) | P1–P5, prioridades, validación en campo (métricas 1/2/5) |
| Desarrollo | Maintainer full-stack | M0–M4, gates, releases |
| Infra/instalación | Maintainer + Carlos (instalador, persona del spec) | `docker-compose`, backups, prueba de instalación (métrica 4) |
| Comunidad | Voluntarios | Issues, pruebas en dispositivos, traducciones, FAQ |

**Cadencia:** iteración semanal; demo por hito; revisión de métricas en M4. Comunicación en español.

---

## 11. Seguimiento

- **Issues** etiquetados: `type:` (feature/bug/chore/docs) · `area:` (web/api/core/infra/design) ·
  `priority:` (P0/P1/P2) · `milestone:` (M0–M4) · `good-first-issue` (para comunidad).
- **Tablero** por hito con las tareas de §3 como checklist.
- **Fuente de verdad:** `002` (qué), `003` (cómo), `004` (cuándo/quién); el diseño en `design/`.
- **Definition of v1 done:** las 5 métricas de `002` §6 verificadas + gates de §6 en verde + demo y
  videos publicados.

---

## 12. Referencias

- `002-especificacion-funcional.md` §3 (alcance), §5 (NFRs), §6 (métricas), §7 (P1–P5).
- `003-plan-tecnico.md` §13 (hitos), §14 (riesgos), §10 (pruebas).
- `001-research-global.md` D10–D14 (adopción y sostenibilidad).
- `design/ACCESSIBILITY.md` (QA de accesibilidad de implementación).
