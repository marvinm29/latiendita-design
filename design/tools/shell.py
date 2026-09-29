#!/usr/bin/env python3
"""Shared shell for Phase-4 screen mockups.

Renders each screen as an HTML file with N state frames
(normal / vacío / sin conexión / error / extras), injecting the icon sprite,
theme toggle, prev-next links, optional offline banner and bottom nav.
Design tokens are used exclusively (no hard-coded colors, no hex).
"""
from itertools import count
from pathlib import Path

_UID = count(1)

DESIGN = Path(__file__).resolve().parents[1]
SPRITE = (DESIGN / "assets" / "icons.svg").read_text(encoding="utf-8")
OUT = DESIGN / "screens"

# nav destination -> (file, label, icon)
NAV = [
    ("inicio", "03-inicio.html", "Inicio", "house"),
    ("productos", "05-productos.html", "Productos", "package"),
    ("escanear", "04-escanear.html", "Escanear", "scan_barcode"),
    ("fiados", "09-fiados.html", "Fiados", "book_open"),
    ("mas", "12-reportes.html", "Más", "menu"),
]

SLUGS = [
    "01-crear-tienda",
    "02-unirse",
    "03-inicio",
    "04-escanear",
    "05-productos",
    "06-nuevo-producto",
    "07-movimiento",
    "08-conteo",
    "09-fiados",
    "10-cliente",
    "11-empleados",
    "12-reportes",
    "13-respaldo",
]


def icon(name, cls="w-icon h-icon", label=None):
    """Lucide sprite use-element. Visible text labels are added by callers."""
    if label:
        return (
            f'<svg class="{cls}" role="img" aria-label="{label}">'
            f'<use href="#i-{name}"></use></svg>'
        )
    return f'<svg class="{cls}" aria-hidden="true"><use href="#i-{name}"></use></svg>'


def banner():
    """Persistent offline banner (C8.2 exact copy). Goes directly under header."""
    return (
        '<div class="offline-banner" role="status">'
        f'{icon("wifi_off", "w-icon h-icon")}'
        '<span>Sin conexión — se sincronizará al reconectar</span></div>'
    )


def pending(label="por sincronizar"):
    """Neutral sync-state badge (DS-17) — text + icon, never color-only."""
    return (
        '<span class="chip chip-pending">'
        f'{icon("clock", "w-4 h-4")}{label}</span>'
    )


def header(title, back=False, action=None, leading=""):
    """56px app header. action = (icon_name, aria_label)."""
    left = (
        f'<button class="btn btn-icon" type="button" aria-label="Volver">'
        f'{icon("arrow_left")}</button>' if back
        else leading or '<span class="w-icon" aria-hidden="true"></span>'
    )
    act = (
        f'<button class="btn btn-icon" type="button" aria-label="{action[1]}">'
        f'{icon(action[0])}</button>' if action
        else '<span class="w-icon" aria-hidden="true"></span>'
    )
    return (
        '<header class="sticky top-0 z-10 bg-background border-b border-card '
        'min-h-header flex items-center gap-2 px-2 shrink-0">'
        f'{left}'
        f'<h1 class="text-2xl font-bold flex-1 truncate">{title}</h1>'
        f'{act}</header>'
    )


def nav(active):
    """Bottom nav: 4 destinations + center Escanear FAB (max 5)."""
    items = []
    for key, href, label, ic in NAV:
        current = ' aria-current="page"' if key == active else ""
        if key == "escanear":
            items.append(
                f'<a class="nav-item nav-center" href="{href}"{current}>'
                f'<span class="fab-scan" aria-hidden="true">{icon(ic, "w-icon h-icon")}</span>'
                '<span class="nav-label">Escanear</span></a>'
            )
        else:
            cls = "nav-item" + (" is-active" if key == active else "")
            items.append(
                f'<a class="{cls}" href="{href}"{current}>'
                f'{icon(ic, "w-icon h-icon")}<span class="nav-label">{label}</span></a>'
            )
    return f'<nav class="bottom-nav shrink-0" aria-label="Navegación principal">{"".join(items)}</nav>'


def content(html, pad="p-4"):
    """Scrollable content region of the phone frame."""
    return f'<div class="flex-1 overflow-y-auto {pad}">{html}</div>'


def frame(*parts, nav_key=None):
    """360×640 device frame. Compose header/banner/content/cta/nav in order."""
    nav_html = nav(nav_key) if nav_key else ""
    return (
        '<div class="w-[360px] mx-auto rounded-xl border border-card overflow-hidden '
        'bg-background flex flex-col" style="height:640px">'
        f'{"".join(parts)}{nav_html}</div>'
    )


def state(label, note, phone_html):
    return (
        '<section class="mb-10">'
        '<div class="flex flex-wrap items-baseline gap-2 mb-1">'
        f'<h2 class="text-lg font-bold">{label}</h2></div>'
        f'<p class="demo-note mb-3">{note}</p>'
        f'{phone_html}</section>'
    )


def sticky_cta(*buttons):
    return (
        '<div class="shrink-0 bg-background border-t border-card p-3">'
        f'<div class="flex gap-2">{"".join(buttons)}</div></div>'
    )


def teach(icon_name, title, body, *buttons):
    """Empty-state: icon in sunken circle + teaching text (Phase-3 decision)."""
    return (
        '<div class="flex flex-col items-center text-center gap-3 px-5 py-10">'
        '<div class="w-16 h-16 rounded-full bg-muted flex items-center justify-center '
        f'text-muted-foreground">{icon(icon_name, "w-7 h-7")}</div>'
        f'<p class="card-title">{title}</p>'
        f'<p class="card-meta max-w-[260px]">{body}</p>'
        f'<div class="flex flex-col gap-2 w-full max-w-[260px] mt-1">{"".join(buttons)}</div>'
        "</div>"
    )


def section(title, action_href=None, action_label=None):
    """Section head with optional inline link action."""
    right = ""
    if action_label:
        right = (
            f'<a class="text-link text-sm font-bold" href="{action_href or "#"}">'
            f'{action_label}</a>'
        )
    return (
        '<div class="flex items-baseline justify-between gap-2 mb-2">'
        f'<h2 class="text-xl font-bold">{title}</h2>{right}</div>'
    )


def stat(label, value, icon_name, tone=""):
    """Small summary card: icon + label + figure. tone in {'', danger, credit, success}."""
    tone_cls = {
        "": "",
        "danger": "text-danger-text",
        "warning": "text-warning-text",
        "credit": "text-credit-text",
        "success": "text-success-text",
    }[tone]
    return (
        '<div class="card p-3 flex-1 min-w-0">'
        f'<div class="flex items-center gap-1 text-muted-foreground">{icon(icon_name, "w-4 h-4")}'
        f'<span class="text-xs">{label}</span></div>'
        f'<p class="text-xl font-bold tabular {tone_cls} mt-1 truncate">{value}</p>'
        "</div>"
    )


def field(label, *, value="", helper="", error="", control="", cls="", id_="", type="text",
          inputmode=None, placeholder="", autocomplete="off"):
    """Label + control + helper/error. Every field has a visible label."""
    uid = id_ or label.lower().replace(" ", "-").replace("í", "i").replace("ó", "o")
    uid = f"{uid}-{next(_UID)}"
    if not control:
        mode = f' inputmode="{inputmode}"' if inputmode else ""
        ph = f' placeholder="{placeholder}"' if placeholder else ""
        control = (
            f'<input class="field-input" id="{uid}" type="{type}" value="{value}"'
            f'{mode}{ph} autocomplete="{autocomplete}">'
        )
    control = control.replace("__UID__", uid)
    msg = ""
    if error:
        msg = (
            f'<p class="field-error" id="{uid}-err">'
            f'{icon("circle_alert", "w-icon h-icon")}{error}</p>'
        )
        control = control.replace(
            "<input", f'<input aria-invalid="true" aria-describedby="{uid}-err"', 1
        )
        cls = (cls + " is-error").strip()
    elif helper:
        msg = f'<p class="field-help" id="{uid}-help">{helper}</p>'
    return (
        f'<div class="field {cls}">'
        f'<label class="field-label" for="{uid}">{label}</label>'
        f"{control}{msg}</div>"
    )


def page(slug, title, states, active=None, back=False):
    """Render one screen file. states = [(state_label, note, phone_html), ...]"""
    idx = SLUGS.index(slug)
    prev_ = SLUGS[idx - 1] + ".html" if idx > 0 else "../preview.html"
    next_ = SLUGS[idx + 1] + ".html" if idx < len(SLUGS) - 1 else "../preview.html"
    prev_label = "preview" if idx == 0 else SLUGS[idx - 1].split("-", 1)[1].replace("-", " ")
    next_label = "preview" if idx == len(SLUGS) - 1 else SLUGS[idx + 1].split("-", 1)[1].replace("-", " ")

    sections = "".join(state(lbl, note, ph) for lbl, note, ph in states)
    nav_note = ""
    if active is None:
        nav_note = " (flujo centrado — sin barra de navegación)"

    html = f"""<!doctype html>
<html lang="es-SV">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{idx + 1} · {title} — LaTiendita (Fase 4)</title>
<link rel="stylesheet" href="../tokens/tokens.css">
<link rel="stylesheet" href="../assets/base.css">
<link rel="stylesheet" href="../assets/ui.css">
<script src="../assets/tailwind.js"></script>
<script src="../assets/theme.js"></script>
<style>.demo-note{{color:var(--color-text-muted);font-size:14px;line-height:20px}}</style>
{SPRITE}
</head>
<body class="bg-muted text-foreground min-h-screen">
<div class="max-w-[900px] mx-auto px-4 py-6 pb-16">
  <div class="flex flex-wrap items-center gap-3 mb-1">
    <a href="../preview.html" class="text-link text-sm font-medium">preview</a>
    <a href="{prev_}" class="text-link text-sm">← {prev_label}</a>
    <a href="{next_}" class="text-link text-sm">{next_label} →</a>
    <div class="ml-auto flex items-center gap-1" role="group" aria-label="Tema">
      <button type="button" class="btn btn-secondary !min-h-[40px] !px-3 text-xs" data-theme-btn data-value="auto" aria-pressed="true">Auto</button>
      <button type="button" class="btn btn-secondary !min-h-[40px] !px-3 text-xs" data-theme-btn data-value="light" aria-pressed="false">Claro</button>
      <button type="button" class="btn btn-secondary !min-h-[40px] !px-3 text-xs" data-theme-btn data-value="dark" aria-pressed="false">Oscuro</button>
    </div>
  </div>
  <p class="demo-note mb-6">Pantalla {idx + 1} de {len(SLUGS)} — {title}{nav_note}. Cada sección es un estado independiente a 360&nbsp;px.</p>
  {sections}
</div>
<script>
  // Tema: Auto = sin data-theme (prefers-color-scheme) · Claro/Oscuro = data-theme explícito
  (function () {{
    var btns = document.querySelectorAll('[data-theme-btn]');
    function applyTheme(v) {{
      if (v === 'auto') document.documentElement.removeAttribute('data-theme');
      else document.documentElement.setAttribute('data-theme', v);
      btns.forEach(function (b) {{ b.setAttribute('aria-pressed', String(b.dataset.value === v)); }});
    }}
    btns.forEach(function (b) {{ b.addEventListener('click', function () {{ applyTheme(b.dataset.value); }}); }});
  }})();
</script>
</body>
</html>
"""
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"{slug}.html"
    path.write_text(html, encoding="utf-8")
    return path
