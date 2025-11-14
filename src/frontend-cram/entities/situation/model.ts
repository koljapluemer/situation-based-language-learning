import type { SituationDTO, SituationSummaryDTO, LanguageCode } from '@sbl/shared';
import { db } from '../database/db';
import type { SituationEntity } from './types';
import { getGloss } from '../gloss/model';

/**
 * Transform SituationDTO from API to SituationEntity for local storage
 */
export function fromDTO(dto: SituationDTO): SituationEntity {
  return {
    id: dto.id,
    descriptions: dto.descriptions,
    imageLink: dto.imageLink,
    targetLanguage: dto.targetLanguage,
    nativeLanguage: dto.nativeLanguage,
    challengesOfExpressionIds: dto.challengesOfExpression.map(g => g.id),
    challengesOfUnderstandingTextIds: dto.challengesOfUnderstandingText.map(g => g.id),
    lastSyncedAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Transform SituationSummaryDTO to a partial SituationEntity
 * (without challenges, for list views)
 */
export function fromSummaryDTO(dto: SituationSummaryDTO): Omit<SituationEntity, 'challengesOfExpressionIds' | 'challengesOfUnderstandingTextIds'> {
  return {
    id: dto.id,
    descriptions: dto.descriptions,
    imageLink: dto.imageLink,
    targetLanguage: dto.targetLanguage,
    nativeLanguage: dto.nativeLanguage,
    lastSyncedAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Upsert a single situation
 * Uses backend id as unique key
 */
export async function upsertSituation(dto: SituationDTO): Promise<void> {
  const entity = fromDTO(dto);

  // Check if situation already exists by id
  const existing = await db.situations.get(dto.id);

  if (existing) {
    // Update existing situation
    await db.situations.update(dto.id, {
      ...entity,
      updatedAt: new Date(),
    });
  } else {
    // Insert new situation
    await db.situations.add(entity);
  }
}

/**
 * Upsert multiple situations
 */
export async function upsertSituations(dtos: SituationDTO[]): Promise<void> {
  await db.transaction('rw', db.situations, async () => {
    for (const dto of dtos) {
      await upsertSituation(dto);
    }
  });
}

/**
 * Upsert situation summary (without full challenge data)
 * Useful for initial download before full details
 */
export async function upsertSituationSummary(dto: SituationSummaryDTO): Promise<void> {
  const partial = fromSummaryDTO(dto);

  const existing = await db.situations.get(dto.id);

  if (existing) {
    // Only update metadata, preserve existing challenges
    await db.situations.update(dto.id, {
      descriptions: partial.descriptions,
      imageLink: partial.imageLink,
      targetLanguage: partial.targetLanguage,
      nativeLanguage: partial.nativeLanguage,
      lastSyncedAt: partial.lastSyncedAt,
      updatedAt: partial.updatedAt,
    });
  } else {
    // Create new situation with empty challenges
    await db.situations.add({
      ...partial,
      challengesOfExpressionIds: [],
      challengesOfUnderstandingTextIds: [],
    });
  }
}

/**
 * Get a situation by id
 */
export async function getSituation(id: string): Promise<SituationEntity | undefined> {
  return db.situations.get(id);
}

/**
 * Get all situations for a specific target language
 */
export async function getSituationsByLanguage(targetLanguage: LanguageCode): Promise<SituationEntity[]> {
  return db.situations.where('targetLanguage').equals(targetLanguage).toArray();
}

/**
 * Get all situations (for local browsing)
 */
export async function getAllSituations(): Promise<SituationEntity[]> {
  return db.situations.toArray();
}

/**
 * Delete a situation by id
 */
export async function deleteSituation(id: string): Promise<void> {
  await db.situations.delete(id);
}

/**
 * Clear all situations (for testing or reset)
 */
export async function clearAllSituations(): Promise<void> {
  await db.situations.clear();
}

/**
 * Check if a situation exists locally
 */
export async function situationExists(id: string): Promise<boolean> {
  const count = await db.situations.where('id').equals(id).count();
  return count > 0;
}

/**
 * Resolve full gloss objects for a challenge
 * (helper for displaying challenges with full gloss data)
 */
export async function resolveGlossesForChallenge(glossIds: string[]) {
  const glosses = await Promise.all(glossIds.map(id => getGloss(id)));
  return glosses.filter((g): g is NonNullable<typeof g> => g !== undefined);
}
