# LaTiendita — Design decisions

> Format: **context → decision → outcome/verification**. Sources cited inline.
> Numbering `DS-nn` is independent from product decisions `D1–D14` (spec) and `P1–P5` (open questions).
> Protocol: when two options were equivalent, we chose the **lowest cognitive load for Marta** and said so.

## Owner decisions (Phase 1 — interview)

### DS-01 · App name = **LaTiendita**
Context: spec §1 leaves the name tentative (Tenda / MiBodega / LaTiendita); onboarding, header and install screens need a name now.
Decision: **LaTiendita**.
Outcome: most colloquial/close of the three for a Salvadoran corner store; unambiguous word, no invented vocabulary for a low-literacy user (Marta recognizes her own world in it). Owner picked this explicitly.

### DS-02 · Typeface = **Atkinson Hyperlegible Next**
Context: “open source, high legibility, full Spanish support, performant on low-end devices” — no family chosen.
Decision: Atkinson Hyperlegible Next (variable 200–800) with fallback to the original Atkinson Hyperlegible, then system stack; self-hosted WOFF2, Latin subset, `font-display: swap`. Design weights used: 400/700 only.
Outcome: the family was purpose-built by Braille Institute + Applied Design Works for low-vision legibility (disambiguated 1/l/I, open counters) — directly aligned with Marta’s profile and the clarity dial (80). Full Spanish diacritics; one variable file keeps the performance budget. Alternatives: Inter (heavier, less distinctive at small sizes), Source Sans 3 (more weights than we need, more “corporate” than “close”).
Sources: https://fonts.google.com/specimen/Atkinson+Hyperlegible+Next · https://www.brailleinstitute.org/freefont/ (SIL OFL 1.1).

### DS-03 · Copy register = **tú neutro** (owner override)
Context: everyday Salvadoran Spanish uses voseo (“Registrá tu entrada”); I recommended voseo for closeness. Owner chose neutral tuteo.
Decision: neutral tú (“Registra tu entrada”) + Salvadoran *vocabulary* (entradas, fiados, abono, libreta). No voseo, no usted.
Outcome: vocabulary stays local and recognizable; verb forms stay region-neutral (lower risk if the app travels, simpler for writers). Reasoning recorded as owner preference — cognitive load of tú vs voseo is effectively equal for Marta.

### DS-04 · Dark mode = **system default + explicit toggle under Más**
Decision: theme follows `prefers-color-scheme` by default (“Automático”); Más → Tema offers Automático/Claro/Oscuro.
Outcome: pre-dawn store opening works out of the box on an auto-dark phone, and Marta can force either mode without hunting settings elsewhere. Zero required configuration (lowest load) with an escape hatch.

## Color

### DS-05 · Radix Colors v3 as the single color source (owner decision, executed)
Decision: vendor Radix Colors CSS (MIT) into `tokens/vendor/radix/`; 5 scales (sand, teal, amber, red, green) × 12 steps × 2 modes. Apply the owner’s step convention: 9 = action fill, 10 = hover, 11 = tinted text/borders on light, 12 = minimum emphasis — **then verify every used pair ourselves instead of trusting the convention**.
Outcome: 60/60 pairs pass WCAG 2.2 AA (`tokens/verify_contrast.py`, exit-code lint). Two convention deviations found by measurement — DS-06 and DS-07.
Sources: https://github.com/radix-ui/colors (MIT) · step system: https://www.radix-ui.com/colors/docs/palette-composition/step-systems

### DS-06 · Primary action text is **dark**, not white (deviation #1)
Context: white on teal-9 (`#12a594`) measures **3.07:1** — fails SC 1.4.3 (4.5:1) for 16px labels; teal-10 hover white = 3.46:1.
Decision: keep teal-9/teal-10 fills (owner convention intact), set `--color-text-on-action` = sand-12 (light) / sand-1 (dark).
Outcome: 5.31 / 4.71 (light), 6.15 / 7.16 (dark) — all pass. Both modes use dark text on the same teal fill → one visual identity, no per-mode button redesign.
Source: WCAG 2.2 SC 1.4.3 https://www.w3.org/TR/WCAG22/#contrast-minimum

### DS-07 · Tinted *text* uses step 12 in light (deviation #2)
Context: owner convention says step 11 = tinted text on light. Measured: teal-11 on sand-1 = **4.46–4.48:1**, green-11 on tinted bg = **4.49:1**, amber-11 on amber-2 = **4.43:1** — all *just* under 4.5:1 (fails).
Decision: light mode → tinted/status **text** = step 12 (≥10.9:1 everywhere); step 11 keeps **icons, borders, focus ring** (non-text needs only 3:1 → 4.53–5.12:1 ✓). Dark mode → step 11 for text (8.56–12.34:1 ✓), as the dark scales invert.
Outcome: zero marginal contrasts in shipped text; the “0.01 short” Radix pairs never appear as text. Rule is one sentence and lintable (DESIGN.md §2.2).
Source: WCAG 2.2 SC 1.4.3 / 1.4.11.

### DS-08 · Destructive = **red-11**, not step 9/10
Context: red-9 (`#e5484d`) fails with both text options: white 3.91:1, near-black 4.19:1. red-10 similar (4.30 white).
Decision: `--color-destructive` = red-11 both modes (white text light 5.21:1, sand-1 text dark 8.97:1); hover = red-12 (12.44 / 13.83).
Outcome: pass with margin; hover darkens in light and lightens in dark — natural feedback with zero new colors.

### DS-09 · Amber is **money only**; connection state is neutral
Decision: amber tokens serve fiados (money owed) and stock-bajo warnings only — never buttons, never decoration. The offline banner and “por sincronizar” badge use neutral sand tones.
Reasoning (lowest load): amber-9 as a button fill cannot carry AA text at all (white 1.9:1); and one hue = one meaning. If “no internet” were amber, Marta would read it as “someone owes me”. Red stays reserved for real problems (stock/critico, errors, destructive).
Source: WCAG 2.2 SC 1.4.1 (use of color) https://www.w3.org/TR/WCAG22/#use-of-color

### DS-10 · Page and card share sand-1, separated by a border
Context: cards at sand-2 drop the teal-9 button boundary to **2.92:1** (< 3:1 SC 1.4.11 for component identification) and drop several text pairs under 4.5.
Decision: page = card = sand-1 + 1px sand-7 border (`--color-border-card`); inputs/banners/secondary buttons = sand-3 (sunken) + sand-10 border.
Outcome: button/FAB boundary 3.02:1 ✓, every inset text pair ≥5.31:1 ✓, flat look respects the “no heavy shadows” budget, and grouping stays visually chunked for low-literacy scanning (cards read as “objects” thanks to borders, not depth tricks).
Source: Understanding SC 1.4.11 https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast

### DS-11 · Input border = **sand-10** (step 10, both modes)
Context: Radix’s border range (steps 6–8) measures 1.55–1.89:1 on light surfaces — inputs would be invisible as interactive boundaries (SC 1.4.11 needs 3:1).
Decision: decorative borders stay sand-7; **interactive** boundaries (inputs, secondary buttons) = sand-10: 3.80/3.40 (light), 4.45/3.75 (dark).

### DS-12 · Focus ring = teal-11, 2px, **offset 2px** (mandatory)
Context: teal-8 ring measures 2.32:1 (< 3:1). A ring drawn flush against the teal-9 fill would measure 1.49:1.
Decision: `outline: 2px solid var(--color-focus); outline-offset: 2px` — the gap makes the ring adjacent to the *page* (4.48 / 10.36:1 ✓) in both modes. Encoded in the component contract (DESIGN.md §10) for Phase 5 checking.
Source: SC 2.4.7 Focus Visible + SC 1.4.11.

## Size, spacing, motion (dials → values)

### DS-13 · Touch minimum = 48px, rows 56px, nav 64px
Context: WCAG 2.2 AA floor is 24×24 (SC 2.5.8); Material uses 48dp, Apple 44pt; Marta uses one thumb on a 5–5.7" phone.
Decision: every interactive element ≥48×48 (`--size-touch-min`), list rows ≥56, bottom nav 64 + safe-area, keypad keys 56, FAB 56.
Reasoning: 48 is the industry-verified thumb target and doubles the AA floor with margin — no trade-off against density dial 45 because rows, not gaps, carry the size.
Sources: https://www.w3.org/TR/WCAG22/#target-size-minimum · https://m3.material.io/foundations/accessible-design/accessible-touch-targets · https://developer.apple.com/design/human-interface-guidelines/buttons

### DS-14 · Density 45 → 4px grid, subset scale; Softness 40 → radii 6/8/12/16; Motion 15 → 80/120/180ms
Decision: spacing = Tailwind’s default 4px subset (4,8,12,16,20,24,32,40,48,64) so the shadcn reference maps 1:1; radii keep buttons/inputs tighter (8) than cards (12) — friendly but not “bubble”; motion limited to opacity/color/≤4px transforms, reduced-motion → 0.
Reasoning: density 45 + clarity 80 = roomy rows, few items per screen; softness 40 avoids both sharp enterprise corners and playful pills; motion 15 means state feedback only.

### DS-15 · Type scale on a 16px base
Decision: 12/14/16/18/20/24/30 with 400/700 only; body and button labels = 16; nothing below 12 (badges only at 12); amounts bold + tabular.
Reasoning: clarity 80 → button text at 16/700 (large enough to read while standing, small enough for 48px controls); two weights remove “which weight is this?” noise.

## System architecture

### DS-16 · DTCG JSON + generated CSS + Tailwind bridge (one source of truth)
Decision: `tokens.json` (DTCG) and `tokens.css` are both emitted by `generate.py` from vendored Radix CSS — nothing hand-typed; `tailwind.theme.js` only references `var(--…)`.
Outcome: light/dark, the `data-theme` override and the `prefers-color-scheme` fallback live in one file; shadcn/ui component names (background/foreground/card/primary/…) map directly, so Phase 3–4 can use shadcn patterns without a second palette. The dark block is intentionally duplicated in CSS (media fallback + explicit toggle) — generated, so drift is impossible.

### DS-17 · “por sincronizar” badge is neutral sand, not amber/red/green
Decision: xs chip, sunken bg + strong border + `Clock` icon + text.
Reasoning: sync state is orthogonal to stock status and money owed; reusing amber or red would overload the one hue-per-meaning rule (DS-09) exactly where trust matters most (“did my data survive?”).

### DS-18 · Sentence case, no ALL-CAPS
Decision: all UI copy in sentence case, including chips and badges.
Reasoning: ALL-CAPS hurts word-shape recognition (lower literacy), and Spanish acronyms feel bureaucratic — “practical and close” beats “system voice”.

### DS-19 · Currency display = `$5.00` (USD)
Decision: en-US number formatting, `$` prefix, 2 decimals, tabular figures; NIO never appears (spec fixed USD).
Reasoning: matches the receipts and price tags Marta already reads; one format everywhere (keypad, lists, reports, WhatsApp share text).

### DS-20 · Icons = Lucide, always with a visible label
Decision: Lucide (ISC) only — the same set shadcn/ui uses; every icon button and nav item shows Spanish text; decorative icons `aria-hidden`.
Reasoning: owner rule + SC 1.4.1; also keeps José/Marta from decoding a pictogram vocabulary.

### DS-21 · shadcn/ui as component reference, tokens as the adapter
Decision: component anatomy (variants, sizes, asChild-free compositions) follows shadcn/ui, but every style value comes from our semantic tokens.
Reasoning: proven, accessible, plain HTML/Tailwind patterns Carlos can maintain; the token adapter is what keeps Radix-step decisions (DS-06…DS-12) from leaking into components.

### DS-22 · Bottom-nav labels at 12px (`xs`)
Context: 5 columns on a 360px screen = 72px per column; “Productos” measures ≈66px at 14px (`sm`) minus padding → wraps or clips. Contrast is size-independent, so AA is unaffected either way.
Decision: nav labels use `xs` (12/16); icons stay 20px; every other badge/label keeps its size rules.
Outcome: all five labels fit on one line at 360px with margin (verified in preview at 360–412px). The icon above each label carries recognition for low-literacy users, and the label confirms it — load stays on the pair, not on the word size.
Recorded here because DESIGN.md §3 previously said `sm` for nav labels (corrected there too).

---

## Screens (Phase 4)

### DS-23 · Screen mockups = fixed 360×640 frame, ≥4 honest states each
Context: spec `005` §4 requires every screen with default/empty/offline/error; DESIGN.md §4 fixes the design viewport at 360×640.
Decision: each screen page renders independent 360×640 frames, one per state, from one shared shell (`design/tools/shell.py`) that composes **header → offline banner → scrollable content → sticky CTA → bottom nav**. State labels stay in Spanish (Bienvenida, Vacío, Sin conexión, Error…).
Outcome: the frame is scroll-clipped exactly like the target phone, the offline banner is always a layout sibling *under* the header (never an overlay), and CTAs/nav stay fixed. Batch-1 QA across 17 frames: 0 broken sprite refs, 0 duplicate ids, 0 orphan labels, 0 external runtime URLs; keys 56px, nav items 64px, buttons 48px.

### DS-24 · Empty state = Lucide icon in a sunken circle + teaching copy
Context: Phase-3 open item #4 asked for the empty-state policy under the anti-goals (no gradients, no emojis).
Decision: 64px `sand-3` circle with a 28px Lucide icon in `sand-11`, then a title, one sentence, and up to two CTAs (primary first).
Outcome: zero new colors and zero illustration assets; the state names what is missing and teaches the first step (clarity dial 80). Shown in *Inicio · Vacío*; reused by every future empty list (products, fiados, employees).

### DS-25 · Joining a store needs internet, and says so
Context: C1.2 validates the invite code server-side, so the join step is the one flow where offline-first cannot apply. A spinner would hide the cause and blame the user.
Decision: offline, the join screen keeps the banner and adds a neutral info card (“Necesitas internet para unirte… vuelve a intentarlo”) with **Reintentar**; the primary button stays disabled and the typed code is preserved.
Outcome: the exception to “todo funciona sin conexión” is explicit, blameless, and recoverable — and only the join step gets it.

### DS-26 · Added a **Productos** catalog screen (spec gap — flag for owner)
Context: the bottom nav has a permanent **Productos** destination, but spec `005` §4’s screen list jumps from Home (3) to New product (5) — there is no catalog screen, even though C2.4 (search by name/category/code) and C2.5 (edit/logical delete) need a list to act on.
Decision: add `screens/05-productos.html` as the *Productos* destination (search + filter segmented + tappable rows + header “+”); the new-product form becomes `06-nuevo-producto.html`. Screen numbers here are sequential 01→13 and supersede spec `005`’s opportunistic list (its “5 New product” = our 06).
Outcome: no dead nav destination; the catalog reuses the Phase-3 product row/status chips and carries the same 5 states (default · vacío · sin conexión · sin resultados · error). **Flagged as a proposed spec amendment** under the project rule “spec first, design second”.

### DS-27 · In-screen segmented controls are 48px and single-line
Context: the 3-option filter (“Todos · Bajo mínimo · Agotados”) wrapped at 360px with default button padding; the harness theme toggle deliberately uses 40px chrome buttons.
Decision: product segmented controls use the standard `.btn` 48px min-height with reduced horizontal padding (`!px-2`) and `whitespace-nowrap`; only mockup harness chrome may use 40px.
Outcome: every in-screen segmented option measured 48px on one line with no overflow at 360px — nothing below the 48px touch floor ships in product UI (DS-13 holds).

---

## Verification ledger

| Check | Command | Status |
|---|---|---|
| WCAG 2.2 AA matrix (60 pairs, 2 modes) | `python3 design/tokens/verify_contrast.py` | 0 failures |
| Token generation reproducible | `python3 design/tokens/generate.py` | deterministic from `vendor/radix/` |
| JSON is valid DTCG-ish (typed values) | `python3 -c "import json; json.load(open('design/tokens/tokens.json'))"` | ok |
| Phase-4 batch 1 (screens 01–04, 17 frames) | `python3 design/tools/batch1.py` + browser QA | 0 broken icons / dup ids / orphan labels / external URLs |
| Phase-4 batch 2 (screens 05–09, 24 frames) | `python3 design/tools/batch2.py` + browser QA | same: all clean; segmented 48px, keys 56px, nav 64px |
| Screenshot record (light + dark) | chrome-devtools full-page capture | `design/screens/*-light.png` + `03-inicio-dark`, `04-escanear-dark`, `07-movimiento-dark` |

## Open for Phase 4 (screens, batch 3)

1. Build screens 10–13: detalle de cliente (+ compartir por WhatsApp, C6.5), empleados (código de invitación + PIN, C1.2/C7), reportes mínimos (C11), respaldo/exportar CSV-JSON (C10).
2. Nav “Más” → `12-reportes.html` 404 until batch 3 lands (expected, phased).
3. Owner review of **DS-26** (Productos catalog) — propose as a spec amendment to `005` §4.
4. Product card “sin mínimo” variant (product with no minimum configured) still undesigned — surfaced in Phase-3 notes; decide before Phase 5.
5. Cosmetic: raised center FAB overlaps the last list row at 360px when scrolled to the bottom; batch-2 nav screens use `pb-20` to clear it — confirm it's enough with real data.


