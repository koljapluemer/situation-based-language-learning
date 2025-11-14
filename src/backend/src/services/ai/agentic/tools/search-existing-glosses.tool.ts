import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { GlossService } from "../../../gloss-service";

/**
 * Tool: Search for existing glosses in the database
 *
 * Allows the agent to perform fuzzy searches to find existing glosses
 * before generating new ones, helping avoid duplicates.
 */
export function createSearchExistingGlossesTool(glossService: GlossService) {
  return tool(
    async ({ language, query, limit }) => {
      try {
        const results = await glossService.search(language, query, limit);

        return JSON.stringify({
          success: true,
          count: results.length,
          glosses: results.map(g => ({
            id: g.id,
            content: g.content,
            language: g.language,
            isParaphrased: g.isParaphrased,
            transcriptions: g.transcriptions,
            hasTranslations: g.translations.length > 0,
            hasContains: g.contains.length > 0,
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
      name: "searchExistingGlosses",
      description:
        "Search for existing glosses in the database by language and content query. " +
        "Returns matching glosses with their basic information and relationships. " +
        "Use this to avoid creating duplicate glosses and to find glosses for building relationships.",
      schema: z.object({
        language: z.string().describe("Language code (e.g., 'eng', 'spa', 'deu')"),
        query: z
          .string()
          .describe("Search query to match against gloss content (fuzzy matching)"),
        limit: z
          .number()
          .optional()
          .default(5)
          .describe("Maximum number of results to return (default: 5)"),
      }),
    }
  );
}
