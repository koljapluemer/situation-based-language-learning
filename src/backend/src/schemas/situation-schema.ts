import { z } from "zod";
import { languageCodeSchema, localizedStringSchema } from "./common";

const glossIdArray = z.array(z.string().cuid()).default([]);

const localizedPromptArray = z
  .array(localizedStringSchema)
  .min(1)
  .refine(
    (prompts) => prompts.some((prompt) => prompt.language === "eng"),
    "At least one English prompt is required"
  );

export const challengeOfExpressionWriteSchema = z.object({
  identifier: z.string().min(1),
  prompts: localizedPromptArray,
  glossIds: glossIdArray,
});

export const challengeOfUnderstandingTextWriteSchema = z.object({
  text: z.string().min(1),
  language: languageCodeSchema,
  glossIds: glossIdArray,
});

export const situationWriteSchema = z.object({
  identifier: z.string().min(1),
  descriptions: z.array(localizedStringSchema).min(1),
  imageLink: z.string().url().optional(),
  targetLanguage: languageCodeSchema,
  challengesOfExpression: z.array(challengeOfExpressionWriteSchema).default([]),
  challengesOfUnderstandingText: z
    .array(challengeOfUnderstandingTextWriteSchema)
    .default([]),
});

export const situationUpdateSchema = z.object({
  identifier: z.string().min(1).optional(),
  descriptions: z.array(localizedStringSchema).min(1).optional(),
  imageLink: z.string().url().optional(),
  targetLanguage: languageCodeSchema.optional(),
  challengesOfExpression: z.array(challengeOfExpressionWriteSchema).optional(),
  challengesOfUnderstandingText: z.array(challengeOfUnderstandingTextWriteSchema).optional(),
});

export const situationQuerySchema = z.object({
  identifier: z.string().optional(),
  targetLanguage: languageCodeSchema.optional(),
  nativeLanguages: z.preprocess(
    (val) => {
      if (typeof val === 'string') {
        return val.split(',').map(s => s.trim());
      }
      if (Array.isArray(val)) {
        return val;
      }
      return undefined;
    },
    z.array(languageCodeSchema).optional()
  ),
});

export type SituationWriteInput = z.infer<typeof situationWriteSchema>;
export type SituationUpdateInput = z.infer<typeof situationUpdateSchema>;
export type SituationQueryInput = z.infer<typeof situationQuerySchema>;
