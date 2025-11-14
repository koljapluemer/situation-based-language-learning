import { LanguageCode } from "@sbl/shared";
import { GlossService } from "../gloss-service";
import { GlossPayload } from "../../schemas/ai-schema";
import { GlossWriteInput } from "../../schemas/gloss-schema";

/**
 * Helper service for creating glosses with recursive contains relationships
 *
 * This service handles the complexity of:
 * 1. Checking if glosses already exist in the database
 * 2. Recursively creating child glosses (depth-first)
 * 3. Building the containsIds array for parent glosses
 * 4. Avoiding duplicate glosses by reusing existing ones
 */
export class GlossCreationHelper {
  constructor(private readonly glossService: GlossService) {}

  /**
   * Create a gloss with recursive contains relationships
   *
   * Algorithm:
   * 1. For each item in the contains array, recursively create child glosses first (depth-first)
   * 2. Collect all child gloss IDs
   * 3. Create the parent gloss with containsIds array
   * 4. Return the parent gloss ID
   *
   * If a gloss with the same language + content already exists, reuse its ID instead of creating a new one.
   *
   * @param payload - The gloss payload (potentially with nested contains)
   * @param language - The language code for this gloss
   * @returns The created (or existing) gloss ID
   */
  async createGlossWithContains(
    payload: GlossPayload,
    language: LanguageCode
  ): Promise<string> {
    // Check if this gloss already exists
    const existingGlosses = await this.glossService.list(language, payload.content);
    if (existingGlosses.length > 0) {
      // Gloss already exists, return its ID
      return existingGlosses[0].id;
    }

    // Process contains recursively (depth-first)
    const containsIds: string[] = [];
    if (payload.contains && payload.contains.length > 0) {
      for (const childPayload of payload.contains) {
        const childId = await this.createGlossWithContains(childPayload, language);
        containsIds.push(childId);
      }
    }

    // Prepare the write input for GlossService
    const writeInput: GlossWriteInput = {
      language,
      content: payload.content,
      isParaphrased: payload.isParaphrased ?? false,
      transcriptions: payload.transcriptions ?? [],
      notes: payload.notes ?? [],
      containsIds,
      translationIds: payload.translationIds ?? [],
      nearSynonymIds: payload.nearSynonymIds ?? [],
      nearHomophoneIds: payload.nearHomophoneIds ?? [],
      clarifiesUsageIds: payload.clarifiesUsageIds ?? [],
      toBeDifferentiatedFromIds: payload.toBeDifferentiatedFromIds ?? [],
    };

    // Create the gloss
    const createdGloss = await this.glossService.create(writeInput);
    return createdGloss.id;
  }

  /**
   * Create multiple glosses in batch
   *
   * @param payloads - Array of gloss payloads
   * @param language - The language code for these glosses
   * @returns Array of created (or existing) gloss IDs
   */
  async createMultipleGlosses(
    payloads: GlossPayload[],
    language: LanguageCode
  ): Promise<string[]> {
    const glossIds: string[] = [];

    for (const payload of payloads) {
      const glossId = await this.createGlossWithContains(payload, language);
      glossIds.push(glossId);
    }

    return glossIds;
  }

  /**
   * Check if a gloss exists and return its ID if it does
   *
   * @param language - Language code
   * @param content - Gloss content
   * @returns The gloss ID if it exists, null otherwise
   */
  async findExistingGlossId(
    language: LanguageCode,
    content: string
  ): Promise<string | null> {
    const existingGlosses = await this.glossService.list(language, content);
    return existingGlosses.length > 0 ? existingGlosses[0].id : null;
  }

  /**
   * Get duplicate information for a list of payloads
   * Useful for showing users which glosses already exist
   *
   * @param payloads - Array of gloss payloads
   * @param language - Language code
   * @returns Array of { content, existingId } for glosses that already exist
   */
  async findDuplicates(
    payloads: GlossPayload[],
    language: LanguageCode
  ): Promise<Array<{ content: string; existingId: string }>> {
    const duplicates: Array<{ content: string; existingId: string }> = [];

    for (const payload of payloads) {
      const existingId = await this.findExistingGlossId(language, payload.content);
      if (existingId) {
        duplicates.push({ content: payload.content, existingId });
      }
    }

    return duplicates;
  }
}
