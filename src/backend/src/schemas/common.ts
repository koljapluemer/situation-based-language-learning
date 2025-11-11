import { z } from "zod";
import { LANGUAGES, LanguageCode } from "../../shared/Language";

const languageCodeValues = Object.keys(LANGUAGES) as [LanguageCode, ...LanguageCode[]];

export const languageCodeSchema = z.enum(languageCodeValues);

export const localizedStringSchema = z.object({
  language: languageCodeSchema,
  content: z.string().min(1),
});

export const noteSchema = z.object({
  noteType: z.string().min(1),
  content: z.string().min(1),
  showBeforeSolution: z.boolean().default(false),
});

export const glossIdentifierSchema = localizedStringSchema;
