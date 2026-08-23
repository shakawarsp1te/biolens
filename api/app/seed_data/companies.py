"""
Seed data for the new server-side company store (app/services/company_store.py).

The first 4 entries (Janux, Cardiff, Erasca, Xencor) are transcribed
verbatim from the old app/mocks/companyProfile.ts + discoveryCards.ts --
same facts, same wording, just moved here so they're served by the API
instead of baked into the mobile bundle. No new research went into those 4
beyond what was already verified.

The next 6 (IDEAYA, Relay, Nuvation Bio, Kura Oncology, Zentalis, Arvinas)
were already individually verified as real, currently-independent,
actively-trading companies during the original Phase 2 research pass
(api/db/seed/oncology_seed.sql) but never got a full profile built out --
that's done here now, researched fresh via WebSearch on Aug 23, 2026 so the
clinical/regulatory facts are current as of that date, not the Phase 2
snapshot.

Frontier Scores here are BioLens's own qualitative estimates (same status
as the original 4's scores) -- the real component-weighted formula lives in
api/app/services/frontier_score.py; wiring these to it exactly would need
each component (clinical momentum, scientific novelty, evidence maturity,
catalyst activity, strategic validation) scored individually per company,
which is future work, not invented here.
"""

from __future__ import annotations

_NOW = "2026-08-23T00:00:00+00:00"


def _company(**kwargs) -> dict:
    return {
        "isMockData": True,
        "reviewStatus": "verified",
        "source": "manual_research",
        "createdAt": _NOW,
        "updatedAt": _NOW,
        "lastVerifiedAt": _NOW,
        **kwargs,
    }


COMPANIES: list[dict] = [
    _company(
        id="janux-therapeutics",
        name="Janux Therapeutics",
        ticker="JANX",
        status="Emerging clinical-stage biotech",
        primaryFocus="Oncology",
        technology="Tumor-activated immunotherapy (TRACTr platform)",
        biolensSummary=(
            "Janux Therapeutics develops tumor-activated T-cell engagers (TRACTr) designed to stay "
            "inactive until they reach tumor tissue, aiming to widen the therapeutic window that has "
            "limited earlier bispecific antibodies. Its lead program, JANX007, has shown encouraging "
            "early anti-tumor activity in metastatic castration-resistant prostate cancer with a "
            "manageable safety profile. Near-term success depends on whether that activity holds up in "
            "the larger Phase 1b expansion and, eventually, a randomized trial."
        ),
        whyItMatters=[
            "The company's valuation is heavily influenced by the clinical development of its lead "
            "program, JANX007, in prostate cancer.",
            "Early clinical evidence could validate Janux's tumor-activated T-cell engager platform "
            "more broadly, not just this one drug.",
            "The major remaining uncertainty is whether the anti-tumor activity observed in early "
            "patients persists across larger cohorts without unacceptable toxicity.",
            "The company's second program, targeting a different tumor antigen, was discontinued in "
            "2026 after Phase 1 data proved insufficient — a reminder that platform breadth doesn't "
            "guarantee every program succeeds.",
        ],
        pipeline=[
            {
                "drugId": "janx007",
                "drugName": "JANX007",
                "target": "PSMA",
                "modality": "Tumor-activated bispecific antibody (TRACTr)",
                "disease": "Metastatic castration-resistant prostate cancer",
                "stage": "Phase I",
                "trialIds": ["NCT05519449"],
                "nextMilestone": "Phase 1b expansion dose-regimen data",
            }
        ],
        thesisMap={
            "whatHasToGoRight": [
                "JANX007's early anti-tumor activity needs to hold up as the evaluable population grows.",
                "Cytokine-release and other on-target toxicities must stay manageable at the selected "
                "once-weekly step-dose regimens.",
                "Response durability needs to improve or persist with longer follow-up.",
                "The Phase 1b expansion needs to confirm what Phase 1a suggested before a "
                "registrational trial can be designed.",
                "Competing PSMA-directed therapies (radioligands, other T-cell engagers) can't "
                "materially outperform JANX007 on efficacy or tolerability.",
            ],
            "whatCouldGoWrong": [
                "Response rate falls as more patients are enrolled — a common pattern when early data "
                "comes from a small, possibly favorable-risk group.",
                "Adverse events limit how high the dose can safely go, capping efficacy.",
                "A competing PSMA-targeted therapy reaches later-stage data first.",
                "Trial design choices (single-arm, small cohorts) produce data that's hard to "
                "interpret cleanly.",
                "Financing needs increase if the path to registration lengthens — irrelevant to the "
                "science, but relevant to whether the program keeps moving.",
            ],
        },
        confidence="moderate",
        frontierScore=61,
        whyItSurfaced=[
            "Encouraging Phase I anti-tumor activity in mCRPC",
            "Phase 1b expansion dose-regimen data expected next",
            "Targets PSMA via a tumor-activated engager platform",
        ],
        oneSentenceSummary=(
            "Janux is developing JANX007, a tumor-activated T-cell engager designed to widen the "
            "therapeutic window versus earlier PSMA bispecifics."
        ),
        keyRisk=(
            "The company's second program was discontinued after Phase I data proved insufficient, "
            "narrowing the near-term thesis to one asset."
        ),
        therapeuticArea="Oncology",
        stage="Phase I",
        maturity="emerging",
        modalities=["Tumor-activated bispecific antibody (TRACTr)"],
        targets=["PSMA"],
    ),
    _company(
        id="cardiff-oncology",
        name="Cardiff Oncology",
        ticker="CRDF",
        status="Emerging clinical-stage biotech (single-asset)",
        primaryFocus="Oncology",
        technology="PLK1 inhibition (onvansertib)",
        biolensSummary=(
            "Cardiff Oncology is a single-asset biotech developing onvansertib, an oral PLK1 "
            "inhibitor, in combination regimens for RAS-mutated colorectal cancer. Its CRDF-004 trial "
            "reported a 72.2% response rate combining onvansertib with FOLFIRI and bevacizumab in "
            "first-line metastatic colorectal cancer — a notably high number for a single-arm cohort. "
            "Near-term success depends on whether that result can be confirmed in a larger or "
            "randomized trial design, since no concurrent control arm exists yet."
        ),
        whyItMatters=[
            "The company's valuation rests almost entirely on the clinical development of "
            "onvansertib, its only clinical-stage asset.",
            "The reported 72.2% response rate in first-line RAS-mutated metastatic colorectal cancer "
            "is unusually high for this setting — exactly why it needs to be read cautiously rather "
            "than at face value.",
            "The major remaining uncertainty is whether this single-arm result would hold up against "
            "a concurrent control arm, since no randomized comparison exists yet.",
            "As a single-asset company, any safety, efficacy, or regulatory setback for onvansertib "
            "affects the entire company at once — there is no second program to fall back on.",
        ],
        pipeline=[
            {
                "drugId": "onvansertib",
                "drugName": "Onvansertib",
                "target": "PLK1",
                "modality": "PLK1 inhibitor (small molecule)",
                "disease": "First-line RAS-mutated metastatic colorectal cancer",
                "stage": "Phase II",
                "trialIds": ["NCT06106308"],
                "nextMilestone": "Registrational trial design following CRDF-004 data",
            }
        ],
        thesisMap={
            "whatHasToGoRight": [
                "The 72.2% response rate needs to be reproduced in a larger, ideally randomized "
                "population before it can be treated as a reliable estimate.",
                "Duration of response needs to be meaningful — a high response rate that fades "
                "quickly is a weaker signal than the topline number suggests.",
                "Grade 3/4 toxicity needs to stay manageable at the selected dose as more patients "
                "are treated.",
                "Regulators need to agree that this single-arm data, or a follow-up randomized trial, "
                "is sufficient for a registrational pathway.",
                "Competing therapies for RAS-mutated metastatic colorectal cancer can't materially "
                "outperform onvansertib combinations before Cardiff reaches later-stage data.",
            ],
            "whatCouldGoWrong": [
                "Response rate regresses toward historical norms as the evaluable population grows — "
                "a common pattern for early, favorable-risk cohorts.",
                "A future randomized trial fails to show the same magnitude of benefit over "
                "FOLFIRI/bevacizumab alone.",
                "Toxicity limits the population able to tolerate the combination at an effective dose.",
                "Regulators require a full randomized trial before considering approval, extending "
                "the timeline substantially.",
                "As a single-asset company, financing constraints could force difficult trade-offs "
                "if the registrational path lengthens.",
            ],
        },
        confidence="moderate",
        frontierScore=81,
        whyItSurfaced=[
            "Phase II colorectal cancer results",
            "Lead program advancing toward registrational development",
            "Targets PLK1",
        ],
        oneSentenceSummary=(
            "Cardiff is developing onvansertib as a combination therapy for RAS-mutated metastatic "
            "colorectal cancer."
        ),
        keyRisk="Clinical thesis remains heavily dependent on one lead asset.",
        therapeuticArea="Oncology",
        stage="Phase II",
        maturity="emerging",
        modalities=["PLK1 inhibitor (small molecule)"],
        targets=["PLK1"],
    ),
    _company(
        id="erasca",
        name="Erasca",
        ticker="ERAS",
        status="Emerging clinical-stage biotech",
        primaryFocus="Oncology",
        technology="RAS/MAPK pathway-targeted therapeutics",
        biolensSummary=(
            "Erasca is a precision oncology company built entirely around RAS/MAPK pathway-driven "
            "cancers, running two distinct Phase I programs in parallel: ERAS-0015, a pan-RAS "
            "molecular glue, and ERAS-4001, a pan-KRAS inhibitor. Early dose-escalation data for "
            "ERAS-0015 has shown preliminary activity in KRAS-mutant solid tumors, though both "
            "programs remain in small-cohort, early-stage trials. Near-term success depends on "
            "whether either program's Phase I data is strong enough to justify a "
            "registration-enabling trial design."
        ),
        whyItMatters=[
            "The company's valuation depends on two early-stage RAS-pathway programs advancing "
            "simultaneously, rather than a single de-risked asset.",
            "A pan-RAS or pan-KRAS therapy that works across multiple mutations, rather than one "
            "specific hotspot, would address a broader patient population than mutation-specific "
            "competitors.",
            "The major remaining uncertainty is whether either program's preliminary Phase I "
            "activity translates into a registration-enabling trial design.",
            "Running two RAS-pathway programs at once diversifies platform risk somewhat, but both "
            "still depend on the same underlying biological thesis working out.",
        ],
        pipeline=[
            {
                "drugId": "eras-0015",
                "drugName": "ERAS-0015",
                "target": "Pan-RAS",
                "modality": "Molecular glue degrader",
                "disease": "RAS-mutant solid tumors",
                "stage": "Phase I",
                "trialIds": ["NCT06983743"],
                "nextMilestone": "Updated Phase I dose-escalation data",
            },
            {
                "drugId": "eras-4001",
                "drugName": "ERAS-4001",
                "target": "KRAS",
                "modality": "KRAS inhibitor (small molecule)",
                "disease": "KRAS-mutant solid tumors",
                "stage": "Phase I",
                "trialIds": [],
                "nextMilestone": "Preliminary Phase I monotherapy data (2H 2026)",
            },
        ],
        thesisMap={
            "whatHasToGoRight": [
                "ERAS-0015's preliminary activity needs to hold up and deepen as the evaluable "
                "population grows.",
                "ERAS-4001 needs to show it can differentiate from other KRAS-directed therapies "
                "already in development.",
                "Both programs need tolerable safety profiles at doses that also show meaningful "
                "activity.",
                "At least one program needs Phase I data strong enough to support a "
                "registration-enabling trial design.",
                "The pan-RAS/pan-KRAS mechanism needs to actually deliver broader applicability than "
                "mutation-specific competitors, not just in theory.",
            ],
            "whatCouldGoWrong": [
                "Early activity signals shrink as more patients are enrolled, a common pattern in "
                "small Phase I cohorts.",
                "A mutation-specific competitor (e.g., a KRAS G12C- or G12D-specific inhibitor) "
                "outperforms Erasca's broader-spectrum approach in its narrower population.",
                "Running two similar-mechanism RAS programs at once splits management and financial "
                "resources rather than truly diversifying risk.",
                "Toxicity tied to broader RAS-pathway inhibition (rather than a single mutation) "
                "limits the tolerable dose.",
                "Neither program reaches a registration-enabling design before financing runway "
                "becomes a constraint.",
            ],
        },
        confidence="low",
        frontierScore=68,
        whyItSurfaced=[
            "Two distinct RAS-pathway programs in Phase I simultaneously (ERAS-0015, ERAS-4001)",
            "Positive preliminary dose-escalation data disclosed for the lead molecular glue",
            "Targets the broad RAS family rather than one hotspot mutation",
        ],
        oneSentenceSummary=(
            "Erasca is a precision oncology company singularly focused on RAS/MAPK pathway-driven "
            "cancers, running a pan-RAS molecular glue and a pan-KRAS inhibitor in parallel."
        ),
        keyRisk=(
            "Both lead programs are still Phase I — neither has produced registration-directed data "
            "yet, so the platform thesis remains unproven in later-stage trials."
        ),
        therapeuticArea="Oncology",
        stage="Phase I",
        maturity="emerging",
        modalities=["Molecular glue degrader", "KRAS inhibitor (small molecule)"],
        targets=["Pan-RAS", "KRAS"],
    ),
    _company(
        id="xencor",
        name="Xencor",
        ticker="XNCR",
        status="Emerging clinical-stage biotech (shifting to wholly-owned pipeline)",
        primaryFocus="Oncology",
        technology="XmAb bispecific antibody engineering platform",
        biolensSummary=(
            "Xencor's XmAb platform engineers bispecific antibodies, and the company is now "
            "advancing two wholly-owned, first-in-class T-cell engagers in oncology: XmAb819, "
            "targeting ENPP3 in clear cell renal cell carcinoma, and XmAb541, targeting CLDN6 in "
            "gynecologic and germ cell tumors. Both remain in Phase I dose escalation, though XmAb541 "
            "has already shown confirmed partial responses in ovarian cancer and germ cell tumor "
            "patients. Near-term success depends on whether either program's early activity holds up "
            "as dosing expands and a recommended Phase 2 dose can be identified with a manageable "
            "safety profile."
        ),
        whyItMatters=[
            "Xencor's shift from a licensing-heavy business model toward wholly-owned assets changes "
            "how much of any future success accrues to the company directly.",
            "Confirmed partial responses in XmAb541's early dose-escalation cohort are a genuine "
            "early efficacy signal, though from a very small number of patients.",
            "The major remaining uncertainty is whether either bispecific's activity and "
            "tolerability profile hold up as the dose-escalation cohorts expand.",
            "As a platform company with a broader historical partnered pipeline, this profile covers "
            "only Xencor's wholly-owned oncology programs, not the company as a whole.",
        ],
        pipeline=[
            {
                "drugId": "xmab819",
                "drugName": "XmAb819",
                "target": "ENPP3",
                "modality": "Bispecific T-cell engaging antibody (XmAb 2+1)",
                "disease": "Advanced clear cell renal cell carcinoma",
                "stage": "Phase I",
                "trialIds": ["NCT05433142"],
                "nextMilestone": "Recommended Phase 3 dose data (2H 2026)",
            },
            {
                "drugId": "xmab541",
                "drugName": "XmAb541",
                "target": "CLDN6",
                "modality": "Bispecific T-cell engaging antibody (XmAb 2+1)",
                "disease": "Advanced gynecologic and germ cell tumors",
                "stage": "Phase I",
                "trialIds": ["NCT06276491"],
                "nextMilestone": "Expanded dose-escalation data",
            },
        ],
        thesisMap={
            "whatHasToGoRight": [
                "XmAb541's confirmed partial responses need to persist and extend to more patients "
                "as enrollment continues.",
                "XmAb819 needs to show a clear efficacy signal in ccRCC to justify advancing toward "
                "a pivotal study.",
                "Both bispecifics need tolerable safety profiles (including cytokine-release risk, "
                "common to T-cell engagers) at doses that also show activity.",
                "A recommended Phase 2/3 dose needs to be identified for at least one program before "
                "a pivotal trial can be designed.",
                "Xencor's broader wholly-owned-pipeline strategy needs enough capital runway to carry "
                "these programs through Phase I without needing a new partnership.",
            ],
            "whatCouldGoWrong": [
                "Confirmed responses don't extend beyond the small number of patients already "
                "reported.",
                "Cytokine-release syndrome or other on-target toxicity limits how high the dose can "
                "go, capping efficacy.",
                "A competing bispecific or cell therapy targeting the same antigens reaches "
                "later-stage data first.",
                "Xencor licenses one or both programs to a partner before pivotal data, changing how "
                "much of any future success the company itself captures.",
                "Financing constraints slow enrollment or force prioritization between the two "
                "programs.",
            ],
        },
        confidence="low",
        frontierScore=58,
        whyItSurfaced=[
            "Two first-in-class bispecific T-cell engagers in Phase I (XmAb819, XmAb541)",
            "Confirmed partial responses already observed in the XmAb541 dose-escalation cohort",
            "Shifting toward a wholly-owned pipeline rather than pure licensing",
        ],
        oneSentenceSummary=(
            "Xencor's XmAb bispecific-antibody platform is advancing two novel T-cell engagers — one "
            "targeting ENPP3 in kidney cancer, one targeting CLDN6 in gynecologic and germ cell "
            "tumors."
        ),
        keyRisk=(
            "Both programs are early Phase I dose-escalation — durability, tolerability at higher "
            "doses, and a path to a pivotal trial are all still unknown."
        ),
        therapeuticArea="Oncology",
        stage="Phase I",
        maturity="emerging",
        modalities=["Bispecific T-cell engaging antibody (XmAb 2+1)"],
        targets=["ENPP3", "CLDN6"],
    ),
    _company(
        id="ideaya-biosciences",
        name="IDEAYA Biosciences",
        ticker="IDYA",
        status="Clinical-stage biotech nearing its first approval",
        primaryFocus="Oncology",
        technology="Precision oncology (PKC inhibition + synthetic lethality)",
        biolensSummary=(
            "IDEAYA Biosciences' lead program pairs darovasertib, a PKC inhibitor, with the "
            "already-approved ALK/ROS1 inhibitor crizotinib for GNAQ/11-mutant uveal melanoma, the "
            "most common eye cancer in adults. Its registrational Phase 2/3 OptimUM-02 trial met its "
            "primary endpoint in first-line, HLA-A*02:01-negative metastatic patients — a median "
            "6.9-month progression-free survival versus 3.1 months for investigator's choice, with a "
            "37.1% response rate versus 5.8% and five complete responses. IDEAYA plans to file for "
            "accelerated U.S. approval in the second half of 2026, and near-term success depends on "
            "whether regulators accept this single randomized trial as sufficient."
        ),
        whyItMatters=[
            "OptimUM-02 is one of the very few randomized, positive Phase 2/3 trials in uveal "
            "melanoma, a disease with no FDA-approved systemic therapy today.",
            "The benefit was measured only in the HLA-A*02:01-negative subgroup — patients who are "
            "HLA-A*02:01-positive are being studied in a separate trial (OptimUM-01) and aren't "
            "covered by this result.",
            "The combination partner, crizotinib, is an older, off-patent drug — a real commercial "
            "consideration once darovasertib itself is priced and launched.",
            "A second program, IDE849, is advancing in parallel, giving the company more than one "
            "shot on goal even as darovasertib heads toward its first filing.",
        ],
        pipeline=[
            {
                "drugId": "darovasertib",
                "drugName": "Darovasertib + crizotinib",
                "target": "PKC (Protein Kinase C)",
                "modality": "PKC inhibitor (small molecule) + approved ALK/ROS1 inhibitor combination",
                "disease": "First-line, HLA-A*02:01-negative metastatic uveal melanoma",
                "stage": "Phase II/III",
                "trialIds": ["NCT05987332"],
                "nextMilestone": "NDA submission for U.S. accelerated approval (2H 2026)",
            }
        ],
        thesisMap={
            "whatHasToGoRight": [
                "The FDA needs to accept OptimUM-02's single randomized trial, plus its 5.8-month "
                "PFS margin, as sufficient for accelerated approval.",
                "The response needs to be durable, not just a PFS delay that doesn't translate into "
                "meaningful time gained for patients.",
                "The combination's safety profile needs to remain acceptable as more patients are "
                "treated commercially, not just in a controlled trial.",
                "Uveal melanoma's small patient population needs to support a viable commercial "
                "launch despite crizotinib's generic status.",
                "The HLA-A*02:01-positive population (OptimUM-01) needs its own path forward even "
                "though it's excluded from this filing.",
            ],
            "whatCouldGoWrong": [
                "The FDA requests a second confirmatory trial before granting accelerated approval, "
                "delaying the launch by years.",
                "Real-world durability falls short of the trial's reported 6.9-month median PFS.",
                "Pricing and reimbursement prove difficult given a low-cost generic combination "
                "partner.",
                "A confirmatory trial (required post-accelerated-approval) fails to verify the "
                "benefit, risking withdrawal.",
                "IDE849 or other pipeline programs draw resources away from darovasertib's launch "
                "preparation.",
            ],
        },
        confidence="moderate",
        frontierScore=84,
        whyItSurfaced=[
            "Registrational Phase 2/3 trial met its primary endpoint with a highly significant result",
            "NDA submission planned for the second half of 2026",
            "First potential systemic therapy approved specifically for uveal melanoma",
        ],
        oneSentenceSummary=(
            "IDEAYA's darovasertib plus crizotinib combination met its primary endpoint in a "
            "registrational trial for uveal melanoma and is headed toward an accelerated-approval "
            "filing."
        ),
        keyRisk=(
            "The reported benefit applies only to one HLA subgroup, and accelerated approval still "
            "requires a post-approval confirmatory trial to succeed."
        ),
        therapeuticArea="Oncology",
        stage="Phase II/III",
        maturity="emerging",
        modalities=["PKC inhibitor (small molecule)", "Approved ALK/ROS1 inhibitor (repurposed)"],
        targets=["PKC"],
    ),
    _company(
        id="relay-therapeutics",
        name="Relay Therapeutics",
        ticker="RLAY",
        status="Emerging clinical-stage biotech",
        primaryFocus="Oncology",
        technology="Structure/motion-based drug design (Dynamo platform)",
        biolensSummary=(
            "Relay Therapeutics uses computational modeling of protein motion (its Dynamo platform) "
            "to design mutant-selective cancer drugs, and its lead molecule, zovegalisib (RLY-2608), "
            "is the first pan-mutant-selective PI3Kα inhibitor to reach the clinic. Earlier-phase "
            "data paired with fulvestrant showed an 11.4-month median progression-free survival in "
            "previously-treated, PIK3CA-mutant HR+/HER2- metastatic breast cancer. The company is now "
            "running a Phase 3 trial (ReDiscover-2) testing zovegalisib head-to-head against "
            "capivasertib, an already-approved competitor, rather than against placebo or "
            "chemotherapy alone."
        ),
        whyItMatters=[
            "Zovegalisib is designed to spare normal (wild-type) PI3Kα, aiming to avoid the "
            "hyperglycemia and other toxicities that have limited earlier, non-selective PI3K "
            "inhibitors.",
            "ReDiscover-2 compares zovegalisib directly against capivasertib, a drug already on the "
            "market for the same population — a genuinely harder bar than most Phase 3 trials, which "
            "compare against placebo or chemotherapy.",
            "The company's computational Dynamo platform is itself part of the thesis: if "
            "zovegalisib succeeds, it validates the platform for future programs, not just this one "
            "molecule.",
            "The major remaining uncertainty is whether a head-to-head win over an approved "
            "competitor is achievable, since capivasertib already has real efficacy of its own.",
        ],
        pipeline=[
            {
                "drugId": "zovegalisib",
                "drugName": "Zovegalisib (RLY-2608)",
                "target": "PI3Kα (mutant-selective)",
                "modality": "Mutant-selective PI3Kα inhibitor (small molecule)",
                "disease": "PIK3CA-mutant, HR+/HER2- metastatic breast cancer",
                "stage": "Phase III",
                "trialIds": ["NCT06982521"],
                "nextMilestone": "ReDiscover-2 head-to-head readout versus capivasertib",
            }
        ],
        thesisMap={
            "whatHasToGoRight": [
                "Zovegalisib needs to beat capivasertib on progression-free survival, not just match "
                "it, to differentiate commercially.",
                "The mutant-selectivity needs to translate into a real tolerability advantage doctors "
                "and patients notice, not just a theoretical one.",
                "The 11.4-month PFS seen in earlier-phase data needs to hold up in a larger, "
                "randomized, blinded Phase 3 population.",
                "Regulatory and payer acceptance needs to follow if the trial succeeds, given "
                "capivasertib is already reimbursed and established.",
                "The Dynamo platform's other earlier-stage programs need enough capital runway while "
                "ReDiscover-2 reads out.",
            ],
            "whatCouldGoWrong": [
                "ReDiscover-2 fails to beat capivasertib, since head-to-head trials against an active, "
                "effective comparator are harder to win than placebo-controlled ones.",
                "Selectivity advantages seen preclinically don't produce a meaningfully better "
                "tolerability profile in practice.",
                "A more advanced or differently-targeted competitor reaches the same population first.",
                "Financing constraints force the company to prioritize zovegalisib over other Dynamo "
                "programs before the readout.",
                "Even a positive result shows only a marginal improvement over capivasertib, limiting "
                "commercial differentiation.",
            ],
        },
        confidence="moderate",
        frontierScore=72,
        whyItSurfaced=[
            "Phase 3 head-to-head trial against an already-approved competitor, not just placebo",
            "First pan-mutant-selective PI3Kα inhibitor to reach this stage of development",
            "Earlier-phase data showed an 11.4-month median PFS in previously-treated patients",
        ],
        oneSentenceSummary=(
            "Relay is running a Phase 3 head-to-head trial of zovegalisib, a mutant-selective PI3Kα "
            "inhibitor, against an already-approved competitor in PIK3CA-mutant breast cancer."
        ),
        keyRisk=(
            "ReDiscover-2 must beat an active, already-effective comparator rather than placebo — a "
            "meaningfully harder bar than most Phase 3 breast-cancer trials clear."
        ),
        therapeuticArea="Oncology",
        stage="Phase III",
        maturity="emerging",
        modalities=["Mutant-selective PI3Kα inhibitor (small molecule)"],
        targets=["PI3Kα"],
    ),
    _company(
        id="nuvation-bio",
        name="Nuvation Bio",
        ticker="NUVB",
        status="Commercial-stage biotech (single approved product)",
        primaryFocus="Oncology",
        technology="ROS1-selective tyrosine kinase inhibition",
        biolensSummary=(
            "Nuvation Bio's only approved product, IBTROZI (taletrectinib), treats ROS1-positive "
            "non-small-cell lung cancer and has become the most prescribed ROS1 inhibitor for both "
            "newly-diagnosed and previously-treated patients since its 2025 approval, generating "
            "$23.2 million in net product revenue in the second quarter of 2026 alone. The company is "
            "now pursuing a supplemental FDA filing with updated response-duration data and running a "
            "confirmatory Phase 3 trial (TRUST-III) in China. Near-term success depends less on "
            "clinical risk than on continuing to grow prescriptions against a competing ROS1 "
            "inhibitor already on the market."
        ),
        whyItMatters=[
            "IBTROZI is already generating real, growing commercial revenue — a meaningfully "
            "different risk profile than a pre-approval clinical-stage company.",
            "About 85% of new patient starts in Q2 2026 were treatment-naive, suggesting doctors are "
            "reaching for it as a first-choice option, not just a fallback.",
            "A pending supplemental NDA (target action date January 4, 2027) could strengthen the "
            "drug's label with updated duration-of-response data.",
            "The company depends on this one drug for essentially all of its near-term revenue — "
            "there is no second commercial product yet.",
        ],
        pipeline=[
            {
                "drugId": "taletrectinib",
                "drugName": "IBTROZI (taletrectinib)",
                "target": "ROS1",
                "modality": "ROS1 tyrosine kinase inhibitor (small molecule, oral)",
                "disease": "ROS1-positive non-small-cell lung cancer",
                "stage": "Approved",
                "trialIds": ["NCT06564324"],
                "nextMilestone": "TRUST-III confirmatory Phase 3 readout (China) and sNDA decision "
                "(Jan 2027)",
            }
        ],
        thesisMap={
            "whatHasToGoRight": [
                "Prescription growth needs to continue at a similar pace as more oncologists become "
                "familiar with the drug.",
                "The pending supplemental NDA needs to succeed, strengthening the label with updated "
                "durability data.",
                "TRUST-III needs to confirm the drug's benefit in a randomized, China-based "
                "population to support broader international approvals.",
                "International partnerships (with Eisai, among others) need to translate into "
                "meaningful ex-U.S. revenue.",
                "No safety signal should emerge as the treated population grows into the thousands.",
            ],
            "whatCouldGoWrong": [
                "A competing ROS1 inhibitor captures a larger share of new patient starts.",
                "The supplemental NDA is delayed or requires additional data.",
                "TRUST-III fails to confirm efficacy in its randomized, active-comparator design.",
                "Reimbursement or pricing pressure limits revenue growth despite prescription growth.",
                "Since this is the company's only approved product, any safety signal or commercial "
                "setback affects the entire company at once.",
            ],
        },
        confidence="moderate",
        frontierScore=58,
        whyItSurfaced=[
            "Already FDA-approved and generating real, growing quarterly revenue",
            "Most-prescribed ROS1 inhibitor for both new and previously-treated patients in 2026",
            "Supplemental NDA and a confirmatory international Phase 3 trial both in progress",
        ],
        oneSentenceSummary=(
            "Nuvation Bio's approved ROS1 inhibitor IBTROZI is already the most-prescribed drug in "
            "its class, with a supplemental filing and confirmatory trial both underway."
        ),
        keyRisk=(
            "The company depends on this one approved product for essentially all near-term revenue, "
            "with no second commercial asset yet to diversify that risk."
        ),
        therapeuticArea="Oncology",
        stage="Approved",
        maturity="scaling",
        modalities=["ROS1 tyrosine kinase inhibitor (small molecule)"],
        targets=["ROS1"],
    ),
    _company(
        id="kura-oncology",
        name="Kura Oncology",
        ticker="KURA",
        status="Commercial-stage biotech (single approved product)",
        primaryFocus="Oncology",
        technology="Menin inhibition (oral, once-daily)",
        biolensSummary=(
            "Kura Oncology's approved drug KOMZIFTI (ziftomenib), partnered with Kyowa Kirin, is the "
            "first once-daily oral menin inhibitor approved for relapsed or refractory NPM1-mutated "
            "acute myeloid leukemia, generating $20.9 million in second-quarter 2026 revenue against "
            "a $68.3 million net loss as the company continues to invest in expanding its use. A "
            "combination trial (KOMET-008, pairing ziftomenib with gilteritinib) and an exploratory "
            "analysis in MEIS1-associated AML subtypes are both underway. Near-term success depends "
            "on whether combination and expansion data broaden the drug's addressable population "
            "beyond its initial approval."
        ),
        whyItMatters=[
            "KOMZIFTI is a genuinely new mechanism (menin inhibition) with a first-and-only "
            "once-daily oral dosing advantage over other targeted AML therapies.",
            "The company is still spending well beyond its product revenue, meaning continued "
            "commercial ramp-up and pipeline expansion both depend on financing discipline.",
            "KOMET-008's combination data, expected in the second half of 2026, could meaningfully "
            "expand the addressable patient population if positive.",
            "As with any single-product commercial-stage biotech, near-term financial results are "
            "tied almost entirely to this one drug's adoption curve.",
        ],
        pipeline=[
            {
                "drugId": "ziftomenib",
                "drugName": "KOMZIFTI (ziftomenib)",
                "target": "Menin-KMT2A",
                "modality": "Menin inhibitor (small molecule, oral)",
                "disease": "Relapsed/refractory NPM1-mutated acute myeloid leukemia",
                "stage": "Approved",
                "trialIds": ["NCT06001788"],
                "nextMilestone": "KOMET-008 combination data with gilteritinib (2H 2026)",
            }
        ],
        thesisMap={
            "whatHasToGoRight": [
                "Commercial adoption needs to keep growing quarter over quarter as more centers adopt "
                "ziftomenib into their AML treatment algorithms.",
                "KOMET-008's combination data needs to show a meaningful benefit over ziftomenib "
                "alone.",
                "The exploratory MEIS1-associated AML analysis needs to identify a real, addressable "
                "expansion population.",
                "The Kyowa Kirin partnership needs to keep supporting commercial infrastructure "
                "efficiently as the launch matures.",
                "Net losses need to narrow as revenue scales, rather than requiring repeated new "
                "financing.",
            ],
            "whatCouldGoWrong": [
                "Adoption plateaus below what's needed to reach profitability on a reasonable "
                "timeline.",
                "KOMET-008 combination data disappoints, narrowing the drug's growth path to its "
                "original approved population only.",
                "A competing menin inhibitor or alternative AML therapy erodes market share.",
                "Continued high cash burn forces dilutive financing or program prioritization.",
                "Safety signals emerge as the treated population grows beyond the original trial "
                "population.",
            ],
        },
        confidence="moderate",
        frontierScore=60,
        whyItSurfaced=[
            "First and only once-daily oral menin inhibitor approved for NPM1-mutated AML",
            "Active combination trial expected to read out in the second half of 2026",
            "Exploratory analysis could expand the addressable AML population",
        ],
        oneSentenceSummary=(
            "Kura Oncology's approved menin inhibitor KOMZIFTI is expanding into combination "
            "regimens and broader AML subtypes beyond its initial approval."
        ),
        keyRisk=(
            "The company still spends well beyond its product revenue, so continued commercial "
            "ramp-up and pipeline expansion both depend on financing discipline."
        ),
        therapeuticArea="Oncology",
        stage="Approved",
        maturity="scaling",
        modalities=["Menin inhibitor (small molecule)"],
        targets=["Menin-KMT2A"],
    ),
    _company(
        id="zentalis-pharmaceuticals",
        name="Zentalis Pharmaceuticals",
        ticker="ZNTL",
        status="Clinical-stage biotech (registrational-stage lead asset)",
        primaryFocus="Oncology",
        technology="WEE1 inhibition (cell-cycle checkpoint)",
        biolensSummary=(
            "Zentalis Pharmaceuticals is a single-asset, DNA-damage-repair-focused biotech advancing "
            "azenosertib, an oral WEE1 inhibitor, in Cyclin E1-positive platinum-resistant ovarian "
            "cancer. The company dosed its first patient in the confirmatory Phase 3 ASPENOVA trial "
            "(420 patients, versus investigator's choice chemotherapy) in May 2026, alongside an "
            "ongoing Phase 2 trial (DENALI) whose topline data is expected by year-end 2026 to support "
            "a potential accelerated approval. Near-term success depends on whether DENALI's data is "
            "strong enough to support that accelerated filing while ASPENOVA continues toward full "
            "approval."
        ),
        whyItMatters=[
            "Azenosertib would be a first-in-class WEE1 inhibitor if approved — no WEE1-targeted "
            "therapy is approved in oncology today.",
            "The two-trial structure (DENALI for accelerated approval, ASPENOVA to confirm it) is a "
            "deliberate regulatory strategy, not a fallback plan — both need to succeed for the "
            "fastest path to market.",
            "As a single-asset company, Zentalis's near-term value depends almost entirely on "
            "azenosertib succeeding in this one indication.",
            "Cyclin E1 positivity is a biomarker-selected population, meaning the trial specifically "
            "targets patients most likely to benefit — a more precise, but also smaller, addressable "
            "population.",
        ],
        pipeline=[
            {
                "drugId": "azenosertib",
                "drugName": "Azenosertib",
                "target": "WEE1",
                "modality": "WEE1 inhibitor (small molecule, oral)",
                "disease": "Cyclin E1-positive platinum-resistant ovarian cancer",
                "stage": "Phase III",
                "trialIds": ["NCT07546500"],
                "nextMilestone": "DENALI Phase 2 topline data supporting accelerated approval (2H 2026)",
            }
        ],
        thesisMap={
            "whatHasToGoRight": [
                "DENALI's Phase 2 topline data needs to be strong enough to support an accelerated "
                "approval filing later this year.",
                "ASPENOVA needs to confirm that benefit in a larger, randomized, controlled "
                "population to convert to full approval.",
                "Azenosertib's safety profile needs to remain manageable as more patients are dosed "
                "across both trials.",
                "The Cyclin E1 biomarker needs to reliably identify patients who actually benefit, "
                "supporting a viable commercial diagnostic-plus-drug launch.",
                "Regulators need to agree the accelerated-then-confirmatory structure is appropriate "
                "for this indication.",
            ],
            "whatCouldGoWrong": [
                "DENALI's data falls short of what's needed to support an accelerated filing.",
                "ASPENOVA fails to confirm the benefit seen in DENALI, a recurring risk for "
                "confirmatory trials in oncology.",
                "As a single-asset company, any clinical or regulatory setback affects the entire "
                "company at once.",
                "Toxicity limits the tolerable dose as the treated population expands.",
                "A competing DNA-damage-repair therapy reaches the same biomarker-selected "
                "population first.",
            ],
        },
        confidence="moderate",
        frontierScore=75,
        whyItSurfaced=[
            "Phase 3 confirmatory trial just dosed its first patient",
            "Phase 2 topline data expected by year-end 2026 to support accelerated approval",
            "Would be a first-in-class WEE1 inhibitor if approved",
        ],
        oneSentenceSummary=(
            "Zentalis is advancing azenosertib, a potential first-in-class WEE1 inhibitor, through "
            "parallel accelerated- and full-approval trials in ovarian cancer."
        ),
        keyRisk=(
            "As a single-asset company, Zentalis's near-term value depends almost entirely on "
            "azenosertib succeeding in one biomarker-selected indication."
        ),
        therapeuticArea="Oncology",
        stage="Phase III",
        maturity="emerging",
        modalities=["WEE1 inhibitor (small molecule)"],
        targets=["WEE1"],
    ),
    _company(
        id="arvinas",
        name="Arvinas",
        ticker="ARVN",
        status="Commercial-stage biotech (single approved product, broader PROTAC platform)",
        primaryFocus="Oncology",
        technology="PROTAC targeted protein degradation",
        biolensSummary=(
            "Arvinas pioneered PROTAC targeted protein degradation, and its lead molecule, "
            "vepdegestrant (brand name VEPPANU), became the first-ever approved PROTAC degrader when "
            "the FDA cleared it in May 2026 — ahead of its assigned review deadline — for "
            "ESR1-mutated, ER-positive/HER2-negative advanced breast cancer, developed and "
            "commercialized with Pfizer. The pivotal Phase 3 VERITAC-2 trial showed a clear "
            "progression-free survival benefit specifically in patients with an ESR1 mutation, though "
            "not across the broader trial population. Beyond this approval, the company's earlier-stage "
            "PROTAC pipeline, including a KRAS G12D degrader, determines whether the platform proves "
            "itself beyond this first success."
        ),
        whyItMatters=[
            "VEPPANU is the first PROTAC degrader ever approved by the FDA — a genuine platform "
            "validation, not just a single-drug win.",
            "The Phase 3 benefit was specific to ESR1-mutant patients; the trial did not show benefit "
            "across its full intent-to-treat population, meaning commercial uptake depends on "
            "biomarker testing being routine in practice.",
            "The Pfizer partnership shares both cost and commercial upside, a different risk/reward "
            "profile than a company launching entirely on its own.",
            "Arvinas has separately restructured its business and pipeline priorities around capital "
            "efficiency, underscoring that even a first approval doesn't remove all financial "
            "pressure.",
        ],
        pipeline=[
            {
                "drugId": "vepdegestrant",
                "drugName": "VEPPANU (vepdegestrant)",
                "target": "ER (Estrogen Receptor)",
                "modality": "PROTAC estrogen receptor degrader (oral, once-daily)",
                "disease": "ESR1-mutated, ER+/HER2- advanced or metastatic breast cancer",
                "stage": "Approved",
                "trialIds": ["NCT05654623"],
                "nextMilestone": "Commercial launch ramp-up with Pfizer",
            }
        ],
        thesisMap={
            "whatHasToGoRight": [
                "ESR1 mutation testing needs to become routine practice so the right patients are "
                "identified for VEPPANU.",
                "Commercial uptake with Pfizer needs to ramp efficiently now that approval has been "
                "granted.",
                "The PROTAC platform's earlier pipeline (including the KRAS G12D degrader) needs to "
                "show its own clinical signals, not just ride on vepdegestrant's approval.",
                "Cost discipline from the company's recent restructuring needs to hold as commercial "
                "spending ramps for the launch.",
                "Real-world outcomes need to match the ESR1-mutant subgroup benefit seen in VERITAC-2.",
            ],
            "whatCouldGoWrong": [
                "Biomarker testing rates stay low in community oncology practice, limiting the "
                "addressable, identifiable patient population.",
                "Commercial launch underperforms expectations despite Pfizer's involvement.",
                "Earlier-pipeline PROTAC programs fail to replicate vepdegestrant's success, raising "
                "doubts about the platform's broader applicability.",
                "A competing oral SERD or degrader reaches the same ESR1-mutant population with a "
                "better profile.",
                "Further restructuring becomes necessary if launch revenue ramps slower than planned.",
            ],
        },
        confidence="moderate",
        frontierScore=68,
        whyItSurfaced=[
            "First-ever FDA-approved PROTAC degrader, approved ahead of its review deadline",
            "Partnered commercial launch with Pfizer now underway",
            "Broader PROTAC pipeline (including a KRAS G12D degrader) still to be proven",
        ],
        oneSentenceSummary=(
            "Arvinas's vepdegestrant became the first-ever approved PROTAC degrader, validating the "
            "company's targeted protein degradation platform beyond this one drug."
        ),
        keyRisk=(
            "The approved benefit is specific to ESR1-mutant patients, so commercial success depends "
            "on biomarker testing becoming routine in everyday oncology practice."
        ),
        therapeuticArea="Oncology",
        stage="Approved",
        maturity="scaling",
        modalities=["PROTAC targeted protein degrader (small molecule)"],
        targets=["ER (Estrogen Receptor)"],
    ),
]
