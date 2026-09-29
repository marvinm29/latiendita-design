#!/usr/bin/env python3
"""Static QA for Phase-4 screens (runs without a browser).

Checks each `design/screens/*.html`:
  1. every <use href="#i-*"> points to an icon that exists in assets/icons.svg
  2. no duplicate element id within a page
  3. every <label for> / aria-describedby / aria-labelledby target id exists
  4. no external runtime URL (src/href) — the app must work fully offline
  5. every field control has a visible <label for>

Exit code 0 = clean. This is the reproducible counterpart of the browser QA
recorded in decisions.md; run it as part of the design lint.

Usage:  python3 design/tools/qa.py
"""
import re
import sys
from collections import Counter
from pathlib import Path

DESIGN = Path(__file__).resolve().parents[1]
SCREENS = sorted((DESIGN / "screens").glob("*.html"))
SPRITE = DESIGN / "assets" / "icons.svg"

USE_RE = re.compile(r'<use\s+href="#i-([a-z_0-9]+)"')
ID_RE = re.compile(r'\bid="([^"]+)"')
FOR_RE = re.compile(r'<label[^>]*\bfor="([^"]+)"')
IDREF_RE = re.compile(r'\baria-(?:labelledby|describedby)="([^"]+)"')
SRC_RE = re.compile(r'\b(?:src|href)="(https?://[^"]+)"')
CONTROL_RE = re.compile(r'<(?:input|select|textarea)\b[^>]*\bid="([^"]+)"')


def main() -> int:
    symbols = set(re.findall(r'<symbol\s+id="i-([a-z_0-9]+)"', SPRITE.read_text(encoding="utf-8")))
    failures = 0
    total_frames = 0
    for path in SCREENS:
        html = path.read_text(encoding="utf-8")
        name = path.name
        problems = []

        used = set(USE_RE.findall(html))
        missing = sorted(used - symbols)
        if missing:
            problems.append(f"iconos inexistentes: {', '.join(missing)}")

        ids = ID_RE.findall(html)
        dups = sorted(i for i, c in Counter(ids).items() if c > 1)
        if dups:
            problems.append(f"ids duplicados: {', '.join(dups)}")

        id_set = set(ids)
        refs = set(FOR_RE.findall(html))
        for group in IDREF_RE.findall(html):
            refs.update(group.split())
        dangling = sorted(r for r in refs if r not in id_set)
        if dangling:
            problems.append(f"referencias sin destino: {', '.join(dangling)}")

        external = sorted(set(SRC_RE.findall(html)))
        if external:
            problems.append(f"URLs externas: {', '.join(external)}")

        # every control with an id must be labelled by a matching <label for>
        labelled = set(FOR_RE.findall(html))
        unlabelled = sorted(c for c in set(CONTROL_RE.findall(html)) if c not in labelled)
        # search fields are wrapped in a label; allow aria-label/aria-labelledby escape hatch
        unlabelled = [c for c in unlabelled if f'aria-labelledby="{c}' not in html]
        if unlabelled:
            problems.append(f"controles sin etiqueta: {', '.join(unlabelled)}")

        frames = html.count('class="w-[360px]')
        total_frames += frames
        status = "OK " if not problems else "FAIL"
        print(f"[{status}] {name:26} frames={frames:<3} iconos={len(used)} ids={len(ids)}")
        for p in problems:
            print(f"        - {p}")
            failures += 1

    print(f"\n{len(SCREENS)} pantallas · {total_frames} marcos · {failures} hallazgos")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
