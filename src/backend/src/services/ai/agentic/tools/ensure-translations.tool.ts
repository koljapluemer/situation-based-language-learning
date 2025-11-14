import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { GlossService } from "../../../gloss-service";
import { GlossCreationHelper } from "../../gloss-creation-helper";
import { languageCodeSchema } from "../../../../schemas/common";
import { LanguageCode } from "@sbl/shared";

const translationPayloadSchema = z.object({
  content: z.string().min(1).describe("Translation content in the native language"),
});

const ensureTranslationsSchema = z.object({
  glossId: z.string().min(1).describe("Existing gloss ID to attach translations to"),
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
        if (!glossId || glossId === "new") {
          return JSON.stringify({
            success: false,
            error:
              "Cannot ensure translations for a gloss that has not been created yet. Create or reference an existing gloss ID before calling this tool.",
          });
        }

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
          translations
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
        "Provide one or more translation payloads (content plus optional paraphrase flag). " +
        "The tool will create any missing translation glosses and link them to the specified gloss.",
      schema: ensureTranslationsSchema,
    }
  );
}
