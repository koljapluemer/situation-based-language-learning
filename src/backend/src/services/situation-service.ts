import { Prisma, PrismaClient } from "@prisma/client";
import {
  ChallengeOfExpression,
  ChallengeOfUnderstandingText,
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
  challengesOfExpression: {
    include: { glosses: { select: { id: true } } },
  },
  challengesOfUnderstanding: {
    include: { glosses: { select: { id: true } } },
  },
} satisfies Prisma.SituationInclude;

type SituationWithRelations = Prisma.SituationGetPayload<{ include: typeof situationInclude }>;

type ChallengeGloss = { id: string };

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
          challengesOfExpression: this.buildExpressionChallengeCreate(payload),
          challengesOfUnderstanding: this.buildUnderstandingChallengeCreate(payload),
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
      await this.client.$transaction(async (tx) => {
        const data: Prisma.SituationUpdateInput = {};
        if (payload.identifier) data.identifier = payload.identifier;
        if (payload.descriptions) data.descriptions = payload.descriptions as Prisma.JsonArray;
        if (payload.imageLink !== undefined) data.imageLink = payload.imageLink;
        if (payload.targetLanguage) data.targetLanguage = payload.targetLanguage;

        if (Object.keys(data).length) {
          await tx.situation.update({ where: { identifier: id }, data });
        }

        if (payload.challengesOfExpression) {
          await tx.challengeOfExpression.deleteMany({ where: { situationId: id } });
          if (payload.challengesOfExpression.length) {
            await Promise.all(
              payload.challengesOfExpression.map((challenge) =>
                tx.challengeOfExpression.create({
                  data: {
                    identifier: challenge.identifier,
                    prompts: challenge.prompts,
                    situationId: id,
                    glosses: this.connectGlosses(challenge.glossIds),
                  },
                })
              )
            );
          }
        }

        if (payload.challengesOfUnderstandingText) {
          await tx.challengeOfUnderstandingText.deleteMany({ where: { situationId: id } });
          if (payload.challengesOfUnderstandingText.length) {
            await Promise.all(
              payload.challengesOfUnderstandingText.map((challenge) =>
                tx.challengeOfUnderstandingText.create({
                  data: {
                    text: challenge.text,
                    language: challenge.language,
                    situationId: id,
                    glosses: this.connectGlosses(challenge.glossIds),
                  },
                })
              )
            );
          }
        }
      });

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
            challengesOfUnderstanding: true,
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
        understanding: situation._count.challengesOfUnderstanding,
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

  private buildExpressionChallengeCreate(payload: SituationWriteInput) {
    if (!payload.challengesOfExpression?.length) {
      return undefined;
    }

    return {
      create: payload.challengesOfExpression.map((challenge) => ({
        identifier: challenge.identifier,
        prompts: challenge.prompts,
        glosses: this.connectGlosses(challenge.glossIds),
      })),
    } satisfies Prisma.ChallengeOfExpressionCreateNestedManyWithoutSituationInput;
  }

  private buildUnderstandingChallengeCreate(payload: SituationWriteInput) {
    if (!payload.challengesOfUnderstandingText?.length) {
      return undefined;
    }

    return {
      create: payload.challengesOfUnderstandingText.map((challenge) => ({
        text: challenge.text,
        language: challenge.language,
        glosses: this.connectGlosses(challenge.glossIds),
      })),
    } satisfies Prisma.ChallengeOfUnderstandingTextCreateNestedManyWithoutSituationInput;
  }

  private toDTO(
    situation: SituationWithRelations,
    glossMap: Map<string, GlossDTO>,
    query: SituationQueryInput = {}
  ): SituationDTO {
    const descriptions = this.parseDescriptions(situation.descriptions);
    const targetLanguage = situation.targetLanguage as LanguageCode;

    return {
      identifier: situation.identifier,
      descriptions,
      imageLink: situation.imageLink ?? undefined,
      targetLanguage,
      challengesOfExpression: situation.challengesOfExpression.map((challenge) =>
        this.mapExpressionChallenge(challenge, glossMap, targetLanguage, query.nativeLanguages)
      ),
      challengesOfUnderstandingText: situation.challengesOfUnderstanding.map((challenge) =>
        this.mapUnderstandingChallenge(challenge, glossMap, targetLanguage, query.nativeLanguages)
      ),
    };
  }

  private mapExpressionChallenge(
    challenge: SituationWithRelations["challengesOfExpression"][number],
    glossMap: Map<string, GlossDTO>,
    targetLanguage: LanguageCode,
    nativeLanguages?: LanguageCode[]
  ): ChallengeOfExpression {
    const prompts = this.parseLocalizedStrings(challenge.prompts);
    const glosses = challenge.glosses.map((gloss) => this.pickGloss(gloss.id, glossMap));

    return {
      identifier: challenge.identifier,
      prompts: this.filterLocalizedStrings(prompts, nativeLanguages),
      glosses: this.filterGlosses(glosses, targetLanguage, nativeLanguages),
    };
  }

  private mapUnderstandingChallenge(
    challenge: SituationWithRelations["challengesOfUnderstanding"][number],
    glossMap: Map<string, GlossDTO>,
    targetLanguage: LanguageCode,
    nativeLanguages?: LanguageCode[]
  ): ChallengeOfUnderstandingText {
    const glosses = challenge.glosses.map((gloss) => this.pickGloss(gloss.id, glossMap));

    return {
      text: challenge.text,
      language: challenge.language as LanguageCode,
      glosses: this.filterGlosses(glosses, targetLanguage, nativeLanguages),
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
    situation.challengesOfExpression.forEach((challenge) =>
      challenge.glosses.forEach((gloss) => target.add(gloss.id))
    );
    situation.challengesOfUnderstanding.forEach((challenge) =>
      challenge.glosses.forEach((gloss) => target.add(gloss.id))
    );
  }

  private async resolveGlossesForSituation(situation: SituationWithRelations) {
    const glossIds = new Set<string>();
    this.collectGlossIds(situation, glossIds);
    return this.resolver.resolveByIds(Array.from(glossIds));
  }

  private parseDescriptions(descriptions: Prisma.JsonValue): LocalizedString[] {
    return this.parseLocalizedStrings(descriptions);
  }

  private parseLocalizedStrings(value: Prisma.JsonValue): LocalizedString[] {
    if (Array.isArray(value)) {
      return value as unknown as LocalizedString[];
    }
    return [];
  }

  private filterLocalizedStrings(
    strings: LocalizedString[],
    preferredLanguages?: LanguageCode[]
  ): LocalizedString[] {
    if (!preferredLanguages || preferredLanguages.length === 0) {
      return strings;
    }
    for (const lang of preferredLanguages) {
      const match = strings.find(s => s.language === lang);
      if (match) return [match];
    }
    const eng = strings.find(s => s.language === 'eng');
    if (eng) return [eng];
    return strings.slice(0, 1);
  }

  private filterGlosses(
    glosses: GlossDTO[],
    targetLanguage: LanguageCode,
    nativeLanguages?: LanguageCode[]
  ): GlossDTO[] {
    if (!nativeLanguages || nativeLanguages.length === 0) {
      return glosses;
    }
    const allowedLanguages = new Set([targetLanguage, ...nativeLanguages]);
    return glosses.filter(g => allowedLanguages.has(g.language));
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
