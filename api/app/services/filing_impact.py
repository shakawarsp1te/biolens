"""
Impact calls on material SEC filings -- the filing counterpart to
paper_impact.py, under the same rules (docs/PLAN.md §3 rule 10): a
company-level read on whether the filing is likely good or bad news, the
same for every reader, grounded only in the filing's own text, never a
buy/sell/hold, price, or predicted move. Shares paper_impact's output model
and validate-and-repair loop, so both are held to identical language rules;
scored against the stock by signal_outcomes.py like any other call.

Which filings get a call: 8-Ks (material events -- results, deals, trial
data, executive changes, financings), S-1/S-3 registrations (capital
raises, where dilution is the plain fact to state), and merger proxies.
10-Qs and 10-Ks don't: their numbers are already computed deterministically
(financial_health.py, valuation.py), and an LLM summary of a 200-page
report would add length, not signal. An 8-K that only reports shareholder
vote results and/or exhibits (items 5.07, 9.01) is skipped as routine.
"""

from __future__ import annotations

import logging
import re
from typing import Any

from app.services.llm import LLMProvider, NotConfiguredProvider, get_llm_provider
from app.services.paper_impact import call_impact_model, company_context, impact_dict
from app.services.sec_edgar import SecEdgarClient

logger = logging.getLogger("biolens.filing_impact")

ASSESSED_FORMS = {"8-K", "8-K/A", "S-1", "S-1/A", "S-3", "S-3/A", "DEFM14A"}
_ROUTINE_ONLY_ITEMS = {"5.07", "9.01"}

# What each 8-K item means, so the model reads the filing in context.
_ITEM_MEANINGS = {
    "1.01": "entry into a material agreement (e.g. licensing, partnership, financing)",
    "1.02": "termination of a material agreement",
    "2.01": "completion of an acquisition or disposition",
    "2.02": "quarterly/annual financial results",
    "2.03": "new debt or financial obligation",
    "2.05": "restructuring or exit costs (often layoffs)",
    "2.06": "material impairment",
    "3.01": "delisting notice or failure to meet listing standards",
    "3.02": "unregistered sale of equity",
    "5.02": "departure or appointment of directors or officers",
    "5.07": "shareholder vote results",
    "7.01": "Regulation FD disclosure (often a presentation or data release)",
    "8.01": "other events (often clinical or regulatory news)",
    "9.01": "financial statements and exhibits",
}

FILING_IMPACT_SYSTEM_PROMPT = (
    "You are BioLens's research analyst. Given ONE new SEC filing (form type, 8-K items, and "
    "the filing's own text) and the profile of the company that filed it, judge whether the "
    "filing is likely good news, bad news, mixed, or unlikely to matter for that company's "
    "prospects -- the read-through a careful biotech analyst gives a non-scientist investor.\n\n"
    "Rules:\n"
    "- Use ONLY the filing text and company profile given. Never bring in outside facts, and "
    "never invent a number; any figure you cite must appear in the filing text.\n"
    "- Capital raises: an offering sells new shares, so say plainly that it dilutes existing "
    "shareholders, and also what the money extends (runway, programs) if the filing says. A "
    "shelf registration (S-3) only makes a future offering possible; say it isn't one yet.\n"
    "- Routine filings (governance, vote results, boilerplate) are 'unlikely_to_matter'.\n"
    "- Clinical data, regulatory decisions, major partnerships, restructurings, and "
    "leadership exits usually matter; weigh how much the filing actually discloses.\n"
    "- Confidence (high/moderate/low) reflects how clearly the filing points one way. If the "
    "text is mostly a cover page with little substance, say so and use low confidence.\n"
    "- `headline` is one plain sentence (max ~25 words) a non-investor understands.\n"
    "- `reasoning` is 2-4 sentences explaining why, in plain language.\n"
    "- `key_findings`: 1-4 specific facts from the filing that drove the call.\n"
    "- `caveats`: 1-3 things the filing does NOT tell you.\n"
    "- Never tell anyone to buy, sell, or hold; never predict a price, a price move, or a "
    "percentage change; never use rating language. Describe what the filing means for the "
    "company, not what anyone should do about it."
)

_ARCHIVE_URL = re.compile(r"/Archives/edgar/data/(\d+)/(\d{18})/([^/?#]+)$")


def _parse_source_url(url: str) -> tuple[str, str, str] | None:
    """(cik, accession-with-dashes, primary document) from a filing signal's
    sourceUrl, which filing_monitor builds from exactly these parts."""
    match = _ARCHIVE_URL.search(url or "")
    if not match:
        return None
    cik, digits, document = match.groups()
    return cik, f"{digits[:10]}-{digits[10:12]}-{digits[12:]}", document


def should_assess(form: str, items: list[str]) -> bool:
    if form not in ASSESSED_FORMS:
        return False
    if form.startswith("8-K") and items and set(items) <= _ROUTINE_ONLY_ITEMS:
        return False
    return True


def build_filing_prompt(
    company: dict[str, Any], *, form: str, items: list[str], filed: str, text: str
) -> str:
    item_lines = "\n".join(f"- Item {i}: {_ITEM_MEANINGS.get(i, 'see filing')}" for i in items)
    return (
        f"{company_context(company)}\n\n"
        f"FILING\nForm: {form}\nFiled: {filed or 'unknown'}\n"
        f"{'8-K items:' + chr(10) + item_lines + chr(10) if item_lines else ''}"
        f"Text (press-release exhibits first, truncated):\n{text}"
    )


async def assess_filing_signals(
    company: dict[str, Any],
    signals: list[dict[str, Any]],
    *,
    sec_client: SecEdgarClient,
    provider: LLMProvider | None = None,
) -> list[dict[str, Any]]:
    """Attaches an `impact` to each assessable new-filing signal and returns
    the signals. Never raises: no LLM configured, an unreadable filing, or
    a call that never validates just leaves the signal as a plain fact."""
    provider = provider or get_llm_provider()
    if isinstance(provider, NotConfiguredProvider):
        return signals
    pending = [
        s for s in signals if s.get("signalType") == "new_filing" and s.get("impact") is None
    ]
    if not pending:
        return signals

    # Form type and 8-K items come from the company's filing index (cached),
    # keyed by accession -- older signals predate storing them.
    meta: dict[str, tuple[str, list[str]]] = {}
    ticker = company.get("ticker")
    cik = await sec_client.get_cik(ticker) if ticker else None
    submissions = await sec_client.get_submissions(cik) if cik else None
    recent = (submissions or {}).get("filings", {}).get("recent", {})
    for accession, form, items in zip(
        recent.get("accessionNumber", []),
        recent.get("form", []),
        recent.get("items", []),
        strict=False,
    ):
        meta[accession] = (form, [i for i in (items or "").split(",") if i])

    for signal in pending:
        parsed = _parse_source_url(signal.get("sourceUrl", ""))
        if parsed is None:
            continue
        filing_cik, accession, document = parsed
        form, items = meta.get(accession, ("", []))
        if not form:
            continue  # not in the filing index yet; retry next pass
        if not should_assess(form, items):
            # Recorded so the backfill doesn't retry it every pass.
            signal["notAssessed"] = "routine_or_report_form"
            continue
        try:
            text = await sec_client.get_filing_text(filing_cik, accession, document)
            if not text:
                continue
            output = await call_impact_model(
                system=FILING_IMPACT_SYSTEM_PROMPT,
                prompt=build_filing_prompt(
                    company, form=form, items=items, filed=signal.get("occurredAt", ""), text=text
                ),
                provider=provider,
            )
        except Exception:
            logger.exception("impact call failed for filing %s", accession)
            continue
        signal["impact"] = impact_dict(output)
    return signals
