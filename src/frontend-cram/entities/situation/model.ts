import type { SituationDTO, SituationSummaryDTO, LanguageCode } from '@sbl/shared';
import { db } from '../database/db';
import type {
  SituationEntity,
  ChallengeOfExpressionEntity,
  ChallengeOfUnderstandingTextEntity,
} from './types';
import { getGloss } from '../gloss/model';

/**
 * Transform SituationDTO from API to SituationEntity for local storage
 */
export function fromDTO(dto: SituationDTO): SituationEntity {
  return {
    identifier: dto.identifier,
    descriptions: dto.descriptions,
    imageLink: dto.imageLink,
    targetLanguage: dto.targetLanguage,
    challengesOfExpression: dto.challengesOfExpression.map(
      (challenge): ChallengeOfExpressionEntity => ({
        identifier: challenge.identifier,
        prompts: challenge.prompts,
        glossIds: challenge.glosses.map(g => g.id),
      })
    ),
    challengesOfUnderstandingText: dto.challengesOfUnderstandingText.map(
      (challenge): ChallengeOfUnderstandingTextEntity => ({
        text: challenge.text,
        language: challenge.language,
        glossIds: challenge.glosses.map(g => g.id),
      })
    ),
    lastSyncedAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Transform SituationSummaryDTO to a partial SituationEntity
 * (without challenges, for list views)
 */
export function fromSummaryDTO(dto: SituationSummaryDTO): Omit<SituationEntity, 'challengesOfExpression' | 'challengesOfUnderstandingText'> {
  return {
    identifier: dto.identifier,
    descriptions: dto.descriptions,
    imageLink: dto.imageLink,
    targetLanguage: dto.targetLanguage,
    lastSyncedAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Upsert a single situation
 * Uses identifier as unique key
 */
export async function upsertSituation(dto: SituationDTO): Promise<void> {
  const entity = fromDTO(dto);

  // Check if situation already exists by identifier
  const existing = await db.situations.get(dto.identifier);

  if (existing) {
    // Update existing situation
    await db.situations.update(dto.identifier, {
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

  const existing = await db.situations.get(dto.identifier);

  if (existing) {
    // Only update metadata, preserve existing challenges
    await db.situations.update(dto.identifier, {
      descriptions: partial.descriptions,
      imageLink: partial.imageLink,
      targetLanguage: partial.targetLanguage,
      lastSyncedAt: partial.lastSyncedAt,
      updatedAt: partial.updatedAt,
    });
  } else {
    // Create new situation with empty challenges
    await db.situations.add({
      ...partial,
      challengesOfExpression: [],
      challengesOfUnderstandingText: [],
    });
  }
}

/**
 * Get a situation by identifier
 */
export async function getSituation(identifier: string): Promise<SituationEntity | undefined> {
  return db.situations.get(identifier);
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
 * Delete a situation by identifier
 */
export async function deleteSituation(identifier: string): Promise<void> {
  await db.situations.delete(identifier);
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
export async function situationExists(identifier: string): Promise<boolean> {
  const count = await db.situations.where('identifier').equals(identifier).count();
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
