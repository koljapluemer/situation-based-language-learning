import { LanguageCode } from "@sbl/shared";
import { GlossService } from "../gloss-service";
import { GlossPayload } from "../../schemas/ai-schema";
import { GlossWriteInput, GlossUpdateInput } from "../../schemas/gloss-schema";

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
    const existingGlosses = await this.glossService.list(language, payload.content);
    const existingGloss = existingGlosses[0];

    // Process contains recursively (depth-first)
    const containsIds: string[] = [];
    if (payload.contains && payload.contains.length > 0) {
      for (const childPayload of payload.contains) {
        const childId = await this.createGlossWithContains(childPayload, language);
        containsIds.push(childId);
      }
    }
    const uniqueContainsIds = this.uniqueIds(containsIds);

    if (!existingGloss) {
      // Prepare the write input for GlossService
      const writeInput: GlossWriteInput = {
        language,
        content: payload.content,
        isParaphrased: payload.isParaphrased ?? false,
        transcriptions: payload.transcriptions ?? [],
        notes: payload.notes ?? [],
        containsIds: uniqueContainsIds,
        translationIds: payload.translationIds ?? [],
        nearSynonymIds: payload.nearSynonymIds ?? [],
        nearHomophoneIds: payload.nearHomophoneIds ?? [],
        clarifiesUsageIds: payload.clarifiesUsageIds ?? [],
        toBeDifferentiatedFromIds: payload.toBeDifferentiatedFromIds ?? [],
      };

      const createdGloss = await this.glossService.create(writeInput);
      return createdGloss.id;
    }

    const updatePayload: GlossUpdateInput = {};
    let needsUpdate = false;

    const existingContainsIds = this.extractIds(existingGloss.contains);
    const mergedContains = this.mergeIds(existingContainsIds, uniqueContainsIds);
    if (mergedContains) {
      updatePayload.containsIds = mergedContains;
      needsUpdate = true;
    }

    const relationMerges: Array<{
      field:
        | "translationIds"
        | "nearSynonymIds"
        | "nearHomophoneIds"
        | "clarifiesUsageIds"
        | "toBeDifferentiatedFromIds";
      existing: string[];
      incoming: string[];
    }> = [
      {
        field: "translationIds",
        existing: this.extractIds(existingGloss.translations),
        incoming: payload.translationIds ?? [],
      },
      {
        field: "nearSynonymIds",
        existing: this.extractIds(existingGloss.nearSynonyms),
        incoming: payload.nearSynonymIds ?? [],
      },
      {
        field: "nearHomophoneIds",
        existing: this.extractIds(existingGloss.nearHomophones),
        incoming: payload.nearHomophoneIds ?? [],
      },
      {
        field: "clarifiesUsageIds",
        existing: this.extractIds(existingGloss.clarifiesUsage),
        incoming: payload.clarifiesUsageIds ?? [],
      },
      {
        field: "toBeDifferentiatedFromIds",
        existing: this.extractIds(existingGloss.toBeDifferentiatedFrom),
        incoming: payload.toBeDifferentiatedFromIds ?? [],
      },
    ];

    for (const relation of relationMerges) {
      const merged = this.mergeIds(relation.existing, relation.incoming);
      if (merged) {
        updatePayload[relation.field] = merged;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      await this.glossService.update(existingGloss.id, updatePayload);
    }

    return existingGloss.id;
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

  /**
   * Create a gloss with translation and recursive contains relationships
   *
   * This method:
   * 1. Creates the translation gloss first (if translation content provided)
   * 2. Recursively creates all contains children (with their translations)
   * 3. Creates the main gloss with links to translation and contains
   * 4. Returns the created gloss ID
   *
   * @param payload - The gloss payload (with optional translation content)
   * @param targetLanguage - Language code for the main gloss
   * @param nativeLanguage - Language code for translation glosses
   * @returns The created (or existing) gloss ID
   */
  async createGlossWithTranslation(
    payload: GlossPayload,
    targetLanguage: LanguageCode,
    nativeLanguage: LanguageCode
  ): Promise<string> {
    const existingGlosses = await this.glossService.list(targetLanguage, payload.content);
    const existingGloss = existingGlosses[0];

    let translationId: string | undefined;
    if (payload.translation) {
      // Build translation payload (mirror structure for contains if present)
      const translationPayload: GlossPayload = {
        content: payload.translation,
        isParaphrased: payload.isParaphrased,
        transcriptions: [], // Translation typically doesn't need transcriptions
        notes: [], // Translation typically doesn't need notes
        // If the main gloss has contains, build translation contains from child translations
        contains: payload.contains?.map(child => ({
          content: child.translation || child.content,
          isParaphrased: child.isParaphrased,
          transcriptions: [],
        })),
      };

      // Recursively create translation gloss (swap languages)
      translationId = await this.createGlossWithTranslation(
        translationPayload,
        nativeLanguage,
        targetLanguage
      );
    }

    // Step 2: Recursively create contains children (with their translations)
    const containsIds: string[] = [];
    if (payload.contains && payload.contains.length > 0) {
      for (const childPayload of payload.contains) {
        const childId = await this.createGlossWithTranslation(
          childPayload,
          targetLanguage,
          nativeLanguage
        );
        containsIds.push(childId);
      }
    }
    const uniqueContainsIds = this.uniqueIds(containsIds);

    // Step 3: Prepare the write/update input for the main gloss
    const translationIds = this.uniqueIds([
      ...(payload.translationIds ?? []),
      ...(translationId ? [translationId] : []),
    ]);

    if (!existingGloss) {
      const writeInput: GlossWriteInput = {
        language: targetLanguage,
        content: payload.content,
        isParaphrased: payload.isParaphrased ?? false,
        transcriptions: payload.transcriptions ?? [],
        notes: payload.notes ?? [],
        containsIds: uniqueContainsIds,
        translationIds,
        nearSynonymIds: payload.nearSynonymIds ?? [],
        nearHomophoneIds: payload.nearHomophoneIds ?? [],
        clarifiesUsageIds: payload.clarifiesUsageIds ?? [],
        toBeDifferentiatedFromIds: payload.toBeDifferentiatedFromIds ?? [],
      };

      const createdGloss = await this.glossService.create(writeInput);
      return createdGloss.id;
    }

    const updatePayload: GlossUpdateInput = {};
    let needsUpdate = false;

    const existingContainsIds = this.extractIds(existingGloss.contains);
    const mergedContains = this.mergeIds(existingContainsIds, uniqueContainsIds);
    if (mergedContains) {
      updatePayload.containsIds = mergedContains;
      needsUpdate = true;
    }

    const existingTranslationIds = this.extractIds(existingGloss.translations);
    const mergedTranslations = this.mergeIds(existingTranslationIds, translationIds);
    if (mergedTranslations) {
      updatePayload.translationIds = mergedTranslations;
      needsUpdate = true;
    }

    const relationMerges: Array<{
      field:
        | "nearSynonymIds"
        | "nearHomophoneIds"
        | "clarifiesUsageIds"
        | "toBeDifferentiatedFromIds";
      existing: string[];
      incoming: string[];
    }> = [
      {
        field: "nearSynonymIds",
        existing: this.extractIds(existingGloss.nearSynonyms),
        incoming: payload.nearSynonymIds ?? [],
      },
      {
        field: "nearHomophoneIds",
        existing: this.extractIds(existingGloss.nearHomophones),
        incoming: payload.nearHomophoneIds ?? [],
      },
      {
        field: "clarifiesUsageIds",
        existing: this.extractIds(existingGloss.clarifiesUsage),
        incoming: payload.clarifiesUsageIds ?? [],
      },
      {
        field: "toBeDifferentiatedFromIds",
        existing: this.extractIds(existingGloss.toBeDifferentiatedFrom),
        incoming: payload.toBeDifferentiatedFromIds ?? [],
      },
    ];

    for (const relation of relationMerges) {
      const merged = this.mergeIds(relation.existing, relation.incoming);
      if (merged) {
        updatePayload[relation.field] = merged;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      await this.glossService.update(existingGloss.id, updatePayload);
    }

    return existingGloss.id;
  }

  /**
   * Create multiple glosses with translations in batch
   *
   * @param payloads - Array of gloss payloads
   * @param targetLanguage - Language code for main glosses
   * @param nativeLanguage - Language code for translation glosses
   * @returns Array of created (or existing) gloss IDs
   */
  async createMultipleGlossesWithTranslations(
    payloads: GlossPayload[],
    targetLanguage: LanguageCode,
    nativeLanguage: LanguageCode
  ): Promise<string[]> {
    const glossIds: string[] = [];

    for (const payload of payloads) {
      const glossId = await this.createGlossWithTranslation(
        payload,
        targetLanguage,
        nativeLanguage
      );
      glossIds.push(glossId);
    }

    return glossIds;
  }

  private extractIds(items?: Array<{ id: string }>): string[] {
    return items?.map(item => item.id) ?? [];
  }

  private mergeIds(existing: string[], incoming: string[]): string[] | null {
    if (!incoming.length) {
      return null;
    }
    const additions = incoming.filter(id => !existing.includes(id));
    if (!additions.length) {
      return null;
    }
    return [...existing, ...additions];
  }

  private uniqueIds(ids: string[]): string[] {
    return Array.from(new Set(ids));
  }
}
