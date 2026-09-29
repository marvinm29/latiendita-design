# LaTiendita — Design System

> **Status:** Phase 4 (Screen mockups) · source of truth for every screen and component.
> Companion docs: [`decisions.md`](./decisions.md) (why, with citations) ·
> [`tokens/verify_contrast.py`](./tokens/verify_contrast.py) (WCAG lint, exit 1 on failure).
>
> Product spec: `specs/002-especificacion-funcional.md`. UI language: **Spanish (tú neutro)**,
> currency **USD**. Users: Marta (owner, low digital literacy), José (employee), Carlos (installer).

---

## 0. What lives where

| File | Role |
|---|---|
| `tokens/tokens.json` | DTCG-format tokens (primitives + semantic, light/dark). Machine-readable source. |
| `tokens/tokens.css` | CSS custom properties. **Runtime source of truth.** Light base + dark override. |
| `tokens/tailwind.theme.js` | Tailwind/shadcn bridge — every value is `var(--…)`; no hex ever. |
| `tokens/generate.py` | Regenerates JSON+CSS from vendored Radix CSS. Run after upgrading Radix. |
| `tokens/verify_contrast.py` | 60-pair WCAG 2.2 AA matrix. Run as lint: `python3 tokens/verify_contrast.py`. |
| `tokens/vendor/radix/` | Radix Colors v3 CSS (MIT) + LICENSE — pinned, no CDN dependency. |
| `assets/` | Fonts (Atkinson WOFF2), `icons.svg` Lucide sprite (42 symbols), `base.css`, `ui.css`, browser `theme.js`, vendored `tailwind.js`. |
| `preview.html` | Phase-3 component gallery (all 9 core components × states, theme toggle). |
| `screens/` | Phase-4 screen mockups, one HTML per screen (360×640 state frames) + screenshots. |
| `tools/shell.py` | Shared screen-shell renderer (header/banner/content/CTA/nav, token-only). |
| `tools/batch1.py` | Batch-1 screen definitions (01–04). `python3 tools/batch1.py` regenerates them. |

**Rule: components use semantic roles only (`--color-action`, `--color-danger-text`, …), never
raw steps (`--teal-9`), and never hex.** Raw steps exist for generation and audit.

---

## 1. Brand → dials → concrete values

Brand words: **clear · trustworthy · close · practical**.

| Dial | Value | How it shows up |
|---|---|---|
| Clarity | 80 | Body ≥16px, labels always visible (no placeholder-only fields), icons + text everywhere, empty states teach the first step, one primary action per screen. |
| Density | 45 | 4px grid, rows ≥56px, cards breathe (`--space-4/5` padding), lists show 6–8 items per screen — chunked, not packed. |
| Softness | 40 | Radii 6/8/12/16 — rounded enough to feel friendly, not pill-shaped consumer app. |
| Contrast | 75 | All text ≥4.5:1 with margin (worst text pair 4.71:1), borders/rings ≥3:1, status never color-only. |
| Motion | 15 | 80/120/180ms only, opacity + ≤4px transform, `prefers-reduced-motion` → 0ms. No decorative motion. |

---

## 2. Color

### 2.1 Architecture

```
Radix Colors v3 (MIT)         semantic roles (32, ×2 modes)        components
5 scales × 12 steps × 2 modes  →  --color-action, --color-danger-text …  →  class="bg-primary"
        pinned in tokens/vendor/             tokens.css + tailwind.theme.js
```

Mode strategy: `:root` = light; dark arrives from `prefers-color-scheme`
(“Tema: Automático”, the default) or from `data-theme="dark"` (the explicit toggle under **Más**).
Steps that must flip between modes (text on teal, status text, links) are re-declared per scope —
the generator guarantees no manual drift.

### 2.2 Role map (owner conventions applied)

| Role token | Light | Dark | Use |
|---|---|---|---|
| `--color-action` / `-hover` | teal-9 / teal-10 | teal-9 / teal-10 | Buttons, FAB, nav accent. **Teal = actions & navigation only.** |
| `--color-text-on-action` | sand-12 | sand-1 | Dark text on teal (see DS-06: white measures 3.07:1). |
| `--color-destructive` / `-hover` | red-11 / red-12 | red-11 / red-12 | Destructive actions only (see DS-08). |
| `--color-credit` + `--color-text-on-credit` | amber-9 + sand-12 | amber-9 + sand-1 | **Money owed (fiados) only.** |
| `--color-credit-text` / `-accent` | amber-12 / amber-11 | amber-11 / amber-11 | Amounts, coin icons. |
| `--color-danger-*` | red-12/2/11 | red-11/2/11 | Stock crítico, errors, validation. |
| `--color-success-*` | green-12/2/11 | green-11/2/11 | Stock OK, sync confirmed. |
| `--color-warning-*` | amber-12/2/11 | amber-11/2/11 | Stock bajo mínimo. |
| `--color-text` / `--color-text-muted` | sand-12 / sand-11 | sand-12 / sand-11 | Body / secondary. |
| `--color-text-link` | teal-12 | teal-11 | Inline links, active nav label (with `--color-nav-active-bg` = teal-2). |
| `--color-surface-page` / `-card` / `-sunken` | sand-1 / sand-1 / sand-3 | sand-1 / sand-1 / sand-3 | Page & cards are the same tone, separated by `--color-border-card` (sand-7); inputs/offline banner/secondary buttons are sunken (sand-3). |
| `--color-border-strong` | sand-10 | sand-10 | Interactive boundaries (inputs) — ≥3:1. |
| `--color-focus` | teal-11 | teal-11 | Focus ring, 2px + **2px offset** (mandatory, DS-12). |
| `--color-scrim` | rgba(0,0,0,.4) | same | Modal scrim. No blur, no backdrop-filter. |

**Semantic color locks**
1. **Amber = fiado/stock-bajo.** Never decorative, never a button color (amber-9 + white measures 1.9:1).
2. **Red = problem (stock/error/destructive).** Never branding.
3. **Teal = action/navigation.** Never a status color.
4. **Connection state is neutral** (offline banner, “por sincronizar” badge = sand tones): it must not read as an error (red) or as money (amber).
5. **Never color-only:** every status ships icon + text (WCAG 1.4.1); chips carry words, not just hue.

### 2.3 Verified contrast (60/60 pairs, both modes)

Run `python3 tokens/verify_contrast.py` — full output below is generated from the vendored CSS.

```
mode fg        bg        role                                        req    ratio verdict
L    sand-12   sand-1    texto cuerpo sobre pagina                   4.5   16.02:1 PASS
L    sand-12   sand-3    texto sobre relleno (input/banner offline)  4.5   14.32:1 PASS
L    sand-11   sand-1    texto secundario sobre pagina               4.5    5.93:1 PASS
L    sand-11   sand-3    placeholder sobre input                     4.5    5.31:1 PASS
L    sand-11   sand-3    badge "por sincronizar" texto               4.5    5.31:1 PASS
D    sand-12   sand-1    texto cuerpo sobre pagina                   4.5   16.26:1 PASS
D    sand-12   sand-3    texto sobre relleno (input/banner offline)  4.5   13.71:1 PASS
D    sand-11   sand-1    texto secundario sobre pagina               4.5    9.01:1 PASS
D    sand-11   sand-3    placeholder sobre input                     4.5    7.60:1 PASS
D    sand-11   sand-3    badge "por sincronizar" texto               4.5    7.60:1 PASS
L    sand-12   teal-9    boton primario texto                        4.5    5.31:1 PASS
L    sand-12   teal-10   boton primario hover texto                  4.5    4.71:1 PASS
D    sand-1    teal-9    boton primario texto                        4.5    6.15:1 PASS
D    sand-1    teal-10   boton primario hover texto                  4.5    7.16:1 PASS
L    white     red-11    boton destructivo texto                     4.5    5.21:1 PASS
D    sand-1    red-11    boton destructivo texto                     4.5    8.97:1 PASS
L    white     red-12    boton destructivo hover texto               4.5   12.44:1 PASS
D    sand-1    red-12    boton destructivo hover texto               4.5   13.83:1 PASS
L    sand-12   sand-3    boton secundario texto                      4.5   14.32:1 PASS
D    sand-12   sand-3    boton secundario texto                      4.5   13.71:1 PASS
L    teal-12   sand-1    enlace / texto tintado                      4.5   11.85:1 PASS
D    teal-11   sand-1    enlace / texto tintado                      4.5   10.36:1 PASS
L    teal-12   teal-2    nav activa etiqueta                         4.5   11.47:1 PASS
L    teal-11   teal-2    nav activa icono                            3.0    4.34:1 PASS
D    teal-11   teal-2    nav activa etiqueta                         4.5    9.55:1 PASS
D    teal-11   teal-3    nav activa icono                            3.0    8.07:1 PASS
L    sand-11   sand-1    nav inactiva etiqueta/icono                 4.5    5.93:1 PASS
D    sand-11   sand-1    nav inactiva etiqueta/icono                 4.5    9.01:1 PASS
L    sand-12   teal-9    FAB escanear icono                          4.5    5.31:1 PASS
D    sand-1    teal-9    FAB escanear icono                          4.5    6.15:1 PASS
L    red-12    red-2     chip stock critico texto                    4.5   11.78:1 PASS
L    green-12  green-2   chip stock ok texto                         4.5   11.72:1 PASS
L    amber-12  amber-2   chip stock bajo texto                       4.5   10.93:1 PASS
D    red-11    red-2     chip stock critico texto                    4.5    8.56:1 PASS
D    green-11  green-2   chip stock ok texto                         4.5    9.37:1 PASS
D    amber-11  amber-2   chip stock bajo texto                       4.5   11.52:1 PASS
L    red-12    sand-1    alerta rojo texto                           4.5   12.22:1 PASS
L    green-12  sand-1    ok verde texto                              4.5   12.10:1 PASS
L    amber-12  sand-1    fiado/ambar texto                           4.5   11.17:1 PASS
D    red-11    sand-1    alerta rojo texto                           4.5    8.97:1 PASS
D    green-11  sand-1    ok verde texto                              4.5   10.07:1 PASS
D    amber-11  sand-1    fiado/ambar texto                           4.5   12.34:1 PASS
L    red-11    sand-1    icono rojo                                  3.0    5.12:1 PASS
L    green-11  sand-1    icono verde                                 3.0    4.63:1 PASS
L    amber-11  sand-1    icono ambar                                 3.0    4.53:1 PASS
D    red-9     sand-1    icono rojo                                  3.0    4.83:1 PASS
D    green-9   sand-1    icono verde                                 3.0    5.99:1 PASS
D    amber-9   sand-1    icono ambar                                 3.0   11.97:1 PASS
L    sand-12   amber-9   badge fiado sobre relleno ambar             4.5   10.33:1 PASS
D    sand-1    amber-9   badge fiado sobre relleno ambar             4.5   11.97:1 PASS
L    sand-10   sand-1    borde input vs pagina                       3.0    3.80:1 PASS
L    sand-10   sand-3    borde input vs relleno                      3.0    3.40:1 PASS
D    sand-10   sand-1    borde input vs pagina                       3.0    4.45:1 PASS
D    sand-10   sand-3    borde input vs relleno                      3.0    3.75:1 PASS
L    teal-11   sand-1    anillo foco vs pagina (offset 2px)          3.0    4.48:1 PASS
L    teal-11   sand-3    anillo foco vs relleno                      3.0    4.01:1 PASS
D    teal-11   sand-1    anillo foco vs pagina                       3.0   10.36:1 PASS
D    teal-11   sand-3    anillo foco vs relleno                      3.0    8.73:1 PASS
L    teal-9    sand-1    relleno accion vs pagina (FAB)              3.0    3.02:1 PASS
D    teal-9    sand-1    relleno accion vs pagina (FAB)              3.0    6.15:1 PASS

60 pairs checked, 0 failures
```

Tightest margins: primary hover text 4.71:1, FAB boundary 3.02:1, amber icon 4.53:1 — all ≥ requirement.

---

## 3. Typography

**Family:** Atkinson Hyperlegible Next (variable 200–800), fallback Atkinson Hyperlegible →
system stack. Self-hosted WOFF2, `font-display: swap`, Latin subset. Why: designed for
low-vision legibility (disambiguated 1/l/I, open counters) — the highest-leverage choice for
Marta. Weight tokens: **400 regular / 700 bold only** (semantic simplicity beats 5 weights).

| Token | Size/Line | Weight | Use |
|---|---|---|---|
| `3xl` | 30/38 | 700 | Onboarding headline, big totals (only 1 per screen). |
| `2xl` | 24/32 | 700 | Screen title (header). |
| `xl` | 20/28 | 700 | Section head, keypad amount, balance figures. |
| `lg` | 18/26 | 700 | Card title, customer name. |
| `base` | 16/24 | 400 (700 strong) | Body, list rows, **button labels**. |
| `sm` | 14/20 | 400 | Secondary info (dates, units, banner text). |
| `xs` | 12/16 | 400 | Badges and bottom-nav labels (“por sincronizar”, chips, nav). Never smaller. |

Rules: sentence case (no ALL-CAPS — WCAG 1.4.12 reading + low literacy); amounts use
`font-variant-numeric: tabular-nums` and bold; currency format `$5.00`
(USD — `Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })`, locale-independent display).

---

## 4. Spacing, size & layout

- **Base grid:** 4px (`--space-1…16`). Gaps `space-2/3`, card padding `space-4`, section `space-5/6`.
- **Touch:** minimum **48×48px** (`--size-touch-min`) — WCAG 2.5.8 AA floor is 24px; we double it
  for thumb use (Material 48dp precedent). List rows ≥56px. Icon-only buttons are 48×48 with a
  24px icon.
- **Frame (5–5.7", portrait, one-handed):**
  - Header 56px (title + at most 1 action).
  - Persistent offline banner directly under header (part of layout, never overlays content).
  - Content scrolls; **bottom nav 64px + safe-area**, 5 destinations:
    `Inicio · Productos · Escanear · Fiados · Más` — Escanear is the raised center action (FAB 56px).
  - Primary CTAs live in the lower 2/3 (thumb zone); no critical action top-right only.
  - Design viewport 360×640; must hold at 414×896 without reflow.

---

## 5. Radius, surfaces, elevation

- Radii: `sm 6` (chips, badges) · `md 8` (buttons, inputs) · `lg 12` (cards, sheets) ·
  `xl 16` (bottom sheet top) · `full` (avatars, FAB circle, pills).
- Surfaces: page = card = sand-1 + 1px `--color-border-card`; sunken elements (inputs, offline
  banner, secondary buttons) = sand-3 + 1px `--color-border-strong`.
- Elevation budget: **no shadows except `--shadow-xs`** (0 1px 2px, FAB only). No blur,
  no backdrop-filter, no gradients (anti-goals). Modal separation = `--color-scrim`.

---

## 6. Motion

- `--duration-fast 80ms` (press/hover color), `--duration-base 120ms` (sheet, banner),
  `--duration-slow 180ms` (screen transitions) — one easing `cubic-bezier(.2,0,0,1)`.
- Allowed: opacity, transform ≤4px, color. Banned: parallax, bounce, layout-animating lists,
  anything decorative (motion dial 15).
- `prefers-reduced-motion: reduce` → durations 0ms.
- Offline banner and pending badge are **static states** (already visible, no entrance
  animation) — connection state must never blink or disappear.

---

## 7. Iconography

- **Lucide** (ISC, tree-shakeable, matches shadcn/ui), stroke 2, sizes 20/24/28.
- **Every icon is paired with a visible text label** (owner rule; also 1.4.1).
- Status icons: `AlertTriangle`/`PackageX` (danger), `Check`/`PackageCheck` (success),
  `TriangleAlert` (warning), `WifiOff` (offline), `RefreshCw`/`Clock` (pending sync),
  `Coins` (fiado). Decorative icons get `aria-hidden="true"`; informative icons get a label.

---

## 8. Connection & data states (always visible)

| State | Element | Copy (exact) | Colors |
|---|---|---|---|
| Offline | Persistent banner under header | **"Sin conexión — se sincronizará al reconectar"** | sunken bg, `--color-text`, `WifiOff` icon |
| Local write not confirmed | Badge on the record/row | **"por sincronizar"** | `xs` chip, sunken bg + `--color-border-strong`, `Clock` icon |
| Sync confirmed | Badge (transient ≤2s) | **"sincronizado"** | `success-surface` + `success-text` + `Check` |
| Sync failed | Row-level | **"no se pudo enviar — reintentar"** | `danger-text` + icon + retry button |

Rules: the banner is *layout-reserved* (never pushes content abruptly, never auto-hides);
“por sincronizar” is text + icon (not color-only); pending state is orthogonal to
amber/red/green status colors.

---

## 9. Content rules (Spanish, tú neutro)

- Vocabulary: **entradas, salidas, ajustes, fiados, abono, cargo, libreta, conteo**.
  Never “créditos”, “sincronización incremental”, “outbox”, “CRUD”.
- Tú neutral: “Registra tu entrada”, “¿Qué quieres hacer?”, “Agrega el primer producto”.
- Empty states teach the first step: title = what’s missing, body = why it matters in one
  sentence, CTA = the single first action (“Agregar producto”, “Crear cliente”, “Escanear”).
- Errors: what happened + what to do, no blame, no jargon: “No se pudo guardar. Tus datos
  están en el teléfono — toca Reintentar.”
- Currency: `$5.00`; quantities with unit words (“12 uds”, “1 bulto”, “2 lb”).

---

## 10. Component contract (input for Phase 3)

Every component must: consume only semantic tokens · ship light+dark for free ·
meet 48px targets · show focus ring (2px + 2px offset) · support `:disabled` (opacity via
`sand-3` bg + `sand-11` text + `border-card`, still ≥4.5:1 text) · never rely on color alone ·
keep Spanish copy with `tú` · handle offline/pending variants where data is involved.

---

## 11. Sources

- Radix Colors v3 (MIT) — https://github.com/radix-ui/colors · step system:
  https://www.radix-ui.com/colors/docs/palette-composition/step-systems
- WCAG 2.2 (W3C Recommendation) — https://www.w3.org/TR/WCAG22/ ·
  SC 1.4.3, 1.4.11, 1.4.1, 2.4.7, 2.5.8 · Understanding 1.4.11:
  https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast
- Atkinson Hyperlegible Next — https://fonts.google.com/specimen/Atkinson+Hyperlegible+Next ·
  Braille Institute “Free Font”: https://www.brailleinstitute.org/freefont/ (SIL OFL 1.1)
- shadcn/ui (component reference, MIT) — https://ui.shadcn.com
- Lucide (ISC) — https://lucide.dev
- Material Design touch targets (48dp) —
  https://m3.material.io/foundations/accessible-design/accessible-touch-targets
- Apple HIG buttons (44pt floor) — https://developer.apple.com/design/human-interface-guidelines/buttons

---

## 12. Screens (Phase 4)

Mockups live in `screens/`, reuse the Phase-3 components only, and render at **360×640**
with four states each (default · vacío · sin conexión · error; extras where the flow needs
them). Composition is fixed: **header → (offline banner) → scrollable content → sticky CTA →
bottom nav**; the banner is a layout sibling under the header, never an overlay (DS-23).
Regenerate with `python3 tools/batch1.py`; verify every state in both themes.

| # | Screen | File | States |
|---|---|---|---|
| 1 | Onboarding · crear tienda | `screens/01-crear-tienda.html` | Bienvenida · vacío · sin conexión · error |
| 2 | Unirse con código (José) | `screens/02-unirse.html` | formulario · vacío · sin conexión · código inválido |
| 3 | Inicio | `screens/03-inicio.html` | default · vacío · sin conexión · error de carga |
| 4 | Escáner | `screens/04-escanear.html` | escaneando · entrada manual · código conocido · sin conexión · error de cámara |
| 5 | Productos (catálogo) | `screens/05-productos.html` | default · vacío · sin conexión · sin resultados · error |
| 6 | Producto nuevo | `screens/06-nuevo-producto.html` | autocompletado · vacío · sin conexión · error · guardado |
| 7 | Movimiento rápido | `screens/07-movimiento.html` | entrada · salida · vacío · sin conexión · error de stock |
| 8 | Conteo asistido | `screens/08-conteo.html` | contando · vacío · sin conexión · código desconocido · resumen |
| 9 | Libro de fiados | `screens/09-fiados.html` | default · vacío · sin conexión · error de carga |
| 10–13 | Cliente · empleados · reportes · respaldo | batch 3 | pending |

Content rules: state labels and copy in Spanish (tú neutro, §9); empty states teach the first
step (DS-24); the join screen is the only flow that requires connectivity and says so (DS-25);
the catalog (5) is an added screen to cover the permanent nav destination (DS-26).
