import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { GlossService } from "../../../gloss-service";
import { LanguageCode } from "@sbl/shared";

/**
 * Tool: Check if a gloss with exact language and content exists
 *
 * Allows the agent to verify if a specific gloss already exists
 * before deciding to create it.
 */
export function createCheckGlossExistsTool(glossService: GlossService) {
  return tool(
    async ({ language, content }) => {
      try {
        const results = await glossService.list(language as LanguageCode, content);

        if (results.length > 0) {
          const existing = results[0];
          return JSON.stringify({
            exists: true,
            glossId: existing.id,
            gloss: {
              id: existing.id,
              content: existing.content,
              language: existing.language,
              isParaphrased: existing.isParaphrased,
              transcriptions: existing.transcriptions,
              notes: existing.notes,
            },
          });
        }

        return JSON.stringify({
          exists: false,
          message: `No gloss found with language="${language}" and content="${content}"`,
        });
      } catch (error) {
        return JSON.stringify({
          exists: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    {
      name: "checkGlossExists",
      description:
        "Check if a gloss with exact language and content already exists in the database. " +
        "Returns the gloss details if found, or a message if not found. " +
        "Use this before generating a new gloss to avoid duplicates.",
      schema: z.object({
        language: z.string().describe("Language code (e.g., 'eng', 'spa', 'deu')"),
        content: z.string().describe("Exact content to check for"),
      }),
    }
  );
}
