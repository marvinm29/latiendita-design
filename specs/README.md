# Specs del proyecto — índice y estado de la sesión

> Léeme primero en una sesión nueva. Este documento es el punto de partida y registra el estado actual del ciclo SDD.

---

## 1. Qué es este proyecto

Sistema de gestión de inventarios **open source, sin costo**, para tiendas de colonia de El Salvador
(gemelas de las *sari-sari* filipinas, *kiranas* indias y *warungs* indonesias). Escaneo de códigos de barras
con la cámara del teléfono, **offline-first**, multiempleado gratis (el muro de pago de Loyverse), fiados,
PWA instalable, español primero, instalable en 1 comando.

**Objetivo del creador:** impacto comunitario real, no monetización directa. Open source desde el repo, con
sostenibilidad aspiracional al estilo jshERP (código libre siempre; conveniencia pagada opcional a futuro).

## 2. Documentos (en orden de lectura)

| Archivo | Contenido | Estado |
|---|---|---|
| `000-research-competencia.md` | Panorama occidental/LatAm: Loyverse, OSPOS, Grocy, InvenTree, HomeBox, ASATI. Hueco de mercado validado. Decisiones D1–D9 | ✅ Completo |
| `001-research-global.md` | Research global (India, Filipinas, Indonesia, China, Brasil): Peddlr, Khatabook, jshERP, Packworks. Lecciones L1–L8, decisiones D10–D14 | ✅ Completo |
| `002-especificacion-funcional.md` | **Spec v1**: visión, personas, 11 capacidades con criterios Gherkin, NFRs medibles, métricas de éxito, preguntas abiertas P1–P5 | ✅ Completo — requiere revisión/acceptance del dueño |
| `005-prompt-opendesigner.md` | Prompt maestro de prototipado, decisión de sistema de color (Radix/Teal/Sand/Amber, S8), protocolo de iteración en 4 fases | ✅ Completo — ejecutar con OpenDesigner para generar fundaciones + mockups |
| `003-plan-tecnico.md` | **Plan técnico v1**: stack (Preact/Fastify/Postgres+RLS), arquitectura offline/sync (outbox + LWW por campo + ledger append-only), modelo de datos, seguridad, presupuesto de rendimiento, estrategia de pruebas y hitos M0–M4 | ✅ Completo — requiere revisión del dueño |
| `004-roadmap.md` | **Roadmap y adopción**: hitos M0–M4 (tareas, criterios de salida, camino crítico), gates de calidad, plan de adopción D11 y post-v1 | ✅ Completo — requiere revisión del dueño |

## 3. Decisiones cerradas en conversación (no repetidas en los docs)

| # | Decisión | Contexto |
|---|---|---|
| S1 | **Stack: PWA** (no Java, no React Native) | Java encierra en Android; RN duplica código móvil+web; PWA corre en cualquier dispositivo y ataca la debilidad de Loyverse (sin versión web). Salida de emergencia: envolver la PWA con **Capacitor** → APK si algún día hace falta Play Store/F-Droid |
| S2 | **Offline-first obligatorio con warning claro** | El usuario eligió "quizás 1 pero con warning claro" → quedó especificado en C8.2 como aviso persistente |
| S3 | **Fiados: módulo completo en v1** | Confirmado tras el research (gancho probado Khatabook/Peddlr) |
| S4 | **Multiempleado por negocio** con roles (dueña/empleado) | Requisito del usuario desde el inicio; en v1 son 2 roles (P2 propone login por código de invitación + PIN) |
| S5 | **Cero costo de infraestructura** en la operación inicial | free tiers + self-host; ver 003 cuando se escriba |
| S6 | No se venderá el producto; se liberará open source | La preocupación de adopción se resolvió con el plan bifurcado D11 (Facebook/comunidad + GitHub/self-hosters) |
| S7 | Idioma de trabajo del proyecto: **español** (docs del spec en español; README técnico podrá ser bilingüe) | — |
| S8 | **Sistema de color: Radix Colors** — Teal primario, Sand neutros, Amber para fiados, semáforo semántico para stock, modos light+dark | Elegido contra Primer, Tailwind, Catppuccin y Nord por contraste WCAG desde el origen y alineación con OpenDesigner/shadcn — evidencia y veredictos en `005-prompt-opendesigner.md` §3 |

## 4. Dónde estábamos en el SDLC

```
Fase: Spec Driven Development
├── Research de mercado y prior art .......... ✅ (000, 001)
├── Especificación funcional v1 ............. ✅ (002) — pendiente de aceptación formal
├── Preguntas abiertas P1–P5 ................ ⏳ abiertas — issues #1 (P2), #2 (P1); P3–P5 asumidos
├── Plan técnico (003) ...................... ✅ escrito — pendiente de revisión del dueño
├── Roadmap/milestones (004) ................ ✅ escrito — pendiente de revisión del dueño
└── Implementación .......................... 🟡 M0 scaffold ✅ · M1: dominio core (64) + Dexie (19)
                                              + UI C2–C5 ✅ — falta e2e offline · M2 bloqueado por P2 (issue #1)

Fase: Diseño (OpenDesigner) — artefactos en design/
├── F1 Fundaciones (tokens DTCG + DESIGN.md + decisions.md) ..... ✅ aprobado
├── F2 Componentes (preview.html, 9 núcleo) .................... ✅ aprobado
├── F3 Pantallas (13 pantallas, 60 marcos, lotes 1–3) ........... ✅ entregado
└── F4 Cierre (ACCESSIBILITY.md · WCAG 2.2 AA + qa.py) .......... ✅ entregado
```

## 5. Para retomar en una sesión nueva

1. Lee `002-especificacion-funcional.md` (fuente de verdad del producto) y `003-plan-tecnico.md` (cómo se construye).
2. Cierra con el dueño las preguntas P1–P5 (licencia, login de empleados, multi-bodega, OFF, límite de fiado); **P1 (licencia) y P2 (login)** impactan directo el plan técnico.
3. Revisa/aprueba `003-plan-tecnico.md` (stack, arquitectura offline/sync, modelo de datos, seguridad, pruebas).
4. Revisa/aprueba `004-roadmap.md` (hitos M0–M4, gates de calidad y plan de adopción D11).
5. El diseño ya está entregado (fases F1–F4 en `design/`). Para verlo: `python3 -m http.server` y abre `design/preview.html` o `design/screens/03-inicio.html`. La accesibilidad (WCAG 2.2 AA) está en `design/ACCESSIBILITY.md`.

## 6. Reglas de proyecto

- Todo artefacto SDD es verificable: si no se puede probar, no entra.
- Español para todos los docs del proyecto.
- El spec se versiona; cambios de alcance pasan por este índice.
