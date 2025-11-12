/**
 * Dexie Cloud metadata fields
 * These fields are reserved for Dexie Cloud sync but not configured yet
 */
export interface DexieCloudEntity {
  id?: string; // Dexie Cloud primary key (will be auto-generated)
  owner?: string; // Dexie Cloud user ID
  realmId?: string; // Dexie Cloud realm ID for sharing
}

/**
 * Sync metadata for tracking updates
 */
export interface SyncMetadata {
  lastSyncedAt?: Date;
  updatedAt?: Date;
}
