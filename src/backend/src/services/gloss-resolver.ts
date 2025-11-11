import { Prisma, PrismaClient } from "@prisma/client";
import { GlossDTO, LanguageCode, Note } from "@sbl/shared";
import { prisma as defaultClient } from "../lib/prisma";

const glossInclude = {
  contains: true,
  nearSynonyms: true,
  nearHomophones: true,
  translations: true,
} satisfies Prisma.GlossInclude;

type GlossNode = Prisma.GlossGetPayload<{ include: typeof glossInclude }>;
type GlossScalar = Prisma.GlossGetPayload<{}>;

export class GlossResolver {
  constructor(private readonly client: PrismaClient = defaultClient) {}

  async resolveByIds(glossIds: string[]): Promise<Map<string, GlossDTO>> {
    if (!glossIds.length) {
      return new Map();
    }

    const nodes = await this.loadGraph(new Set(glossIds));
    const memo = new Map<string, GlossDTO>();

    const result = new Map<string, GlossDTO>();
    glossIds.forEach((id) => {
      if (nodes.has(id)) {
        result.set(id, this.buildResolvedGloss(id, nodes, memo));
      }
    });

    return result;
  }

  async resolveSingle(glossId: string): Promise<GlossDTO> {
    const nodes = await this.loadGraph(new Set([glossId]));
    if (!nodes.has(glossId)) {
      throw new Error(`Gloss ${glossId} not found`);
    }

    return this.buildResolvedGloss(glossId, nodes, new Map());
  }

  private async loadGraph(seedIds: Set<string>): Promise<Map<string, GlossNode>> {
    const nodes = new Map<string, GlossNode>();
    const queue = new Set(seedIds);

    while (queue.size) {
      const batch = Array.from(queue);
      queue.clear();

      const glosses = await this.client.gloss.findMany({
        where: { id: { in: batch } },
        include: glossInclude,
      });

      glosses.forEach((gloss) => {
        nodes.set(gloss.id, gloss);
        gloss.contains.forEach((child) => {
          if (!nodes.has(child.id)) {
            queue.add(child.id);
          }
        });
      });
    }

    return nodes;
  }

  private buildResolvedGloss(
    glossId: string,
    nodes: Map<string, GlossNode>,
    memo: Map<string, GlossDTO>
  ): GlossDTO {
    if (memo.has(glossId)) {
      return memo.get(glossId)!;
    }

    const node = nodes.get(glossId);
    if (!node) {
      throw new Error(`Gloss node ${glossId} missing from graph`);
    }

    const dto: GlossDTO = {
      ...this.baseFromNode(node),
      contains: [],
      nearSynonyms: [],
      nearHomophones: [],
      translations: [],
    };

    memo.set(glossId, dto);

    dto.contains = node.contains.map((child) =>
      this.buildResolvedGloss(child.id, nodes, memo)
    );

    dto.nearSynonyms = node.nearSynonyms.map((gloss) =>
      this.shallowGloss(gloss, nodes, memo)
    );
    dto.nearHomophones = node.nearHomophones.map((gloss) =>
      this.shallowGloss(gloss, nodes, memo)
    );
    dto.translations = node.translations.map((gloss) =>
      this.shallowGloss(gloss, nodes, memo)
    );

    return dto;
  }

  private shallowGloss(
    gloss: GlossScalar,
    nodes: Map<string, GlossNode>,
    memo: Map<string, GlossDTO>
  ): GlossDTO {
    if (memo.has(gloss.id)) {
      return memo.get(gloss.id)!;
    }

    if (nodes.has(gloss.id)) {
      return this.buildResolvedGloss(gloss.id, nodes, memo);
    }

    return { ...this.baseFromNode(gloss), contains: [], nearSynonyms: [], nearHomophones: [], translations: [] };
  }

  private baseFromNode(gloss: GlossScalar | GlossNode): GlossDTO {
    return {
      id: gloss.id,
      language: gloss.language as LanguageCode,
      content: gloss.content,
      isParaphrased: gloss.isParaphrased,
      transcriptions: gloss.transcriptions ?? [],
      notes: this.parseNotes(gloss.notes),
      contains: [],
      nearSynonyms: [],
      nearHomophones: [],
      translations: [],
    };
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
