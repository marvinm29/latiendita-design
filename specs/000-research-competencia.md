# 000 · Research: Proyectos similares y lecciones de mercado

> Fase: Spec Driven Development — documento de entrada para el spec.
> Fecha: 2026-09-20. Fuentes: GitHub, awesome-selfhosted, Loyverse (docs oficiales), OSPOS, Grocy, medevel, mercado local SV.

---

## 1. Pregunta que este research responde

¿Ya existe un sistema open source de inventario con escaneo de código de barras por cámara del teléfono,
offline-first, pensado para tiendas de colonia, multiempleado y fácil de instalar?
Si existe → aprender de él. Si no existe → validar el hueco antes de construir.

---

## 2. Panorama por categoría

### 2.1 Gratis pero propietario (la competencia REAL de una tiendita)

| Producto | Qué es | Por qué gana | Debilidad explotable |
|---|---|---|---|
| **Loyverse POS** | POS + inventario gratis, Android/iOS | Gratis en el núcleo, funciona en teléfonos baratos, UI simple, español, offline básico | **Sin versión web** (su FAQ lo confirma: solo apps móviles). **Empleados es de pago** (~US$5–25/mes por tienda tras 14 días de prueba). Sin self-hosting: tus datos viven en su nube cerrada. Integraciones (e-commerce, contabilidad) de pago |
| Eleventa, Sicar (MX), Alegra, Nextar, CoPos | SaaS de pago mensual, en español | Soporte local, facturación | Cuestan $15–60/mes; apuntan a negocios formales, no a la tiendita |

**Insight clave:** el modelo Loyverse demuestra que el segmento existe y es masivo, pero su muro de pago
es exactamente el requisito #4 de nuestro proyecto (varios empleados por negocio). Ese es el hueco.

### 2.2 Open source de inventario (los más cercanos a la idea)

| Proyecto | ★ | Licencia | Stack | Escaneo por cámara | Offline | Veredicto |
|---|---|---|---|---|---|---|
| **Grocy** | ~9.5k | MIT | PHP | ✅ Sí (cámara del navegador) + integración Open Food Facts | Parcial (PWA limitada) | El más cercano en UX, pero es para el HOGAR: sin costos, precios ni proveedores. Multiusuario débil |
| **HomeBox** | ~7.3k | AGPL-3.0 | Go (binario único) | ✅ QR/códigos | No | Es catálogo de pertenencias, no control de stock con movimientos. Instalación trivial (lección a copiar) |
| **InvenTree** | ~7.6k | MIT | Python/Django + Vue | ✅ app móvil oficial | No | Orientado a ingeniería/piezas. SÍ usa libro de movimientos como fuente de verdad (patrón a copiar) |
| **Snipe-IT** | enorme | AGPL | PHP/Laravel | ✅ QR con cámara | No | Gestión de activos IT, no retail. Su playbook de adopción es oro (ver §5) |
| Bigcapital | ~3.9k | AGPL | Node | ✗ | No | Contabilidad + inventario SMB, aún maduro |
| OpenBoxes, GreaterWMS, ModernWMS, PartKeepr, Part-DB, exDateMan | — | varias | varias | Parcial | No | Almacén/salud/piezas: problemas de empresas, no de tienditas |

### 2.3 Open source POS (generación anterior)

| Proyecto | Estado | Por qué NO sirve para este caso |
|---|---|---|
| **OSPOS** (~3.9k, MIT) | Activo | PHP/CodeIgniter + Bootstrap 3: requiere servidor LAMP, asume PC de escritorio + escáner USB, sin offline real, UI pesada para un Android de gama baja. Sí tiene: multiusuario con permisos, multiidioma (ES incluido), generación de códigos de barras |
| ERPNext + POS Awesome | Activo | ERP completo: instalarlo para una tiendita es matar una mosca con un cañón. Instalación compleja |
| unicenta, chromis, Floreant | Legado | Java de escritorio, abandonados o estancados |

### 2.4 Mercado local El Salvador

- **ASATI Software** (SV): POS + inventario + factura electrónica DTE, de pago. Apunta a negocios formales que deben cumplir Hacienda.
- **Sointec, puntosdeventa.com.sv**: venden paquetes de hardware (lector, impresora) + software. El escáner físico es el modelo actual.
- El segmento **tienda de colonia semi-informal** hoy usa: un cuaderno, Excel, o Loyverse gratis. Nadie atiende su caso con software libre.

---

## 3. El hueco validado (gap statement)

> **No existe hoy** una aplicación **PWA mobile-first**, **offline-first**, con **escaneo de códigos de barras por la cámara del teléfono**,
> para **inventario de tienda retail pequeña**, con **roles multiempleado incluidos sin costo**, **instalable en un comando** (Docker/binario),
> **en español**, con **licencia open source**.

Cada búsqueda en r/selfhosted de "self-hosted inventory with barcode" tiene respuestas insatisfechas
(la gente termina adaptando Grocy o Snipe-IT a su negocio). Los proyectos OSS de inventario pequeños
(Storaji, PartKeepr, ms3-stock-management…) murieron por las mismas 4 causas: desktop-first, sin offline,
instalación difícil, solo inglés. **Nuestro diseño invierte las 4.**

---

## 4. Lecciones técnicas del prior art (qué copiar / qué evitar)

**Copiar:**
1. **Cámara como escáner funciona en producción** (Grocy lo hace desde el navegador). Stack moderno: BarcodeDetector API nativa + ZXing/WASM como fallback.
2. **Open Food Facts para autocompletar productos** por EAN-13 (Grocy + Barcode Buddy lo demuestran): mata el mayor punto de fricción — teclear nombres de productos.
3. **Conversión de unidades** (1 bulto = 12 unidades) es un patrón resuelto en Grocy ("quantity unit conversions"). Valida el requisito de venta fraccionada.
4. **Libro de movimientos como fuente de verdad** (InvenTree): el stock nunca se edita a mano; se deriva de entradas/salidas/ajustes. Auditabilidad gratis.
5. **Binario único o docker-compose de un comando** (HomeBox): la fricción de instalación es el predictor #1 de adopción.

**Evitar (causas de muerte documentadas):**
- UI de escritorio usada desde un teléfono (OSPOS con Bootstrap 3).
- Requerir hardware especial (escáner USB, impresora, PC dedicada).
- Dependencia de conexión estable.
- Inglés-only, sin demo en vivo, sin datos de ejemplo.
- Alcance ERP (ERPNext) o nicho técnico (Part-DB) que confunde al usuario final.

---

## 5. Playbook de adopción (evidencia de cómo crecen estos proyectos)

Los 4 grandes del espacio (Grocy, HomeBox, InvenTree, Snipe-IT) comparten el mismo patrón de crecimiento:

1. **Listado en awesome-selfhosted** → el canal de descubrimiento canónico. Requisito: licencia OSI, README serio, demo.
2. **Demo en vivo con datos** (los 4 la tienen) → convierte curioso en usuario.
3. **Instalación en 1 comando** (Docker como mínimo; HomeBox distribuye UN binario).
4. **Paquetes en plataformas de 1 clic**: Cloudron, YunoHost, Elestio, Railway, DigitalOcean Marketplace (Snipe-IT debe su escala a esto).
5. **Cobertura en YouTube/podcasts de self-hosting** (uGeek cubrió Grocy en español; r/selfhosted hace el resto).
6. **La persona que instala NO es la persona que usa.** En la práctica: un técnico, un hijo, un familiar o un pequeño revendedor local instala; la dueña de la tienda solo usa la PWA. El producto debe hablarle a ambos perfiles.

**Implicación honesta para el modelo open source:** la tienda no instalará Docker. Las rutas de adopción reales son:
(a) self-hosters y comunidades hispanas lo instalan para otros (¡y ES el mercado que más contribuye a OSS!),
(b) más adelante, una instancia gratuita alojada vía GitHub Sponsors/OpenCollective si el proyecto despega,
(c) revendedores locales de tecnología (como los que hoy venden ASATI) pueden ofrecarlo como servicio.

**Licencia:** MIT domina entre los grandes (Grocy, InvenTree, OSPOS) → máxima adopción y forkabilidad.
AGPL-3.0 (HomeBox, Bigcapital) protege contra SaaS cerrados que capitalicen el trabajo sin devolver.
Recomendación preliminar: **AGPL-3.0** si el miedo es que alguien lo cierre como SaaS; **MIT** si el objetivo es adopción máxima. Decidir como issue del spec.

---

## 6. Decisiones preliminares que este research habilita (para el spec)

| # | Decisión | Basada en |
|---|---|---|
| D1 | PWA mobile-first, offline-first con IndexedDB | Hueco de mercado + fallas documentadas de la competencia OSS |
| D2 | Escaneo por cámara: BarcodeDetector API + fallback ZXing | Grocy lo valida en producción |
| D3 | Autocompletado por Open Food Facts (EAN-13) con caché local | Grocy/Barcode Buddy; crítica con productos locales sin EAN |
| D4 | Roles multiempleado GRATIS como propuesta de valor central | Es el muro de pago de Loyverse |
| D5 | Libro de movimientos como fuente de verdad del stock | Patrón InvenTree |
| D6 | Conversión de unidades (venta fraccionada) como requisito de primera clase | Patrón Grocy + realidad de las tiendas de colonia |
| D7 | Instalación: docker-compose de 1 comando + demo en vivo con datos sembrados | Playbook HomeBox/Grocy/Snipe-IT |
| D8 | Sin POS ni DTE en v1 (inventario puro) | Diferenciación vs ASATI; POS queda como fase posterior |
| D9 | Español primero, arquitectura i18n desde el día 1 | Causa de muerte #4 de los proyectos pequeños |

---

## 7. Riesgos que el research NO elimina

- **R1:** Los dueños de tienda podrían preferir Loyverse por marcas/soporte aunque sea de pago en empleados. Mitigación: demo + datos de ejemplo en español + migrador CSV desde Loyverse.
- **R2:** Mantener un proyecto OSS es trabajo de años; la mayoría muere por burnout del maintainer. Mitigación: alcance MVP brutal (ver roadmap), automatización de CI, y aceptar que "mantenido por 1 persona + comunidad" es legítimo.
- **R3:** Open Food Facts tiene buena cobertura de productos enlatados/importados en LatAm, pero débil en abarrotes locales sueltos. El flujo debe ser perfecto SIN él (entrada manual rápida).
