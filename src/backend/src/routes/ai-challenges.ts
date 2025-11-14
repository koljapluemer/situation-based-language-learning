import { FastifyInstance } from "fastify";
import { z } from "zod";
import { AgenticGenerator, AgenticGenerationContext } from "../services/ai/agentic/agent";
import { GlossCreationHelper } from "../services/ai/gloss-creation-helper";
import { GlossService } from "../services/gloss-service";
import { SituationService } from "../services/situation-service";
import {
  generateChallengesRequestSchema,
  saveChallengesRequestSchema,
} from "../schemas/ai-schema";
import { LanguageCode } from "@sbl/shared";

const paramsSchema = z.object({ id: z.string().min(1) });

/**
 * AI Challenge Routes
 *
 * Endpoints for generating understanding text challenges using the agentic AI workflow.
 */
export function registerAIChallengeRoutes(app: FastifyInstance) {
  const glossService = new GlossService();
  const situationService = new SituationService();
  const glossCreationHelper = new GlossCreationHelper(glossService);

/**
 * POST /ai/generate-understanding-challenges/agentic
   *
   * Generate understanding challenges using agentic mode (tool-using agent).
   * Slower but more comprehensive, with autonomous decision-making.
   */
  app.post("/ai/generate-understanding-challenges/agentic", async (request, reply) => {
    try {
      const payload = generateChallengesRequestSchema.parse(request.body);

      // Build context
      const context: AgenticGenerationContext = {
        situationId: payload.situationId,
        targetLanguage: payload.targetLanguage,
        nativeLanguage: payload.nativeLanguage,
        userHints: payload.userHints,
      };

      // Generate with agentic mode
      const generator = new AgenticGenerator(glossService, situationService);
      const result = await generator.generateUnderstandingChallenges(context);

      // Check for duplicates
      const duplicates = await glossCreationHelper.findDuplicates(
        result.glosses,
        payload.targetLanguage
      );

      return reply.code(200).send({
        success: true,
        glosses: result.glosses,
        duplicates,
        metadata: {
          mode: "agentic",
          iterations: result.iterations,
          toolCalls: result.toolCalls,
          count: result.glosses.length,
          errors: result.errors,
          logs: result.logs,
        },
      });
    } catch (error) {
      request.log.error(error, "Agentic generation failed");
      const message = error instanceof Error ? error.message : "Unknown error";
      const stack = error instanceof Error ? error.stack : undefined;
      return reply.code(500).send({
        success: false,
        error: message,
        details: stack,
      });
    }
  });

  /**
   * POST /situations/:id/save-generated-challenges
   *
   * Save selected generated challenges to a situation.
   * Creates glosses with recursive contains relationships and attaches them
   * to the situation's challengesOfUnderstandingText array.
   */
  app.post("/situations/:id/save-generated-challenges", async (request, reply) => {
    try {
      const { id } = paramsSchema.parse(request.params);
      const payload = saveChallengesRequestSchema.parse(request.body);

      // Fetch situation to get target language
      const situation = await situationService.findById(id, {});
      const targetLanguage = situation.targetLanguage as LanguageCode;

      // Create glosses with recursive contains and translations
      const createdGlossIds = await glossCreationHelper.createMultipleGlossesWithTranslations(
        payload.selectedGlosses,
        targetLanguage,
        payload.nativeLanguage
      );

      // Get existing understanding challenge IDs
      const existingIds = situation.challengesOfUnderstandingText.map(g => g.id);

      // Merge with new IDs (avoid duplicates)
      const allIds = [...existingIds, ...createdGlossIds];
      const uniqueIds = Array.from(new Set(allIds));

      // Update situation
      const updated = await situationService.update(id, {
        challengesOfUnderstandingTextIds: uniqueIds,
      });

      return reply.code(200).send({
        success: true,
        data: updated,
        metadata: {
          createdCount: createdGlossIds.length,
          totalChallenges: uniqueIds.length,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return reply.code(500).send({
        success: false,
        error: message,
      });
    }
  });
}
