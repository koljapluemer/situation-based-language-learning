import { Prisma, PrismaClient } from "@prisma/client";
import {
  ChallengeOfExpression,
  ChallengeOfUnderstandingText,
  GlossDTO,
  LanguageCode,
  LocalizedString,
  SituationDTO,
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
          challengesOfExpression: this.buildExpressionChallengeCreate(payload),
          challengesOfUnderstanding: this.buildUnderstandingChallengeCreate(payload),
        },
        include: situationInclude,
      });

      const glossMap = await this.resolveGlossesForSituation(situation);
      return this.toDTO(situation, glossMap);
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
                    prompt: challenge.prompt,
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
    return this.toDTO(situation, glossMap);
  }

  async list(query: SituationQueryInput): Promise<SituationDTO[]> {
    const where: Prisma.SituationWhereInput = {};
    if (query.identifier) {
      where.identifier = query.identifier;
    }

    const situations = await this.client.situation.findMany({
      where,
      include: situationInclude,
      orderBy: { updatedAt: "desc" },
    });

    const glossIds = new Set<string>();
    situations.forEach((situation) => this.collectGlossIds(situation, glossIds));
    const glossMap = await this.resolver.resolveByIds(Array.from(glossIds));

    return situations.map((situation) => this.toDTO(situation, glossMap));
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
        prompt: challenge.prompt,
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
    glossMap: Map<string, GlossDTO>
  ): SituationDTO {
    const descriptions = this.parseDescriptions(situation.descriptions);

    return {
      identifier: situation.identifier,
      descriptions,
      challengesOfExpression: situation.challengesOfExpression.map((challenge) =>
        this.mapExpressionChallenge(challenge, glossMap)
      ),
      challengesOfUnderstandingText: situation.challengesOfUnderstanding.map((challenge) =>
        this.mapUnderstandingChallenge(challenge, glossMap)
      ),
    };
  }

  private mapExpressionChallenge(
    challenge: SituationWithRelations["challengesOfExpression"][number],
    glossMap: Map<string, GlossDTO>
  ): ChallengeOfExpression {
    return {
      prompt: challenge.prompt,
      glosses: challenge.glosses.map((gloss) => this.pickGloss(gloss.id, glossMap)),
    };
  }

  private mapUnderstandingChallenge(
    challenge: SituationWithRelations["challengesOfUnderstanding"][number],
    glossMap: Map<string, GlossDTO>
  ): ChallengeOfUnderstandingText {
    return {
      text: challenge.text,
      language: challenge.language as LanguageCode,
      glosses: challenge.glosses.map((gloss) => this.pickGloss(gloss.id, glossMap)),
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
    if (Array.isArray(descriptions)) {
      return descriptions as unknown as LocalizedString[];
    }

    return [];
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
