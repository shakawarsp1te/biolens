"""
PubMed parsing/matching logic tests (PLAN.md Phase 4 checklist item), run
against real captured E-utilities responses in tests/fixtures/.
"""

import json
from pathlib import Path

from app.services.pubmed import (
    build_drug_search_term,
    build_target_indication_term,
    parse_abstracts_xml,
)

FIXTURES = Path(__file__).parent / "fixtures"


def load_json(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text())


def load_text(name: str) -> str:
    return (FIXTURES / name).read_text()


class TestBuildDrugSearchTerm:
    def test_single_name_no_aliases(self):
        assert build_drug_search_term("onvansertib") == '"onvansertib"'

    def test_with_aliases_ors_them_together(self):
        term = build_drug_search_term("onvansertib", ["PCM-075", "NMS-P937"])
        assert term == '("onvansertib" OR "PCM-075" OR "NMS-P937")'

    def test_ignores_blank_aliases(self):
        term = build_drug_search_term("onvansertib", ["", "  ", "PCM-075"])
        assert term == '("onvansertib" OR "PCM-075")'

    def test_empty_alias_list_same_as_none(self):
        assert build_drug_search_term("onvansertib", []) == build_drug_search_term("onvansertib")


class TestBuildTargetIndicationTerm:
    def test_both_fields_quoted_and_tiab_scoped(self):
        term = build_target_indication_term("PLK1", "colorectal cancer")
        assert term == '"PLK1"[tiab] AND "colorectal cancer"[tiab]'


class TestParseAbstractsXml:
    def test_extracts_pmid_title_abstract_from_real_response(self):
        xml_text = load_text("pubmed_efetch_abstract.xml")
        articles = parse_abstracts_xml(xml_text)
        assert len(articles) == 1
        article = articles[0]
        assert article["pmid"] == "42155785"
        assert "polo-like kinase 1" in article["title"].lower()
        assert "PLK1" in article["abstract"]
        # Never the full text — just the abstract.
        assert "CopyrightInformation" not in article["abstract"]

    def test_handles_empty_result_set(self):
        empty_xml = '<?xml version="1.0"?><PubmedArticleSet></PubmedArticleSet>'
        assert parse_abstracts_xml(empty_xml) == []

    def test_missing_abstract_gives_none_not_empty_string(self):
        xml_text = (
            '<?xml version="1.0"?><PubmedArticleSet><PubmedArticle>'
            "<MedlineCitation><PMID>1</PMID>"
            "<Article><ArticleTitle>No Abstract Here</ArticleTitle></Article>"
            "</MedlineCitation></PubmedArticle></PubmedArticleSet>"
        )
        articles = parse_abstracts_xml(xml_text)
        assert articles[0]["abstract"] is None


class TestEsearchFixtures:
    def test_nct_id_search_translates_to_secondary_source_id(self):
        # Verified live: PubMed indexes registered trial numbers under
        # "Secondary Source ID" — `NCT......[si]` is the right field tag.
        data = load_json("pubmed_esearch_nct.json")
        assert '"NCT06106308"[Secondary Source ID]' in data["esearchresult"]["querytranslation"]
        assert len(data["esearchresult"]["idlist"]) >= 1

    def test_drug_name_search_returns_pmids(self):
        data = load_json("pubmed_esearch_drug.json")
        assert len(data["esearchresult"]["idlist"]) > 0
