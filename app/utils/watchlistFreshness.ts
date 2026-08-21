import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * "New since your last visit" tracking for followed companies — a real
 * diff against live ClinicalTrials.gov results, not a fabricated
 * notification. On first visit to a company (no stored baseline yet),
 * every trial found today becomes the baseline with zero reported as new —
 * pre-existing trials a company already had when you started following it
 * were never "new" to begin with. Only trials that show up on a later visit,
 * after the baseline was set, count.
 */

const STORAGE_KEY_PREFIX = "biolens:watchlist:seenTrials:";

async function getSeenTrialIds(companyId: string): Promise<string[] | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY_PREFIX + companyId);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function setSeenTrialIds(companyId: string, ids: string[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY_PREFIX + companyId, JSON.stringify(ids));
}

/**
 * Compares `currentTrialIds` (a fresh ClinicalTrials.gov lookup for this
 * company, done by the caller) against what was seen last time, returns how
 * many are genuinely new, and immediately updates the baseline to the
 * current set — so this visit becomes the new "last visit" for next time.
 */
export async function diffAndUpdateSeenTrials(
  companyId: string,
  currentTrialIds: string[],
): Promise<number> {
  const previouslySeen = await getSeenTrialIds(companyId);
  await setSeenTrialIds(companyId, currentTrialIds);

  if (previouslySeen === null) return 0; // first-ever visit: baseline only, nothing "new" yet
  const previouslySeenSet = new Set(previouslySeen);
  return currentTrialIds.filter((id) => !previouslySeenSet.has(id)).length;
}
