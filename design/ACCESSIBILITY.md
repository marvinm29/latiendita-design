# LaTiendita — Accesibilidad (WCAG 2.2 nivel AA)

> Fase 4 · Cierre. Checklist por componente + evidencia verificable.
> Hermano de `DESIGN.md` (sistema) y `decisions.md` (bitácora). Español primero.

Este documento cierra la fase de diseño con una auditoría de accesibilidad **al nivel AA de WCAG 2.2**.
No es una promesa a futuro: cada criterio se marca con su evidencia (un comando reproducible, un
token verificado o una decisión de `decisions.md`). Lo que todavía requiere prueba manual con
tecnología de asistencia se lista al final, sin adornos.

| Herramienta | Comando | Qué cubre |
|---|---|---|
| Matriz de contraste | `python3 design/tokens/verify_contrast.py` | 60 pares de color, light + dark (1.4.3, 1.4.11) |
| QA estática de pantallas | `python3 design/tools/qa.py` | iconos, ids, etiquetas, sin URLs externas (1.3.1, 4.1.2, 3.3.2) |
| Regeneración de tokens | `python3 design/tokens/generate.py` | determinismo de la fuente de color |

---

## 1. Criterios de conformidad

Estado: **Met** = cumplido y evidenciado · **N/A** = no aplica (con razón) · **Manual** = razonado,
pendiente de prueba con lector de pantalla/zoom real.

### Perceptible

| SC | Nivel | Criterio | Estado | Evidencia |
|---|---|---|---|---|
| 1.1.1 | A | Contenido no textual | Met | Todo icono decorativo lleva `aria-hidden="true"`; los que comunican llevan `role="img"` + `aria-label`. Sprite Lucide estático, sin texto en imágenes. |
| 1.3.1 | A | Información y relaciones | Met | `qa.py` verifica que cada `<label for>` tenga su control y que `aria-labelledby`/`aria-describedby` apunten a ids existentes; grupos con `role="group"` + `aria-label`; nav con `aria-label` + `aria-current`. |
| 1.3.5 | AA | Identificar el propósito del campo | N/A | No hay campos de identidad del usuario (nombre, correo, dirección). El único campo de contacto (teléfono del cliente en fiados) es dato de un tercero, no del operador; los campos de búsqueda llevan `type="search"`. |
| 1.4.1 | A | Uso del color | Met | Estado y dirección nunca dependen del color: chips con icono + texto, filas de fiados con signo `+`/`−` (DS-28), nav activa con fondo **y** etiqueta, badge neutral “por sincronizar”. |
| 1.4.3 | AA | Contraste mínimo | Met | 60/60 pares ≥4.5:1 (texto) y 0 fallos; el peor par de texto real es 4.71:1 (`design/DESIGN.md` §2.3). |
| 1.4.4 | AA | Cambio de tamaño del texto | Manual | Tipografía en `rem`/`px` con `-webkit-text-size-adjust:100%`; el zoom del navegador escala todo. Reflow a 200% pendiente de captura formal. |
| 1.4.11 | AA | Contraste de elementos no textuales | Met | Bordes de input, anillos de foco y rellenos de acción ≥3:1 en la matriz (p. ej. borde input vs página 3.80:1; anillo foco 4.48:1). |
| 1.4.12 | AA | Espaciado del texto | Met | Sin alturas fijas que recorten texto; `line-height` viene de tokens; las tarjetas crecen con el contenido. |
| 1.4.13 | AA | Contenido en hover o focus | Met | No hay tooltips ni contenido que solo aparezca al pasar el cursor; los estados de ayuda son permanentes (`field-help`). |

### Operable

| SC | Nivel | Criterio | Estado | Evidencia |
|---|---|---|---|---|
| 2.1.1 | A | Teclado | Met | Controles nativos (`button`, `a`, `input`); sin `div` clicables; el teclado numérico son botones reales. |
| 2.1.2 | A | Sin trampas de teclado | Met | No hay modales atrapadas ni `tabindex` positivo; el foco sigue el orden del DOM. |
| 2.1.4 | A | Atajos de teclado de un solo carácter | N/A | No se definen atajos de tecla única. |
| 2.2.1 | A | Tiempo ajustable | N/A | No hay límites de tiempo de interacción. (El vencimiento del código de invitación es del código, no del tiempo del usuario.) |
| 2.2.2 | A | Pausar, detener, ocultar | N/A | No hay contenido en movimiento ni carruseles. |
| 2.3.1 | A | Tres destellos o menos | Met | Sin animaciones de parpadeo. |
| 2.4.2 | A | Título de la página | Met | `<title>` por pantalla (`"3 · Inicio — LaTiendita"`). |
| 2.4.3 | A | Orden del foco | Met | Orden = orden visual (encabezado → contenido → CTA → nav). |
| 2.4.4 | A | Propósito del enlace | Met | Texto de enlace descriptivo (“hoja de estados”, “Ver productos”, “Escanear”), nunca “clic aquí”. |
| 2.4.6 | AA | Encabezados y etiquetas | Met | Un `<h1>` por frame; secciones con `<h2>`/`<h3>`; todos los campos con etiqueta visible (nunca solo placeholder). |
| 2.4.7 | AA | Foco visible | Met | Anillo obligatorio de 2px + offset 2px (teal-11) en `:focus-visible` (`base.css`); DS-12. |
| 2.4.11 | AA | Foco no oscurecido (mínimo) | Met | Banner, CTA fijo y nav son **hermanos del layout**, no overlays (DS-23); el contenido con scroll reserva espacio (`pb-20`) para no tapar el último control enfocado. |
| 2.5.7 | AA | Movimientos de arrastre | N/A | No se requiere arrastrar para operar. |
| 2.5.8 | AA | Tamaño del objetivo (mínimo) | Met | Suelo de 48px (`--size-touch-min`), filas 56px, nav 64px, teclas 56px (DS-13/DS-27). Supera el mínimo AA de 24px. |

### Comprensible

| SC | Nivel | Criterio | Estado | Evidencia |
|---|---|---|---|---|
| 3.1.1 | A | Idioma de la página | Met | `<html lang="es-SV">` en todas las pantallas. |
| 3.2.1 | A | Al recibir el foco | Met | Enfocar no dispara cambios de contexto. |
| 3.2.2 | A | Al introducir datos | Met | Escribir no envía ni navega; todo se confirma con un botón explícito. |
| 3.2.3 | A | Navegación coherente | Met | Nav inferior idéntica y en el mismo orden en todas las pantallas. |
| 3.2.4 | AA | Identificación coherente | Met | Mismo icono + etiqueta para la misma función en toda la app. |
| 3.3.1 | A | Identificación de errores | Met | Error con icono + texto y `aria-invalid="true"` + `aria-describedby` al mensaje (`field()` en `shell.py`). |
| 3.3.2 | A | Etiquetas o instrucciones | Met | Etiqueta + ayuda visibles antes de cada campo; `qa.py` verifica la asociación. |
| 3.3.3 | AA | Sugerencia ante errores | Met | El mensaje dice cómo corregir (“Ingresa un precio válido, por ejemplo 1.25.”). |
| 3.3.4 | AA | Prevención de errores (legales/financieros) | Met | El conteo pide confirmación antes de aplicar ajustes; los movimientos y fiados son inmutables (se corrigen con un movimiento inverso); borrado lógico con tombstone. |
| 3.3.7 | A | Entrada redundante | Met | El código de unirse se conserva al fallar; no se pide dos veces el mismo dato. |
| 3.3.8 | AA | Autenticación accesible (mínimo) | Met | Se entra con código de invitación pegable (sin test cognitivo ni transcripción forzada); compatible con gestores de contraseñas. |

### Robusto

| SC | Nivel | Criterio | Estado | Evidencia |
|---|---|---|---|---|
| 4.1.2 | A | Nombre, rol, valor | Met | `aria-pressed` en segmentado/tema, `aria-current` en nav, `role="status"` en banner y display del teclado, `role="img"` con `aria-label` en gráficos y visor. `qa.py` valida ids y referencias. |
| 4.1.3 | AA | Mensajes de estado | Met | Banner “Sin conexión — se sincronizará al reconectar” y el display del teclado usan `role="status"` (anuncio sin robar el foco). |

> 4.1.1 (Parsing) fue **obsoleto** en WCAG 2.2; no aplica.

---

## 2. Checklist por componente

Cada componente se implementa con clases de `ui.css` que consumen **solo tokens semánticos** (nunca
un paso crudo ni hex). Columnas: criterios clave y cómo se cumplen.

| # | Componente | Criterios clave | Cómo se cumple |
|---|---|---|---|
| 1 | **Botón** (primario / secundario / icono / destructivo) | 1.4.1, 1.4.3, 1.4.11, 2.5.8, 2.4.7 | ≥48px; anillo 2+2px; primario con texto oscuro sobre teal (DS-06, 5.31:1); destructivo red-11/red-12; nunca solo color (siempre texto). |
| 2 | **Campo de formulario** | 1.3.1, 3.3.1, 3.3.2, 3.3.3, 1.4.3 | Etiqueta visible + ayuda; error con icono, texto y `aria-invalid`/`aria-describedby`; borde sand-10 ≥3:1. |
| 3 | **Control segmentado** | 4.1.2, 2.5.8, 1.4.1 | `role="group"` + `aria-label`; opciones con `aria-pressed`; 48px en una línea (DS-27); activo con fondo **y** `aria-pressed`. |
| 4 | **Chip de estado** (stock / neutral / crédito) | 1.4.1, 3.2.4, 4.1.2 | Icono + texto siempre; ámbar solo dinero (DS-09); “por sincronizar” neutral (DS-17); contraste ≥4.5:1. |
| 5 | **Tarjeta / fila de producto** | 2.5.8, 2.4.4, 1.4.11, 4.1.2 | Toda la fila es un `button` con `aria-label` descriptivo (“… Ver producto.”); foco visible; separador por borde, no por sombra. |
| 6 | **Tarjeta / fila de cliente (fiados)** | 1.4.1, 2.4.4, 4.1.2 | Saldo con icono + cifra tabular; `aria-label` (“debe $12.50 … Ver detalle.”); “Al día” con icono + texto. |
| 7 | **Teclado numérico** | 2.1.1, 4.1.2, 4.1.3, 2.5.8 | Botones reales ≥56px; display con `role="status"` + `aria-label` (“Cantidad contada: 14”); tecla borrar con nombre. |
| 8 | **Estados de conexión** | 4.1.3, 1.4.1, 1.4.3 | Banner con `role="status"` y copy exacta (C8.2), como hermano del layout bajo el encabezado (DS-23); badge neutral con icono + texto. |
| 9 | **Navegación inferior + FAB** | 2.4.7, 2.4.11, 2.5.8, 3.2.3, 4.1.2 | 5 destinos máx.; `aria-current="page"`; etiqueta 12px (DS-22); FAB central 64px; nav hermana del layout (no tapa el foco). |
| 10 | **Alerta / estado vacío** | 1.4.1, 3.3.3, 2.4.6 | Icono en círculo (no color solo) + título + instrucción; botones con jerarquía primaria/secundaria. |

---

## 3. Cobertura de pantallas

Las 13 pantallas (60 marcos a 360×640) cubren, como mínimo, los cuatro estados honestos
(`default · vacío · sin conexión · error`) más los extras de cada flujo. Verificación estática:

```
13 pantallas · 60 marcos · 0 hallazgos
```

Cada estado offline se diseñó con la misma copy de aviso y el badge neutral, de modo que el mensaje
de estado es consistente y anunciable (`role="status"`) en toda la app.

---

## 4. Verificación pendiente (honesta)

La fase de diseño no sustituye una auditoría con usuarios y tecnología de asistencia. Antes de
publicar el producto, queda pendiente:

1. **Lector de pantalla real** (TalkBack en Android, VoiceOver en iOS) sobre las 13 pantallas.
2. **Zoom 200% y reflow** por captura formal (criterio 1.4.4 / 1.4.10 en el nivel AA de reflow ya se
   cumple por layout fluido, pero falta la evidencia).
3. **Contraste de foco sobre foto/scroll** en dispositivo físico (2.4.11 instrumentado).
4. **Pruebas con la persona real (Marta)** — el criterio de éxito del producto no es sólo WCAG.

Estos puntos entran al plan técnico (`specs/003`) y al roadmap (`specs/004`) como tareas de QA de
implementación.
