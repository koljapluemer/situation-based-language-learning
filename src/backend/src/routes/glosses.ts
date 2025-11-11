import { FastifyInstance } from "fastify";
import { z } from "zod";
import { GlossService } from "../services/gloss-service";
import { glossQuerySchema, glossUpdateSchema, glossWriteSchema } from "../schemas/gloss-schema";

const paramsSchema = z.object({ id: z.string().cuid() });
const service = new GlossService();

export function registerGlossRoutes(app: FastifyInstance) {
  app.get("/glosses", async (request) => {
    const query = glossQuerySchema.parse(request.query);
    const glosses = await service.list(query.language, query.content);
    return { data: glosses };
  });

  app.get("/glosses/:id", async (request) => {
    const { id } = paramsSchema.parse(request.params);
    return { data: await service.findById(id) };
  });

  app.post("/glosses", async (request, reply) => {
    const payload = glossWriteSchema.parse(request.body);
    const gloss = await service.create(payload);
    return reply.code(201).send({ data: gloss });
  });

  app.patch("/glosses/:id", async (request) => {
    const { id } = paramsSchema.parse(request.params);
    const payload = glossUpdateSchema.parse(request.body);
    const gloss = await service.update(id, payload);
    return { data: gloss };
  });

  app.delete("/glosses/:id", async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    await service.delete(id);
    return reply.code(204).send();
  });
}
