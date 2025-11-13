import type { LanguageCode, LocalizedString } from '@sbl/shared';
import type { DexieCloudEntity, SyncMetadata } from '../database/types';

/**
 * Situation entity for local storage
 *
 * Diverges from SituationDTO:
 * - Challenges stored as gloss ID arrays (glosses themselves stored in separate gloss table)
 * - Includes Dexie Cloud fields (id, owner, realmId)
 * - Includes sync metadata (lastSyncedAt, updatedAt)
 * - Primary key is identifier (not a Dexie-generated ID)
 */
export interface SituationEntity extends DexieCloudEntity, SyncMetadata {
  // Note: identifier serves as primary key (overrides DexieCloudEntity.id)
  identifier: string;

  // Core situation fields
  descriptions: LocalizedString[];
  imageLink?: string;
  targetLanguage: LanguageCode;

  // Challenges as gloss ID arrays
  challengesOfExpressionIds: string[];
  challengesOfUnderstandingTextIds: string[];
}
