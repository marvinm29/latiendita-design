# B2 · Traslado explícito de datos heredados

Spec: `specs/002-especificacion-funcional.md` C1.4, C7.2, C8.4 y C10.2.
Base: `acf23df`. Un agente, mismo árbol, sin commit/push/despliegue (AGENTS §6).

## Decisión y alcance

El dueño eligió el 16/11/2026 confirmación de la dueña y respaldo antes de trasladar
todo. La alternativa era conservar `local` separado y usar importación. Se descarta
asignación automática y descarte de ejemplos: no prueban propiedad ni ausencia de
datos reales. Esta subtarea entrega migración; renovación/reingreso siguen pendientes.

La dueña desbloqueada ve un resumen en Respaldo y datos. Confirma «Estos datos son
de mi tienda». Una transacción guarda el origen y cambia únicamente el contexto de
negocio de las filas y payloads. Mantiene IDs, marcas LWW, cola y referencias. Descarta
`serverSeq` del origen y devuelve ops `ok`/`enviando` a `pendiente`, sin copiar cursores.
La caché destino se verifica contra el libro; el respaldo mantiene el origen exacto. No se
acepta destino ocupado ni referencias cruzadas/payloads desconocidos. Una marca
terminal impide resiembra y escrituras tardías al origen. El respaldo sigue
descargable por la dueña de la cuenta destino después de recargar. No incluye tokens
ni verificadores de PIN. No transfiere cursores ni confirma operaciones.

## Pasos y archivos

- [x] 1. `datos/migracionLocal.test.ts`: demostrar primero fallos por migración ausente;
  probar conservación exacta, rollback, destino ocupado, referencias ajenas,
  sesión/rol/bloqueo, repetición y A→B. Fixture real Dexie con cola antigua.
- [x] 2. `datos/migracionLocal.ts`: inspección sólo para dueña desbloqueada y traslado
  con respaldo dentro de una única transacción IndexedDB, sin sembrar al inspeccionar.
  `baseLocal.ts`, `core/db/meta.ts`, repos e importador: impedir uso del origen retirado,
  incluso con contextos capturados antes del traslado.
- [x] 3. `paginas/respaldo/DatosAnteriores.tsx`, `Respaldo.tsx`,
  `e2e/migracion-local.spec.ts`: primero e2e rojo; resumen, confirmación, cancelación,
  descarga persistente, recarga offline y axe usando los componentes existentes.
- [x] 4. Gates: tipos, lint, tests, build, tamaño; e2e secuencial con CI=1.
  Actualizar docs de continuidad con evidencia y límites. Revisión propia del diff.

## Verificación y riesgos

La prueba de integración usa IndexedDB simulado; el e2e usa IndexedDB de Chromium.
Auth HTTP del navegador simulado: no demuestra acceso recuperable ni RLS. No cambia
servidor, SQL ni contratos HTTP; no requiere repetir PG para este alcance.
Vigilar cola antigua con payloads anidados, libro con IDs repetidos, unidad sin
negocioId, stock desactualizado, tombstones, cambio de cuenta durante confirmación,
fallo después de guardar respaldo y otra pestaña escribiendo al origen.

## Registro

- Base: tipos correctos. Tests fallaron por socket EPERM del sandbox; repetición
  fuera del sandbox correcta: 171 regulares y dos integraciones PG omitidas.
- Adaptación: AGENTS §6 prevalece sobre worktrees, commits y revisor delegado de
  las skills. Se usa este registro breve y se continúa con la política elegida.
- Pruebas rojas observadas: módulo ausente; escritura tardía en `local`; confirmación
  `serverSeq=123` heredada; ID ajeno en operación con negocio aparentemente válido;
  stock caché 999 frente al libro 10; botón de revisión ausente en Chromium; descarga
  desde pantalla antigua después de cambiar cuenta. Todas corregidas y verdes.
- Revisión propia: mantener esquema/IDs globales; no hacer merge con destino ocupado
  porque no se puede inferir pertenencia. Si esa limitación no sirve, requerirá una
  política de conflictos explícita. Formatos de cola desconocidos conservan todo y
  bloquean el traslado hasta entenderlos; no se descartan ni se normalizan a ciegas.
- Revisión de componentes: hooks incondicionales, consultas independientes agrupadas,
  manejo de desmontaje, checkbox con etiqueta y área de 48px, alertas con foco,
  botones bloqueados durante traslado. Descarga revalida cuenta/rol/bloqueo al pulsar.
- Verificación final: tipos/lint y 186 pruebas regulares (96 core + 70 web + 20 API),
  dos integraciones PG omitidas. `CI=1 pnpm --filter @latiendita/web test:e2e --retries=0`
  → 33/33 (24.7 s), con Chromium/PWA, descarga real y axe. Pruebas y e2e fuera del sandbox
  tras bloqueos de sockets en la base y del servidor de Playwright dentro de él.
- Build y tamaño: `pnpm build`, `pnpm size` → correctos, **118 513 / 153 600 B gzip**.
  Contraste 60/60 y QA estática 13 pantallas/60 marcos/0 hallazgos. Docs de estado
  actualizados. Revisión propia, sin delegación; sin hallazgos importantes pendientes
  dentro de este alcance. Commit/push autorizados después por el dueño; sin despliegue.
  Sigue B2b (renovación/reingreso).
