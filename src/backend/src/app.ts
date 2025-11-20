import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./env.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerGlossRoutes } from "./routes/glosses.js";
import { registerSituationRoutes } from "./routes/situations.js";
import { registerAIChallengeRoutes } from "./routes/ai-challenges.js";
import { HttpError } from "./utils/http-error.js";
import { prisma } from "./lib/prisma.js";
import { ZodError } from "zod";

export function buildApp() {
  const app = Fastify({
    logger: true,
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: "Validation error",
        details: error.issues,
      });
    }

    if (error instanceof HttpError) {
      request.log.warn({ err: error }, error.message);
      return reply.status(error.statusCode).send({
        error: error.message,
      });
    }

    request.log.error({ err: error }, "Unhandled error");
    return reply.status(500).send({ error: "Internal Server Error" });
  });

  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });

  app.register(cors, {
    origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN.split(","),
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  });

  registerHealthRoutes(app);
  registerGlossRoutes(app);
  registerSituationRoutes(app);
  registerAIChallengeRoutes(app);

  return app;
}
