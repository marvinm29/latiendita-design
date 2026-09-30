# LaTiendita · API (multi-stage) — build del monorepo pnpm, sólo el filtro api.
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
RUN pnpm install --filter @latiendita/api --frozen-lockfile || pnpm install --filter @latiendita/api

COPY tsconfig.base.json ./
COPY apps/api/ apps/api/
RUN pnpm --filter @latiendita/api build

FROM node:22-alpine
WORKDIR /app
RUN corepack enable
ENV NODE_ENV=production

COPY --from=build /app/package.json pnpm-workspace.yaml ./
COPY --from=build /app/apps/api/package.json apps/api/
RUN pnpm install --filter @latiendita/api --prod --frozen-lockfile || pnpm install --filter @latiendita/api --prod

COPY --from=build /app/apps/api/dist apps/api/dist
# Migraciones SQL las aplica entrypoint de Postgres (initdb.d); se copian por si
# se ejecutan a mano con psql.
COPY apps/api/src/migrations apps/api/migrations

WORKDIR /app/apps/api
EXPOSE 3000
USER node
CMD ["node", "dist/server.js"]
