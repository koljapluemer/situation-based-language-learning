import { buildApp } from "./app.js";
import { env } from "./env.js";

async function start() {
  const app = buildApp();
  try {
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
    app.log.info(`Backend listening on port ${env.PORT}`);
  } catch (error) {
    app.log.error(error, "Failed to start backend");
    process.exit(1);
  }
}

start();
