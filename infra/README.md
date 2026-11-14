# Infraestructura — LaTiendita

Objetivo de instalación para Carlos (D7 / T-08): API + PostgreSQL 16 + Caddy (TLS)
con **≤5 variables**. El despliegue actual es un scaffold: no sirve la web, no
incluye backups automáticos y todavía no se ha validado una instalación completa.

## Requisitos

- Docker con plugin `docker compose` (Docker Desktop o docker-ce + compose plugin)
- Un servidor con puerto 80/443 libres (para TLS con Caddy)

## Arrancar el scaffold local

```bash
git clone <repo> latiendita
cd latiendita/infra
cp .env.example .env
# Editá .env: al menos POSTGRES_PASSWORD y SESSION_SECRET (valores fuertes).
# En producción: DOMAIN=tutienda.ejemplo.com y DEMO_SEED=false.
docker compose up -d
```

Qué pasa al arrancar:

1. **db** — PostgreSQL 16; en el primer arranque ejecuta `db-init/001_migrar.sh`
   (migraciones `0001`–`0004`) y `002_rol_api.sh` (rol restringido y permisos).
2. **api** — Fastify; espera a que `db` pase el healthcheck y expone
   `GET /health` → `{"status":"ok"}`.
3. **caddy** (opcional, perfil `tls`) — reverse proxy con TLS automático:

```bash
docker compose --profile tls up -d
```

## Las 5 variables (`.env`)

| Variable | Qué es |
|---|---|
| `DOMAIN` | Dominio público (Caddy/Let's Encrypt). Dev: `localhost` |
| `POSTGRES_PASSWORD` | Contraseña del rol restringido `latiendita_api` |
| `SESSION_SECRET` | Compose lo exige y lo pasa a la API, pero el código actual no lo utiliza. |
| `DEMO_SEED` | Compose lo pasa a la API, pero actualmente no activa una semilla en el servidor. La web tiene datos demo locales independientes. |
| `BACKUP_CRON` | Reservado para el futuro servicio de respaldo; actualmente no hace nada. |

## Comandos útiles

```bash
docker compose ps                 # estado + healthchecks
docker compose logs -f api        # logs de la API
docker compose logs -f db
curl -s http://localhost:3000/health   # {"status":"ok"}
docker compose config             # valida el YAML con tus .env
docker compose down               # para (los datos quedan en el volumen)
docker compose up -d --build      # actualizar tras git pull
```

## Actualizar

Un volumen anterior a `0004` necesita migración y aprovisionamiento antes de arrancar la API
con el nuevo rol. Para una base que **ya tiene `0001`–`0003`**, la transición manual es:

```bash
docker compose stop api
docker compose up -d db
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U latiendita -d latiendita -f /migrations/0004_auth_minimo_privilegio.sql
docker compose exec -T db sh /docker-entrypoint-initdb.d/002_rol_api.sh
docker compose up -d --build api
```

Los scripts de `docker-entrypoint-initdb.d` se ejecutan solo al crear un volumen de
Postgres vacío. No vuelvas a ejecutar `001_migrar.sh` sobre un volumen con datos, ni `002_rol_api.sh`
si el rol ya existe. La transición anterior no sustituye el migrador versionado del incremento E.
El arranque y la transición con Docker siguen sin probarse en este entorno. La PWA avisa de
una versión nueva.

## Roles y aislamiento de auth (incremento A)

- `latiendita` es el administrador/migrador y dueño de las tablas y funciones. Tras el
  aprovisionamiento queda **sin contraseña para conexiones remotas**. Se administra desde
  el socket local dentro del contenedor: `docker compose exec db psql -U latiendita -d latiendita`.
- `latiendita_api` conecta por TCP desde la API, sin superusuario, `BYPASSRLS`, creación de
  roles/bases ni propiedad de objetos. Usa `POSTGRES_PASSWORD`; no se añade una sexta variable.
  El cliente también acepta `DATABASE_URL` para instalaciones externas, que debe apuntar a
  un rol con estos mismos permisos.
- `permisos-app.sql` concede únicamente lectura de las cinco tablas de auth con RLS,
  inserción de invitaciones/sesiones, actualización de uso/revocación y ejecución de cuatro
  funciones. No concede escritura directa de negocios, personas o membresías ni permisos de sync.
- Las búsquedas iniciales usan el hash exacto de código/token; alta y canje son atómicos.
  Las funciones `SECURITY DEFINER` fijan `search_path`, califican las tablas y revocan ejecución
  pública, siguiendo la [documentación de PostgreSQL 16](https://www.postgresql.org/docs/16/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY).
  El resto de auth fija el negocio dentro de cada transacción; la API lo obtiene del código o sesión.

Integración reproducible (sólo clúster PG16 desechable; crea y elimina una base y un rol propios):

```bash
SYNC_TEST_PG=1 PGHOST=/ruta/al/socket PGPORT=55439 PGUSER=admin_pruebas PGDATABASE=postgres pnpm --filter @latiendita/api test
```

Debe terminar sin `SKIP`. Cubre migraciones reales, alta/canje con rollback, carreras de canje
y rotación, expiración, revocación, baja de membresía y lecturas/escrituras A/B con el rol de
aplicación. El SQL de permisos es el mismo que utiliza el aprovisionamiento de Compose.
Esto prueba auth/RLS en PG16, no el despliegue completo ni la sincronización entre navegadores.

## Respaldo

- Automático del servidor: **no implementado**; el bloque de compose está comentado y no existe un runbook de restauración probado.
- Desde la app: **Más → Respaldo y datos** → export CSV/JSON, incluyendo conteos. El restore conserva ediciones existentes y restaura las semillas demo sin modificar; aún no encola datos para sync (ver `specs/006-plan-sprints.md` §3).

La API publica el puerto 3000 directamente; el perfil `tls` añade Caddy, pero no
cierra esa exposición ni sirve la aplicación web. Auth/RLS tiene integración PG16;
la instalación completa y la seguridad del despliegue siguen pendientes en E/M4.

## Resolver problemas

| Síntoma | Qué revisar |
|---|---|
| `api` reiniciando | `docker compose logs api` — ¿`DATABASE_URL` y password correctos? |
| Puerto 3000 ocupado | Cambiar el mapeo en `docker-compose.yml` |
| TLS no emite cert | `DOMAIN` apunta al servidor? Puerto 80/443 abiertos? |
| Sin datos al reinstalar | El volumen `db_data` se conserva con `down`; `down -v` **borra todo** |
