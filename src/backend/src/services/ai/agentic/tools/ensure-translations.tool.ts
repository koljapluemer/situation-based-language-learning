import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { GlossService } from "../../../gloss-service";
import { GlossCreationHelper } from "../../gloss-creation-helper";
import { languageCodeSchema, noteSchema } from "../../../../schemas/common";
import { GlossPayload } from "../../../../schemas/ai-schema";
import { LanguageCode } from "@sbl/shared";

const translationPayloadSchema: z.ZodType<GlossPayload> = z.lazy(() =>
  z.object({
    content: z.string().min(1).describe("Translation content in the native language"),
    isParaphrased: z.boolean().default(false),
    transcriptions: z.array(z.string()).optional(),
    notes: z.array(noteSchema).optional(),
    contains: z.array(translationPayloadSchema).optional(),
  })
);

const ensureTranslationsSchema = z.object({
  glossId: z.string().describe("Existing gloss ID to attach translations to"),
  nativeLanguage: languageCodeSchema.describe(
    "Native language code for translations (e.g., 'eng', 'spa')"
  ),
  translations: z
    .array(translationPayloadSchema)
    .min(1)
    .describe("Array of translation payloads to ensure"),
});

type EnsureTranslationsInput = z.infer<typeof ensureTranslationsSchema>;

export function createEnsureTranslationsTool(
  glossService: GlossService,
  glossCreationHelper: GlossCreationHelper
) {
  return tool(
    async ({ glossId, nativeLanguage, translations }: EnsureTranslationsInput) => {
      try {
        const gloss = await glossService.findById(glossId);

        if (gloss.language === nativeLanguage) {
          return JSON.stringify({
            success: false,
            error:
              "The gloss already uses the native language. Translations should target a different language.",
          });
        }

        const result = await glossCreationHelper.ensureTranslationsForGloss(
          glossId,
          nativeLanguage as LanguageCode,
          translations as GlossPayload[]
        );

        return JSON.stringify({
          success: true,
          glossId,
          addedTranslationIds: result.addedTranslationIds,
          totalTranslationIds: result.totalTranslationIds,
        });
      } catch (error) {
        return JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    {
      name: "ensureGlossTranslations",
      description:
        "Ensure that a gloss has translations in the situation's native language. " +
        "Provide one or more translation payloads (content, notes, etc.). " +
        "The tool will create any missing translation glosses and link them to the specified gloss.",
      schema: ensureTranslationsSchema,
    }
  );
}
