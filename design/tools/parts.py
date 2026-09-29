#!/usr/bin/env python3
"""Reusable Phase-4 mockup parts (token-only, Spanish copy).

Used by batch1.py / batch2.py. Anything here must render with the Phase-3
component classes only — no inline colors, no new CSS.
"""
from shell import _UID, field, icon, pending


def status_chip(level, label=None):
    """Stock chip: icon + text, never color-only. level in success|warning|danger."""
    name, text, cls = {
        "success": ("package_check", "En stock", "chip-success"),
        "warning": ("alert_triangle", "Bajo mínimo", "chip-warning"),
        "danger": ("package_x", "Agotado", "chip-danger"),
    }[level]
    return f'<span class="chip {cls}">{icon(name, "w-4 h-4")}{label or text}</span>'


def product_card(name, meta, price, qty, level):
    """Static product card (article)."""
    return (
        '<article class="card mb-2">'
        '<div class="flex items-start justify-between gap-3">'
        f'<div class="min-w-0"><h3 class="card-title">{name}</h3>'
        f'<p class="card-meta">{meta}</p></div>'
        f"{status_chip(level)}</div>"
        '<div class="flex items-center justify-between gap-3 mt-2">'
        f'<span class="product-price">{price}</span>'
        f'<span class="card-meta tabular">{qty}</span></div>'
        "</article>"
    )


def product_row(name, meta, price, qty, level, *, pending_sync=False):
    """Tappable product row: the whole row is the target (≥48px) and opens the product."""
    pend = f'<div class="mt-2">{pending()}</div>' if pending_sync else ""
    return (
        '<article class="card mb-2">'
        f'<button type="button" class="card-row" '
        f'aria-label="{name}, {price}, {qty}. Ver producto.">'
        '<div class="min-w-0 flex-1">'
        '<div class="flex items-start justify-between gap-3">'
        f'<div class="min-w-0"><h3 class="card-title">{name}</h3>'
        f'<p class="card-meta">{meta}</p></div>'
        f"{status_chip(level)}</div>"
        '<div class="flex items-center justify-between gap-3 mt-2">'
        f'<span class="product-price">{price}</span>'
        f'<span class="card-meta tabular">{qty}</span></div>'
        f"{pend}</div>"
        f'{icon("chevron_right", "w-icon h-icon card-chevron")}'
        "</button></article>"
    )


def customer_card(name, amount, age, al_dia=False, pending_sync=False):
    tag = f'<div class="mt-2">{pending()}</div>' if pending_sync else ""
    amount_html = (
        '<p class="card-amount"><span class="chip chip-success">'
        f'{icon("check", "w-4 h-4")}Al día</span></p>'
        if al_dia else
        '<p class="card-amount balance-amount flex items-center gap-2">'
        f'{icon("coins", "w-icon h-icon")}{amount}</p>'
    )
    return (
        '<article class="card mb-2">'
        '<button type="button" class="card-row" '
        f'aria-label="{name}, {"saldo al día" if al_dia else "debe " + amount}, {age}. Ver detalle.">'
        '<div class="min-w-0 flex-1">'
        f'<h3 class="card-title">{name}</h3>'
        '<p class="balance-label">Saldo</p>'
        f"{amount_html}"
        f'<p class="card-meta mt-1">{age}</p>{tag}</div>'
        f'{icon("chevron_right", "w-icon h-icon card-chevron")}'
        "</button></article>"
    )


def search_field(label="Buscar producto", placeholder="Nombre o código de barras",
                 helper="Los resultados aparecen mientras escribes, sin internet.", value=""):
    return field(
        label,
        control=(
            '<div class="relative">'
            '<span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">'
            f'{icon("search", "w-icon h-icon")}</span>'
            '<input class="field-input pl-11" id="__UID__" type="search" '
            f'value="{value}" placeholder="{placeholder}" autocomplete="off">'
            "</div>"
        ),
        helper=helper,
    )


def alert_card(title, body, *buttons, tone="danger"):
    ic = "alert_triangle" if tone == "danger" else "circle_alert"
    tone_cls = "text-danger-text" if tone == "danger" else "text-warning-text"
    return (
        '<div class="card flex items-start gap-3">'
        f'<span class="{tone_cls}">{icon(ic, "w-icon h-icon")}</span>'
        f'<div class="min-w-0 flex-1"><p class="card-title">{title}</p>'
        f'<p class="card-meta mt-1">{body}</p>'
        f'<div class="flex flex-col gap-2 mt-3">{"".join(buttons)}</div></div></div>'
    )


def keypad_grid():
    keys = "".join(f'<button type="button" class="key">{d}</button>' for d in "123456789")
    return (
        '<div class="keypad-grid">'
        f'{keys}<button type="button" class="key" aria-label="Punto decimal">.</button>'
        '<button type="button" class="key">0</button>'
        f'<button type="button" class="key" aria-label="Borrar último dígito">'
        f'{icon("delete")}</button></div>'
    )


def keypad(display_label, value, aria):
    """Numeric keypad with a labelled display (amounts / counts / codes)."""
    kid = f"kp-{next(_UID)}"
    return (
        f'<p class="field-label" id="{kid}">{display_label}</p>'
        f'<div class="keypad-display mt-1" role="status" '
        f'aria-labelledby="{kid}" aria-label="{aria}">'
        f'<span class="tabular">{value}</span></div>'
        f'<div class="keypad mt-3">{keypad_grid()}</div>'
    )


def viewfinder():
    return (
        '<div class="relative rounded-lg bg-muted border border-strong flex items-center '
        'justify-center" style="height:240px" role="img" '
        'aria-label="Vista de la cámara apuntando a un código de barras">'
        '<div class="w-[220px] h-[120px] rounded-md border-2 border-dashed '
        'border-strong flex items-center justify-center text-muted-foreground">'
        f'{icon("barcode", "w-7 h-7")}</div>'
        '<span class="absolute left-[70px] right-[70px] h-[2px] bg-border-strong" '
        'aria-hidden="true"></span></div>'
    )


def segmented(name, options, active):
    """Segmented control: buttons with aria-pressed (styled by ui.css). 48px targets."""
    return (
        f'<div class="flex rounded-md border border-strong p-1 gap-1" role="group" aria-label="{name}">'
        + "".join(
            f'<button type="button" class="btn btn-secondary btn-segment flex-1 whitespace-nowrap" '
            f'aria-pressed="{"true" if o == active else "false"}">{o}</button>'
            for o in options
        )
        + "</div>"
    )


def difference_chip(diff):
    """Count difference: sobran (success) / faltan (warning) / sin diferencia (neutral)."""
    if diff > 0:
        return f'<span class="chip chip-success">{icon("package_plus", "w-4 h-4")}Sobran {diff}</span>'
    if diff < 0:
        return f'<span class="chip chip-warning">{icon("package_minus", "w-4 h-4")}Faltan {abs(diff)}</span>'
    return f'<span class="chip chip-pending">{icon("check", "w-4 h-4")}Sin diferencia</span>'


def movement_row(kind, desc, amount, when, *, user="", pending_sync=False):
    """Fiados ledger row. kind in cargo (ámbar, sube la deuda) | abono (verde, la baja)."""
    tone, ic, sign = (
        ("text-credit-text", "coins", "+") if kind == "cargo"
        else ("text-success-text", "check", "−")
    )
    pend = f'<div class="mt-2">{pending()}</div>' if pending_sync else ""
    who = f" · {user}" if user else ""
    return (
        '<article class="card mb-2">'
        '<div class="flex items-start gap-3">'
        f'<span class="{tone}">{icon(ic, "w-icon h-icon")}</span>'
        '<div class="min-w-0 flex-1">'
        f'<p class="card-title">{desc}</p>'
        f'<p class="card-meta">{when}{who}</p>{pend}</div>'
        f'<p class="{tone} tabular font-bold whitespace-nowrap">{sign}{amount}</p>'
        "</div></article>"
    )


def employee_row(name, role, detail):
    """Employee/owner row with a neutral role chip (never color-only: label carries it)."""
    return (
        '<article class="card mb-2">'
        '<div class="flex items-center gap-3">'
        '<div class="min-w-0 flex-1">'
        f'<h3 class="card-title">{name}</h3>'
        f'<p class="card-meta">{detail}</p></div>'
        f'<span class="chip chip-pending">{icon("users", "w-4 h-4")}{role}</span>'
        "</div></article>"
    )


def invite_code_card(code, days=7):
    """One-time invite code (C1.2). Requires connectivity to be generated (DS-25)."""
    return (
        '<div class="card">'
        '<div class="flex items-start justify-between gap-3">'
        '<div class="min-w-0"><p class="card-title">Código de invitación</p>'
        f'<p class="card-meta mt-1">Para que tu empleado se una. Sirve una sola vez.</p></div>'
        f'<span class="chip chip-pending">{icon("clock", "w-4 h-4")}{days} días</span></div>'
        '<p class="mt-3 rounded-md border border-strong bg-muted py-3 text-center text-2xl '
        f'font-bold tabular">{code}</p>'
        '<div class="flex flex-col gap-2 mt-3">'
        f'<button class="btn btn-primary w-full">{icon("share_2", "w-4 h-4")}Compartir código</button>'
        '<button class="btn btn-secondary w-full">Copiar código</button>'
        "</div></div>"
    )


def rank_row(name, meta, value):
    """'Lo que más se movió' ranking row."""
    return (
        '<article class="card mb-2">'
        '<div class="flex items-start justify-between gap-3">'
        '<div class="min-w-0"><h3 class="card-title">{}</h3>'
        '<p class="card-meta">{}</p></div>'
        '<p class="tabular font-bold whitespace-nowrap">{}</p>'
        "</div></article>"
    ).format(name, meta, value)


def action_row(icon_name, title, meta, *, href="#", chevron=True, tone=""):
    """Settings-style row: icon + title + meta, whole row tappable (≥48px)."""
    chev = icon("chevron_right", "w-icon h-icon card-chevron") if chevron else ""
    return (
        f'<a class="card mb-2 card-row" href="{href}">'
        f'<span class="{tone or "text-muted-foreground"}">{icon(icon_name, "w-icon h-icon")}</span>'
        '<span class="min-w-0 flex-1">'
        f'<span class="card-title block">{title}</span>'
        f'<span class="card-meta block">{meta}</span></span>{chev}</a>'
    )


def share_preview(name, message):
    """Generated-locally account statement (C6.5) — no messaging backend."""
    return (
        '<div class="card">'
        '<div class="flex items-start gap-3">'
        f'<span class="text-link">{icon("message_circle", "w-icon h-icon")}</span>'
        '<div class="min-w-0 flex-1"><p class="card-title">Estado de cuenta para ' + name + "</p>"
        '<p class="card-meta mt-1">Se arma en tu teléfono, sin internet. Tú eliges a quién enviarlo.</p>'
        "</div></div>"
        '<div class="mt-3 rounded-md border border-strong bg-muted p-3">'
        f'<p class="card-meta" style="white-space:pre-line">{message}</p></div>'
        '<div class="flex flex-col gap-2 mt-3">'
        f'<button class="btn btn-primary w-full">{icon("share_2", "w-4 h-4")}Compartir por WhatsApp</button>'
        '<button class="btn btn-secondary w-full">Copiar mensaje</button>'
        "</div></div>"
    )

