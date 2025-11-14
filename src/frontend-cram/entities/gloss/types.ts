import type { LanguageCode, Note } from '@sbl/shared';
import type { DexieCloudEntity, SyncMetadata } from '../database/types';


export interface ProgressEbisu {
  model: [number, number, number] // [a, b, t
  lastReviewed: Date
}

/**
 * Gloss entity for local storage
 *
 * Diverges from GlossDTO:
 * - Stores relation IDs as arrays instead of full GlossReference objects
 * - Includes Dexie Cloud fields (id, owner, realmId)
 * - Includes sync metadata (lastSyncedAt, updatedAt)
 * - Unique by compound key [language+content]
 */
export interface GlossEntity extends DexieCloudEntity, SyncMetadata {
  // id inherited from DexieCloudEntity (Dexie Cloud primary key)

  // Core gloss fields
  language: LanguageCode;
  content: string;
  isParaphrased: boolean;
  transcriptions: string[];
  notes: Note[];

  // Relations stored as ID arrays (not full objects)
  containsIds: string[];
  nearSynonymIds: string[];
  nearHomophoneIds: string[];
  translationIds: string[];
  clarifiesUsageIds: string[];
  toBeDifferentiatedFromIds: string[];

  // per-user-progress
  progressEbisu?: ProgressEbisu
}
