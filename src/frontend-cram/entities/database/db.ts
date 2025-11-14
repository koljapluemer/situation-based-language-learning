import Dexie, { Table } from 'dexie';
import dexieCloud from 'dexie-cloud-addon';
import type { GlossEntity } from '../gloss/types';
import type { SituationEntity } from '../situation/types';

/**
 * Dexie database for offline storage of language learning content
 *
 * Cloud sync is prepared but not configured yet.
 * To enable cloud sync later, configure dexieCloud with your database URL.
 */
export class SBLDatabase extends Dexie {
  // Entity tables
  glosses!: Table<GlossEntity, string>; // Primary key: id
  situations!: Table<SituationEntity, string>; // Primary key: id

  constructor() {
    super('SBLDatabase', { addons: [dexieCloud] });

    // Schema version 1
    this.version(1).stores({
      // Gloss: indexed by id (primary key) and compound index [language+content] for deduplication
      glosses: 'id, [language+content], language, lastSyncedAt',

      // Legacy situation schema (slug primary key)
      situations: 'identifier, targetLanguage, lastSyncedAt',
    });

    // Schema version 2 - switch situations primary key to backend id
    this.version(2).stores({
      glosses: 'id, [language+content], language, lastSyncedAt',
      situations: 'id, targetLanguage, nativeLanguage, lastSyncedAt',
    }).upgrade(async (tx) => {
      // Clear outdated situation records (incompatible schema)
      await tx.table('situations').clear();
    });

    // Dexie Cloud configuration (disabled until needed)
    // To enable: uncomment and provide your cloud database URL
    // this.cloud.configure({
    //   databaseUrl: 'https://your-dexie-cloud-url.com',
    //   requireAuth: false,
    // });
  }
}

// Singleton instance
export const db = new SBLDatabase();
