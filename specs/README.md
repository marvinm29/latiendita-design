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
| `003-plan-tecnico.md` | Stack final, arquitectura offline/sync, modelo de datos, estrategia de pruebas | ⏳ **No escrito — siguiente tarea** |
| `004-roadmap.md` | Hitos, fases, tareas, plan de adopción | ⏳ No escrito |

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
├── Preguntas abiertas P1–P5 ................ ⏳ decidir antes del plan técnico
├── Plan técnico (003) ...................... ⏳ SIGUIENTE PASO
├── Roadmap/milestones (004) ................ ⏳ después de 003
└── Implementación .......................... ❌ no iniciada
```

## 5. Para retomar en una sesión nueva

1. Lee `002-especificacion-funcional.md` (el spec es la fuente de verdad).
2. Resuelve/resuelve con el dueño P1–P5 (licencia, login de empleados, multi-bodega, OFF, límites de fiado).
3. Escribe `003-plan-tecnico.md` — insumos que ya están decididos y NO reabrir:
   PWA mobile-first, offline-first (IndexedDB + outbox sync, last-write-wins por campo), escaneo con
   BarcodeDetector API + fallback ZXing/WASM, Open Food Facts como acelerador no dependencia, libro de
   movimientos inmutable como fuente de verdad del stock y de los fiados, RLS por negocio, docker-compose
   de 1 comando + demo sembrada, presupuesto de rendimiento (JS inicial ≤150KB gzip, TTI ≤3s en gama baja),
   tests unitarios de stock/fiados/sync + e2e offline obligatorios. Incorporar los tokens DTCG y
   `DESIGN.md` producidos por OpenDesigner (ver `005-prompt-opendesigner.md`).
4. Luego `004-roadmap.md` con hitos M0–M4 y el plan de adopción D11.
5. Prototipado de diseño: ejecutar el prompt maestro de `005-prompt-opendesigner.md` con OpenDesigner
   cargado en el repo (fases F1 fundaciones → F4 cierre, aprobando cada lote).

## 6. Reglas de proyecto

- Todo artefacto SDD es verificable: si no se puede probar, no entra.
- Español para todos los docs del proyecto.
- El spec se versiona; cambios de alcance pasan por este índice.
