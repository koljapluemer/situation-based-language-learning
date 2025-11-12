import { Prisma, PrismaClient } from "@prisma/client";
import { GlossDTO, GlossIdentifier, LanguageCode, Note } from "@sbl/shared";
import { prisma as defaultClient } from "../lib/prisma";

const relationSelect = { select: { id: true, language: true, content: true } } as const;

const glossInclude = {
  contains: relationSelect,
  nearSynonyms: relationSelect,
  nearHomophones: relationSelect,
  translations: relationSelect,
  clarifiesUsage: relationSelect,
  toBeDifferentiatedFrom: relationSelect,
} satisfies Prisma.GlossInclude;

type GlossNode = Prisma.GlossGetPayload<{ include: typeof glossInclude }>;

export class GlossResolver {
  constructor(private readonly client: PrismaClient = defaultClient) {}

  async resolveByIds(glossIds: string[]): Promise<Map<string, GlossDTO>> {
    if (!glossIds.length) {
      return new Map();
    }

    const glosses = await this.client.gloss.findMany({
      where: { id: { in: glossIds } },
      include: glossInclude,
    });

    const map = new Map<string, GlossDTO>();
    glosses.forEach((gloss) => map.set(gloss.id, this.toDTO(gloss)));
    return map;
  }

  async resolveSingle(glossId: string): Promise<GlossDTO> {
    const gloss = await this.client.gloss.findUnique({
      where: { id: glossId },
      include: glossInclude,
    });

    if (!gloss) {
      throw new Error(`Gloss ${glossId} not found`);
    }

    return this.toDTO(gloss);
  }

  private toDTO(gloss: GlossNode): GlossDTO {
    return {
      id: gloss.id,
      language: gloss.language as LanguageCode,
      content: gloss.content,
      isParaphrased: gloss.isParaphrased,
      transcriptions: gloss.transcriptions ?? [],
      notes: this.parseNotes(gloss.notes),
      contains: this.mapIdentifiers(gloss.contains),
      nearSynonyms: this.mapIdentifiers(gloss.nearSynonyms),
      nearHomophones: this.mapIdentifiers(gloss.nearHomophones),
      translations: this.mapIdentifiers(gloss.translations),
      clarifiesUsage: this.mapIdentifiers(gloss.clarifiesUsage),
      toBeDifferentiatedFrom: this.mapIdentifiers(gloss.toBeDifferentiatedFrom),
    };
  }

  private mapIdentifiers(glosses?: { language: string; content: string }[]): GlossIdentifier[] {
    if (!glosses?.length) {
      return [];
    }
    return glosses.map((gloss) => ({
      language: gloss.language as LanguageCode,
      content: gloss.content,
    }));
  }

  private parseNotes(notes: Prisma.JsonValue | null | undefined): Note[] {
    if (!notes) {
      return [];
    }

    if (Array.isArray(notes)) {
      return notes as unknown as Note[];
    }

    return [];
  }
}
