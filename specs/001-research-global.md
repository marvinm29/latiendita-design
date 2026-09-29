# 001 · Research global: micro-retail digital en el mundo y qué aprendemos

> Complemento de `000-research-competencia.md`. Cobertura: India, Filipinas, Indonesia, China, Brasil, Occidente.
> Pregunta: ¿este fenómeno ya está probado en otro lado? ¿Qué modelo de producto, adopción y sostenibilidad funciona de verdad?

---

## 1. Veredicto global: el fenómeno está probado — y a escala masiva

La tienda de colonia salvadoreña tiene gemelos idénticos y documentados en 3 continentes:

| País | Nombre local | Tamaño | Cómo se está digitalizando |
|---|---|---|---|
| **Filipinas** | sari-sari | 1.3 millones de tiendas (~70% de los bienes manufacturados vendidos ahí) | **Peddlr**: 1M de comercios registrados, app gratuita de **inventario + POS, funciona SIN internet**. **Packworks**: 300,000 tiendas con inventario digital. GrowSari: B2B de abarrotes + financiamiento (respaldo Tencent/Temasek) |
| **India** | kirana | decenas de millones | **Khatabook** (100M+ descargas): digitalizó el **libro de fiados** (khata/udhaar), no el inventario. Dukaan AI: **facturación por voz** en idiomas locales. Vyapar: freemium |
| **Indonesia** | warung | ~65 millones de warungs | Apps propietarias dominan; OSS local: open-retail, Dikasir (kasir = caja) |
| **China** | 进销存 (jinxiaocun) | categoría estándar del comercio pequeño | **jshERP** (4.6k★, Apache-2.0, activo 2026): OSS 100% + nube de pago + plugins. GreaterWMS, ModernWMS, ShopXO, 星云ERP |
| **Brasil** | PDV/estoque MEI | enorme mercado | Fragmentado: LivreOS (AGPL, Laravel), Hórus PDV. Sin ganador claro |
| **Occidente** | — | — | OSS de inventario existe pero orientado a hogar (Grocy), almacén (WMS) o TI (Snipe-IT); POS de era desktop (OSPOS) |

**Conclusión central:** la idea no es especulativa. Peddlr es literalmente la idea del usuario
(app gratuita, mobile-first, inventario como núcleo, offline) y ganó 1M de comercios. Lo que NO existe
en ningún continente es esa misma cosa **open source, autohospedable y en español**. Ese es el hueco exacto.

---

## 2. Las 3 lecciones de adopción que cambian el plan

### L1 · El gancho emocional real: los FIADOS (la libreta)
Khatabook alcanzó 100M+ descargas digitalizando el libro de créditos (khata), no el inventario.
En El Salvador existe el mismo comportamiento: **"apuntar fiados"** es la práctica universal de las tiendas de colonia.
Implicación de alcance: aunque el proyecto sea de inventario, el módulo **fiados (cliente + cargo/abono + recordatorio de pago)** es probablemente EL gancho de adopción. Peddlr también centra su UX ahí.

### L2 · La confianza se construye en Facebook, no en GitHub
Peddlr enfrentó el miedo a estafas ("miedo a poner la información de su negocio en una app desconocida") y lo resolvió con un **grupo de Facebook de 119,000 miembros** que se autoayudan. En El Salvador Facebook/WhatsApp son la infraestructura social real (los emprendedores viven en grupos como "Emprendedores SV").
Implicación: la estrategia de adopción no empieza en GitHub sino en **grupos de Facebook + tutoriales en video en español + demo con datos**. GitHub es para la comunidad técnica (self-hosters, contribuidores), que cumple otro rol.

### L3 · Offline explícito = ventaja competitiva documentada
El artículo de Peddlr lo dice tal cual: la app funciona "aun sin conexión a Internet" — esa fue parte central de su crecimiento en zonas con señal pobre. Coincide con la decisión D1 (offline-first) y la valida con evidencia de mercado, no solo técnica.

---

## 3. Lecciones de producto (transversales)

- **L4 · Venta fraccionada es universal:** en Filipinas se llama *tingi* (micro-empaques: un sobrecito, un huevo, una libra). El requisito D6 (conversión de unidades) tiene espejo exacto en el mercado más parecido al salvadoreño.
- **L5 · Voz primero (futuro):** Dukaan AI factura hablando (en hindi/local). Para baja alfabetización digital, entrada por voz en español es un diferenciador posterior (v2+).
- **L6 · Ecosistema de super-app:** en China todo corre dentro de WeChat (mini-programas). El equivalente salvadoreño es **WhatsApp**: futuro — compartir lista de fiados/stock por WhatsApp, recordatorios de cobro. (WhatsApp Cloud API tiene capa gratuita). No para v1, pero define la hoja de ruta.
- **L7 · Distribución sin Google:** F-Droid permite publicar APKs sin cuenta de Play Store ni $25. Si algún día se empaqueta con Capacitor, F-Droid es el canal natural de un proyecto open source.
- **L8 · El installer ≠ el usuario (confirmado otra vez):** Packworks/Peddlr/Khatabook crecieron con dueñas de tienda que jamás configuraron nada. La instalación la hace la comunidad técnica; el uso, la tienda. El producto necesita DOS discursos: README técnico y manual en español con capturas.

---

## 4. Modelos de sostenibilidad observados (cómo "gratis" sobrevive)

| Modelo | Ejemplo | Mecánica | Aplicable a nosotros |
|---|---|---|---|
| Core gratis + add-ons de pago | **Loyverse** | Empleados/integraciones de pago | No (empleados gratis es nuestra promesa) |
| Core gratis + servicios financieros | Peddlr, Khatabook | Ganan con B2B, recargas, créditos | No aplicable como persona individual; posible con partners locales algún día |
| **OSS + nube de pago + plugins** | **jshERP** (¥198/año ≈ $28/año por nube; plugins; custom) | El código es libre; se paga la conveniencia | **Sí** — modelo demostrado y compatible con open source: quien quiera autohospedar, gratis; quien quiera nube lista, paga (futuro, vía GitHub Sponsors/OpenCollective si el proyecto crece) |
| SaaS puro | Packworks | Suscripción B2B | No |

---

## 5. Riesgos actualizados

- **R4 (nuevo):** El segmento está lleno de startups financiadas (Loyverse, Peddlr, Packworks, Dukaan). Contra ellas no competimos por features sino por **open source + self-host + gratis multiempleado + español + datos propios**. Es un nicho real (comunidad self-host hispana + revendedores locales + ONGs).
- **R5 (nuevo):** Si incluimos fiados, tocar dinero/creditío exige rigor en auditoría y respaldo (backups). El libro de movimientos (D5) cubre esto por diseño.
- **R6 (nuevo):** La adopción por Facebook (L2) implica soporte comunitario en español con costo de tiempo del maintainer. Mitigar con: FAQ en video, demo, plantillas de respuestas.

---

## 6. Impacto en las decisiones del spec (actualización de D1–D9)

| # | Cambio |
|---|---|
| D10 | **Fiados (libreta digital)** entra como módulo de v1: cliente + cargo/abono + saldo + historial. Es el gancho de adopción probado (Khatabook/Peddlr) y el dolor real del segmento |
| D11 | Plan de adopción bifurcado: **comunidad Facebook/WhatsApp en español** (usuarios) + **GitHub/self-host** (instaladores). Demo con datos + videos cortos obligatorios en v1 |
| D12 | WhatsApp como canal de distribución futuro (compartir estado de cuenta de fiado, consultar stock) — hoja de ruta, no v1 |
| D13 | Modelo de sostenibilidad aspiracional: código libre siempre (Apache-2.0 o AGPL-3.0, decidir), conveniencia pagada opcional (nube hosted) — patrón jshERP |
| D14 | Packaging futuro: APK vía F-Droid (Capacitor) solo si la demanda lo pide; v1 sigue siendo PWA |
