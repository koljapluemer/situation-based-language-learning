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
import { AI_CONFIG } from "../config/ai-config";
import {
  subscribeRunCompletion,
  subscribeRunLogs,
} from "../services/ai/run-log-stream";
import { authenticateRequest } from "../middleware/supabase-auth";

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

  app.get("/ai/run-logs/:id", async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    reply.hijack();
    const origin = (request.headers.origin as string | undefined) ?? "*";
    reply.raw.setHeader("Access-Control-Allow-Origin", origin);
    reply.raw.setHeader("Vary", "Origin");
    reply.raw.setHeader("Access-Control-Allow-Credentials", "true");
    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.flushHeaders?.();
    reply.raw.write(":\n\n");

    let closed = false;
    const cleanup = () => {
      if (closed) return;
      closed = true;
      unsubscribeLogs();
      unsubscribeEnd();
      reply.raw.end();
    };

    const unsubscribeLogs = subscribeRunLogs(id, entry => {
      if (closed) return;
      reply.raw.write(`data: ${JSON.stringify(entry)}\n\n`);
    });

    const unsubscribeEnd = subscribeRunCompletion(id, () => {
      if (closed) return;
      reply.raw.write(`event: end\ndata: {}\n\n`);
      cleanup();
    });

    request.raw.on("close", cleanup);
  });

/**
 * POST /ai/generate-understanding-challenges/agentic
   *
   * Generate understanding challenges using agentic mode (tool-using agent).
   * Slower but more comprehensive, with autonomous decision-making.
   */
  app.post("/ai/generate-understanding-challenges/agentic", {
    preHandler: authenticateRequest,
    handler: async (request, reply) => {
    try {
      const payload = generateChallengesRequestSchema.parse(request.body);

      // Build context
      const context: AgenticGenerationContext = {
        situationId: payload.situationId,
        targetLanguage: payload.targetLanguage,
        nativeLanguage: payload.nativeLanguage,
        userHints: payload.userHints,
        provider: payload.provider,
        runId: payload.runId,
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
          provider: context.provider ?? AI_CONFIG.provider,
          runId: result.runId,
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
    }
  });

  /**
   * POST /ai/generate-expression-challenges/agentic
   *
   * Generate expression challenges using agentic mode (tool-using agent).
   * Creates high-level communicative functions in native language that learners
   * need to express in target language.
   */
  app.post("/ai/generate-expression-challenges/agentic", {
    preHandler: authenticateRequest,
    handler: async (request, reply) => {
    try {
      const payload = generateChallengesRequestSchema.parse(request.body);

      // Build context
      const context: AgenticGenerationContext = {
        situationId: payload.situationId,
        targetLanguage: payload.targetLanguage,
        nativeLanguage: payload.nativeLanguage,
        userHints: payload.userHints,
        provider: payload.provider,
        runId: payload.runId,
      };

      // Generate with agentic mode
      const generator = new AgenticGenerator(glossService, situationService);
      const result = await generator.generateExpressionChallenges(context);

      // Check for duplicates (in native language for expression challenges)
      const duplicates = await glossCreationHelper.findDuplicates(
        result.glosses,
        payload.nativeLanguage
      );

      return reply.code(200).send({
        success: true,
        glosses: result.glosses,
        duplicates,
        metadata: {
          mode: "agentic",
          provider: context.provider ?? AI_CONFIG.provider,
          runId: result.runId,
          iterations: result.iterations,
          toolCalls: result.toolCalls,
          count: result.glosses.length,
          errors: result.errors,
          logs: result.logs,
        },
      });
    } catch (error) {
      request.log.error(error, "Agentic expression generation failed");
      const message = error instanceof Error ? error.message : "Unknown error";
      const stack = error instanceof Error ? error.stack : undefined;
      return reply.code(500).send({
        success: false,
        error: message,
        details: stack,
      });
    }
    }
  });

  /**
   * POST /situations/:id/save-generated-challenges
   *
   * Save selected generated challenges to a situation.
   * Creates glosses with recursive contains relationships and attaches them
   * to either challengesOfExpression or challengesOfUnderstandingText array.
   */
  app.post("/situations/:id/save-generated-challenges", {
    preHandler: authenticateRequest,
    handler: async (request, reply) => {
    try {
      const { id } = paramsSchema.parse(request.params);
      const payload = saveChallengesRequestSchema.parse(request.body);

      // Fetch situation to get languages
      const situation = await situationService.findById(id, {});
      const targetLanguage = situation.targetLanguage as LanguageCode;
      const challengeType = payload.challengeType || "understanding";

      // For expression: glosses are in native language
      // For understanding: glosses are in target language
      const glossLanguage = challengeType === "expression"
        ? payload.nativeLanguage
        : targetLanguage;

      // For expression: translations are in target language
      // For understanding: translations are in native language
      const translationLanguage = challengeType === "expression"
        ? targetLanguage
        : payload.nativeLanguage;

      // Create glosses with recursive contains and translations
      const createdGlossIds = await glossCreationHelper.createMultipleGlossesWithTranslations(
        payload.selectedGlosses,
        glossLanguage,
        translationLanguage
      );

      // Get existing challenge IDs based on type
      const existingIds = challengeType === "expression"
        ? situation.challengesOfExpression.map(g => g.id)
        : situation.challengesOfUnderstandingText.map(g => g.id);

      // Merge with new IDs (avoid duplicates)
      const allIds = [...existingIds, ...createdGlossIds];
      const uniqueIds = Array.from(new Set(allIds));

      // Update situation with appropriate field
      const updateData = challengeType === "expression"
        ? { challengesOfExpressionIds: uniqueIds }
        : { challengesOfUnderstandingTextIds: uniqueIds };

      const updated = await situationService.update(id, updateData);

      return reply.code(200).send({
        success: true,
        data: updated,
        metadata: {
          createdCount: createdGlossIds.length,
          totalChallenges: uniqueIds.length,
          challengeType,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return reply.code(500).send({
        success: false,
        error: message,
      });
    }
    }
  });
}
