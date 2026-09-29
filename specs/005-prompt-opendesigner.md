# 005 · Prototipado con OpenDesigner — prompt maestro y decisiones de diseño

> Artefacto SDD de la fase de diseño. Insumos: `002-especificacion-funcional.md` (capacidades C1–C11),
> decisiones S1–S8. Salida esperada: tokens DTCG + Tailwind theme + `DESIGN.md` + `decisions.md`
> + `preview.html` de OpenDesigner, que alimentarán `003-plan-tecnico.md` y el frontend.

---

## 1. Cómo usar este documento

1. Carga OpenDesigner (github.com/ckryptickunal/OpenDesigner) en tu herramienta IA (Claude, Cursor, ChatGPT, Codex) dentro de este repo.
2. Pega el **prompt maestro** (§2, en inglés) tal cual.
3. Responde las ≤5 preguntas de owner-input que queden después de las ya respondidas aquí.
4. Sigue el **protocolo de iteración** (§4): fundaciones → componentes → pantallas por lotes.
5. Todo lo que OpenDesigner decida queda registrado en su `decisions.md`; cualquier desvío del spec se reporta como issue y se corrige aquí.

---

## 2. Prompt maestro (en inglés — máxima adherencia del modelo; la copia de UI permanece en español)

```
ACT AS A senior design-systems designer, specialized in mobile apps for users with low
digital literacy in emerging markets. OpenDesigner is loaded in this repo.

CONTEXT: First read specs/002-especificacion-funcional.md (the product source of truth;
it is written in Spanish). Summary: an offline-first PWA for inventory + customer store
credit ("fiados") for corner stores in El Salvador. Users: Marta (owner, 40-60, Android
8-11 with 2GB RAM), José (young employee), Carlos (technical installer). UI language:
Spanish (plain Salvadoran wording), currency USD. No POS, no e-invoicing (DTE).

OWNER INPUTS — already decided, do NOT ask again:
- Brand words: "clear, trustworthy, close, practical"
- Platforms: mobile-first PWA, Android first (iOS and desktop secondary)
- Color system: Radix Colors (github.com/radix-ui/colors) as the single source of color
  (MIT). Scale convention: step 9 = action background, step 10 = hover, step 11 = tinted
  text/borders on light backgrounds, step 12 = minimum emphasis.
  · Primary: Teal (actions and navigation)
  · Neutrals: Sand scale (warm grays — approachable, not cold tech)
  · Store-credit accent: Amber (money owed)
  · Stock status: Radix semantic Red / Green / Amber
  · Paired light + dark modes; WCAG 2.2 AA contrast verified by you
- Typography: open source, high legibility, full Spanish support, performant on
  low-end devices
- Dials: clarity 80, density 45, softness 40, contrast 75, motion 15
- Dark mode: yes, as second mode (stores open before dawn)
- Base 16px, minimum touch targets 48px
- Component reference system: shadcn/ui (already in your benchmark)

HARD CONSTRAINTS:
- One-handed use (thumb), 5–5.7 inch screens
- No blur/backdrop-filter or heavy shadows (budget: initial JS ≤150KB gzip)
- Connection states ALWAYS visible: persistent offline banner ("Sin conexión — se
  sincronizará al reconectar") + "por sincronizar" badge on unconfirmed data. UI copy
  stays in Spanish; English glosses here are for your understanding only
- Plain Salvadoran Spanish in UI: "entradas" (stock in), "fiados" (store credit),
  "abono" (payment on account) — never "créditos" or "sync incremental"
- Icons always paired with text labels; empty states must teach the first step
- Bottom navigation with max 5 destinations: Inicio (Home), Productos (Products),
  Escanear (Scan), Fiados (Credit), Más (More)

DELIVERABLES IN ORDER (wait for my OK between phases):
1. Interview: ONLY owner-input questions not covered above; max 5
2. Foundations: DTCG tokens with light/dark modes + CSS + Tailwind theme + DESIGN.md +
   decisions.md with cited sources
3. Core components in preview.html using ONLY tokens: buttons (primary, secondary,
   icon), product card with stock level, customer card with balance, offline banner,
   "pending sync" badge, form field, numeric keypad for amounts, scan FAB, bottom
   navigation bar
4. Screen mockups (HTML/Tailwind reusing the components), each with default/empty/
   offline/error states
5. WCAG 2.2 checklist applied per component + lint + coverage check

SCREENS (batches of 3–4, see §4):
  1 Onboarding create store · 2 Join with invite code (José) · 3 Home (low-stock
  alerts + credit owed + search) · 4 Full-screen scanner with flashlight and manual
  entry · 5 New product (≤5 visible fields, Open Food Facts autocomplete) · 6 Quick
  movement (stock in/out/adjustment, pack↔unit conversion) · 7 Assisted serial count ·
  8 Credit book list (sorted by balance and age) · 9 Customer detail (charges/payments
  + share via WhatsApp) · 10 Employees (invite with code + PIN)
  Sub-screens under "Más" (design in the last batch): Minimal reports (C11) and
  Backup/Export CSV-JSON (C10).

ANTI-GOALS: desktop-first, POS/checkout, e-invoicing, dark patterns, gamification,
emojis in UI, decorative gradients.

PROTOCOL: when two options are equivalent, choose the one with the lowest cognitive
load for Marta and record the reasoning in decisions.md. At the end of each phase,
list what remains open for the next one.
```

---

## 3. Bitácora de decisión: sistema de color (S8)

**Decisión:** Radix Colors como fuente única de color. **Fecha:** 2026-09-27.

| Opción | Repo oficial | Evidencia | Veredicto |
|---|---|---|---|
| **Radix Colors** ✅ | `radix-ui/colors` | 12 escaladas por color con uso definido (acción/hover/texto/enlace/énfasis), semánticos success/warning/danger/info, pares light+dark diseñados para contraste, MIT, mantenido por WorkOS; base de shadcn/ui (~90k★), el ecosistema UI dominante entre ingenieros | **Elegido**: contraste WCAG desde el origen + alinea con el benchmark de OpenDesigner |
| GitHub Primer | `primer/primitives` + `primer/css` | Sistema de GitHub, probado por 100M+ devs | Descartado: gris-azulado y optimizado para densidad de código, no para retail |
| Tailwind palette | `tailwindlabs/tailwindcss` | Estándar de facto del frontend | Descartado como base: materias primas sin roles semánticos; Radix ya exporta a Tailwind |
| Catppuccin | `catppuccin/catppuccin` (~17k★) | El tema dev más viral | Descartado: pastel de bajo contraste, tema de editor/terminal — inviable bajo sol de tienda |
| Nord | `nordtheme/nord` (~6k★) | Paleta ártica clásica | Descartado: sin pushes desde 2023 y orientado a dark/terminal |

**Mapeo adoptado:** Teal (primario) · Sand (neutros) · Amber (fiados) · Red/Green/Amber semánticos (stock) · modos light/dark apareados.

---

## 4. Protocolo de iteración (4 fases)

| Fase | Entregable | Criterio de aprobación | Lotear |
|---|---|---|---|
| **F1 Fundaciones** | Tokens DTCG light/dark + Tailwind theme + DESIGN.md + decisions.md | Contraste AA verificado; Sand/Teal/Amber presentes; sin blur/sombras pesadas | — |
| **F2 Componentes** | `preview.html` con los 9 componentes núcleo | Solo tokens; targets ≥48px; banner offline y badge visibles | — |
| **F3 Pantallas** | Mockups HTML/Tailwind por pantalla | Estados default/vacío/offline/error en cada una | Lote A: 1–3 · Lote B: 4–6 · Lote C: 7–9 · Lote D: 10 + subpantallas "Más" |
| **F4 Cierre** | Checklist WCAG 2.2 por componente + lint + cobertura | Sin hallazgos bloqueantes | — |

**Regla de cambio:** si durante el prototipado algo contradice el spec (`002`), se actualiza el spec primero y el diseño después. Nunca al revés.
