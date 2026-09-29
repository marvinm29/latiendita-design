#!/usr/bin/env python3
"""Phase 4 · Batch 2 — screens 5–9.

05 Productos (catálogo) · 06 Producto nuevo · 07 Movimiento rápido
08 Conteo asistido · 09 Libro de fiados

Run:  python3 design/tools/batch2.py
Same state protocol as batch 1 (default · vacío · sin conexión · error, plus
extras where the flow needs them); Phase-3 components only.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from shell import (  # noqa: E402
    banner, content, field, frame, header, icon, page, pending, section, stat,
    sticky_cta, teach,
)
from parts import (  # noqa: E402
    alert_card, customer_card, difference_chip, keypad, product_card, product_row,
    search_field, segmented, status_chip,
)

NAV_PAD = "p-4 pb-20"  # clears the raised center FAB when scrolled to bottom


# ---------------------------------------------------------------- 5. Productos
def screen_productos():
    def listing(rows, extra_top=""):
        return (
            extra_top
            + search_field()
            + '<div class="mt-3">' + segmented("Filtrar", ["Todos", "Bajo mínimo", "Agotados"], "Todos") + "</div>"
            + '<p class="card-meta mt-3 mb-2">248 productos · 7 bajo mínimo</p>'
            + "".join(rows)
        )

    normal = listing([
        product_row("Refresco Big Cola 355ml", "Bebidas · por unidad", "$0.75", "12 uds", "success"),
        product_row("Harina Selecta 5 lb", "Abarrotes · por unidad", "$1.10", "3 uds · mínimo 5", "warning"),
        product_row("Leche Doña Vera 1 L", "Lácteos · por unidad", "$0.95", "0 uds", "danger"),
    ])

    offline = listing(
        [
            product_row("Harina Selecta 5 lb", "Abarrotes · por unidad", "$1.10",
                        "3 uds · mínimo 5", "warning", pending_sync=True),
            product_row("Refresco Big Cola 355ml", "Bebidas · por unidad", "$0.75",
                        "12 uds", "success"),
        ],
        extra_top='<div class="mb-3 flex items-center gap-2">' + pending()
        + '<span class="card-meta">1 cambio sin confirmar</span></div>',
    )

    no_results = (
        search_field(value="galletas")
        + '<div class="mt-3">' + segmented("Filtrar", ["Todos", "Bajo mínimo", "Agotados"], "Todos") + "</div>"
        + teach("search", "No encontramos “galletas”",
                "Revisa la palabra o agrégalo como producto nuevo: queda con el código que escanees.",
                '<a class="btn btn-primary w-full" href="06-nuevo-producto.html">Agregar producto nuevo</a>',
                '<a class="btn btn-secondary w-full" href="04-escanear.html">Escanear código</a>')
    )

    states = [
        ("Default",
         "Catálogo local: buscar, filtrar por estado y abrir cualquier producto. Una sola acción de cabecera.",
         frame(header("Productos", action=("plus", "Agregar producto")) + content(normal, pad=NAV_PAD),
               nav_key="productos")),
        ("Vacío",
         "Sin productos todavía: el estado vacío enseña el primer paso y ofrece escanear como atajo.",
         frame(header("Productos", action=("plus", "Agregar producto"))
               + content(teach("package", "Agrega tu primer producto",
                               "Con el código de barras el nombre se llena solo. Así controlas tu "
                               "inventario y tus fiados.",
                               '<a class="btn btn-primary w-full" href="06-nuevo-producto.html">Agregar producto</a>',
                               '<a class="btn btn-secondary w-full" href="04-escanear.html">Escanear</a>'), pad=NAV_PAD),
               nav_key="productos")),
        ("Sin conexión",
         "El catálogo vive en el teléfono: buscar y filtrar siguen funcionando; lo editado queda por sincronizar.",
         frame(header("Productos", action=("plus", "Agregar producto")) + banner()
               + content(offline, pad=NAV_PAD), nav_key="productos")),
        ("Sin resultados",
         "Búsqueda sin coincidencias: no es un error; se ofrece crear el producto que falta.",
         frame(header("Productos", action=("plus", "Agregar producto"))
               + content(no_results, pad=NAV_PAD), nav_key="productos")),
        ("Error de carga",
         "Si falla la lectura del catálogo, se explica y se ofrece Reintentar; nada se borra.",
         frame(header("Productos", action=("plus", "Agregar producto"))
               + content(alert_card("No se pudieron cargar los productos",
                                    "Tus productos siguen guardados en el teléfono. Revisa la conexión "
                                    "e inténtalo otra vez.",
                                    '<button class="btn btn-secondary">Reintentar</button>'), pad=NAV_PAD),
               nav_key="productos")),
    ]
    return page("05-productos", "Productos · catálogo", states, active="productos")


# ------------------------------------------------------------ 6. Producto nuevo
def screen_nuevo_producto():
    off_hit = (
        '<div class="card mb-4">'
        '<div class="flex items-start gap-3">'
        f'<span class="text-link">{icon("circle_check", "w-icon h-icon")}</span>'
        '<div class="min-w-0 flex-1"><p class="card-title">Encontramos estos datos</p>'
        '<p class="card-meta mt-1">Por el código 7501234567890 (Open Food Facts).</p>'
        '<p class="card-meta mt-1"><strong>Galletas Charme</strong> · Categoría: Galletas</p>'
        '<button class="btn btn-secondary mt-3">Usar estos datos</button></div></div></div>'
    )

    def form(name="", price="", code="7501234567890", minimum="5",
             name_help="Así se verá en la lista y en el escaneo.",
             price_error="", extra="", disabled=False):
        body = (
            extra
            + field("Nombre del producto", value=name, helper=name_help)
            + '<div class="mt-4"></div>'
            + field("Precio de venta", value=price, helper="En dólares, por unidad.",
                    error=price_error, inputmode="decimal")
            + '<div class="mt-4"></div>'
            + field("Código de barras", value=code,
                    helper=("Se llenó al escanear. Puedes corregirlo si hace falta."
                            if code else "Si lo tienes, escanéalo o escríbelo aquí. Es opcional."))
            + '<div class="mt-4"></div>'
            + '<p class="field-label mb-2">Se vende por</p>'
            + segmented("Unidad de venta", ["Unidad", "Bulto", "Libra"], "Unidad")
            + '<div class="mt-4"></div>'
            + field("Stock mínimo", value=minimum, helper="Te avisamos cuando bajes de aquí.")
            + '<button class="btn btn-secondary w-full mt-4">Agregar costo, categoría o foto</button>'
        )
        return (
            header("Producto nuevo", back=True)
            + content(body)
            + sticky_cta(
                f'<button class="btn btn-primary w-full"{" disabled" if disabled else ""}>'
                "Guardar producto</button>"
            )
        )

    saved = (
        '<div class="card">'
        '<div class="flex items-start gap-3">'
        f'<span class="text-success-text">{icon("circle_check", "w-icon h-icon")}</span>'
        '<div class="min-w-0 flex-1"><p class="card-title">Producto guardado</p>'
        '<p class="card-meta mt-1">Galletas Charme · $1.25 · Galletas</p>'
        f'<div class="mt-2">{pending()}</div>'
        '<p class="field-help mt-3">Quedó en tu teléfono; se enviará al reconectar.</p>'
        '<div class="flex flex-col gap-2 mt-3">'
        '<button class="btn btn-primary w-full">Agregar otro producto</button>'
        '<a class="btn btn-secondary w-full" href="05-productos.html">Ver en Productos</a>'
        "</div></div></div></div>"
    )

    offline_note = (
        '<div class="mb-4">'
        + alert_card("No pudimos buscar el nombre",
                     "Estás sin conexión. Escríbelo tú y el producto se guarda igual; no pasa nada.",
                     tone="warning")
        + "</div>"
    )

    states = [
        ("Default · con autocompletado",
         "Escaneado un código conocido: el nombre se propone (Open Food Facts) y quedan ≤5 campos visibles.",
         frame(form(name="Galletas Charme", price="1.25", extra=off_hit))),
        ("Vacío",
         "Alta manual: campos vacíos, ayuda visible y botón deshabilitado. Nunca solo placeholders.",
         frame(form(name="", price="", code="", minimum="", disabled=True))),
        ("Sin conexión",
         "Sin internet el autocompletado no está, pero el flujo manual no se bloquea (C2.2).",
         frame(banner() + form(name="", price="1.25", code="7501234567890",
                               extra=offline_note))),
        ("Error de validación",
         "Precio inválido: error junto al campo, con icono y texto que dice qué hacer.",
         frame(form(name="Galletas Charme", price="1,",
                    price_error="Ingresa un precio válido, por ejemplo 1.25."))),
        ("Guardado (offline)",
         "Confirmación honesta: guardado en el teléfono y marcado por sincronizar; se ofrecen los 2 siguientes pasos.",
         frame(header("Producto nuevo", back=True) + content(saved))),
    ]
    return page("06-nuevo-producto", "Producto nuevo", states, active=None)


# --------------------------------------------------------- 7. Movimiento rápido
def screen_movimiento():
    context_card = (
        '<article class="card mb-4">'
        '<div class="flex items-start justify-between gap-3">'
        '<div class="min-w-0"><h3 class="card-title">Refresco Big Cola 355ml</h3>'
        '<p class="card-meta">7501234567890 · por unidad</p></div>'
        f'{status_chip("success")}</div>'
        '<p class="card-meta mt-2">Stock actual: <strong>12 uds</strong></p></article>'
    )

    def movement(kind, qty, unit, cta, *, note="", disabled=False, alert=""):
        conv = (
            '<p class="field-help mt-1">1 bulto = 12 unidades → son 24 unidades.</p>'
            if unit == "Bulto" else
            '<p class="field-help mt-1">Cada movimiento suma o resta al stock. Nunca se edita a mano.</p>'
        )
        body = (
            context_card
            + segmented("Tipo de movimiento", ["Entrada", "Salida", "Ajuste"], kind)
            + '<div class="mt-4">' + keypad("Cantidad", qty, f"Cantidad: {qty}") + "</div>"
            + '<p class="field-label mt-4 mb-2">Se cuenta por</p>'
            + segmented("Unidad", ["Unidad", "Bulto"], unit)
            + conv
            + (f'<div class="mt-4">{alert}</div>' if alert else "")
            + '<div class="mt-4"></div>'
            + field("Nota (opcional)", value=note, placeholder="Ej. compra a don Beto")
            + '<p class="field-help mt-3">Si te equivocas, se corrige con un movimiento nuevo: '
            "el historial no se borra.</p>"
        )
        return (
            header("Movimiento", back=True)
            + content(body)
            + sticky_cta(
                f'<button class="btn btn-primary w-full"{" disabled" if disabled else ""}>{cta}</button>'
            )
        )

    states = [
        ("Entrada (default)",
         "Tipo + cantidad + unidad. El bulto se convierte a unidades en la misma línea (C2.3).",
         frame(movement("Entrada", "2", "Bulto", "Registrar entrada", note="Compra a don Beto"))),
        ("Salida",
         "Mismo formulario, tipo Salida; la nota ayuda a reconstruir la historia.",
         frame(movement("Salida", "5", "Unidad", "Registrar salida"))),
        ("Vacío",
         "Sin cantidad no hay movimiento: botón deshabilitado y la ayuda explica la conversión de unidades.",
         frame(movement("Entrada", "0", "Unidad", "Registrar entrada", disabled=True))),
        ("Sin conexión",
         "El movimiento se guarda local y queda por sincronizar; el stock local ya lo refleja.",
         frame(banner() + movement("Entrada", "1", "Bulto", "Registrar entrada",
                                   note="Reposición"))),
        ("Error · más de lo que hay",
         "Salida mayor al stock: se dice cuánto hay y se pide ajustar; nunca se deja el stock en negativo.",
         frame(movement("Salida", "20", "Unidad", "Registrar salida", disabled=True,
                        alert=alert_card("No puedes sacar más de lo que hay",
                                         "Tienes 12 unidades. Cambia la cantidad para continuar.",
                                         tone="warning")))),
    ]
    return page("07-movimiento", "Movimiento rápido", states, active=None)


# ------------------------------------------------------------ 8. Conteo asistido
def screen_conteo():
    progress = (
        '<div class="card mb-4">'
        '<div class="flex items-baseline justify-between gap-2">'
        '<p class="card-title">Conteo asistido</p>'
        '<span class="card-meta tabular">12 de 248</span></div>'
        '<div class="mt-2 h-2 rounded-full bg-muted overflow-hidden" role="img" '
        'aria-label="12 de 248 productos contados">'
        '<div class="h-full bg-border-strong" style="width:5%"></div></div></div>'
    )

    def current():
        return (
            '<p class="card-title mb-1">Refresco Big Cola 355ml</p>'
            '<p class="card-meta mb-3">Escaneado · el sistema dice 12 uds</p>'
            + keypad("¿Cuántas unidades contaste?", "14", "Cantidad contada: 14")
        )

    counted = (
        '<p class="text-xl font-bold mt-5 mb-2">Ya contados</p>'
        '<div class="card">'
        + _count_row("Refresco Big Cola", "Contado 14 · sistema 12", 2)
        + _count_row("Harina Selecta 5 lb", "Contado 3 · sistema 5", -2)
        + _count_row("Leche Doña Vera 1 L", "Contado 0 · sistema 0", 0)
        + "</div>"
    )

    summary = (
        '<div class="card">'
        '<p class="card-title">Terminar conteo</p>'
        '<p class="card-meta mt-1">248 productos contados. 3 tienen diferencia y se guardarán como '
        "ajustes; el conteo queda en el historial.</p>"
        '<div class="flex flex-col gap-2 mt-3">'
        '<button class="btn btn-primary w-full">Guardar ajustes</button>'
        '<button class="btn btn-secondary w-full">Seguir contando</button>'
        "</div></div>"
    )

    states = [
        ("Contando (default)",
         "Escaneo en serie: se captura lo contado del producto actual y la lista muestra el diferencial.",
         frame(header("Conteo", back=True)
               + content(progress + current() + counted)
               + sticky_cta('<button class="btn btn-primary w-full">Terminar conteo (12)</button>'))),
        ("Vacío",
         "Nada contado aún: el estado vacío enseña a escanear el primero; sin teclado todavía.",
         frame(header("Conteo", back=True)
               + content(teach("scan_barcode", "Escanea el primer producto",
                               "Cuenta los productos escaneándolos uno por uno. Al terminar, el sistema "
                               "calcula las diferencias solo.",
                               '<a class="btn btn-primary w-full" href="04-escanear.html">Escanear producto</a>',
                               '<button class="btn btn-secondary w-full">Elegir de la lista</button>'))
               + sticky_cta('<button class="btn btn-primary w-full" disabled>Terminar conteo (0)</button>'))),
        ("Sin conexión",
         "El conteo funciona sin internet; los ajustes se sincronizan al final, no producto por producto.",
         frame(header("Conteo", back=True) + banner()
               + content('<p class="card-meta mb-3">Puedes contar sin conexión. Los ajustes se guardan al '
                         "terminar y se sincronizan al reconectar.</p>" + progress + current())
               + sticky_cta('<button class="btn btn-primary w-full">Terminar conteo (12)</button>'))),
        ("Error · código desconocido",
         "Un código que no está en el catálogo no detiene el conteo: se puede crear o saltar.",
         frame(header("Conteo", back=True)
               + content(progress
                         + alert_card("No encontramos ese código en tu catálogo",
                                      "El código 7591234500011 no está registrado. Puedes crearlo ahora "
                                      "o seguir contando.",
                                      '<a class="btn btn-primary" href="06-nuevo-producto.html">Crear producto</a>',
                                      '<button class="btn btn-secondary">Saltar</button>', tone="warning"))
               + sticky_cta('<button class="btn btn-primary w-full">Terminar conteo (12)</button>'))),
        ("Resumen y confirmar",
         "Cierre del conteo: se explica qué se guardará y se permite seguir; nada se aplica sin confirmar.",
         frame(header("Conteo", back=True) + content(summary))),
    ]
    return page("08-conteo", "Conteo asistido", states, active=None)


def _count_row(name, detail, diff):
    return (
        '<div class="flex items-center justify-between gap-3 py-3 border-b border-card last:border-0">'
        f'<div class="min-w-0"><p class="card-title">{name}</p>'
        f'<p class="card-meta">{detail}</p></div>{difference_chip(diff)}</div>'
    )


# --------------------------------------------------------------- 9. Libro de fiados
def screen_fiados():
    def summary():
        return (
            section("Resumen")
            + '<div class="flex gap-2 mb-4">'
            + stat("Saldo total", "$86.50", "coins", tone="credit")
            + stat("Con saldo", "4", "users")
            + stat("Cobrado este mes", "$40.00", "check", tone="success")
            + "</div>"
        )

    def book(pending_first=False):
        return (
            summary()
            + search_field("Buscar cliente", "Nombre o teléfono",
                           "La libreta vive en el teléfono; ordena por saldo o antigüedad.")
            + '<div class="mt-3 mb-3">' + segmented("Ordenar", ["Por saldo", "Por antigüedad"], "Por saldo") + "</div>"
            + customer_card("Doña Rosa", "$12.50", "Último movimiento hace 12 días",
                            pending_sync=pending_first)
            + customer_card("María", "$3.25", "Último movimiento hace 3 días")
            + customer_card("Don Carlos", "", "Abonó $5.00 hoy", al_dia=True)
        )

    empty = teach(
        "book_open",
        "Agrega tu primer cliente",
        "Guarda quién te debe y cuánto. Después puedes fiar y abonar en segundos, con o sin internet.",
        '<button class="btn btn-primary w-full">Crear cliente</button>',
        '<a class="btn btn-secondary w-full" href="05-productos.html">Ver productos</a>',
    )

    offline_note = (
        '<div class="mb-3 flex items-center gap-2">' + pending()
        + '<span class="card-meta">1 fiado sin confirmar</span></div>'
    )

    states = [
        ("Default",
         "La libreta ordenada por saldo y antigüedad; el ámbar marca dinero adeudado, nunca decoración.",
         frame(header("Fiados", action=("plus", "Agregar cliente")) + content(book(), pad=NAV_PAD),
               nav_key="fiados")),
        ("Vacío",
         "Sin clientes: el estado vacío explica para qué sirve y ofrece crear el primero.",
         frame(header("Fiados", action=("plus", "Agregar cliente")) + content(empty, pad=NAV_PAD),
               nav_key="fiados")),
        ("Sin conexión",
         "Fiados y abonos se registran localmente; el saldo se actualiza al instante y queda por sincronizar.",
         frame(header("Fiados", action=("plus", "Agregar cliente")) + banner()
               + content(offline_note + summary() + search_field("Buscar cliente", "Nombre o teléfono")
                         + customer_card("Doña Rosa", "$17.50", "Último movimiento hoy",
                                         pending_sync=True)
                         + customer_card("María", "$3.25", "Último movimiento hace 3 días"),
                         pad=NAV_PAD), nav_key="fiados")),
        ("Error de carga",
         "Si no se puede leer la libreta, se explica y se ofrece Reintentar; los saldos siguen en el teléfono.",
         frame(header("Fiados", action=("plus", "Agregar cliente"))
               + content(alert_card("No se pudieron cargar los fiados",
                                    "Los saldos siguen guardados en el teléfono. Revisa la conexión e "
                                    "inténtalo otra vez.",
                                    '<button class="btn btn-secondary">Reintentar</button>'), pad=NAV_PAD),
               nav_key="fiados")),
    ]
    return page("09-fiados", "Libro de fiados", states, active="fiados")


if __name__ == "__main__":
    for fn in (screen_productos, screen_nuevo_producto, screen_movimiento, screen_conteo, screen_fiados):
        print(fn())
