import { FastifyInstance } from "fastify";
import { z } from "zod";
import { SituationService } from "../services/situation-service";
import { situationQuerySchema, situationUpdateSchema, situationWriteSchema } from "../schemas/situation-schema";

const paramsSchema = z.object({ id: z.string().min(1) }); // identifier (e.g., "greeting-basic")
const service = new SituationService();

export function registerSituationRoutes(app: FastifyInstance) {
  app.get("/situations/summary", async (request) => {
    const query = situationQuerySchema.parse(request.query);
    return { data: await service.listSummary(query) };
  });

  app.get("/situations", async (request) => {
    const query = situationQuerySchema.parse(request.query);
    return { data: await service.list(query) };
  });

  app.get("/situations/:id", async (request) => {
    const { id } = paramsSchema.parse(request.params);
    const query = situationQuerySchema.parse(request.query);
    return { data: await service.findById(id, query) };
  });

  app.post("/situations", async (request, reply) => {
    const payload = situationWriteSchema.parse(request.body);
    const situation = await service.create(payload);
    return reply.code(201).send({ data: situation });
  });

  app.patch("/situations/:id", async (request) => {
    const { id } = paramsSchema.parse(request.params);
    const payload = situationUpdateSchema.parse(request.body);
    return {
      data: await service.update(id, payload),
    };
  });

  app.delete("/situations/:id", async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    await service.delete(id);
    return reply.code(204).send();
  });
}
