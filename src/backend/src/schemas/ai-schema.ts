import { z } from "zod";
import { languageCodeSchema, noteSchema } from "./common";

/**
 * Request schema for generating understanding challenges
 */
export const generateChallengesRequestSchema = z.object({
  situationId: z.string().min(1),
  targetLanguage: languageCodeSchema,
  nativeLanguage: languageCodeSchema,
  count: z.number().int().min(1).max(10).optional(),
  userHints: z.string().optional(),
});

/**
 * Recursive gloss payload schema for AI-generated content
 * Supports nested contains relationships
 */
export interface GlossPayload {
  content: string;
  isParaphrased: boolean;
  transcriptions?: string[];
  notes?: Array<{
    noteType: string;
    content: string;
    showBeforeSolution: boolean;
  }>;
  contains?: GlossPayload[];  // Recursive!
  translationIds?: string[];
  nearSynonymIds?: string[];
  nearHomophoneIds?: string[];
  clarifiesUsageIds?: string[];
  toBeDifferentiatedFromIds?: string[];
}

/**
 * Zod schema for validating gloss payloads (with lazy recursion)
 */
export const glossPayloadSchema: z.ZodType<GlossPayload> = z.lazy(() =>
  z.object({
    content: z.string().min(1),
    isParaphrased: z.boolean().default(false),
    transcriptions: z.array(z.string()).optional(),
    notes: z.array(noteSchema).optional(),
    contains: z.array(glossPayloadSchema).optional(),  // Recursive reference
    translationIds: z.array(z.string()).optional(),
    nearSynonymIds: z.array(z.string()).optional(),
    nearHomophoneIds: z.array(z.string()).optional(),
    clarifiesUsageIds: z.array(z.string()).optional(),
    toBeDifferentiatedFromIds: z.array(z.string()).optional(),
  })
);

/**
 * Request schema for saving generated challenges
 */
export const saveChallengesRequestSchema = z.object({
  selectedGlosses: z.array(glossPayloadSchema),
});

/**
 * Type exports for TypeScript
 */
export type GenerateChallengesRequest = z.infer<typeof generateChallengesRequestSchema>;
export type SaveChallengesRequest = z.infer<typeof saveChallengesRequestSchema>;
