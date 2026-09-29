#!/usr/bin/env python3
"""Phase 4 · Batch 3 — screens 10–13 (covers C6.4/C6.5, C1.2/C7, C11, C10).

10 Detalle de cliente · 11 Empleados · 12 Reportes mínimos · 13 Respaldo y datos

Run:  python3 design/tools/batch3.py
Same state protocol as batches 1–2 (default · vacío · sin conexión · error, plus
extras where the flow needs them); Phase-3 components only.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from shell import (  # noqa: E402
    banner, content, frame, header, icon, page, pending, section, stat, sticky_cta,
    teach,
)
from parts import (  # noqa: E402
    action_row, alert_card, employee_row, invite_code_card, movement_row, rank_row,
    segmented, share_preview,
)

NAV_PAD = "p-4 pb-20"  # clears the raised center FAB when scrolled to bottom


# ------------------------------------------------------- 10. Detalle de cliente
def screen_cliente():
    def balance(amount="$12.50", when="Último movimiento hace 12 días", phone="7788-1234"):
        return (
            '<article class="card mb-4">'
            '<p class="balance-label">Saldo</p>'
            '<p class="card-amount balance-amount flex items-center gap-2 mt-1">'
            f'{icon("coins", "w-icon h-icon")}{amount}</p>'
            f'<p class="card-meta mt-1">{phone} · {when}</p></article>'
        )

    ledger = (
        balance()
        + section("Cargos y abonos")
        + movement_row("abono", "Abonó en efectivo", "$5.00", "Hace 3 días", user="José")
        + movement_row("cargo", "2 leches + 1 arroz", "$1.90", "Hace 12 días", user="Marta")
        + movement_row("cargo", "3 bolsas de agua", "$1.50", "Hace 20 días", user="Marta")
    )

    empty = balance("$0.00", "Todavía sin movimientos")

    offline_note = (
        '<div class="mb-3 flex items-center gap-2">' + pending()
        + '<span class="card-meta">1 fiado sin confirmar</span></div>'
    )

    message = (
        "Hola Doña Rosa, este es su estado de cuenta en La Tiendita:\n"
        "\n"
        "Saldo pendiente: $12.50\n"
        "Último movimiento: hace 12 días\n"
        "\n"
        "Gracias."
    )

    cta_fiar = '<button class="btn btn-primary flex-1">Fiar</button>'
    cta_abonar = '<button class="btn btn-secondary flex-1">Abonar</button>'

    states = [
        ("Default",
         "Historial del cliente en 2 toques (C6.4): saldo derivado y cada cargo/abono con fecha y quién lo hizo.",
         frame(header("Doña Rosa", back=True, action=("share_2", "Compartir estado de cuenta"))
               + content(ledger) + sticky_cta(cta_fiar, cta_abonar))),
        ("Vacío",
         "Cliente sin movimientos: el saldo arranca en cero y el estado vacío explica cómo se usa.",
         frame(header("Doña Rosa", back=True)
               + content(empty + teach(
                   "coins", "Sin movimientos todavía",
                   "Cuando le fíes o te abone, cada cargo y abono queda aquí con fecha y nota. "
                   "El saldo se calcula solo.",
                   '<button class="btn btn-primary w-full">Fiar</button>',
                   '<button class="btn btn-secondary w-full">Abonar</button>'))
               + sticky_cta(cta_fiar, cta_abonar))),
        ("Sin conexión",
         "Fiar y abonar funcionan sin internet: el saldo cambia al instante en el teléfono y queda por sincronizar.",
         frame(header("Doña Rosa", back=True, action=("share_2", "Compartir estado de cuenta"))
               + banner()
               + content(offline_note
                         + balance("$17.50", "Último movimiento hoy")
                         + section("Cargos y abonos")
                         + movement_row("cargo", "Fió 2 bultos de harina", "$5.00", "Hoy",
                                        user="Marta", pending_sync=True)
                         + movement_row("abono", "Abonó en efectivo", "$5.00", "Hace 3 días", user="José"))
               + sticky_cta(cta_fiar, cta_abonar))),
        ("Compartir estado de cuenta",
         "El mensaje se genera localmente (C6.5) y se manda con la app del teléfono; sin backend de mensajería.",
         frame(header("Estado de cuenta", back=True)
               + content(share_preview("Doña Rosa", message)))),
        ("Error de carga",
         "Si no se puede leer el historial, se explica y se ofrece Reintentar; el saldo sigue en el teléfono.",
         frame(header("Doña Rosa", back=True)
               + content(alert_card("No se pudo cargar el historial",
                                    "El saldo sigue guardado en tu teléfono. Revisa la conexión e "
                                    "inténtalo otra vez.",
                                    '<button class="btn btn-secondary">Reintentar</button>'))
               + sticky_cta(cta_fiar, cta_abonar))),
    ]
    return page("10-cliente", "Detalle de cliente", states, active=None)


# ------------------------------------------------------------------ 11. Empleados
def screen_empleados():
    def people():
        return (
            '<p class="card-meta mb-3">En este negocio. La dueña invita; los empleados operan productos, '
            "movimientos y fiados (C7).</p>"
            + section("Quiénes tienen acceso")
            + employee_row("Marta Meléndez", "Dueña", "Creó el negocio · acceso completo")
            + employee_row("José Ramírez", "Empleado", "Se unió hace 2 meses")
        )

    invite_cta = (
        '<div class="card mt-2">'
        '<p class="card-title">Invita a un empleado</p>'
        '<p class="card-meta mt-1">Genera un código de un solo uso. José lo ingresa desde su teléfono '
        "y queda vinculado a tu tienda.</p>"
        '<button class="btn btn-primary w-full mt-3">Generar código de invitación</button>'
        "</div>"
    )

    states = [
        ("Default",
         "Solo la dueña gestiona el acceso; cada persona con su rol. La lista deja claro quién es quién.",
         frame(header("Empleados", action=("plus", "Invitar empleado"))
               + content(people() + invite_cta, pad=NAV_PAD), nav_key="mas")),
        ("Vacío",
         "Sin empleados todavía (solo la dueña): el estado vacío explica el beneficio y ofrece el primer paso.",
         frame(header("Empleados", action=("plus", "Invitar empleado"))
               + content(teach(
                   "user_plus", "Invita a tu primer empleado",
                   "José registrará productos, movimientos y fiados con su propio teléfono. "
                   "Y solo verá tu tienda, nunca la de otro negocio.",
                   '<button class="btn btn-primary w-full">Generar código</button>'), pad=NAV_PAD),
               nav_key="mas")),
        ("Código generado",
         "Código de un solo uso con vencimiento visible (C1.2); se comparte por la app que ya usa Marta.",
         frame(header("Empleados", action=("plus", "Invitar empleado"))
               + content(invite_code_card("7K4-9QF")
                         + '<p class="field-help mt-3">Muéstraselo o mándalo por WhatsApp. Si vence, '
                           "genera otro sin problema.</p>", pad=NAV_PAD), nav_key="mas")),
        ("Sin conexión",
         "Invitar es lo único que sí requiere internet; todo lo demás sigue funcionando sin conexión (DS-25).",
         frame(header("Empleados", action=("plus", "Invitar empleado")) + banner()
               + content(alert_card("Para invitar necesitas conexión",
                                    "Generar el código de invitación sí usa internet. Tus datos y el "
                                    "resto de la app siguen funcionando sin conexión.",
                                    '<button class="btn btn-secondary">Reintentar</button>', tone="warning")
                         + '<div class="mt-4"></div>' + people(), pad=NAV_PAD), nav_key="mas")),
        ("Error",
         "Si falla la generación, se dice qué pasó y se ofrece reintentar; nada se pierde.",
         frame(header("Empleados", action=("plus", "Invitar empleado"))
               + content(alert_card("No se pudo generar el código",
                                    "Puede ser la conexión. Inténtalo otra vez en un momento.",
                                    '<button class="btn btn-secondary">Reintentar</button>')
                         + '<div class="mt-4"></div>' + people(), pad=NAV_PAD), nav_key="mas")),
    ]
    return page("11-empleados", "Empleados", states, active="mas")


# -------------------------------------------------------------- 12. Reportes
def screen_reportes():
    def body(rng, extra_top=""):
        return (
            extra_top
            + '<div class="mb-4">'
            + segmented("Rango", ["Este mes", "30 días", "Este año"], rng) + "</div>"
            + section("Inventario")
            + '<div class="flex gap-2 mb-4">'
            + stat("Valor al costo", "$1,240.00", "package")
            + stat("Valor a precio", "$1,860.00", "coins", tone="success")
            + "</div>"
            + section("Fiados")
            + '<div class="flex gap-2 mb-4">'
            + stat("Fiado", "$86.50", "coins", tone="credit")
            + stat("Cobrado", "$40.00", "check", tone="success")
            + "</div>"
            + section("Lo que más se movió")
            + rank_row("Refresco Big Cola 355ml", "48 entradas · 132 salidas", "160 movs")
            + rank_row("Harina Selecta 5 lb", "20 entradas · 41 salidas", "61 movs")
            + rank_row("Leche Doña Vera 1 L", "15 entradas · 38 salidas", "53 movs")
        )

    states = [
        ("Default",
         "Reportes mínimos (C11): valor del inventario, resumen de fiados y lo que más se movió, por rango.",
         frame(header("Reportes") + content(body("Este mes"), pad=NAV_PAD), nav_key="mas")),
        ("Vacío",
         "Sin movimientos aún: el estado vacío explica qué aparecerá aquí y lleva al primer paso.",
         frame(header("Reportes")
               + content(teach(
                   "bar_chart_3", "Aún no hay datos para reportar",
                   "Cuando registres entradas, salidas y fiados, aquí verás el valor de tu inventario "
                   "y lo que más se mueve.",
                   '<a class="btn btn-primary w-full" href="05-productos.html">Ver productos</a>'),
                   pad=NAV_PAD), nav_key="mas")),
        ("Sin conexión",
         "Los reportes se calculan en el teléfono con tus datos: funcionan igual sin internet.",
         frame(header("Reportes") + banner()
               + content('<p class="card-meta mb-3">Se calculan en tu teléfono, con lo que ya tienes '
                         "guardado. No necesitas conexión.</p>" + body("Este mes"), pad=NAV_PAD),
               nav_key="mas")),
        ("Error",
         "Si falla el cálculo, se explica y se ofrece Reintentar; los datos no se tocan.",
         frame(header("Reportes")
               + content(alert_card("No se pudieron calcular los reportes",
                                    "Tus datos siguen en el teléfono. Revisa la conexión e inténtalo otra vez.",
                                    '<button class="btn btn-secondary">Reintentar</button>'), pad=NAV_PAD),
               nav_key="mas")),
    ]
    return page("12-reportes", "Reportes mínimos", states, active="mas")


# --------------------------------------------------------- 13. Respaldo y datos
def screen_respaldo():
    def body(extra_top=""):
        return (
            extra_top
            + '<div class="card mb-4">'
            '<div class="flex items-start gap-3">'
            f'<span class="text-link">{icon("circle_check", "w-icon h-icon")}</span>'
            '<div class="min-w-0 flex-1"><p class="card-title">Tus datos son tuyos</p>'
            '<p class="card-meta mt-1">Llévatelos cuando quieras, en CSV o JSON. La puerta de salida '
            "siempre está abierta (C10).</p></div></div></div>"
            + section("Exportar")
            + action_row("file_down", "Productos (CSV)", "Para abrir en Excel")
            + action_row("file_down", "Movimientos (CSV)", "Entradas, salidas y ajustes")
            + action_row("file_down", "Fiados (CSV)", "Cargos, abonos y saldos")
            + section("Respaldo completo")
            + action_row("file_down", "Respaldo (JSON)", "Todo, para restaurar en otro teléfono")
            + section("Importar")
            + action_row("clipboard_list", "Importar desde CSV", "Plantilla incluida, para migrar de Excel")
            + '<p class="field-help mt-3">Todo esto se genera en tu teléfono, sin internet.</p>'
        )

    exported = (
        '<div class="card">'
        '<div class="flex items-start gap-3">'
        f'<span class="text-success-text">{icon("circle_check", "w-icon h-icon")}</span>'
        '<div class="min-w-0 flex-1"><p class="card-title">Respaldo listo</p>'
        '<p class="card-meta mt-1">la-tiendita-2026-09-29.json · 2.4 MB</p>'
        '<p class="field-help mt-3">Guárdalo en tu teléfono o mándalo a tu correo. Con ese archivo '
        "puedes recuperar todo en otro teléfono.</p>"
        '<div class="flex flex-col gap-2 mt-3">'
        f'<button class="btn btn-primary w-full">{icon("share_2", "w-4 h-4")}Compartir respaldo</button>'
        '<button class="btn btn-secondary w-full">Guardar en el teléfono</button>'
        "</div></div></div></div>"
    )

    template = (
        '<div class="card mb-4">'
        '<p class="card-title">Migrar desde Excel o otro sistema</p>'
        '<p class="card-meta mt-1">Descarga la plantilla de ejemplo, llena tus productos y súbela. '
        "Nada se guarda hasta que confirmes.</p>"
        '<div class="flex flex-col gap-2 mt-3">'
        f'<button class="btn btn-secondary w-full">{icon("file_down", "w-4 h-4")}Descargar plantilla</button>'
        '<button class="btn btn-primary w-full">Elegir archivo CSV</button>'
        "</div></div>"
    )

    states = [
        ("Default",
         "Exportar y respaldar desde el teléfono (C10.1/C10.2). Una fila por acción, con etiqueta y meta.",
         frame(header("Respaldo y datos") + content(body(), pad=NAV_PAD), nav_key="mas")),
        ("Respaldo listo",
         "Confirmación honesta: qué archivo se creó, cuánto pesa y qué se puede hacer con él.",
         frame(header("Respaldo y datos") + content(exported, pad=NAV_PAD), nav_key="mas")),
        ("Importar (plantilla)",
         "Migración desde Excel/Loyverse con plantilla incluida (C10.3); el import no aplica sin confirmar.",
         frame(header("Importar datos", back=True) + content(template), nav_key="mas")),
        ("Sin conexión",
         "Exportar y respaldar no necesitan internet: el archivo se arma en el teléfono.",
         frame(header("Respaldo y datos") + banner()
               + content('<p class="card-meta mb-3">Sin conexión igual puedes exportar y respaldar: '
                         "el archivo se crea en tu teléfono.</p>" + body(), pad=NAV_PAD), nav_key="mas")),
        ("Error",
         "Si falla la creación del archivo, se explica y se ofrece reintentar; no se pierde nada.",
         frame(header("Respaldo y datos")
               + content(alert_card("No se pudo crear el archivo",
                                    "Puede ser el espacio del teléfono. Inténtalo otra vez.",
                                    '<button class="btn btn-secondary">Reintentar</button>')
                         + '<div class="mt-4"></div>' + body(), pad=NAV_PAD), nav_key="mas")),
    ]
    return page("13-respaldo", "Respaldo y datos", states, active="mas")


if __name__ == "__main__":
    for fn in (screen_cliente, screen_empleados, screen_reportes, screen_respaldo):
        print(fn())
