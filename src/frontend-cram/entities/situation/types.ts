import type { LanguageCode, LocalizedString } from '@sbl/shared';
import type { DexieCloudEntity, SyncMetadata } from '../database/types';

/**
 * Challenge of Expression (embedded in SituationEntity)
 *
 * Diverges from ChallengeOfExpression DTO:
 * - Stores gloss IDs as array instead of full GlossDTO objects
 */
export interface ChallengeOfExpressionEntity {
  identifier: string;
  prompts: LocalizedString[];
  glossIds: string[]; // Store IDs instead of full glosses
}

/**
 * Challenge of Understanding Text (embedded in SituationEntity)
 *
 * Diverges from ChallengeOfUnderstandingText DTO:
 * - Stores gloss IDs as array instead of full GlossDTO objects
 */
export interface ChallengeOfUnderstandingTextEntity {
  text: string;
  language: LanguageCode;
  glossIds: string[]; // Store IDs instead of full glosses
}

/**
 * Situation entity for local storage
 *
 * Diverges from SituationDTO:
 * - Challenges are embedded (not separate tables)
 * - Glosses in challenges stored as ID arrays
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

  // Embedded challenges (not separate tables)
  challengesOfExpression: ChallengeOfExpressionEntity[];
  challengesOfUnderstandingText: ChallengeOfUnderstandingTextEntity[];
}
