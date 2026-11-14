#!/bin/sh
# Primer arranque de un volumen vacío; no volver a ejecutar sobre datos existentes.
set -eu

for migracion in /migrations/*.sql; do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$migracion"
done
