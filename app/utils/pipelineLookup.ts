import { CompanyRecord, PipelineAsset } from "../types/domain";

export interface FlatPipelineAsset extends PipelineAsset {
  companyId: string;
  companyName: string;
}

/**
 * Flattens every company's pipeline into one list, each asset annotated
 * with which company it belongs to. The Watchlist screen needs this to
 * resolve a followed drug/target's entityId back into something
 * displayable — there's no standalone `drugs`/`targets` table yet, so a
 * company's own profile (fetched via CompaniesContext) is the only source
 * of truth for what a drug or target even is.
 */
export function getAllPipelineAssets(companies: CompanyRecord[]): FlatPipelineAsset[] {
  return companies.flatMap((company) =>
    company.pipeline.map((asset) => ({
      ...asset,
      companyId: company.id,
      companyName: company.name,
    })),
  );
}

export function findPipelineAssetByDrugId(
  companies: CompanyRecord[],
  drugId: string,
): FlatPipelineAsset | undefined {
  return getAllPipelineAssets(companies).find((asset) => asset.drugId === drugId);
}

/** A "target" isn't its own entity anywhere yet — its entityId is just the
 * target string (e.g. "PLK1"), so following it once represents following
 * that biology broadly, not one company's specific asset against it. */
export function findPipelineAssetsByTarget(
  companies: CompanyRecord[],
  target: string,
): FlatPipelineAsset[] {
  return getAllPipelineAssets(companies).filter((asset) => asset.target === target);
}
