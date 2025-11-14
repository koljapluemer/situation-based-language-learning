import { z } from "zod";
import { languageCodeSchema, localizedStringSchema } from "./common";

const glossIdArray = z.array(z.string().cuid()).default([]);

export const situationWriteSchema = z.object({
  descriptions: z.array(localizedStringSchema).min(1),
  imageLink: z.string().url().optional(),
  targetLanguage: languageCodeSchema,
  nativeLanguage: languageCodeSchema,
  challengesOfExpressionIds: glossIdArray,
  challengesOfUnderstandingTextIds: glossIdArray,
});

export const situationUpdateSchema = z.object({
  descriptions: z.array(localizedStringSchema).min(1).optional(),
  imageLink: z.string().url().optional(),
  targetLanguage: languageCodeSchema.optional(),
  nativeLanguage: languageCodeSchema.optional(),
  challengesOfExpressionIds: glossIdArray.optional(),
  challengesOfUnderstandingTextIds: glossIdArray.optional(),
});

export const situationQuerySchema = z.object({
  id: z.string().optional(),
  targetLanguage: languageCodeSchema.optional(),
  nativeLanguage: languageCodeSchema.optional(),
});

export type SituationWriteInput = z.infer<typeof situationWriteSchema>;
export type SituationUpdateInput = z.infer<typeof situationUpdateSchema>;
export type SituationQueryInput = z.infer<typeof situationQuerySchema>;
