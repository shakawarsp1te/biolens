"""
PLAN.md Phase 6: deterministic statistics parser.

Deliberately rule-based, not LLM-based — this is the complement to Phase 5's
LLM entity extraction. Numbers get parsed and classified by regex/logic
here, never inferred by a language model, so every number in the app is
auditable back to an explicit match in the source text rather than a
model's guess. Where the source text doesn't state a number explicitly
(e.g. an abstract gives a percentage but not the responder count), these
functions return None rather than back-calculating it — reconstructing
"14 of 53" from "26.4% of 53 patients" would be exactly the kind of
fabrication BUILD_BRIEF.txt forbids, just committed here instead of by an
LLM.

BUILD_BRIEF.txt §26: "The application must never reduce clinical-trial
analysis to p < 0.05 = success." Every function below exists to prevent one
specific way that collapse happens — see each docstring for which BUILD_BRIEF
section it implements.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from enum import Enum

from app.models.domain import EndpointRole

# ---------------------------------------------------------------------------
# §27: endpoint type classification
# ---------------------------------------------------------------------------


class EndpointType(str, Enum):
    TIME_TO_EVENT = "time_to_event"
    BINARY = "binary"
    CONTINUOUS = "continuous"


# Order matters: checked as substrings, most-specific-first within each list
# doesn't matter here since categories don't overlap, but list order across
# categories does — time-to-event is checked before binary/continuous so
# "progression-free survival rate" (unusual phrasing) still lands as
# time-to-event rather than matching "rate" as binary.
_TIME_TO_EVENT_TERMS = [
    "overall survival",
    "progression-free survival",
    "event-free survival",
    "disease-free survival",
    "recurrence-free survival",
    "time to progression",
    "duration of response",
]
_BINARY_TERMS = [
    "objective response rate",
    "overall response rate",
    "complete response rate",
    "remission rate",
    "response rate",
]
_CONTINUOUS_TERMS = [
    "change in",
    "biomarker level",
    "symptom score",
    "disease score",
]


def classify_endpoint_type(endpoint_label: str) -> EndpointType | None:
    """BUILD_BRIEF.txt §27. Returns None rather than guessing when the label
    doesn't match a known pattern — an unclassified endpoint should read as
    unclassified in the UI, not silently default to one bucket."""
    label = endpoint_label.lower()
    for term in _TIME_TO_EVENT_TERMS:
        if term in label:
            return EndpointType.TIME_TO_EVENT
    for term in _BINARY_TERMS:
        if term in label:
            return EndpointType.BINARY
    for term in _CONTINUOUS_TERMS:
        if term in label:
            return EndpointType.CONTINUOUS
    return None


# ---------------------------------------------------------------------------
# Sample size / evaluable population
# ---------------------------------------------------------------------------

_SAMPLE_SIZE_PATTERNS = [
    re.compile(r"\bn\s*=\s*(\d+)\b", re.IGNORECASE),
    re.compile(r"\bamong\s+the\s+(\d+)\s+patients?\b", re.IGNORECASE),
    re.compile(r"\b(\d+)\s+patients?\s+(?:were\s+)?(?:treated|enrolled)\b", re.IGNORECASE),
]


def extract_sample_size(text: str) -> int | None:
    """First confident match wins — this is meant for short readout/abstract
    text with one clearly stated enrollment figure, not for reconciling
    multiple different patient counts mentioned in a longer document."""
    for pattern in _SAMPLE_SIZE_PATTERNS:
        match = pattern.search(text)
        if match:
            return int(match.group(1))
    return None


# ---------------------------------------------------------------------------
# §34: ORR — never a bare percentage, denominator required
# ---------------------------------------------------------------------------

_ORR_FRACTION_PATTERN = re.compile(
    r"\b(\d+)\s*(?:/|of)\s*(\d+)\s*(?:evaluable\s+)?patients?\b", re.IGNORECASE
)


@dataclass
class ORRResult:
    responders: int
    evaluable: int

    @property
    def percentage(self) -> float:
        return round(self.responders / self.evaluable * 100, 1)

    @property
    def display(self) -> str:
        """BUILD_BRIEF.txt §34: '12 of 20 evaluable patients' — the
        percentage is secondary, shown after, never alone."""
        return f"{self.responders} of {self.evaluable} evaluable patients (ORR {self.percentage}%)"


def parse_orr(text: str) -> ORRResult | None:
    """Requires an explicit 'N of M' / 'N/M' fraction in the text. A
    percentage alone (even paired with a separately-stated sample size) is
    not enough — see this module's docstring for why."""
    match = _ORR_FRACTION_PATTERN.search(text)
    if not match:
        return None
    responders, evaluable = int(match.group(1)), int(match.group(2))
    if evaluable <= 0 or responders > evaluable:
        return None
    return ORRResult(responders=responders, evaluable=evaluable)


def format_orr_display(responders: int, evaluable: int) -> str:
    """For callers that already have both numbers (e.g. from Phase 5
    extraction or manual entry) and just need the correctly-ordered display
    string, without going through parse_orr's text-matching."""
    if evaluable <= 0:
        raise ValueError("evaluable population must be positive")
    if responders < 0 or responders > evaluable:
        raise ValueError("responders must be between 0 and evaluable")
    return ORRResult(responders=responders, evaluable=evaluable).display


# ---------------------------------------------------------------------------
# §31: confidence intervals
# ---------------------------------------------------------------------------

_CI_PATTERN = re.compile(
    r"(\d+)%?\s*CI[,:]?\s*(-?\d+(?:\.\d+)?)\s*(?:to|-|–|,)\s*(-?\d+(?:\.\d+)?|not reached)",
    re.IGNORECASE,
)

CI_MISINTERPRETATION_WARNING = (
    "A 95% confidence interval does not mean there is a 95% probability the true value falls "
    "in this range — it describes how the estimate would vary across repeated studies."
)


@dataclass
class ConfidenceInterval:
    level: int
    low: float
    high: float | None  # None means "not reached" (common for DOR/OS upper bounds)

    @property
    def display(self) -> str:
        high_str = "not reached" if self.high is None else str(self.high)
        return f"{self.level}% CI: {self.low} to {high_str}"


def parse_confidence_interval(text: str) -> ConfidenceInterval | None:
    match = _CI_PATTERN.search(text)
    if not match:
        return None
    level = int(match.group(1))
    low = float(match.group(2))
    high_raw = match.group(3)
    high = None if high_raw.lower() == "not reached" else float(high_raw)
    if high is not None and high < low:
        raise ValueError(
            f"CI upper bound ({high}) is less than lower bound ({low}) — malformed input"
        )
    return ConfidenceInterval(level=level, low=low, high=high)


# ---------------------------------------------------------------------------
# §33: hazard ratio — correct plain-language framing
# ---------------------------------------------------------------------------


def frame_hazard_ratio(hr: float, *, event_description: str = "progression or death") -> str:
    """BUILD_BRIEF.txt §33. Never '% of patients saved' or 'lived X% longer'
    — the brief calls out both as specifically incorrect. This always frames
    in terms of instantaneous hazard, matching the brief's own example."""
    if hr <= 0:
        raise ValueError("hazard ratio must be positive")
    if hr < 1:
        change_pct = round((1 - hr) * 100, 1)
        direction = "lower"
    elif hr > 1:
        change_pct = round((hr - 1) * 100, 1)
        direction = "higher"
    else:
        return (
            f"The treatment and comparator groups had statistically equivalent instantaneous "
            f"hazards of {event_description} over the analyzed period."
        )
    return (
        f"The treatment group experienced an estimated {change_pct}% {direction} instantaneous "
        f"hazard of {event_description} over the analyzed period."
    )


# ---------------------------------------------------------------------------
# §26/§30: p-values — never auto-framed as success, interim thresholds
# ---------------------------------------------------------------------------

INTERIM_THRESHOLD_UNAVAILABLE_WARNING = (
    "The appropriate interim significance threshold was not available from the reviewed sources."
)


@dataclass
class PValueResult:
    value: float
    is_interim_analysis: bool = False
    has_prespecified_boundary: bool = False

    def display(self) -> str:
        """Deliberately returns only the raw value — never 'significant' /
        'not significant' / 'success'. BUILD_BRIEF.txt §26's absolute rule:
        no p < 0.05 = success collapse anywhere in the app."""
        if self.is_interim_analysis and not self.has_prespecified_boundary:
            return f"p = {self.value} ({INTERIM_THRESHOLD_UNAVAILABLE_WARNING})"
        return f"p = {self.value}"


# ---------------------------------------------------------------------------
# §28: primary / secondary / exploratory endpoint labeling
# ---------------------------------------------------------------------------

# Exploratory checked first: "post hoc" text often also mentions "secondary"
# nearby (e.g. "a post hoc analysis of the secondary endpoint..."), and post
# hoc status should win — it's the stronger signal that inferential weight
# should be low, per §28's "do not treat them equally."
_EXPLORATORY_MARKERS = ["exploratory endpoint", "exploratory analysis", "post hoc", "post-hoc"]
_SECONDARY_MARKERS = ["key secondary endpoint", "secondary endpoint", "secondary outcome"]
_PRIMARY_MARKERS = ["primary endpoint", "primary outcome"]


def classify_endpoint_role(text: str) -> EndpointRole | None:
    lowered = text.lower()
    if any(marker in lowered for marker in _EXPLORATORY_MARKERS):
        return EndpointRole.EXPLORATORY
    if any(marker in lowered for marker in _SECONDARY_MARKERS):
        return EndpointRole.SECONDARY
    if any(marker in lowered for marker in _PRIMARY_MARKERS):
        return EndpointRole.PRIMARY
    return None


# ---------------------------------------------------------------------------
# §36: single-arm trial warning
# ---------------------------------------------------------------------------

SINGLE_ARM_WARNING = "This trial does not contain a concurrent control group."
CROSS_TRIAL_COMPARISON_WARNING = (
    "Cross-trial comparison is approximate because patient populations, eligibility, "
    "assessment timing, and trial methods may differ."
)

_SINGLE_ARM_MARKERS = ["single-arm", "single arm", "one-arm", "uncontrolled"]


def detect_single_arm(text: str) -> bool:
    lowered = text.lower()
    return any(marker in lowered for marker in _SINGLE_ARM_MARKERS)


def single_arm_warning(is_single_arm: bool) -> str | None:
    return SINGLE_ARM_WARNING if is_single_arm else None
