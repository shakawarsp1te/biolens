import { MOCK_COMPANY_PROFILES } from "../mocks/companyProfile";
import { PipelineAsset } from "../types/domain";

export interface FlatPipelineAsset extends PipelineAsset {
  companyId: string;
  companyName: string;
}

/**
 * Flattens every company profile's pipeline into one list, each asset
 * annotated with which company it belongs to. The Watchlist screen needs
 * this to resolve a followed drug/target's entityId back into something
 * displayable — there's no standalone `drugs`/`targets` table yet, so
 * PipelineAsset (already attached to a real company profile) is the only
 * source of truth for what a drug or target even is.
 */
export function getAllPipelineAssets(): FlatPipelineAsset[] {
  return Object.values(MOCK_COMPANY_PROFILES).flatMap((company) =>
    company.pipeline.map((asset) => ({
      ...asset,
      companyId: company.id,
      companyName: company.name,
    })),
  );
}

export function findPipelineAssetByDrugId(drugId: string): FlatPipelineAsset | undefined {
  return getAllPipelineAssets().find((asset) => asset.drugId === drugId);
}

/** A "target" isn't its own entity anywhere yet — its entityId is just the
 * target string (e.g. "PLK1"), so following it once represents following
 * that biology broadly, not one company's specific asset against it. */
export function findPipelineAssetsByTarget(target: string): FlatPipelineAsset[] {
  return getAllPipelineAssets().filter((asset) => asset.target === target);
}
