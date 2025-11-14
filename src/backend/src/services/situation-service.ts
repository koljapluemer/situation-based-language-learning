import { Prisma, PrismaClient } from "@prisma/client";
import {
  GlossDTO,
  LanguageCode,
  LocalizedString,
  SituationDTO,
  SituationSummaryDTO,
} from "@sbl/shared";
import { prisma as defaultClient } from "../lib/prisma";
import {
  SituationQueryInput,
  SituationUpdateInput,
  SituationWriteInput,
} from "../schemas/situation-schema";
import { GlossResolver } from "./gloss-resolver";
import { ConflictError, NotFoundError } from "../utils/http-error";

const situationInclude = {
  challengesOfExpression: true,
  challengesOfUnderstandingText: true,
} satisfies Prisma.SituationInclude;

type SituationWithRelations = Prisma.SituationGetPayload<{ include: typeof situationInclude }>;

export class SituationService {
  private readonly resolver: GlossResolver;

  constructor(private readonly client: PrismaClient = defaultClient) {
    this.resolver = new GlossResolver(this.client);
  }

  async create(payload: SituationWriteInput): Promise<SituationDTO> {
    try {
      const situation = await this.client.situation.create({
        data: {
          identifier: payload.identifier,
          descriptions: payload.descriptions,
          imageLink: payload.imageLink,
          targetLanguage: payload.targetLanguage,
          challengesOfExpression: this.connectGlosses(payload.challengesOfExpressionIds),
          challengesOfUnderstandingText: this.connectGlosses(payload.challengesOfUnderstandingTextIds),
        },
        include: situationInclude,
      });

      const glossMap = await this.resolveGlossesForSituation(situation);
      return this.toDTO(situation, glossMap, {});
    } catch (error) {
      this.handlePrismaError(error, payload.identifier);
      throw error;
    }
  }

  async update(
    id: string,
    payload: SituationUpdateInput
  ): Promise<SituationDTO> {
    await this.ensureExists(id);

    try {
      const data: Prisma.SituationUpdateInput = {};
      if (payload.identifier) data.identifier = payload.identifier;
      if (payload.descriptions) data.descriptions = payload.descriptions as Prisma.JsonArray;
      if (payload.imageLink !== undefined) data.imageLink = payload.imageLink;
      if (payload.targetLanguage) data.targetLanguage = payload.targetLanguage;

      // Handle gloss array updates
      if (payload.challengesOfExpressionIds !== undefined) {
        data.challengesOfExpression = {
          set: payload.challengesOfExpressionIds.map(id => ({ id })),
        };
      }

      if (payload.challengesOfUnderstandingTextIds !== undefined) {
        data.challengesOfUnderstandingText = {
          set: payload.challengesOfUnderstandingTextIds.map(id => ({ id })),
        };
      }

      await this.client.situation.update({ where: { identifier: id }, data });

      return this.findById(id, {});
    } catch (error) {
      this.handlePrismaError(error, payload.identifier);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    await this.ensureExists(id);
    await this.client.situation.delete({ where: { identifier: id } });
  }

  async findById(id: string, query: SituationQueryInput): Promise<SituationDTO> {
    const situation = await this.client.situation.findUnique({
      where: { identifier: id },
      include: situationInclude,
    });

    if (!situation) {
      throw new NotFoundError(`Situation ${id} not found`);
    }

    const glossMap = await this.resolveGlossesForSituation(situation);
    return this.toDTO(situation, glossMap, query);
  }

  async list(query: SituationQueryInput): Promise<SituationDTO[]> {
    const where: Prisma.SituationWhereInput = {};
    if (query.identifier) {
      where.identifier = query.identifier;
    }
    if (query.targetLanguage) {
      where.targetLanguage = query.targetLanguage;
    }

    const situations = await this.client.situation.findMany({
      where,
      include: situationInclude,
      orderBy: { updatedAt: "desc" },
    });

    const glossIds = new Set<string>();
    situations.forEach((situation) => this.collectGlossIds(situation, glossIds));
    const glossMap = await this.resolver.resolveByIds(Array.from(glossIds));

    return situations.map((situation) => this.toDTO(situation, glossMap, query));
  }

  async listSummary(query: SituationQueryInput): Promise<SituationSummaryDTO[]> {
    const where: Prisma.SituationWhereInput = {};
    if (query.identifier) {
      where.identifier = query.identifier;
    }
    if (query.targetLanguage) {
      where.targetLanguage = query.targetLanguage;
    }

    const situations = await this.client.situation.findMany({
      where,
      select: {
        identifier: true,
        descriptions: true,
        imageLink: true,
        targetLanguage: true,
        _count: {
          select: {
            challengesOfExpression: true,
            challengesOfUnderstandingText: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return situations.map((situation) => ({
      identifier: situation.identifier,
      descriptions: this.parseDescriptions(situation.descriptions),
      imageLink: situation.imageLink ?? undefined,
      targetLanguage: situation.targetLanguage as LanguageCode,
      challengeCount: {
        expression: situation._count.challengesOfExpression,
        understanding: situation._count.challengesOfUnderstandingText,
      },
    }));
  }

  private connectGlosses(ids: string[]) {
    if (!ids.length) {
      return undefined;
    }
    return {
      connect: ids.map((id) => ({ id })),
    };
  }

  private toDTO(
    situation: SituationWithRelations,
    glossMap: Map<string, GlossDTO>,
    query: SituationQueryInput = {}
  ): SituationDTO {
    const descriptions = this.parseDescriptions(situation.descriptions);
    const targetLanguage = situation.targetLanguage as LanguageCode;
    const nativeLanguage = this.selectNativeLanguage(query.nativeLanguages);

    // Map expression challenges (glosses in native language)
    const expressionGlosses = situation.challengesOfExpression.map((gloss) =>
      this.pickGloss(gloss.id, glossMap)
    );
    const filteredExpressionGlosses = this.filterExpressionGlosses(
      expressionGlosses,
      targetLanguage,
      nativeLanguage
    );

    // Map understanding challenges (glosses in target language)
    const understandingGlosses = situation.challengesOfUnderstandingText.map((gloss) =>
      this.pickGloss(gloss.id, glossMap)
    );
    const filteredUnderstandingGlosses = this.filterUnderstandingGlosses(
      understandingGlosses,
      targetLanguage,
      nativeLanguage
    );

    return {
      identifier: situation.identifier,
      descriptions,
      imageLink: situation.imageLink ?? undefined,
      targetLanguage,
      challengesOfExpression: filteredExpressionGlosses,
      challengesOfUnderstandingText: filteredUnderstandingGlosses,
    };
  }

  private pickGloss(
    glossId: string,
    glossMap: Map<string, GlossDTO>
  ): GlossDTO {
    const gloss = glossMap.get(glossId);
    if (!gloss) {
      throw new NotFoundError(`Gloss ${glossId} not found while mapping situation`);
    }
    return gloss;
  }

  private collectGlossIds(situation: SituationWithRelations, target: Set<string>) {
    situation.challengesOfExpression.forEach((gloss) => target.add(gloss.id));
    situation.challengesOfUnderstandingText.forEach((gloss) => target.add(gloss.id));
  }

  private async resolveGlossesForSituation(situation: SituationWithRelations) {
    const glossIds = new Set<string>();
    this.collectGlossIds(situation, glossIds);

    // Recursively resolve all dependencies (contains, translations, etc.)
    const glossMap = new Map<string, GlossDTO>();
    const toResolve = Array.from(glossIds);

    while (toResolve.length > 0) {
      const batch = toResolve.splice(0, toResolve.length);
      const resolvedBatch = await this.resolver.resolveByIds(batch);

      // Add newly resolved glosses to map
      resolvedBatch.forEach((gloss, id) => {
        if (!glossMap.has(id)) {
          glossMap.set(id, gloss);

          // Collect IDs from all relations
          gloss.contains.forEach((ref) => {
            if (!glossMap.has(ref.id)) {
              toResolve.push(ref.id);
            }
          });
          gloss.translations.forEach((ref) => {
            if (!glossMap.has(ref.id)) {
              toResolve.push(ref.id);
            }
          });
          gloss.nearSynonyms.forEach((ref) => {
            if (!glossMap.has(ref.id)) {
              toResolve.push(ref.id);
            }
          });
          gloss.nearHomophones.forEach((ref) => {
            if (!glossMap.has(ref.id)) {
              toResolve.push(ref.id);
            }
          });
          gloss.clarifiesUsage.forEach((ref) => {
            if (!glossMap.has(ref.id)) {
              toResolve.push(ref.id);
            }
          });
          gloss.toBeDifferentiatedFrom.forEach((ref) => {
            if (!glossMap.has(ref.id)) {
              toResolve.push(ref.id);
            }
          });
        }
      });
    }

    return glossMap;
  }

  private parseDescriptions(descriptions: Prisma.JsonValue): LocalizedString[] {
    if (Array.isArray(descriptions)) {
      return descriptions as unknown as LocalizedString[];
    }
    return [];
  }

  private selectNativeLanguage(nativeLanguages?: LanguageCode[]): LanguageCode | undefined {
    return nativeLanguages && nativeLanguages.length ? nativeLanguages[0] : undefined;
  }

  private filterExpressionGlosses(
    glosses: GlossDTO[],
    targetLanguage: LanguageCode,
    nativeLanguage?: LanguageCode
  ): GlossDTO[] {
    return glosses
      .map((gloss) => this.cloneGloss(gloss))
      .map((gloss) =>
        this.pruneGlossRelations(gloss, {
          containsLanguage: nativeLanguage,
          translationLanguage: targetLanguage,
        })
      )
      .filter((gloss) => !nativeLanguage || gloss.language === nativeLanguage);
  }

  private filterUnderstandingGlosses(
    glosses: GlossDTO[],
    targetLanguage: LanguageCode,
    nativeLanguage?: LanguageCode
  ): GlossDTO[] {
    return glosses
      .map((gloss) => this.cloneGloss(gloss))
      .map((gloss) =>
        this.pruneGlossRelations(gloss, {
          containsLanguage: targetLanguage,
          translationLanguage: nativeLanguage,
        })
      )
      .filter((gloss) => gloss.language === targetLanguage);
  }

  private pruneGlossRelations(
    gloss: GlossDTO,
    options: { containsLanguage?: LanguageCode; translationLanguage?: LanguageCode }
  ): GlossDTO {
    const clone = { ...gloss };

    if (options.containsLanguage) {
      clone.contains = clone.contains.filter((ref) => ref.language === options.containsLanguage);
    }

    if (options.translationLanguage) {
      clone.translations = clone.translations.filter((ref) => ref.language === options.translationLanguage);
    }

    return clone;
  }

  private cloneGloss(gloss: GlossDTO): GlossDTO {
    return {
      ...gloss,
      contains: gloss.contains.map((ref) => ({ ...ref })),
      nearSynonyms: gloss.nearSynonyms.map((ref) => ({ ...ref })),
      nearHomophones: gloss.nearHomophones.map((ref) => ({ ...ref })),
      translations: gloss.translations.map((ref) => ({ ...ref })),
      clarifiesUsage: gloss.clarifiesUsage.map((ref) => ({ ...ref })),
      toBeDifferentiatedFrom: gloss.toBeDifferentiatedFrom.map((ref) => ({ ...ref })),
    };
  }

  private async ensureExists(id: string) {
    const exists = await this.client.situation.findUnique({ where: { identifier: id }, select: { identifier: true } });
    if (!exists) {
      throw new NotFoundError(`Situation ${id} not found`);
    }
  }

  private handlePrismaError(error: unknown, identifier?: string) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        throw new ConflictError(`Situation identifier ${identifier} already exists`);
      }
      if (error.code === "P2025") {
        throw new NotFoundError("Referenced gloss not found");
      }
    }
  }
}
