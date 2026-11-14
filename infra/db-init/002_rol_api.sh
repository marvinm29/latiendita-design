#!/bin/sh
# Se ejecuta como administrador local, después de las migraciones.
set -eu

# El único password externo queda en el rol restringido. Administración posterior:
# docker compose exec db psql -U latiendita -d latiendita (socket local del contenedor).
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=app_password="$POSTGRES_PASSWORD" --set=admin_role="$POSTGRES_USER" <<'SQL'
BEGIN;
CREATE ROLE latiendita_api LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
SELECT format('ALTER ROLE latiendita_api PASSWORD %L', :'app_password') \gexec
SELECT set_config('latiendita.rol_app', 'latiendita_api', false);
\i /permisos-app.sql
SELECT format('ALTER ROLE %I PASSWORD NULL', :'admin_role') \gexec
COMMIT;
SQL
