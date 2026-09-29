"""competitors.py tests: target -> search terms, what counts as naming a
target, grouping by parent company, and excluding the company itself."""

from app.services.competitors import (
    _mentions_target,
    group_competitor_trials,
    search_terms_for_target,
)


def _study(nct, lead, title, phases=("PHASE3",), drugs=(), description=""):
    return {
        "protocolSection": {
            "identificationModule": {"nctId": nct, "briefTitle": title},
            "sponsorCollaboratorsModule": {"leadSponsor": {"name": lead}},
            "designModule": {"phases": list(phases)},
            "statusModule": {"overallStatus": "RECRUITING"},
            "armsInterventionsModule": {
                "interventions": [{"name": d, "description": description} for d in drugs]
            },
        }
    }


def test_search_terms_from_real_profile_targets():
    assert search_terms_for_target("ER (Estrogen Receptor)") == ["estrogen receptor", "ESR1"]
    assert search_terms_for_target("Menin-KMT2A") == ["menin"]
    assert search_terms_for_target("WEE1") == ["WEE1"]
    assert search_terms_for_target("Not specified in trial data") == []
    assert search_terms_for_target("MUC1 (inferred from trial population)") == []


def test_wild_type_mentions_describe_patients_not_the_target():
    assert _mentions_target("Sotorasib in KRAS G12C-mutated NSCLC", "KRAS")
    assert not _mentions_target("Panitumumab in KRAS wild-type colorectal cancer", "KRAS")
    assert not _mentions_target("A study of KRASX-99", "KRAS")  # substring of another word


def test_groups_by_parent_excludes_self_and_ranks_most_advanced_first():
    studies = [
        _study("NCT1", "Kura Oncology, Inc.", "Ziftomenib in menin-dependent AML", drugs=["Z"]),
        _study(
            "NCT2",
            "Janssen Research & Development, LLC",
            "Bleximenib, a menin inhibitor",
            ("PHASE2",),
            ["Bleximenib"],
        ),
        _study(
            "NCT3",
            "Janssen Pharmaceutica N.V.",
            "Menin inhibitor combo",
            ("PHASE3",),
            ["Bleximenib", "Placebo"],
        ),
        _study("NCT4", "Servier", "S243249 menin study", ("PHASE1", "PHASE2"), ["S243249"]),
        _study("NCT5", "Other Co", "Unrelated leukemia trial", drugs=["X"]),
    ]
    result = group_competitor_trials(
        studies,
        terms=["menin"],
        company_name="Kura Oncology",
        tracked={"servier": "servier"},
    )
    assert [c["company"] for c in result] == ["Johnson & Johnson", "Servier"]
    jnj = result[0]
    assert jnj["ticker"] == "JNJ"
    assert jnj["trialCount"] == 2
    assert jnj["mostAdvancedPhase"] == "Phase III"
    assert jnj["drugs"] == ["Bleximenib"]  # placebo filtered as generic
    assert result[1]["trackedCompanyId"] == "servier"
    assert result[1]["trials"][0]["phase"] == "Phase I/II"


def test_target_in_drug_description_counts():
    studies = [
        _study(
            "NCT9",
            "Acme",
            "A study in solid tumors",
            drugs=["AC-1"],
            description="a WEE1 inhibitor",
        )
    ]
    result = group_competitor_trials(studies, terms=["WEE1"], company_name="Zentalis", tracked={})
    assert result[0]["company"] == "Acme"


def test_clean_drug_name_strips_doses_and_arm_labels():
    from app.services.competitors import clean_drug_name

    assert clean_drug_name("S243249 600mg") == "S243249"
    assert clean_drug_name("BN104 monotherapy - rp2d") == "BN104"
    assert clean_drug_name("Adagrasib oral dose of 400 mg twice daily") == "Adagrasib"
    assert clean_drug_name("IMM-1-104 Monotherapy (Treatment Group A)") == "IMM-1-104"
    assert clean_drug_name("Bleximenib") == "Bleximenib"


def test_clean_drug_name_drops_parentheticals_including_unclosed():
    from app.services.competitors import clean_drug_name

    assert clean_drug_name("Azacitidine (AZA)") == "Azacitidine"
    assert clean_drug_name("Azacitidine (AZA") == "Azacitidine"
