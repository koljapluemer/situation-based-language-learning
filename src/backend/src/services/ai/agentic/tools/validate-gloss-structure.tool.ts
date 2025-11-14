import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { GlossService } from "../../../gloss-service";
import { glossPayloadSchema } from "../../../../schemas/ai-schema";

/**
 * Tool: Validate gloss structure
 *
 * Allows the agent to validate a gloss payload structure before finalizing it.
 * Checks schema validity and verifies that all referenced gloss IDs exist.
 */
export function createValidateGlossStructureTool(glossService: GlossService) {
  return tool(
    async ({ glossPayload }) => {
      try {
        // Parse the JSON string
        const parsed = JSON.parse(glossPayload);

        // Validate against schema
        const validationResult = glossPayloadSchema.safeParse(parsed);

        if (!validationResult.success) {
          return JSON.stringify({
            valid: false,
            error: "Schema validation failed",
            details: validationResult.error.errors,
          });
        }

        const payload = validationResult.data;

        // Check if any referenced IDs exist
        const allIds = [
          ...(payload.translationIds || []),
          ...(payload.nearSynonymIds || []),
          ...(payload.nearHomophoneIds || []),
          ...(payload.clarifiesUsageIds || []),
          ...(payload.toBeDifferentiatedFromIds || []),
        ];

        const missingIds: string[] = [];

        for (const id of allIds) {
          try {
            await glossService.findById(id);
          } catch (error) {
            missingIds.push(id);
          }
        }

        if (missingIds.length > 0) {
          return JSON.stringify({
            valid: false,
            error: "Referenced gloss IDs do not exist",
            missingIds,
          });
        }

        return JSON.stringify({
          valid: true,
          message: "Gloss payload is valid and all referenced IDs exist",
        });
      } catch (error) {
        return JSON.stringify({
          valid: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    {
      name: "validateGlossStructure",
      description:
        "Validate a gloss payload structure and check that all referenced gloss IDs exist in the database. " +
        "Pass the gloss payload as a JSON string. " +
        "Returns validation status and any errors found. " +
        "Use this before finalizing a gloss to ensure it will be accepted by the database.",
      schema: z.object({
        glossPayload: z
          .string()
          .describe("JSON string of the gloss payload to validate"),
      }),
    }
  );
}
