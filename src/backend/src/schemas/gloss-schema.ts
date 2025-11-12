import { z } from "zod";
import { languageCodeSchema, noteSchema } from "./common";

const idArray = () => z.array(z.string().cuid()).default([]);

export const glossWriteSchema = z.object({
  language: languageCodeSchema,
  content: z.string().min(1),
  isParaphrased: z.boolean().default(false),
  transcriptions: z.array(z.string().min(1)).default([]),
  notes: z.array(noteSchema).default([]),
  containsIds: idArray(),
  nearSynonymIds: idArray(),
  nearHomophoneIds: idArray(),
  translationIds: idArray(),
  clarifiesUsageIds: idArray(),
  toBeDifferentiatedFromIds: idArray(),
});

export const glossUpdateSchema = glossWriteSchema.partial();

export const glossQuerySchema = z
  .object({
    language: languageCodeSchema.optional(),
    content: z.string().optional(),
  })
  .refine(
    (value) => !(value.content && !value.language),
    { message: "language is required when filtering by content", path: ["language"] }
  );

export const glossSuggestSchema = z.object({
  language: languageCodeSchema,
  query: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(20).optional(),
});

export type GlossWriteInput = z.infer<typeof glossWriteSchema>;
export type GlossUpdateInput = z.infer<typeof glossUpdateSchema>;
export type GlossQueryInput = z.infer<typeof glossQuerySchema>;
export type GlossSuggestInput = z.infer<typeof glossSuggestSchema>;
