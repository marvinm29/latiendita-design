# 002 · Especificación funcional v1 — Inventario para tiendas de colonia

> Artefacto SDD. Basado en: `000-research-competencia.md`, `001-research-global.md`, decisiones D1–D14.
> Estado: borrador para revisión. Regla del proyecto: **cada capacidad debe ser verificable** — si no se puede probar, no entra al spec.

---

## 1. Visión

> software libre que le da a cada tienda de colonia de El Salvador el control de su inventario y sus fiados,
> desde el teléfono que ya tienen, con o sin internet, sin costo y sin ceder sus datos.

**Nombre tentativo:** pendiente (candidatos: *Tenda*, *MiBodega*, *LaTiendita*). Decisión separada.

## 2. Usuarios (personas)

| Persona | Perfil | Dispositivo | Qué necesita |
|---|---|---|---|
| **Marta** — dueña de tienda | 40-60 años, maneja la libreta de fiados a mano, poca experiencia digital | Android 8-11, 2GB RAM, plan de datos limitado | Contar inventario escaneando, saber qué falta, a quién le debe qué |
| **José** — empleado | 18-30 años, nativo digital | Mismo teléfono u otro barato | Registrar entradas de mercadería, hacer conteo, no romper nada |
| **Carlos** — instalador/técnico | Familiar o revendedor local, sabe Docker | Laptop + subdominio | Instalar en 1 comando, respaldos automáticos, actualizar sin miedo |

**Principio de diseño derivado:** la app debe ser usable por Marta sin capacitación y configurable por Carlos sin soporte.

## 3. Alcance

**En v1:** catálogo con escaneo, movimientos de inventario (libro), stock y alertas, fiados completo, roles multiempleado, offline-first con sincronización, PWA instalable, export/respaldo, reportes básicos, español.

**Fuera de v1 (explícito):** POS/caja, factura electrónica DTE, multi-bodega/multi-tienda, e-commerce, integración WhatsApp (D12 → v2), entrada por voz (D5 → v2), app nativa (D14 → opcional).

## 4. Capacidades y criterios de aceptación

### C1 · Negocio, cuentas y accesos
- C1.1 Marta crea un negocio con nombre; queda como **dueña**.
- C1.2 Marta genera un **código de invitación** y lo comparte con José; José lo ingresa desde su teléfono y queda vinculado con rol `empleado`.
- C1.3 José ve solo lo que su rol permite (ver C7).

```gherkin
Escenario: empleado se une por código
  Dado que José recibió el código "TQ7-392"
  Cuando José ingresa el código desde su teléfono
  Entonces José queda registrado en el negocio de Marta con rol "empleado"
  Y ve los productos del negocio de Marta, no de otros negocios
```

### C2 · Catálogo de productos
- C2.1 Un producto tiene: nombre, código de barras (opcional), precio de venta, costo (opcional), unidad base, stock mínimo, categoría (opcional), foto (opcional).
- C2.2 Al crear por escaneo de un EAN-13 conocido, se **autocompleta nombre** vía Open Food Facts (con caché local; si no hay datos ni internet, sigue el flujo manual sin bloquear).
- C2.3 **Empaques y fraccionado:** un producto puede tener unidades de venta con factor (ej. 1 bulto = 12 unidades; 1 libra si se vende a granel). Las entradas y conteos pueden expresarse en cualquier unidad registrada.
- C2.4 Buscar productos por nombre, categoría o código; los resultados aparecen mientras se escribe (sin red necesaria — índice local).
- C2.5 Editar y "eliminar" (borrado lógico con tombstone — el historial sobrevive).

```gherkin
Escenario: alta de producto escaneado, sin internet
  Dado que Marta no tiene conexión y escanea un EAN-13 nuevo
  Cuando el autocompletado no tiene datos locales
  Entonces la app abre el formulario con el código ya llenado
  Y Marta solo teclea nombre y precio
  Y el producto queda guardado localmente y marcado "por sincronizar"
```

### C3 · Escaneo de códigos de barras
- C3.1 Escaneo por cámara con detección nativa (BarcodeDetector) y fallback (ZXing/WASM) — formatos EAN-13, EAN-8, UPC-A, Code128.
- C3.2 **Entrada manual siempre disponible** (teclado numérico) — el flujo nunca depende de la cámara.
- C3.3 Escanear un código conocido abre su producto; escanear uno desconocido ofrece crear el producto con ese código.

### C4 · Movimientos de inventario (el libro)
- C4.1 El stock **nunca se edita a mano**: solo por movimientos `entrada`, `salida`, `ajuste` (+`conteo` físico que genera ajustes).
- C4.2 Cada movimiento registra: producto, cantidad (con unidad), fecha, usuario, nota opcional. **Inmutable**: corregir = nuevo movimiento inverso.
- C4.3 El stock actual es el derivado del libro; se cachea localmente para velocidad.

```gherkin
Escenario: corrección sin destruir historia
  Dado que José registró una entrada de 10 unidades por error
  Cuando Marta corrige el registro
  Entonces el sistema agrega un movimiento inverso de -10 con nota "corrige #123"
  Y el movimiento original permanece visible en el historial
```

### C5 · Stock, alertas y conteo
- C5.1 Vista "qué falta": productos bajo el mínimo, ordenados por urgencia.
- C5.2 **Conteo físico asistido**: escanear en serie productos y capturar lo contado; al confirmar, genera los ajustes del diferencial (modo inventariado rápido).

### C6 · Fiados (libreta digital)
- C6.1 Clientes con nombre (y teléfono opcional). Se crean en el momento.
- C6.2 Movimientos de fiado por cliente: `cargo` (le fié) y `abono` (me pagó), con fecha, monto y nota. Inmutables como C4.
- C6.3 Saldo por cliente derivado; lista ordenada por saldo y antigüedad ("la libreta").
- C6.4 Historial completo por cliente visible en 2 toques.
- C6.5 Compartir estado de cuenta por WhatsApp/texto (mensaje con detalle generado localmente) — sin backend de mensajería.

```gherkin
Escenario: fiado y abono offline
  Dado que Marta está sin conexión y fía C$5.00 (USD) a "Doña Rosa"
  Cuando registra el cargo
  Entonces el saldo de Doña Rosa queda actualizado localmente en el acto
  Y al reconectar, el cargo sincroniza sin duplicarse
```

### C7 · Roles y permisos
- C7.1 Roles: `dueña` (todo, incl. gestión de empleados y borrar negocio), `empleado` (operar: productos, movimientos, fiados).
- C7.2 Los datos están aislados por negocio en la base (RLS en servidor) — José de la tienda A jamás ve la tienda B.

### C8 · Offline-first y sincronización
- C8.1 **Todas** las operaciones de C2–C6 funcionan sin conexión (lectura y escritura).
- C8.2 **Advertencia clara (decisión del usuario):** al operar sin conexión, la app muestra un aviso persistente "Sin conexión — se sincronizará al reconectar"; al reconectar, sincroniza automáticamente y confirma.
- C8.3 Cola de operaciones locales (outbox) con reintentos; sincronización incremental.
- C8.4 Conflictos (dos editores, mismo dato): política last-write-wins por campo + el historial de movimientos conserva ambos (nunca se pierde un movimiento).
- C8.5 Borrar app no debe perder datos: todo vive también en el servidor; al reinstalar, descarga su copia.

### C9 · PWA
- C9.1 Instalable ("Añadir a pantalla de inicio") en Android e iOS; funciona fullscreen sin barra.
- C9.2 Actualizaciones con aviso no intrusivo ("hay una nueva versión — reiniciar").
- C9.3 HTTPS obligatorio (la cámara lo exige).

### C10 · Datos: respaldo y salida
- C10.1 Exportar productos, movimientos y fiados a **CSV** e **JSON** desde el teléfono, sin depender del instalador.
- C10.2 Respaldo/restore JSON completo (Marta puede "llevarse sus datos" — la puerta de salida es sagrada).
- C10.3 Importar CSV (plantilla incluida) para migrar de Excel/Loyverse.

### C11 · Reportes mínimos
- C11.1 Valor del inventario al costo y a precio.
- C11.2 "Lo que más se movió" (entradas/salidas por producto, rango de fechas).
- C11.3 Resumen de fiados: total fiado, total cobrado, saldo total.

## 5. Requisitos no funcionales

| Área | Requisito | Verificación |
|---|---|---|
| Rendimiento | JS inicial ≤ 150KB gzip; TTI ≤ 3s emulando Moto G4 (CPU 4x); interacciones < 200ms | Lighthouse CI + trace |
| Dispositivos | Android 8+ (Chrome/WebView), iOS 16+ (Safari), cualquier PC | Matriz de pruebas |
| Offline | CRUD completo offline; datos sobreviven cierre/reinicio del navegador | Playwright `setOffline` + reinicio |
| Seguridad | HTTPS-only, sesiones firmadas, aislamiento por negocio (RLS), sin secretos en cliente | Auditoría + pentest básico |
| Privacidad | Sin telemetría por defecto (opt-in); datos del negocio son del negocio | Revisión de código |
| Idioma | Español (SV) primero; i18n desde el día 1; moneda USD; textos en lenguaje llano, sin tecnicismos | Revisión |
| Accesibilidad | Targets táctiles ≥ 44px, contraste AA, usable con una mano | Auditoría a11y |
| Instalación | docker-compose de 1 comando + demo con datos sembrados + `.env` con 5 variables máximo | Prueba de instalación en máquina limpia |
| Calidad | Tests unitarios de lógica crítica (stock, fiados, sync), e2e de flujos C1-C10 | CI obligatorio |

## 6. Métricas de éxito (v1)

1. Una tienda nueva termina su primer conteo asistido de ~200 productos en ≤ 2 horas usando escaneo.
2. Alta de producto escaneado ≤ 20 s (medición con cronómetro en pruebas de campo).
3. 0 movimientos perdidos tras 100 operaciones con cortes de red simulados.
4. Instalación limpia del servidor por Carlos ≤ 15 min siguiendo solo el README.
5. Un empleado nuevo opera (entrada + fiado + consulta) sin capacitación formal.

## 7. Preguntas abiertas (a resolver antes del tech plan)

| # | Pregunta | Propuesta |
|---|---|---|
| P1 | Licencia: MIT vs AGPL-3.0 | AGPL-3.0 (protege el "gratis para siempre" contra forks SaaS cerrados) — decidir como issue |
| P2 | Login de empleados sin email: PIN + código de invitación vs cuenta email | Código de invitación + PIN simple, gestionado por la dueña (espeja Loyverse y la realidad del segmento) |
| P3 | ¿Un negocio puede tener varias ubicaciones en v1? | No (una bodega virtual); diseñar modelo para no cerrar la puerta |
| P4 | Cobertura de Open Food Facts en abarrotes locales | Flujo manual-first; OFF es un acelerador, no una dependencia |
| P5 | ¿Fiados permite líneas de crédito con límite? | Solo saldo informativo + opcional límite con advertencia; sin bloqueos duros en v1 |
