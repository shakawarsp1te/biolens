import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Device-local watchlist persistence (Phase 9 groundwork). Mirrors the
 * eventual `watchlists` DB table shape (entity_type, entity_id) exactly
 * (see db/migrations/0001_init_schema.sql) so migrating to real
 * Supabase-backed, cross-device persistence later is a storage-layer swap,
 * not a data-model change.
 *
 * This is genuine local persistence, not a stub — AsyncStorage survives
 * app restarts. What it doesn't do yet is sync across devices or require
 * an account, since that needs Phase 0's Supabase Auth to exist first.
 */

export type WatchlistEntityType = "company" | "drug" | "target";

export interface WatchlistEntry {
  entityType: WatchlistEntityType;
  entityId: string;
  addedAt: string;
}

const STORAGE_KEY = "biolens:watchlist";

function sameEntity(a: WatchlistEntry, entityType: WatchlistEntityType, entityId: string): boolean {
  return a.entityType === entityType && a.entityId === entityId;
}

export async function getWatchlist(): Promise<WatchlistEntry[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Corrupted storage shouldn't crash the app — treat as empty.
    return [];
  }
}

async function saveWatchlist(entries: WatchlistEntry[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export async function addToWatchlist(
  entityType: WatchlistEntityType,
  entityId: string,
): Promise<WatchlistEntry[]> {
  const current = await getWatchlist();
  if (current.some((entry) => sameEntity(entry, entityType, entityId))) return current;
  const next = [...current, { entityType, entityId, addedAt: new Date().toISOString() }];
  await saveWatchlist(next);
  return next;
}

export async function removeFromWatchlist(
  entityType: WatchlistEntityType,
  entityId: string,
): Promise<WatchlistEntry[]> {
  const current = await getWatchlist();
  const next = current.filter((entry) => !sameEntity(entry, entityType, entityId));
  await saveWatchlist(next);
  return next;
}
