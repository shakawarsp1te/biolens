"""
PubMed E-utilities client (PLAN.md Phase 4): targeted search by NCT ID, drug
name/alias, and target+indication only — never an open-ended full-text
search, per the checklist's "targeted search" scoping.

Stores metadata (title, authors, journal, pub date, DOI) and abstracts only.
Never fetches full-text — publisher-copyrighted full text is out of scope
(checklist: "no full-text scraping of copyrighted papers"); PubMed abstracts
are NLM-hosted and distributed for exactly this kind of reuse.

Response shapes verified live against https://eutils.ncbi.nlm.nih.gov, not
assumed — see tests/fixtures/pubmed_*.json for captured examples, including
the live-verified NCT-ID search syntax (`NCT.......[si]` -> "Secondary
Source ID", the field PubMed indexes registered trial numbers under).
"""

from __future__ import annotations

import asyncio
import re
import time
import xml.etree.ElementTree as ET
from typing import Any

import httpx

from app.core.config import get_settings
from app.services.cache import CacheStore, get_cache_store


class RateLimiter:
    """NCBI E-utilities rate limit: 3 req/sec without an API key, 10/sec
    with one (https://www.ncbi.nlm.nih.gov/books/NBK25497/). Simple async
    sleep-based throttle — sufficient for a single backend process; a
    multi-instance deployment would need a shared (e.g. Redis-backed)
    limiter instead, since this one's state is process-local."""

    def __init__(self, requests_per_second: float):
        self._min_interval = 1.0 / requests_per_second
        self._last_request_at: float | None = None
        self._lock = asyncio.Lock()

    async def wait(self) -> None:
        async with self._lock:
            now = time.monotonic()
            if self._last_request_at is not None:
                elapsed = now - self._last_request_at
                remaining = self._min_interval - elapsed
                if remaining > 0:
                    await asyncio.sleep(remaining)
            self._last_request_at = time.monotonic()


def _rate_for(api_key: str) -> float:
    return 10.0 if api_key else 3.0


# NCBI still returns the occasional 429 even when callers stay under the
# documented rate (seen live during a full 10-company scan pass), so a
# 429 is retried with backoff rather than failing that company's scan.
# Dropped connections get the same treatment: the scheduled scan often runs
# moments after the Mac wakes, before the network is fully back (seen live:
# httpcore.ReadError on the Sep 26, 2026 morning run).
_MAX_RETRIES = 3
_RETRY_BACKOFF_SECONDS = 1.0

# Search results change as new papers are indexed, so -- unlike esummary/
# efetch, which are fixed per PMID -- esearch entries expire. Without this,
# a long-running server's repeated scan passes would keep seeing the first
# pass's cached PMID list and never report a new paper.
_ESEARCH_CACHE_TTL_SECONDS = 3600.0


def build_drug_search_term(drug_name: str, aliases: list[str] | None = None) -> str:
    """Targeted search by drug name/alias: OR's the primary name with any
    aliases, each quoted so multi-word names/aliases aren't split apart."""
    names = [drug_name, *(aliases or [])]
    quoted = [f'"{name}"' for name in names if name and name.strip()]
    if len(quoted) == 1:
        return quoted[0]
    return "(" + " OR ".join(quoted) + ")"


# Pipeline drug names are written for people, not search engines: "KOMZIFTI
# (ziftomenib)", "Darovasertib + crizotinib", "Biomarker-driven therapy
# selection (includes apalutamide, niraparib/abiraterone, others)". Searched
# verbatim, PubMed finds no exact phrase and silently falls back to looser
# word matching -- one way off-target papers got in.
_COMBO_SPLIT = re.compile(r"\s*(?:\+|/|,|\bwith\b|\band\b)\s*", re.I)
_DESCRIPTIVE = re.compile(
    r"\b(therapy|therapies|selection|includes|including|program|platform|biomarker|"
    r"undisclosed|candidate|candidates|regimen|others|various|not specified)\b",
    re.I,
)
# Company development codes: IBI310, RLY-2608, JANX007, ERAS-0015, XmAb819.
_DEV_CODE = re.compile(r"^[A-Za-z]{2,}[- ]?\d{2,}[A-Za-z0-9-]*$")
_MAX_NAME_WORDS = 3


def drug_search_names(drug_name: str) -> list[str]:
    """Search-ready names for one pipeline drug: brand and generic pulled
    apart, combos reduced to the company's own drug (the first named, plus
    any development code -- a standard partner drug like crizotinib would
    pull in thousands of unrelated papers), descriptive phrases dropped.
    [] when nothing in the name is a searchable drug name."""
    if not drug_name or not drug_name.strip():
        return []
    inner = re.findall(r"\(([^)]*)\)", drug_name)
    outer = re.sub(r"\([^)]*\)?", " ", drug_name)
    names: list[str] = []
    for index, part in enumerate(_COMBO_SPLIT.split(outer)):
        part = part.strip(" -–")
        if part and (index == 0 or _DEV_CODE.match(part)):
            names.append(part)
    for group in inner:
        # A parenthetical is a single alternate name ("ziftomenib",
        # "RLY-2608"), not a list ("includes apalutamide, niraparib, ...").
        if not _COMBO_SPLIT.search(group):
            names.append(group.strip())
    cleaned: list[str] = []
    for name in names:
        if not name or _DESCRIPTIVE.search(name) or len(name.split()) > _MAX_NAME_WORDS:
            continue
        if len(name) < 3 or name.lower() in {n.lower() for n in cleaned}:
            continue
        cleaned.append(name)
    return cleaned


def build_pipeline_drug_term(names: list[str]) -> str:
    """Title/abstract-only phrase search ([tiab]) for a pipeline drug's
    names -- a mention in affiliations or MeSH indexing doesn't count."""
    return " OR ".join(f'"{name}"[tiab]' for name in names)


def build_target_indication_term(target: str, indication: str) -> str:
    """Targeted search by target + indication: both must appear in the
    title or abstract — [tiab] keeps this a real targeted search rather
    than a loose match against the full record (e.g. affiliations, MeSH)."""
    return f'"{target}"[tiab] AND "{indication}"[tiab]'


def _extract_doi(article_ids: list[dict[str, Any]]) -> str | None:
    for entry in article_ids:
        if entry.get("idtype") == "doi":
            return entry.get("value")
    return None


def parse_abstracts_xml(xml_text: str) -> list[dict[str, Any]]:
    """Parses efetch's PubmedArticleSet XML into {pmid, title, abstract}.
    Deliberately extracts only the abstract text (and enough metadata to
    identify the article) — never any full-text sections some records also
    carry."""
    root = ET.fromstring(xml_text)
    articles = []
    for article in root.findall(".//PubmedArticle"):
        pmid_el = article.find(".//PMID")
        title_el = article.find(".//ArticleTitle")
        # itertext(), not .text: PubMed marks up italics/superscripts inline
        # (<i>KRAS</i>, 10<sup>-3</sup>), and .text stops at the first tag --
        # it silently truncated abstracts mid-sentence before this.
        abstract_parts = [
            text
            for t in article.findall(".//Abstract/AbstractText")
            if (text := "".join(t.itertext()).strip())
        ]
        articles.append(
            {
                "pmid": pmid_el.text if pmid_el is not None else None,
                "title": "".join(title_el.itertext()).strip() if title_el is not None else None,
                "abstract": " ".join(abstract_parts).strip() or None,
            }
        )
    return articles


class PubMedClient:
    def __init__(
        self,
        *,
        http_client: httpx.AsyncClient | None = None,
        cache: CacheStore | None = None,
        rate_limiter: RateLimiter | None = None,
    ):
        settings = get_settings()
        self._base_url = settings.pubmed_api_base
        self._api_key = settings.pubmed_api_key
        self._tool = settings.pubmed_tool_name or "biolens"
        self._email = settings.pubmed_contact_email
        self._http_client = http_client
        self._cache = cache or get_cache_store()
        self._owns_client = http_client is None
        self._rate_limiter = rate_limiter or RateLimiter(_rate_for(self._api_key))

    async def __aenter__(self) -> "PubMedClient":
        if self._http_client is None:
            self._http_client = httpx.AsyncClient(base_url=self._base_url, timeout=10.0)
        return self

    async def __aexit__(self, *exc_info: object) -> None:
        if self._owns_client and self._http_client is not None:
            await self._http_client.aclose()

    def _base_params(self) -> dict[str, str]:
        params = {"tool": self._tool}
        if self._email:
            params["email"] = self._email
        if self._api_key:
            params["api_key"] = self._api_key
        return params

    async def _get(self, path: str, params: dict[str, Any]) -> httpx.Response:
        assert self._http_client is not None, "use `async with PubMedClient() as client:`"
        for attempt in range(_MAX_RETRIES + 1):
            await self._rate_limiter.wait()
            try:
                response = await self._http_client.get(
                    path, params={**self._base_params(), **params}
                )
            except httpx.TransportError:
                if attempt == _MAX_RETRIES:
                    raise
            else:
                if response.status_code != 429 or attempt == _MAX_RETRIES:
                    break
            await asyncio.sleep(_RETRY_BACKOFF_SECONDS * 2**attempt)
        response.raise_for_status()
        return response

    async def esearch(self, term: str, *, retmax: int = 10, sort: str | None = None) -> list[str]:
        cache_key = f"pubmed:esearch:{term}:{retmax}:{sort or ''}"
        cached = await self._cache.get(cache_key)
        if cached is not None and time.time() - cached.fetched_at < _ESEARCH_CACHE_TTL_SECONDS:
            return cached.value["idlist"]

        params: dict[str, Any] = {"db": "pubmed", "term": term, "retmode": "json", "retmax": retmax}
        if sort:
            params["sort"] = sort
        response = await self._get("/esearch.fcgi", params)
        idlist = response.json().get("esearchresult", {}).get("idlist", [])
        await self._cache.set(cache_key, {"idlist": idlist})
        return idlist

    async def search_pipeline_drug(self, names: list[str], *, retmax: int = 10) -> list[str]:
        """PMIDs whose title or abstract names this drug (drug_search_names),
        newest first: the scan keeps only the top `retmax`, and for a drug
        with hundreds of papers (Innovent's sintilimab) a relevance order
        could push a brand-new paper below the cut."""
        if not names:
            return []
        return await self.esearch(build_pipeline_drug_term(names), retmax=retmax, sort="pub_date")

    async def esummary(self, pmids: list[str]) -> list[dict[str, Any]]:
        if not pmids:
            return []
        cache_key = f"pubmed:esummary:{','.join(sorted(pmids))}"
        cached = await self._cache.get(cache_key)
        if cached is not None:
            return cached.value["summaries"]

        response = await self._get(
            "/esummary.fcgi", {"db": "pubmed", "id": ",".join(pmids), "retmode": "json"}
        )
        result = response.json().get("result", {})
        summaries = [result[uid] for uid in result.get("uids", []) if uid in result]
        await self._cache.set(cache_key, {"summaries": summaries})
        return summaries

    async def efetch_abstracts(self, pmids: list[str]) -> list[dict[str, Any]]:
        if not pmids:
            return []
        cache_key = f"pubmed:efetch:{','.join(sorted(pmids))}"
        cached = await self._cache.get(cache_key)
        if cached is not None:
            return cached.value["abstracts"]

        response = await self._get(
            "/efetch.fcgi",
            {"db": "pubmed", "id": ",".join(pmids), "rettype": "abstract", "retmode": "xml"},
        )
        abstracts = parse_abstracts_xml(response.text)
        await self._cache.set(cache_key, {"abstracts": abstracts})
        return abstracts

    # --- Targeted searches (checklist scope: no open-ended full-text search) ---

    async def search_by_nct_id(self, nct_id: str, *, retmax: int = 10) -> list[str]:
        return await self.esearch(f"{nct_id}[si]", retmax=retmax)

    async def search_by_drug_name(
        self, drug_name: str, *, aliases: list[str] | None = None, retmax: int = 10
    ) -> list[str]:
        return await self.esearch(build_drug_search_term(drug_name, aliases), retmax=retmax)

    async def search_by_target_and_indication(
        self, target: str, indication: str, *, retmax: int = 10
    ) -> list[str]:
        return await self.esearch(build_target_indication_term(target, indication), retmax=retmax)

    async def build_research_package(self, pmids: list[str], *, query: str) -> dict[str, Any]:
        """Combines esummary + efetch into one deduped package keyed by
        PMID — the "Drug/Company Research Package" the checklist asks to be
        cached. Cached as a whole (in addition to the underlying esummary/
        efetch calls each being cached individually) so re-requesting the
        same package doesn't redo the merge either."""
        cache_key = f"pubmed:package:{query}"
        cached = await self._cache.get(cache_key)
        if cached is not None:
            return cached.value

        summaries = await self.esummary(pmids)
        abstracts = await self.efetch_abstracts(pmids)
        abstract_by_pmid = {a["pmid"]: a["abstract"] for a in abstracts}

        papers = [
            {
                "pmid": summary.get("uid"),
                "title": summary.get("title"),
                "journal": summary.get("fulljournalname") or summary.get("source"),
                "pub_date": summary.get("pubdate"),
                "doi": _extract_doi(summary.get("articleids", [])),
                "abstract": abstract_by_pmid.get(summary.get("uid")),
            }
            for summary in summaries
        ]
        package = {"query": query, "paper_count": len(papers), "papers": papers}
        await self._cache.set(cache_key, package)
        return package
