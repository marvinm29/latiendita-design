import "dotenv/config";
import Fastify from "fastify";
import { closeDb } from "./db/client";

const app = Fastify({
  logger: true,
});

app.get("/health", async () => ({ status: "ok" }));

async function main(): Promise<void> {
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? "0.0.0.0";

  await app.listen({ port, host });
  app.log.info(`API escuchando en http://${host}:${port}`);
}

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  app.log.info(`Recibido ${signal}, cerrando…`);
  try {
    await app.close();
    await closeDb();
    process.exit(0);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

process.on("SIGINT", (signal) => void shutdown(signal));
process.on("SIGTERM", (signal) => void shutdown(signal));

main().catch((error) => {
  app.log.error(error);
  process.exit(1);
});
