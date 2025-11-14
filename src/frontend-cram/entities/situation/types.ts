import type { LanguageCode, LocalizedString } from '@sbl/shared';
import type { DexieCloudEntity, SyncMetadata } from '../database/types';

/**
 * Situation entity for local storage
 *
 * Diverges from SituationDTO:
 * - Challenges stored as gloss ID arrays (glosses themselves stored in separate gloss table)
 * - Includes Dexie Cloud fields (id, owner, realmId)
 * - Includes sync metadata (lastSyncedAt, updatedAt)
 * - Primary key is the situation id (matches backend cuid)
 */
export interface SituationEntity extends DexieCloudEntity, SyncMetadata {
  // Note: backend id serves as primary key
  id: string;

  // Core situation fields
  descriptions: LocalizedString[];
  imageLink?: string;
  targetLanguage: LanguageCode;
  nativeLanguage: LanguageCode;

  // Challenges as gloss ID arrays
  challengesOfExpressionIds: string[];
  challengesOfUnderstandingTextIds: string[];
}
