import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { SituationService } from "../../../situation-service";

/**
 * Tool: Analyze situation context
 *
 * Allows the agent to get comprehensive information about a situation,
 * including existing challenges and descriptions.
 */
export function createAnalyzeSituationTool(situationService: SituationService) {
  return tool(
    async ({ situationId }) => {
      try {
        // Fetch without language filtering to get all challenges
        const situation = await situationService.findById(situationId, {});

        return JSON.stringify({
          success: true,
          situation: {
            identifier: situation.identifier,
            descriptions: situation.descriptions,
            targetLanguage: situation.targetLanguage,
            imageLink: situation.imageLink,
            challengeCounts: {
              expression: situation.challengesOfExpression.length,
              understanding: situation.challengesOfUnderstandingText.length,
            },
          },
          existingUnderstandingChallenges: situation.challengesOfUnderstandingText.map(g => ({
            id: g.id,
            content: g.content,
            language: g.language,
            isParaphrased: g.isParaphrased,
          })),
          existingExpressionChallenges: situation.challengesOfExpression.map(g => ({
            id: g.id,
            content: g.content,
            language: g.language,
            isParaphrased: g.isParaphrased,
          })),
        });
      } catch (error) {
        return JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    {
      name: "analyzeSituationContext",
      description:
        "Get comprehensive context about a situation, including descriptions in multiple languages, " +
        "target language, existing understanding challenges, and existing expression challenges. " +
        "Use this at the beginning to understand what the situation is about and what challenges already exist.",
      schema: z.object({
        situationId: z
          .string()
          .describe("The situation identifier (e.g., 'greeting-basic')"),
      }),
    }
  );
}
