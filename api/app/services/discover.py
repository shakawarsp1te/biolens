"""
PLAN.md Phase 8: Discover page filtering (BUILD_BRIEF.txt §11).

Oncology-only for V1 (§11: "Do not implement these other areas during the
initial data build") — therapeutic_area filtering exists here for the
future, not because other areas are populated yet.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.services.frontier_score import CompanyMaturity


@dataclass(frozen=True)
class DiscoverFilters:
    therapeutic_area: str | None = None
    stage: str | None = None
    modality: str | None = None
    target: str | None = None  # substring search, per §11 ("Target: Searchable")
    maturity: CompanyMaturity | None = None


@dataclass(frozen=True)
class DiscoverListing:
    """One Discover-feed row: a company plus enough of its pipeline to
    filter on modality/target, which are drug-level attributes, not
    company-level ones."""

    company_id: str
    name: str
    therapeutic_area: str
    stage: str
    maturity: CompanyMaturity
    frontier_score: int
    modalities: list[str] = field(default_factory=list)
    targets: list[str] = field(default_factory=list)


def apply_discover_filters(
    listings: list[DiscoverListing], filters: DiscoverFilters
) -> list[DiscoverListing]:
    """Every filter is optional and case-insensitive. modality/target match
    if *any* of the company's drugs has a matching modality/target —
    substring match for target (so "KRAS" matches "KRAS G12D"), exact match
    for the enum-like fields (therapeutic_area, stage, maturity)."""
    result = listings

    if filters.therapeutic_area:
        wanted = filters.therapeutic_area.lower()
        result = [listing for listing in result if listing.therapeutic_area.lower() == wanted]

    if filters.stage:
        wanted = filters.stage.lower()
        result = [listing for listing in result if listing.stage.lower() == wanted]

    if filters.modality:
        wanted = filters.modality.lower()
        result = [
            listing
            for listing in result
            if any(wanted in modality.lower() for modality in listing.modalities)
        ]

    if filters.target:
        wanted = filters.target.lower()
        result = [
            listing
            for listing in result
            if any(wanted in target.lower() for target in listing.targets)
        ]

    if filters.maturity:
        result = [listing for listing in result if listing.maturity == filters.maturity]

    return result
