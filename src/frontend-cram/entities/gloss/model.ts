import type { GlossDTO, LanguageCode } from '@sbl/shared';
import { db } from '../database/db';
import type { GlossEntity } from './types';
import * as ebisu from 'ebisu-js';

/**
 * Transform GlossDTO from API to GlossEntity for local storage
 */
export function fromDTO(dto: GlossDTO): GlossEntity {
  return {
    id: dto.id,
    language: dto.language,
    content: dto.content,
    isParaphrased: dto.isParaphrased,
    transcriptions: dto.transcriptions || [],
    notes: dto.notes || [],
    containsIds: (dto.contains || []).map(ref => ref.id),
    nearSynonymIds: (dto.nearSynonyms || []).map(ref => ref.id),
    nearHomophoneIds: (dto.nearHomophones || []).map(ref => ref.id),
    translationIds: (dto.translations || []).map(ref => ref.id),
    clarifiesUsageIds: (dto.clarifiesUsage || []).map(ref => ref.id),
    toBeDifferentiatedFromIds: (dto.toBeDifferentiatedFrom || []).map(ref => ref.id),
    lastSyncedAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Upsert a single gloss
 * Uses compound key [language+content] to deduplicate
 */
export async function upsertGloss(dto: GlossDTO): Promise<void> {
  const entity = fromDTO(dto);

  // Check if gloss already exists by compound key [language+content]
  const existing = await db.glosses
    .where('[language+content]')
    .equals([dto.language, dto.content])
    .first();

  if (existing) {
    // Update existing gloss, keeping the existing Dexie id
    await db.glosses.update(existing.id!, {
      ...entity,
      id: existing.id, // Preserve Dexie Cloud primary key
      updatedAt: new Date(),
    });
  } else {
    // Insert new gloss
    await db.glosses.add(entity);
  }
}

/**
 * Upsert multiple glosses
 */
export async function upsertGlosses(dtos: GlossDTO[]): Promise<void> {
  // Use transaction for atomic operation
  await db.transaction('rw', db.glosses, async () => {
    for (const dto of dtos) {
      await upsertGloss(dto);
    }
  });
}

/**
 * Get a gloss by its ID
 */
export async function getGloss(id: string): Promise<GlossEntity | undefined> {
  return db.glosses.get(id);
}

/**
 * Get multiple glosses by their IDs
 */
export async function getGlossesByIds(ids: string[]): Promise<GlossEntity[]> {
  return db.glosses.where('id').anyOf(ids).toArray();
}

/**
 * Find a gloss by language and content
 */
export async function findByLanguageContent(
  language: LanguageCode,
  content: string
): Promise<GlossEntity | undefined> {
  return db.glosses
    .where('[language+content]')
    .equals([language, content])
    .first();
}

/**
 * Get all glosses for a specific language
 */
export async function getGlossesByLanguage(language: LanguageCode): Promise<GlossEntity[]> {
  return db.glosses.where('language').equals(language).toArray();
}

/**
 * Delete a gloss by ID
 */
export async function deleteGloss(id: string): Promise<void> {
  await db.glosses.delete(id);
}

/**
 * Clear all glosses (for testing or reset)
 */
export async function clearAllGlosses(): Promise<void> {
  await db.glosses.clear();
}

/**
 * Update Ebisu progress for a gloss
 */
export async function updateGlossProgress(
  glossId: string,
  model: [number, number, number],
  lastReviewed: Date
): Promise<void> {
  await db.glosses.update(glossId, {
    progressEbisu: {
      model,
      lastReviewed
    }
  });
}

/**
 * Get recall probability for a gloss using Ebisu
 * Returns 0 if no progress exists yet
 */
export function getRecallProbability(gloss: GlossEntity): number {
  if (!gloss.progressEbisu) {
    return 0;
  }

  const { model, lastReviewed } = gloss.progressEbisu;
  const hoursSinceReview = (Date.now() - lastReviewed.getTime()) / (1000 * 60 * 60);

  return ebisu.predictRecall(model, hoursSinceReview, true);
}

/**
 * Get glosses that need practice (recall probability below threshold)
 * If minRecall not provided, returns all glosses
 */
export async function getDueGlosses(
  glossIds: string[],
  minRecall?: number
): Promise<GlossEntity[]> {
  const glosses = await db.glosses.where('id').anyOf(glossIds).toArray();

  if (minRecall === undefined) {
    return glosses;
  }

  return glosses.filter(gloss => getRecallProbability(gloss) < minRecall);
}
