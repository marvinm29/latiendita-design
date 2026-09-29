#!/usr/bin/env python3
"""Phase 4 · Batch 1 — screens 1–4 (onboarding, join, home, scanner).

Run:  python3 design/tools/batch1.py
Each screen is rendered with its default / vacío / sin conexión / error states
(plus extras where the flow needs them), reusing Phase-3 components only.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from shell import (  # noqa: E402
    banner, content, field, frame, header, icon, page, pending, section, stat,
    sticky_cta, teach,
)
from parts import alert_card, customer_card, keypad_grid, product_card, search_field, viewfinder  # noqa: E402


# ---------------------------------------------------------------- 1. Onboarding
def screen_crear_tienda():
    brand = (
        '<div class="flex flex-col flex-1">'
        '<div class="flex-1 flex flex-col items-center justify-center text-center px-6 gap-3">'
        '<div class="w-16 h-16 rounded-full bg-muted flex items-center justify-center '
        f'text-muted-foreground">{icon("house", "w-7 h-7")}</div>'
        '<p class="text-3xl font-bold">LaTiendita</p>'
        '<p class="card-meta max-w-[280px]">Tu inventario y tus fiados, desde el teléfono '
        'que ya tienes. Funciona sin internet.</p></div>'
        '<div class="p-4 flex flex-col gap-2">'
        '<a class="btn btn-primary w-full" href="#">Crear mi tienda</a>'
        '<a class="btn btn-secondary w-full" href="02-unirse.html">Ya tengo un código</a>'
        "</div></div>"
    )

    form = lambda value, helper, err, disabled: (  # noqa: E731
        header("Crear tienda", back=True, leading='<span class="w-icon"></span>')
        + content(
            '<p class="card-meta mb-4">Escribe el nombre de tu tienda. Puedes cambiarlo '
            "después.</p>"
            + field(
                "Nombre de tu tienda",
                value=value,
                helper=helper,
                error=err,
                placeholder="Tienda de Marta",
            )
            + '<p class="field-help mt-3">Tú quedas como dueña y podrás invitar a tus '
            "empleados.</p>"
        )
        + sticky_cta(
            f'<button class="btn btn-primary w-full"{" disabled" if disabled else ""}>'
            "Crear tienda</button>"
        )
    )

    states = [
        ("Bienvenida (default)",
         "Primera pantalla; enseña el primer paso con una sola acción principal. Sin barra de navegación.",
         frame(brand)),
        ("Formulario · vacío",
         "Nombre vacío: el botón queda deshabilitado y el campo muestra ayuda, no un error.",
         frame(form("", "Así lo verás en el encabezado de la app.", "", True))),
        ("Sin conexión",
         "La tienda se crea localmente; el aviso es neutral (ni rojo ni ámbar) y el botón sigue activo.",
         frame(header("Crear tienda", back=True) + banner() + content(
             '<p class="card-meta mb-4">Escribe el nombre de tu tienda. Puedes cambiarlo '
             "después.</p>"
             + field("Nombre de tu tienda", value="Tienda de Marta",
                     helper="Se guarda en el teléfono y se sincroniza al reconectar.")
             + '<p class="field-help mt-3">Tú quedas como dueña y podrás invitar a tus '
               "empleados.</p>"
         ) + sticky_cta('<button class="btn btn-primary w-full">Crear tienda</button>'))),
        ("Error de validación",
         "El error dice qué pasó y qué hacer; el texto va al lado del campo, con icono y borde rojos.",
         frame(form("", "", "Escribe el nombre de tu tienda para continuar.", True))),
    ]
    return page("01-crear-tienda", "Onboarding · crear tienda", states, active=None, back=False)


# ---------------------------------------------------------------- 2. Unirse
def screen_unirse():
    def join(value, helper, err, disabled, note=""):
        body = (
            '<p class="card-meta mb-4">Pídele a la dueña de la tienda el código de '
            "invitación y escríbelo aquí.</p>"
            + field("Tu nombre", value="José", helper="Así te verán en el historial.")
            + '<div class="mt-4"></div>'
            + field("Código de invitación", value=value, helper=helper, error=err,
                    placeholder="TQ7-392")
            + (f'<div class="mt-4">{note}</div>' if note else "")
        )
        return (
            header("Unirme a una tienda", back=True)
            + content(body)
            + sticky_cta(
                f'<button class="btn btn-primary w-full"{" disabled" if disabled else ""}>'
                "Unirme</button>"
            )
        )

    pending_note = alert_card(
        "Necesitas internet para unirte",
        "El código se revisa con el servidor. Cuando tengas conexión, vuelve a intentarlo.",
        '<button class="btn btn-secondary">Reintentar</button>',
        tone="warning",
    )

    states = [
        ("Formulario (default)",
         "José escribe su nombre y el código de 6 caracteres que le dio la dueña. Una sola acción principal.",
         frame(join("TQ7-392", "Seis caracteres, como TQ7-392.", "", False))),
        ("Vacío",
         "Sin código: ayuda visible y botón deshabilitado. El flujo nunca depende de la cámara ni del email.",
         frame(join("", "Seis caracteres, como TQ7-392.", "", True))),
        ("Sin conexión",
         "Unirse sí necesita internet: se dice claro, sin culpar al usuario, y se ofrece reintentar.",
         frame(header("Unirme a una tienda", back=True) + banner()
               + content('<p class="card-meta mb-4">Pídele a la dueña el código de '
                         "invitación.</p>"
                         + field("Tu nombre", value="José")
                         + '<div class="mt-4"></div>'
                         + field("Código de invitación", value="TQ7-392")
                         + '<div class="mt-4">' + pending_note + "</div>")
               )),
        ("Error · código inválido",
         "Error de campo: qué pasó y qué hacer, con icono + texto (nunca solo color).",
         frame(join("TQ7-000", "", "Ese código no existe. Pídeselo otra vez a la dueña.", False))),
    ]
    return page("02-unirse", "Unirse con código (José)", states, active=None)


# ---------------------------------------------------------------- 3. Inicio
def screen_inicio():
    def summary(*, pending_row=False, dim=False):
        extra = ""
        if pending_row:
            extra = f'<div class="mb-3">{pending()}</div>'
        return (
            section("Resumen")
            + '<div class="flex gap-2 mb-4">'
            + stat("Productos", "248", "package")
            + stat("Por falta", "7", "alert_triangle", tone="warning")
            + stat("Fiado", "$86.50", "coins", tone="credit")
            + "</div>"
            + search_field()
            + (f'<div class="mt-4">{extra}</div>' if extra else '<div class="mt-4"></div>')
            + section("Qué te falta", "#", "Ver todo (7)")
            + product_card("Harina Selecta 5 lb", "Abarrotes · por unidad", "$1.10",
                           "3 uds · mínimo 5", "warning")
            + product_card("Leche Doña Vera 1 L", "Lácteos · por unidad", "$0.95",
                           "0 uds", "danger")
            + '<div class="mt-5"></div>'
            + section("Fiados", "#", "Ver libreta")
            + customer_card("Doña Rosa", "$12.50", "Último movimiento hace 12 días")
        )

    empty = teach(
        "package",
        "Agrega tu primer producto",
        "Con el código de barras el nombre se llena solo. Así empiezas a controlar tu "
        "inventario y tus fiados.",
        '<a class="btn btn-primary w-full" href="05-nuevo-producto.html">Agregar producto</a>',
        '<a class="btn btn-secondary w-full" href="04-escanear.html">Escanear</a>',
    )

    offline_body = (
        section("Resumen")
        + '<div class="flex gap-2 mb-4">'
        + stat("Productos", "248", "package")
        + stat("Por falta", "7", "alert_triangle", tone="warning")
        + stat("Fiado", "$86.50", "coins", tone="credit")
        + "</div>"
        + search_field()
        + '<div class="mt-4 mb-2 flex items-center gap-2">'
        + pending() + '<span class="card-meta">1 movimiento sin confirmar</span></div>'
        + section("Qué te falta", "#", "Ver todo (7)")
        + product_card("Harina Selecta 5 lb", "Abarrotes · por unidad", "$1.10",
                       "3 uds · mínimo 5", "warning")
    )

    error_body = alert_card(
        "No se pudieron actualizar los datos",
        "Tus datos siguen guardados en el teléfono. Revisa la conexión e inténtalo otra vez.",
        '<button class="btn btn-secondary">Reintentar</button>',
    )

    states = [
        ("Default",
         "Resumen, búsqueda local y lo urgente (stock bajo + fiado). Un solo acento de acción: la búsqueda.",
         frame(header("Hola, Marta", action=("refresh_cw", "Actualizar datos"))
               + content(summary()), nav_key="inicio")),
        ("Vacío",
         "Sin productos: el estado vacío enseña el primer paso con una sola acción principal.",
         frame(header("Hola, Marta", action=("refresh_cw", "Actualizar datos"))
               + content(empty), nav_key="inicio")),
        ("Sin conexión",
         "Banner persistente bajo el encabezado + insignia neutral “por sincronizar”. El contenido sigue usable.",
         frame(header("Hola, Marta", action=("refresh_cw", "Actualizar datos"))
               + banner() + content(offline_body), nav_key="inicio")),
        ("Error de carga",
         "Si la actualización falla, se explica y se ofrece Reintentar; nada se borra del teléfono.",
         frame(header("Hola, Marta", action=("refresh_cw", "Actualizar datos"))
               + content(error_body), nav_key="inicio")),
    ]
    return page("03-inicio", "Inicio", states, active="inicio")


# ---------------------------------------------------------------- 4. Escáner
def screen_escanear():
    hud = lambda extra="": (  # noqa: E731
        '<p class="card-title text-center mb-1">Apunta al código de barras</p>'
        '<p class="card-meta text-center mb-4">Sostén el teléfono sobre el código. Se '
        "detecta solo.</p>" + viewfinder() + extra
    )
    controls = (
        '<div class="flex gap-2 mt-4">'
        f'<button class="btn btn-secondary flex-1">{icon("flashlight")}Linterna</button>'
        f'<button class="btn btn-secondary flex-1">{icon("keyboard")}Escribir código</button>'
        "</div>"
    )

    detected = (
        '<p class="card-title mb-3">Código detectado</p>'
        + product_card("Refresco Big Cola 355ml", "7501234567890 · por unidad", "$0.75",
                       "12 uds", "success")
        + '<div class="flex flex-col gap-2 mt-4">'
        '<button class="btn btn-primary w-full">Registrar entrada</button>'
        '<button class="btn btn-secondary w-full">Abrir producto</button></div>'
    )

    manual = (
        '<p class="field-label" id="codigo-label">Código de barras</p>'
        '<div class="keypad-display mt-1" role="status" aria-labelledby="codigo-label" '
        'aria-label="Código escrito: 7 5 0 1 2 3 4 5 6 7 8 9 0">'
        '<span class="tabular">7501234567890</span></div>'
        '<p class="field-help mt-1">El teclado está siempre disponible — el flujo nunca '
        'depende de la cámara.</p>'
        + f'<div class="keypad mt-4">{keypad_grid()}</div>'
        + '<button class="btn btn-primary w-full mt-4">Buscar producto</button>'
    )

    cam_error = alert_card(
        "No pudimos usar la cámara",
        "Revisa el permiso de la cámara en tu teléfono, o escribe el código a mano: "
        "siempre funciona.",
        f'<button class="btn btn-primary">{icon("keyboard")}Escribir el código</button>',
        f'<button class="btn btn-secondary">{icon("refresh_cw")}Reintentar cámara</button>',
    )

    states = [
        ("Escaneando (default)",
         "Pantalla completa: visor, instrucción en una línea y dos apoyos (linterna, escribir a mano).",
         frame(header("Escanear", back=True, action=("flashlight", "Encender linterna"))
               + content(hud(controls)))),
        ("Entrada manual",
         "El teclado numérico reemplaza a la cámara (C3.2). El código se ve grande y tabular.",
         frame(header("Escribir el código", back=True) + content(manual))),
        ("Código conocido",
         "Un código ya registrado abre su producto; la acción principal decide qué sigue.",
         frame(header("Escanear", back=True, action=("flashlight", "Encender linterna"))
               + content(detected))),
        ("Sin conexión",
         "Escanear también funciona sin internet; lo nuevo quedará “por sincronizar”.",
         frame(header("Escanear", back=True) + banner()
               + content(hud(
                   '<p class="card-meta text-center mt-3">Puedes escanear sin conexión. Lo que '
                   "agregues se marcará para sincronizar al reconectar.</p>"
                   + controls)))),
        ("Error de cámara",
         "Si la cámara falla, la salida manual está a un toque: el flujo sigue.",
         frame(header("Escanear", back=True) + content(cam_error))),
    ]
    return page("04-escanear", "Escáner", states, active=None)


if __name__ == "__main__":
    for fn in (screen_crear_tienda, screen_unirse, screen_inicio, screen_escanear):
        print(fn())
