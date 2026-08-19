"""
Parsing/matching logic tests (PLAN.md Phase 3 checklist item), run against
real captured ClinicalTrials.gov API v2 responses in tests/fixtures/ — not
hand-constructed fake JSON, so a real shape change in the upstream API would
actually be caught here.
"""

import json
from pathlib import Path

import pytest

from app.models.domain import TrialPhase
from app.services.clinicaltrials import (
    map_ctgov_phases,
    parse_study_summary,
    study_mentions_intervention,
)

FIXTURES = Path(__file__).parent / "fixtures"


def load_fixture(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text())


@pytest.fixture
def janx007_study() -> dict:
    return load_fixture("ctgov_study_NCT05519449.json")


class TestMapCtgovPhases:
    def test_phase1(self):
        assert map_ctgov_phases(["PHASE1"]) == TrialPhase.PHASE_I

    def test_phase1_2_combo(self):
        assert map_ctgov_phases(["PHASE1", "PHASE2"]) == TrialPhase.PHASE_I_II

    def test_phase2(self):
        assert map_ctgov_phases(["PHASE2"]) == TrialPhase.PHASE_II

    def test_phase2_3_combo(self):
        assert map_ctgov_phases(["PHASE2", "PHASE3"]) == TrialPhase.PHASE_II_III

    def test_phase3(self):
        assert map_ctgov_phases(["PHASE3"]) == TrialPhase.PHASE_III

    def test_phase4_maps_to_approved(self):
        assert map_ctgov_phases(["PHASE4"]) == TrialPhase.APPROVED

    def test_early_phase1_has_no_bucket(self):
        # We deliberately don't force this into PHASE_I — it's a distinct
        # CT.gov concept (exploratory, pre-Phase-1) that would misrepresent
        # the trial if merged into our Phase I bucket.
        assert map_ctgov_phases(["EARLY_PHASE1"]) is None

    def test_na_has_no_bucket(self):
        assert map_ctgov_phases(["NA"]) is None

    def test_empty_list_has_no_bucket(self):
        assert map_ctgov_phases([]) is None

    def test_none_has_no_bucket(self):
        assert map_ctgov_phases(None) is None

    def test_order_independent(self):
        # CT.gov could plausibly return phases in either order; the mapping
        # must not depend on list order.
        assert map_ctgov_phases(["PHASE2", "PHASE1"]) == TrialPhase.PHASE_I_II


class TestParseStudySummary:
    def test_extracts_core_fields(self, janx007_study):
        summary = parse_study_summary(janx007_study)
        assert summary["nct_id"] == "NCT05519449"
        assert summary["lead_sponsor"] == "Janux Therapeutics"
        assert summary["phase"] == TrialPhase.PHASE_I
        assert summary["overall_status"] in {"RECRUITING", "ACTIVE_NOT_RECRUITING", "COMPLETED"}

    def test_extracts_conditions(self, janx007_study):
        summary = parse_study_summary(janx007_study)
        assert "Prostate Cancer" in summary["conditions"]

    def test_extracts_interventions(self, janx007_study):
        summary = parse_study_summary(janx007_study)
        assert "JANX007" in summary["interventions"]
        assert "Darolutamide" in summary["interventions"]

    def test_falls_back_to_arm_group_names_when_no_top_level_interventions(self):
        # Some field-limited search responses omit armsInterventionsModule's
        # top-level `interventions` list but still include armGroups.
        raw = {
            "protocolSection": {
                "identificationModule": {"nctId": "NCT00000000"},
                "armsInterventionsModule": {
                    "armGroups": [{"interventionNames": ["Drug: TestDrug"]}],
                },
            }
        }
        summary = parse_study_summary(raw)
        assert summary["interventions"] == ["TestDrug"]

    def test_handles_missing_modules_gracefully(self):
        # A minimal/malformed record shouldn't raise — every field should
        # degrade to None/empty rather than KeyError.
        summary = parse_study_summary({"protocolSection": {}})
        assert summary["nct_id"] is None
        assert summary["phase"] is None
        assert summary["conditions"] == []
        assert summary["interventions"] == []


class TestStudyMentionsIntervention:
    def test_true_for_exact_match(self, janx007_study):
        assert study_mentions_intervention(janx007_study, "JANX007") is True

    def test_case_insensitive(self, janx007_study):
        assert study_mentions_intervention(janx007_study, "janx007") is True

    def test_false_for_unrelated_drug(self, janx007_study):
        assert study_mentions_intervention(janx007_study, "Pembrolizumab") is False

    def test_false_for_empty_query(self, janx007_study):
        assert study_mentions_intervention(janx007_study, "") is False

    def test_matches_via_title_even_if_not_a_listed_intervention(self, janx007_study):
        # "prostate" isn't an intervention name, but it is in the brief
        # title — matching logic should still catch it there.
        assert study_mentions_intervention(janx007_study, "prostate") is True
