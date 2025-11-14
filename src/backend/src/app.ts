import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./env";
import { registerHealthRoutes } from "./routes/health";
import { registerGlossRoutes } from "./routes/glosses";
import { registerSituationRoutes } from "./routes/situations";
import { registerAIChallengeRoutes } from "./routes/ai-challenges";
import { HttpError } from "./utils/http-error";
import { prisma } from "./lib/prisma";
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
