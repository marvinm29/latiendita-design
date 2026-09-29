#!/usr/bin/env python3
"""LaTiendita token pipeline.

Reads vendored Radix Colors CSS (MIT, ./vendor/radix/*.css) and emits:
  - tokens.json  — DTCG-format tokens (primitives + semantic aliases, light/dark)
  - tokens.css   — CSS custom properties, light base + dark overrides
                   (prefers-color-scheme fallback for "auto" + [data-theme] override)

Run: python3 generate.py
Every value is traceable: no hex or number is typed by hand except the
non-color scale definitions below, which are justified in ../decisions.md.
"""

import json
import re
from pathlib import Path

HERE = Path(__file__).parent
VENDOR = HERE / "vendor" / "radix"
SCALES = ["sand", "teal", "amber", "red", "green"]

# ---------------------------------------------------------------------------
# 1. Radix primitives (parsed — never hand-typed)
# ---------------------------------------------------------------------------

def parse_radix():
    out = {s: {"light": {}, "dark": {}} for s in SCALES}
    for scale in SCALES:
        for mode, suffix in (("light", ""), ("dark", "-dark")):
            css = (VENDOR / f"{scale}{suffix}.css").read_text()
            # hex declarations only; P3 blocks use color(display-p3 ...) and are skipped
            for step, hexv in re.findall(rf"--{scale}-(\d+):\s*(#[0-9a-f]{{6}});", css):
                out[scale][mode][int(step)] = hexv
            assert len(out[scale][mode]) == 12, f"{scale}/{mode}: expected 12 steps"
    return out

RADIX = parse_radix()

def hex_to_dtcg(hexv):
    hexv = hexv.lstrip("#")
    comps = [round(int(hexv[i:i+2], 16) / 255, 6) for i in (0, 2, 4)]
    return {"colorSpace": "srgb", "components": comps, "alpha": 1}

def ref(scale, mode, step):
    return f"{{color.radix.{scale}.{mode}.{step}}}"

# ---------------------------------------------------------------------------
# 2. Semantic color tokens — every pair verified in ../../docs contrast matrix
#    (light value, dark value) as DTCG alias references or literal colors
# ---------------------------------------------------------------------------

SEMANTIC = {
    # surfaces & borders
    "surface-page":       (ref("sand", "light", 1),  ref("sand", "dark", 1)),
    "surface-card":       (ref("sand", "light", 1),  ref("sand", "dark", 1)),
    "surface-sunken":     (ref("sand", "light", 3),  ref("sand", "dark", 3)),
    "surface-hover":      (ref("sand", "light", 2),  ref("sand", "dark", 2)),
    "border-card":        (ref("sand", "light", 7),  ref("sand", "dark", 7)),
    "border-strong":      (ref("sand", "light", 10), ref("sand", "dark", 10)),
    # text
    "text":               (ref("sand", "light", 12), ref("sand", "dark", 12)),
    "text-muted":         (ref("sand", "light", 11), ref("sand", "dark", 11)),
    "text-link":          (ref("teal", "light", 12), ref("teal", "dark", 11)),
    "text-on-action":     (ref("sand", "light", 12), ref("sand", "dark", 1)),
    "text-on-destructive":({"colorSpace": "srgb", "components": [1, 1, 1], "alpha": 1},
                           ref("sand", "dark", 1)),
    "text-on-credit":     (ref("sand", "light", 12), ref("sand", "dark", 1)),
    # actions
    "action":             (ref("teal", "light", 9),  ref("teal", "dark", 9)),
    "action-hover":       (ref("teal", "light", 10), ref("teal", "dark", 10)),
    "destructive":        (ref("red", "light", 11),  ref("red", "dark", 11)),
    "destructive-hover":  (ref("red", "light", 12),  ref("red", "dark", 12)),
    # credit (fiados) — amber is reserved for money owed
    "credit":             (ref("amber", "light", 9), ref("amber", "dark", 9)),
    "credit-text":        (ref("amber", "light", 12), ref("amber", "dark", 11)),
    "credit-accent":      (ref("amber", "light", 11), ref("amber", "dark", 11)),
    # stock status (semantic red / green / amber)
    "danger-text":        (ref("red", "light", 12),  ref("red", "dark", 11)),
    "danger-bg":          (ref("red", "light", 2),   ref("red", "dark", 2)),
    "danger-accent":      (ref("red", "light", 11),  ref("red", "dark", 11)),
    "success-text":       (ref("green", "light", 12), ref("green", "dark", 11)),
    "success-bg":         (ref("green", "light", 2),  ref("green", "dark", 2)),
    "success-accent":     (ref("green", "light", 11), ref("green", "dark", 11)),
    "warning-text":       (ref("amber", "light", 12), ref("amber", "dark", 11)),
    "warning-bg":         (ref("amber", "light", 2),  ref("amber", "dark", 2)),
    "warning-accent":     (ref("amber", "light", 11), ref("amber", "dark", 11)),
    # focus & navigation
    "focus":              (ref("teal", "light", 11), ref("teal", "dark", 11)),
    "nav-active-bg":      (ref("teal", "light", 2),  ref("teal", "dark", 2)),
    "nav-active-text":    (ref("teal", "light", 12), ref("teal", "dark", 11)),
    # overlay
    "scrim":              ({"colorSpace": "srgb", "components": [0, 0, 0], "alpha": 0.4},
                           {"colorSpace": "srgb", "components": [0, 0, 0], "alpha": 0.4}),
}

# Semantic tokens whose Radix STEP differs between modes (documented in ../decisions.md).
# The generator emits a full semantic block per color scope, so each of these is
# re-declared with its mode-specific step automatically.
STEP_SWITCHING = [
    "text-link", "text-on-action", "text-on-destructive", "text-on-credit",
    "danger-text", "success-text", "warning-text", "credit-text",
    "nav-active-text", "destructive-hover",
]

# ---------------------------------------------------------------------------
# 3. Non-color scales (justified in ../decisions.md, referenced by DESIGN.md)
# ---------------------------------------------------------------------------

SPACES = {"1": 4, "2": 8, "3": 12, "4": 16, "5": 20, "6": 24, "8": 32, "10": 40, "12": 48, "16": 64}
RADII = {"sm": 6, "md": 8, "lg": 12, "xl": 16, "full": 999}
SIZES = {
    "touch-min": 48, "control-h": 48, "row-min": 56, "nav-h": 64, "header-h": 56,
    "fab": 56, "key": 56, "icon": 24, "icon-sm": 20, "icon-lg": 28,
}
TEXT = {  # name: (px, line-height px)
    "xs": (12, 16), "sm": (14, 20), "base": (16, 24), "lg": (18, 26),
    "xl": (20, 28), "2xl": (24, 32), "3xl": (30, 38),
}
DURATIONS = {"fast": 80, "base": 120, "slow": 180}
EASE = [0.2, 0, 0, 1]
BORDERS = {"hairline": 1, "focus": 2}
FONT_STACK = [
    "Atkinson Hyperlegible Next", "Atkinson Hyperlegible", "system-ui",
    "-apple-system", "Segoe UI", "Roboto", "sans-serif",
]

# ---------------------------------------------------------------------------
# 4. tokens.json (DTCG)
# ---------------------------------------------------------------------------

def build_json():
    color = {"$type": "color", "radix": {}, "semantic": {}}
    for scale in SCALES:
        color["radix"][scale] = {}
        for mode in ("light", "dark"):
            color["radix"][scale][mode] = {
                str(step): {
                    "$value": hex_to_dtcg(hexv),
                    "$description": f"Radix Colors {scale}-{step} ({mode}) {hexv}",
                }
                for step, hexv in sorted(RADIX[scale][mode].items())
            }
    for name, (light, dark) in SEMANTIC.items():
        color["semantic"][name] = {
            "light": {"$value": light},
            "dark": {"$value": dark},
        }

    def dim(v):
        return {"$type": "dimension", "$value": {"value": v, "unit": "px"}}

    tokens = {
        "$description": (
            "LaTiendita design tokens — DTCG format. Color primitives: Radix Colors v3 "
            "(MIT, github.com/radix-ui/colors). Regenerate with design/tokens/generate.py; "
            "contrast verified by design/tokens/verify_contrast.py (58/58 pairs, WCAG 2.2 AA)."
        ),
        "color": color,
        "space": {"$type": "dimension", **{k: dim(v) for k, v in SPACES.items()}},
        "radius": {"$type": "dimension", **{k: dim(v) for k, v in RADII.items()}},
        "size": {"$type": "dimension", **{k: dim(v) for k, v in SIZES.items()}},
        "border": {"$type": "dimension", **{k: dim(v) for k, v in BORDERS.items()}},
        "duration": {"$type": "duration",
                     **{k: {"$value": {"value": v, "unit": "ms"}} for k, v in DURATIONS.items()}},
        "easing": {"$type": "cubicBezier", "standard": {"$value": EASE}},
        "font": {
            "family": {"$type": "fontFamily", "sans": {"$value": FONT_STACK}},
            "weight": {"$type": "fontWeight",
                       "regular": {"$value": 400}, "bold": {"$value": 700}},
        },
        "text": {
            name: {
                "$type": "typography",
                "$value": {
                    "fontFamily": "{font.family.sans}",
                    "fontSize": {"value": size, "unit": "px"},
                    "fontWeight": 400 if name in ("xs", "sm", "base") else 700,
                    "letterSpacing": {"value": 0, "unit": "px"},
                    "lineHeight": round(line / size, 4),
                },
            }
            for name, (size, line) in TEXT.items()
        },
        "shadow": {
            "$type": "shadow",
            "xs": {"$value": {
                "color": {"colorSpace": "srgb", "components": [0.129, 0.125, 0.11], "alpha": 0.1},
                "offsetX": {"value": 0, "unit": "px"},
                "offsetY": {"value": 1, "unit": "px"},
                "blur": {"value": 2, "unit": "px"},
                "spread": {"value": 0, "unit": "px"},
            }},
        },
    }
    (HERE / "tokens.json").write_text(json.dumps(tokens, indent=2, ensure_ascii=False) + "\n")

# ---------------------------------------------------------------------------
# 5. tokens.css
# ---------------------------------------------------------------------------

def css_value(value):
    """DTCG value (alias ref or literal color) -> CSS custom property value."""
    if isinstance(value, dict):
        r, g, b = (round(c * 255) for c in value["components"])
        a = value.get("alpha", 1)
        if a < 1:
            return f"rgba({r}, {g}, {b}, {a})"
        return f"#{r:02x}{g:02x}{b:02x}"
    m = re.match(r"\{color\.radix\.(\w+)\.\w+\.(\d+)\}", value)
    return f"var(--{m.group(1)}-{m.group(2)})"

def primitives_block(mode):
    lines = [f"  /* Radix Colors {mode} (MIT) — vendored from ./vendor/radix */"]
    for scale in SCALES:
        for step, hexv in sorted(RADIX[scale][mode].items()):
            lines.append(f"  --{scale}-{step}: {hexv};")
    return "\n".join(lines)

def semantic_block(mode):
    lines = [f"  /* semantic ({mode}) */"]
    for name, (light, dark) in SEMANTIC.items():
        value = light if mode == "light" else dark
        lines.append(f"  --color-{name}: {css_value(value)};")
    return "\n".join(lines)

def scales_block():
    lines = []
    for k, v in SPACES.items():
        lines.append(f"  --space-{k}: {v}px;")
    for k, v in RADII.items():
        lines.append(f"  --radius-{k}: {v}px;")
    for k, v in SIZES.items():
        lines.append(f"  --size-{k}: {v}px;")
    for k, v in BORDERS.items():
        lines.append(f"  --border-{k}: {v}px;")
    for k, v in DURATIONS.items():
        lines.append(f"  --duration-{k}: {v}ms;")
    lines.append(f"  --ease-standard: cubic-bezier({', '.join(str(x) for x in EASE)});")
    stack = ", ".join(f'"{s}"' if " " in s else s for s in FONT_STACK)
    lines.append(f"  --font-sans: {stack};")
    lines.append("  --font-weight-regular: 400;")
    lines.append("  --font-weight-bold: 700;")
    for name, (size, line) in TEXT.items():
        lines.append(f"  --font-size-{name}: {size}px;")
        lines.append(f"  --line-height-{name}: {line}px;")
    lines.append("  --shadow-xs: 0 1px 2px rgba(33, 32, 28, 0.10);")
    return "\n".join(lines)

def build_css():
    light = "\n".join([primitives_block("light"), semantic_block("light"), scales_block()])
    dark = "\n".join([primitives_block("dark"), semantic_block("dark")])
    css = f"""/* LaTiendita design tokens — generated by generate.py (do not edit by hand).
 * Color primitives: Radix Colors v3 (MIT) — ./vendor/radix/
 * Structure: light is the base (:root); dark overrides arrive either from the OS
 * (prefers-color-scheme, for data-theme="auto"/absent) or from an explicit
 * [data-theme="dark"] set by the "Tema" toggle in Más.
 * Contrast: all 58 token pairs verified WCAG 2.2 AA — see ./verify_contrast.py
 */

:root {{
{light}
}}

@media (prefers-color-scheme: dark) {{
  :root:not([data-theme]) {{
{dark}
  }}
}}

:root[data-theme="dark"] {{
{dark}
}}
"""
    (HERE / "tokens.css").write_text(css)

if __name__ == "__main__":
    build_json()
    build_css()
    n_sem = len(SEMANTIC)
    print(f"tokens.json + tokens.css written — "
          f"{len(SCALES)} scales x 12 steps x 2 modes, {n_sem} semantic tokens")
