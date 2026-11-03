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

1. **db** — PostgreSQL 16; en el primer arranque aplica
   `apps/api/src/migrations/0001_init.sql` (tablas + RLS por `negocio_id`).
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
| `POSTGRES_PASSWORD` | Contraseña del usuario de Postgres |
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

```bash
git pull
docker compose up -d --build
```

Los scripts de `docker-entrypoint-initdb.d` se ejecutan solo al crear un volumen de
Postgres vacío. Este comando no aplica migraciones nuevas a una base ya existente;
el mecanismo de migración y su runbook siguen pendientes. La PWA avisa de una versión nueva.

## Respaldo

- Automático del servidor: **no implementado**; el bloque de compose está comentado y no existe un runbook de restauración probado.
- Desde la app: **Más → Respaldo y datos** → export CSV/JSON, incluyendo conteos. El restore conserva ediciones existentes y restaura las semillas demo sin modificar; aún no encola datos para sync (ver `specs/006-plan-sprints.md` §3).

La API publica el puerto 3000 directamente; el perfil `tls` añade Caddy, pero no
cierra esa exposición ni sirve la aplicación web. El aislamiento RLS de auth y
una instalación segura completa siguen pendientes de verificación en S4/M4.

## Resolver problemas

| Síntoma | Qué revisar |
|---|---|
| `api` reiniciando | `docker compose logs api` — ¿`DATABASE_URL` y password correctos? |
| Puerto 3000 ocupado | Cambiar el mapeo en `docker-compose.yml` |
| TLS no emite cert | `DOMAIN` apunta al servidor? Puerto 80/443 abiertos? |
| Sin datos al reinstalar | El volumen `db_data` se conserva con `down`; `down -v` **borra todo** |
