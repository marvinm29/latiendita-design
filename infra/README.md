# Infraestructura — LaTiendita

Instalación de **1 comando** para Carlos (D7 / T-08): API + PostgreSQL 16 +
Caddy (TLS) con **≤5 variables** de entorno.

## Requisitos

- Docker con plugin `docker compose` (Docker Desktop o docker-ce + compose plugin)
- Un servidor con puerto 80/443 libres (para TLS con Caddy)

## Instalar (≤15 min)

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
| `SESSION_SECRET` | Secreto de sesiones de la API |
| `DEMO_SEED` | `true` = siembra tienda demo en el primer arranque |
| `BACKUP_CRON` | Horario del respaldo `pg_dump` (cron), ej. `0 3 * * *` |

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

Las migraciones son aditivas. La app PWA avisa cuando hay una versión nueva
(no recarga a la fuerza — C9.2).

## Respaldo

- Automático: perfil `backup` con `BACKUP_CRON` → volumen `backup_data`
  (activar cuando se descomente el servicio en `docker-compose.yml`).
- Desde la app: **Más → Respaldo y datos** → export CSV/JSON (C10).

## Resolver problemas

| Síntoma | Qué revisar |
|---|---|
| `api` reiniciando | `docker compose logs api` — ¿`DATABASE_URL` y password correctos? |
| Puerto 3000 ocupado | Cambiar el mapeo en `docker-compose.yml` |
| TLS no emite cert | `DOMAIN` apunta al servidor? Puerto 80/443 abiertos? |
| Sin datos al reinstalar | El volumen `db_data` se conserva con `down`; `down -v` **borra todo** |
