import { CompanyProfile } from "../types/domain";

/**
 * Builds the `facts` / `sourceIds` package handed to POST /analyze/ask for a
 * given company profile screen. Ask BioLens (BUILD_BRIEF.txt §57) answers
 * strictly from whatever is passed in here — nothing else — so this is the
 * one place that decides what "the current research package" means for a
 * company profile.
 *
 * Deliberately verbose rather than clever: one plain-English fact string per
 * profile field, so a validation failure or a thin profile is easy to reason
 * about by eye. Trial NCT IDs double as source_ids since they're the only
 * genuinely traceable identifiers a mock profile carries today.
 */
export function buildAskBioLensContext(company: CompanyProfile): {
  facts: string[];
  sourceIds: string[];
} {
  const facts: string[] = [
    `${company.name} — primary focus: ${company.primaryFocus}.`,
    `${company.name}'s technology: ${company.technology}.`,
    `Current status: ${company.status}.`,
    company.biolensSummary,
    ...company.whyItMatters,
  ];

  for (const asset of company.pipeline) {
    facts.push(
      `Pipeline asset ${asset.drugName} (${asset.drugId}): targets ${asset.target}, a ` +
        `${asset.modality} for ${asset.disease}, currently in ${asset.stage}` +
        (asset.trialIds.length > 0 ? `, tracked under trial(s) ${asset.trialIds.join(", ")}` : "") +
        (asset.nextMilestone ? `. Next milestone: ${asset.nextMilestone}.` : "."),
    );
  }

  if (company.isMockData) {
    facts.push(
      "This profile is illustrative mock data for demo purposes, not a live, verified data feed.",
    );
  }

  const sourceIds = Array.from(new Set(company.pipeline.flatMap((asset) => asset.trialIds)));

  return { facts, sourceIds };
}
