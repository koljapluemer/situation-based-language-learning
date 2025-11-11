import { FastifyInstance } from "fastify";
import { z } from "zod";
import { SituationService } from "../services/situation-service";
import { situationQuerySchema, situationUpdateSchema, situationWriteSchema } from "../schemas/situation-schema";
import { languageCodeSchema } from "../schemas/common";

const paramsSchema = z.object({ id: z.string().cuid() });
const languageQuerySchema = z.object({ language: languageCodeSchema });
const service = new SituationService();

export function registerSituationRoutes(app: FastifyInstance) {
  app.get("/situations", async (request) => {
    const query = situationQuerySchema.parse(request.query);
    return { data: await service.list(query) };
  });

  app.get("/situations/:id", async (request) => {
    const { id } = paramsSchema.parse(request.params);
    const { language } = languageQuerySchema.parse(request.query);
    return { data: await service.findById(id, { language }) };
  });

  app.post("/situations", async (request, reply) => {
    const payload = situationWriteSchema.parse(request.body);
    const situation = await service.create(payload);
    return reply.code(201).send({ data: situation });
  });

  app.patch("/situations/:id", async (request) => {
    const { id } = paramsSchema.parse(request.params);
    const { language } = languageQuerySchema.parse(request.query);
    const payload = situationUpdateSchema.parse(request.body);
    return {
      data: await service.update(id, payload, language),
    };
  });

  app.delete("/situations/:id", async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    await service.delete(id);
    return reply.code(204).send();
  });
}
