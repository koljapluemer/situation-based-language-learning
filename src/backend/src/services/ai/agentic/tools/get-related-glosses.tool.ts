import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { GlossService } from "../../../gloss-service";

/**
 * Tool: Get all relationships for a specific gloss
 *
 * Allows the agent to explore the relationship graph of existing glosses
 * to build rich connections for newly generated glosses.
 */
export function createGetRelatedGlossesTool(glossService: GlossService) {
  return tool(
    async ({ glossId }) => {
      try {
        const gloss = await glossService.findById(glossId);

        return JSON.stringify({
          success: true,
          gloss: {
            id: gloss.id,
            content: gloss.content,
            language: gloss.language,
            isParaphrased: gloss.isParaphrased,
          },
          relationships: {
            contains: gloss.contains.map(g => ({
              id: g.id,
              content: g.content,
              language: g.language,
            })),
            nearSynonyms: gloss.nearSynonyms.map(g => ({
              id: g.id,
              content: g.content,
              language: g.language,
            })),
            translations: gloss.translations.map(g => ({
              id: g.id,
              content: g.content,
              language: g.language,
            })),
            nearHomophones: gloss.nearHomophones.map(g => ({
              id: g.id,
              content: g.content,
              language: g.language,
            })),
            clarifiesUsage: gloss.clarifiesUsage.map(g => ({
              id: g.id,
              content: g.content,
              language: g.language,
            })),
            toBeDifferentiatedFrom: gloss.toBeDifferentiatedFrom.map(g => ({
              id: g.id,
              content: g.content,
              language: g.language,
            })),
          },
        });
      } catch (error) {
        return JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    {
      name: "getRelatedGlosses",
      description:
        "Get all relationships for a specific gloss by ID. " +
        "Returns the gloss details along with all related glosses: " +
        "contains (sub-parts), synonyms, translations, homophones, usage clarifications, and differentiation pairs. " +
        "Use this to understand how existing glosses are connected and to build similar connections for new glosses.",
      schema: z.object({
        glossId: z.string().describe("The unique ID (cuid) of the gloss to query"),
      }),
    }
  );
}
