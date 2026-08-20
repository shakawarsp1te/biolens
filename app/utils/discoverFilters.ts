import { CompanyMaturity, DiscoveryCardData, TrialPhase } from "../types/domain";

/**
 * Mirrors api/app/services/discover.py's DiscoverFilters/apply_discover_filters
 * exactly (same match rules: exact case-insensitive for stage/therapeutic
 * area/maturity, substring case-insensitive for modality/target) so the
 * behavior is identical whether it runs here against mock data or later
 * server-side against the real database.
 */
export interface DiscoverFilters {
  therapeuticArea?: string;
  stage?: TrialPhase;
  modality?: string;
  target?: string;
  maturity?: CompanyMaturity;
}

export function applyDiscoverFilters(
  listings: DiscoveryCardData[],
  filters: DiscoverFilters,
): DiscoveryCardData[] {
  let result = listings;

  if (filters.therapeuticArea) {
    const wanted = filters.therapeuticArea.toLowerCase();
    result = result.filter((listing) => listing.therapeuticArea.toLowerCase() === wanted);
  }

  if (filters.stage) {
    const wanted = filters.stage.toLowerCase();
    result = result.filter((listing) => listing.stage.toLowerCase() === wanted);
  }

  if (filters.modality) {
    const wanted = filters.modality.toLowerCase();
    result = result.filter((listing) =>
      listing.modalities.some((modality) => modality.toLowerCase().includes(wanted)),
    );
  }

  if (filters.target) {
    const wanted = filters.target.toLowerCase();
    result = result.filter((listing) =>
      listing.targets.some((target) => target.toLowerCase().includes(wanted)),
    );
  }

  if (filters.maturity) {
    result = result.filter((listing) => listing.maturity === filters.maturity);
  }

  return result;
}
