import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

let pool: Pool | undefined;
let db: Db | undefined;

/**
 * Pool perezoso: importar este módulo NO abre conexiones (útil en tests y en
 * `/health`, que no toca la base). DATABASE_URL manda; si no, variables locales.
 */
export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    pool = connectionString
      ? new Pool({ connectionString })
      : new Pool({
          host: process.env.POSTGRES_HOST ?? "localhost",
          port: Number(process.env.POSTGRES_PORT ?? 5432),
          user: process.env.POSTGRES_USER ?? "latiendita",
          password: process.env.POSTGRES_PASSWORD ?? "",
          database: process.env.POSTGRES_DB ?? "latiendita",
        });
  }
  return pool;
}

export function getDb(): Db {
  if (!db) {
    db = drizzle(getPool(), { schema });
  }
  return db;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
    db = undefined;
  }
}
