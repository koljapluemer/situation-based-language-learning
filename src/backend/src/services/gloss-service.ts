import { Prisma, PrismaClient } from "@prisma/client";
import { GlossDTO } from "../../shared/dto/GlossDTO";
import { GlossWriteInput, GlossUpdateInput } from "../schemas/gloss-schema";
import { LanguageCode } from "../../shared/Language";
import { prisma as defaultClient } from "../lib/prisma";
import { GlossResolver } from "./gloss-resolver";
import { ConflictError, NotFoundError } from "../utils/http-error";

export class GlossService {
  private readonly resolver: GlossResolver;

  constructor(private readonly client: PrismaClient = defaultClient) {
    this.resolver = new GlossResolver(this.client);
  }

  async create(payload: GlossWriteInput): Promise<GlossDTO> {
    try {
      const glossary = await this.client.gloss.create({
        data: {
          language: payload.language,
          content: payload.content,
          isParaphrased: payload.isParaphrased ?? false,
          transcriptions: payload.transcriptions ?? [],
          notes: payload.notes ?? [],
          contains: this.connectRelations(payload.containsIds),
          nearSynonyms: this.connectRelations(payload.nearSynonymIds),
          nearHomophones: this.connectRelations(payload.nearHomophoneIds),
          translations: this.connectRelations(payload.translationIds),
        },
      });

      return this.resolver.resolveSingle(glossary.id);
    } catch (error) {
      this.handlePrismaError(error, payload);
      throw error;
    }
  }

  async update(id: string, payload: GlossUpdateInput): Promise<GlossDTO> {
    await this.ensureExists(id);

    const data: Prisma.GlossUpdateInput = {};
    if (payload.language) data.language = payload.language;
    if (payload.content) data.content = payload.content;
    if (typeof payload.isParaphrased === "boolean") data.isParaphrased = payload.isParaphrased;
    if (payload.transcriptions !== undefined) data.transcriptions = payload.transcriptions;
    if (payload.notes !== undefined) data.notes = payload.notes;

    if (payload.containsIds !== undefined) {
      data.contains = this.setRelations(payload.containsIds);
    }
    if (payload.nearSynonymIds !== undefined) {
      data.nearSynonyms = this.setRelations(payload.nearSynonymIds);
    }
    if (payload.nearHomophoneIds !== undefined) {
      data.nearHomophones = this.setRelations(payload.nearHomophoneIds);
    }
    if (payload.translationIds !== undefined) {
      data.translations = this.setRelations(payload.translationIds);
    }

    try {
      const glossary = await this.client.gloss.update({
        where: { id },
        data,
      });

      return this.resolver.resolveSingle(glossary.id);
    } catch (error) {
      this.handlePrismaError(error, payload);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    await this.ensureExists(id);
    await this.client.gloss.delete({ where: { id } });
  }

  async findById(id: string): Promise<GlossDTO> {
    await this.ensureExists(id);
    return this.resolver.resolveSingle(id);
  }

  async list(language?: LanguageCode, content?: string): Promise<GlossDTO[]> {
    const where: Prisma.GlossWhereInput = {};
    if (language) where.language = language;
    if (content) where.content = content;

    const glosses = await this.client.gloss.findMany({
      where,
      select: { id: true },
      orderBy: { updatedAt: "desc" },
    });

    const map = await this.resolver.resolveByIds(glosses.map((g) => g.id));

    return glosses
      .map((gloss) => map.get(gloss.id))
      .filter((item): item is GlossDTO => Boolean(item));
  }

  private connectRelations(ids?: string[]) {
    if (!ids?.length) return undefined;
    return {
      connect: ids.map((id) => ({ id })),
    };
  }

  private setRelations(ids: string[]) {
    return {
      set: ids.map((id) => ({ id })),
    };
  }

  private async ensureExists(id: string) {
    const exists = await this.client.gloss.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      throw new NotFoundError(`Gloss ${id} not found`);
    }
  }

  private handlePrismaError(error: unknown, payload: { language?: string; content?: string }) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        throw new ConflictError(
          `Gloss with language ${payload.language} and content ${payload.content} already exists`
        );
      }
      if (error.code === "P2025") {
        throw new NotFoundError("Referenced gloss not found");
      }
    }
  }
}
