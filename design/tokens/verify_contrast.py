#!/usr/bin/env python3
"""Canonical WCAG 2.2 AA verification matrix for LaTiendita tokens.

Primitives are parsed from ./vendor/radix/*.css (same source as generate.py);
the MATRIX below lists every foreground/background pairing the design system
actually uses, both modes. Requirements: 4.5 for normal text (SC 1.4.3),
3.0 for non-text UI — borders, icons, focus rings, component boundaries
(SC 1.4.11).

Run: python3 verify_contrast.py   (exit 1 on any failure — usable as lint)
"""

import re
import sys
from pathlib import Path

VENDOR = Path(__file__).parent / "vendor" / "radix"
SCALES = ["sand", "teal", "amber", "red", "green"]

def load(mode_suffix):
    out = {}
    for scale in SCALES:
        css = (VENDOR / f"{scale}{mode_suffix}.css").read_text()
        for step, hexv in re.findall(rf"--{scale}-(\d+):\s*(#[0-9a-f]{{6}});", css):
            out[f"{scale}-{step}"] = hexv
    return out

L, D = load(""), load("-dark")
L["white"] = D["white"] = "#ffffff"

def srgb_to_lin(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def lum(h):
    h = h.lstrip("#")
    r, g, b = (int(h[i:i+2], 16) for i in (0, 2, 4))
    return 0.2126 * srgb_to_lin(r) + 0.7152 * srgb_to_lin(g) + 0.0722 * srgb_to_lin(b)

def ratio(a, b):
    l1, l2 = sorted((lum(a), lum(b)), reverse=True)
    return (l1 + 0.05) / (l2 + 0.05)

# (mode, fg, bg, requirement, component / role) — L = light, D = dark
MATRIX = [
    # --- body & muted text -------------------------------------------------
    ('L', 'sand-12', 'sand-1', 4.5, 'texto cuerpo sobre pagina'),
    ('L', 'sand-12', 'sand-3', 4.5, 'texto sobre relleno (input/banner offline)'),
    ('L', 'sand-11', 'sand-1', 4.5, 'texto secundario sobre pagina'),
    ('L', 'sand-11', 'sand-3', 4.5, 'placeholder sobre input'),
    ('L', 'sand-11', 'sand-3', 4.5, 'badge "por sincronizar" texto'),
    ('D', 'sand-12', 'sand-1', 4.5, 'texto cuerpo sobre pagina'),
    ('D', 'sand-12', 'sand-3', 4.5, 'texto sobre relleno (input/banner offline)'),
    ('D', 'sand-11', 'sand-1', 4.5, 'texto secundario sobre pagina'),
    ('D', 'sand-11', 'sand-3', 4.5, 'placeholder sobre input'),
    ('D', 'sand-11', 'sand-3', 4.5, 'badge "por sincronizar" texto'),
    # --- actions -----------------------------------------------------------
    ('L', 'sand-12', 'teal-9', 4.5, 'boton primario texto'),
    ('L', 'sand-12', 'teal-10', 4.5, 'boton primario hover texto'),
    ('D', 'sand-1', 'teal-9', 4.5, 'boton primario texto'),
    ('D', 'sand-1', 'teal-10', 4.5, 'boton primario hover texto'),
    ('L', 'white', 'red-11', 4.5, 'boton destructivo texto'),
    ('D', 'sand-1', 'red-11', 4.5, 'boton destructivo texto'),
    ('L', 'white', 'red-12', 4.5, 'boton destructivo hover texto'),
    ('D', 'sand-1', 'red-12', 4.5, 'boton destructivo hover texto'),
    ('L', 'sand-12', 'sand-3', 4.5, 'boton secundario texto'),
    ('D', 'sand-12', 'sand-3', 4.5, 'boton secundario texto'),
    # --- links / tinted text ----------------------------------------------
    ('L', 'teal-12', 'sand-1', 4.5, 'enlace / texto tintado'),
    ('D', 'teal-11', 'sand-1', 4.5, 'enlace / texto tintado'),
    # --- navigation --------------------------------------------------------
    ('L', 'teal-12', 'teal-2', 4.5, 'nav activa etiqueta'),
    ('L', 'teal-11', 'teal-2', 3.0, 'nav activa icono'),
    ('D', 'teal-11', 'teal-2', 4.5, 'nav activa etiqueta'),
    ('D', 'teal-11', 'teal-3', 3.0, 'nav activa icono'),
    ('L', 'sand-11', 'sand-1', 4.5, 'nav inactiva etiqueta/icono'),
    ('D', 'sand-11', 'sand-1', 4.5, 'nav inactiva etiqueta/icono'),
    ('L', 'sand-12', 'teal-9', 4.5, 'FAB escanear icono'),
    ('D', 'sand-1', 'teal-9', 4.5, 'FAB escanear icono'),
    # --- status chips (stock) ---------------------------------------------
    ('L', 'red-12', 'red-2', 4.5, 'chip stock critico texto'),
    ('L', 'green-12', 'green-2', 4.5, 'chip stock ok texto'),
    ('L', 'amber-12', 'amber-2', 4.5, 'chip stock bajo texto'),
    ('D', 'red-11', 'red-2', 4.5, 'chip stock critico texto'),
    ('D', 'green-11', 'green-2', 4.5, 'chip stock ok texto'),
    ('D', 'amber-11', 'amber-2', 4.5, 'chip stock bajo texto'),
    # --- status text on plain surfaces -------------------------------------
    ('L', 'red-12', 'sand-1', 4.5, 'alerta rojo texto'),
    ('L', 'green-12', 'sand-1', 4.5, 'ok verde texto'),
    ('L', 'amber-12', 'sand-1', 4.5, 'fiado/ambar texto'),
    ('D', 'red-11', 'sand-1', 4.5, 'alerta rojo texto'),
    ('D', 'green-11', 'sand-1', 4.5, 'ok verde texto'),
    ('D', 'amber-11', 'sand-1', 4.5, 'fiado/ambar texto'),
    # --- status icons (non-text >= 3) --------------------------------------
    ('L', 'red-11', 'sand-1', 3.0, 'icono rojo'),
    ('L', 'green-11', 'sand-1', 3.0, 'icono verde'),
    ('L', 'amber-11', 'sand-1', 3.0, 'icono ambar'),
    ('D', 'red-9', 'sand-1', 3.0, 'icono rojo'),
    ('D', 'green-9', 'sand-1', 3.0, 'icono verde'),
    ('D', 'amber-9', 'sand-1', 3.0, 'icono ambar'),
    # --- amber (fiado) badge fill ------------------------------------------
    ('L', 'sand-12', 'amber-9', 4.5, 'badge fiado sobre relleno ambar'),
    ('D', 'sand-1', 'amber-9', 4.5, 'badge fiado sobre relleno ambar'),
    # --- borders / focus / boundaries (non-text >= 3) -----------------------
    ('L', 'sand-10', 'sand-1', 3.0, 'borde input vs pagina'),
    ('L', 'sand-10', 'sand-3', 3.0, 'borde input vs relleno'),
    ('D', 'sand-10', 'sand-1', 3.0, 'borde input vs pagina'),
    ('D', 'sand-10', 'sand-3', 3.0, 'borde input vs relleno'),
    ('L', 'teal-11', 'sand-1', 3.0, 'anillo foco vs pagina (offset 2px)'),
    ('L', 'teal-11', 'sand-3', 3.0, 'anillo foco vs relleno'),
    ('D', 'teal-11', 'sand-1', 3.0, 'anillo foco vs pagina'),
    ('D', 'teal-11', 'sand-3', 3.0, 'anillo foco vs relleno'),
    ('L', 'teal-9', 'sand-1', 3.0, 'relleno accion vs pagina (FAB)'),
    ('D', 'teal-9', 'sand-1', 3.0, 'relleno accion vs pagina (FAB)'),
]

def main():
    fails = 0
    rows = []
    for mode, fg, bg, req, role in MATRIX:
        pal = L if mode == "L" else D
        r = ratio(pal[fg], pal[bg])
        ok = r >= req
        fails += not ok
        rows.append((mode, fg, bg, role, req, r, ok))
    w = max(len(r[3]) for r in rows)
    print(f"{'mode':4} {'fg':9} {'bg':9} {'role':<{w}} {'req':>4} {'ratio':>8} verdict")
    for mode, fg, bg, role, req, r, ok in rows:
        print(f"{mode:4} {fg:9} {bg:9} {role:<{w}} {req:>4} {r:7.2f}:1 {'PASS' if ok else 'FAIL'}")
    print(f"\n{len(rows)} pairs checked, {fails} failures")
    return 1 if fails else 0

if __name__ == "__main__":
    sys.exit(main())
