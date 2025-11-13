import { z } from "zod";
import { languageCodeSchema, localizedStringSchema } from "./common";

const glossIdArray = z.array(z.string().cuid()).default([]);

export const situationWriteSchema = z.object({
  identifier: z.string().min(1),
  descriptions: z.array(localizedStringSchema).min(1),
  imageLink: z.string().url().optional(),
  targetLanguage: languageCodeSchema,
  challengesOfExpressionIds: glossIdArray,
  challengesOfUnderstandingTextIds: glossIdArray,
});

export const situationUpdateSchema = z.object({
  identifier: z.string().min(1).optional(),
  descriptions: z.array(localizedStringSchema).min(1).optional(),
  imageLink: z.string().url().optional(),
  targetLanguage: languageCodeSchema.optional(),
  challengesOfExpressionIds: glossIdArray.optional(),
  challengesOfUnderstandingTextIds: glossIdArray.optional(),
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
