import { TrackerDB } from "./types";

// Single source of truth for how each collection is stored in Redis.
// The old model stored each collection as ONE big JSON array under a single key
// and overwrote the whole thing on every change — so any stale browser could
// wipe everyone else's work. The new model stores each record individually:
//  - "hash" collections: a Redis hash, one field per record (keyed by identity)
//  - "set"  collections: a Redis set, one member per value
// That means a save only ever touches the one record that changed, so
// simultaneous editors can never overwrite each other.

export type CollectionKey = keyof TrackerDB;
export type CollectionKind = "hash" | "set";

interface CollectionCfg {
  kind: CollectionKind;
  redisKey: string; // new per-record storage key
  legacyKey: string; // old whole-array key, read once during migration
  identity?: (item: any) => string; // record key, for hash collections
}

export const COLLECTIONS: Record<CollectionKey, CollectionCfg> = {
  clients: { kind: "hash", redisKey: "h:clients", legacyKey: "data:clients", identity: (c) => c.id },
  logs: { kind: "hash", redisKey: "h:logs", legacyKey: "data:contactlog", identity: (l) => l.id },
  deals: { kind: "hash", redisKey: "h:deals", legacyKey: "data:deals", identity: (d) => d.id },
  capacity: { kind: "hash", redisKey: "h:capacity", legacyKey: "data:capacity", identity: (c) => `${c.broker}__${c.weekStart}` },
  brokerContacts: { kind: "hash", redisKey: "h:brokercontacts", legacyKey: "data:brokercontacts", identity: (c) => c.name },
  brokers: { kind: "set", redisKey: "s:brokers", legacyKey: "data:brokers" },
  opsRecipients: { kind: "set", redisKey: "s:opsrecipients", legacyKey: "data:opsrecipients" },
  // Community Tracker (migrated) — legacyKey paths are dead (no legacy
  // single-array key ever existed for these), kept only so migrateIfNeeded()
  // doesn't need to special-case them; redis.get() on a key that was never
  // set just returns null and the migration loop no-ops.
  communities: { kind: "hash", redisKey: "h:communities", legacyKey: "data:communities", identity: (c) => c.id },
  communityIntel: { kind: "hash", redisKey: "h:communityintel", legacyKey: "data:communityintel", identity: (i) => i.communityId },
  callLogs: { kind: "hash", redisKey: "h:calllogs", legacyKey: "data:calllogs", identity: (l) => l.id },
  // Feature Sheets
  builders: { kind: "hash", redisKey: "h:builders", legacyKey: "data:builders", identity: (b) => b.id },
};

export const COLLECTION_KEYS = Object.keys(COLLECTIONS) as CollectionKey[];
