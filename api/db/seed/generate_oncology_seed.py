#!/usr/bin/env python3
"""
Generates db/seed/oncology_seed.sql from the data below.

Phase 2 checklist scope only: real, individually web-search-verified
companies/drugs/targets/trials (entities), NOT trial_results (statistics) —
extracting and framing statistics correctly is Phase 6's job, and seeding
hand-typed numbers here would violate the "every numeric claim traceable to a
source, never fabricated" rule just as much as inventing them from scratch.

Every company was checked (Aug 2026, via web search) for: still independent,
ticker current, program active, not acquired. Every trial's NCT ID was
verified against a real source rather than guessed — where a trial exists but
its exact NCT ID couldn't be confirmed with confidence (ERAS-4001/BOREALIS-1),
nct_id is left null rather than typed from a fuzzy match.

Counts land at 10 companies / 16 drugs / 15 targets / 19 trials rather than
the checklist's round 10/20/10/20 — every row here is real and individually
verified; padding to the exact round numbers would have meant inventing
companies or drugs, which the product's own rules forbid. See the commit
message / PR description for the source list.

Re-run this script (`python3 generate_oncology_seed.py`) after editing the
data below to regenerate oncology_seed.sql.
"""

import uuid
from pathlib import Path

NAMESPACE = uuid.UUID("6ff588e2-6b3b-4f1e-8f6b-0b6e2e1c9a11")  # arbitrary, fixed


def uid(kind: str, name: str) -> str:
    """Deterministic UUID so re-running this script doesn't change IDs."""
    return str(uuid.uuid5(NAMESPACE, f"{kind}:{name}"))


TARGETS = [
    (
        "PSMA",
        "A protein found on the surface of prostate cancer cells that drugs can use as a homing beacon.",
        "Prostate-specific membrane antigen — a cell-surface glycoprotein highly overexpressed on prostate "
        "cancer cells, used as a targeting antigen for T-cell engagers and radioligand therapies.",
    ),
    (
        "PLK1",
        "An enzyme cancer cells rely on to divide; blocking it can stop tumor growth.",
        "Polo-like kinase 1 — a serine/threonine kinase essential for mitotic entry and progression, "
        "frequently overexpressed in RAS-mutated tumors.",
    ),
    (
        "Pan-RAS",
        "A family of proteins that, when mutated, act like a stuck gas pedal telling cells to keep growing.",
        "The RAS family of GTPases (KRAS/NRAS/HRAS) — oncogenic mutations lock RAS in its active, GTP-bound "
        "state, continuously signaling through MAPK/PI3K pathways. 'Pan-RAS' therapies aim to hit multiple "
        "RAS mutants at once rather than one specific hotspot.",
    ),
    (
        "KRAS",
        "The most commonly mutated cancer-driving gene; drugs targeting it aim to shut off its growth signal.",
        "Kirsten rat sarcoma viral oncogene homolog — the most frequently mutated RAS-family member across "
        "human cancers, with hotspot mutations (G12C, G12D, G12V) each requiring differently-shaped inhibitors.",
    ),
    (
        "PKC",
        "A signaling enzyme that, when mutated upstream, drives a rare eye cancer called uveal melanoma.",
        "Protein kinase C — acts downstream of the GNAQ/GNA11 mutations that define most uveal melanomas, "
        "making PKC a druggable node in that pathway.",
    ),
    (
        "DLL3",
        "A protein found almost exclusively on certain lung cancer cells, making it a precise drug target.",
        "Delta-like ligand 3 — a Notch pathway inhibitory ligand aberrantly expressed on the cell surface of "
        "small cell lung cancer and other neuroendocrine tumors, with minimal expression on healthy tissue.",
    ),
    (
        "PI3Kalpha",
        "A growth-signaling enzyme that's frequently mutated in breast cancer.",
        "Phosphoinositide 3-kinase alpha — encoded by PIK3CA, one of the most commonly mutated oncogenes in "
        "HR+/HER2- breast cancer; mutant-selective inhibitors aim to spare the wild-type enzyme elsewhere in "
        "the body.",
    ),
    (
        "NRAS",
        "A RAS-family gene that drives a subset of melanomas and other solid tumors when mutated.",
        "Neuroblastoma RAS viral oncogene homolog — a RAS-family GTPase; NRAS-mutant cancers have historically "
        "lacked a selective inhibitor because NRAS's binding pocket differs subtly from KRAS's.",
    ),
    (
        "ROS1",
        "A growth-signal receptor that, when fused to another gene, can drive lung cancer.",
        "ROS proto-oncogene 1 receptor tyrosine kinase — gene fusions create a constitutively active kinase "
        "that drives a molecular subset of non-small cell lung cancer.",
    ),
    (
        "IDH1",
        "A metabolism enzyme that, when mutated, produces a byproduct that helps brain tumors grow.",
        "Isocitrate dehydrogenase 1 — hotspot mutations (e.g. R132H) produce the oncometabolite "
        "2-hydroxyglutarate, defining a molecular subtype of glioma.",
    ),
    (
        "Menin",
        "A protein certain leukemia cells depend on to keep growing abnormally.",
        "Menin (MEN1 gene product) — an epigenetic scaffolding protein required for the leukemogenic "
        "gene-expression program in NPM1-mutant and KMT2A-rearranged AML; blocking its interaction with "
        "KMT2A shuts that program down.",
    ),
    (
        "Farnesyltransferase",
        "An enzyme that anchors other proteins to the cell membrane so they can signal; blocking it can "
        "misdirect cancer-driving proteins.",
        "Farnesyltransferase — catalyzes farnesylation, a lipid modification required for membrane "
        "localization of RAS and related GTPases; inhibiting it is being explored to weaken RAS-pathway "
        "signaling and overcome resistance to other targeted therapies.",
    ),
    (
        "WEE1",
        "A checkpoint enzyme that gives cancer cells time to repair DNA damage before dividing; blocking it "
        "can force damaged cells to divide and die.",
        "WEE1 kinase — a cell-cycle checkpoint regulator that inhibits CDK1; particularly relevant in tumors "
        "already deficient in other DNA-damage-response pathways, such as Cyclin E1-amplified cancers.",
    ),
    (
        "ENPP3",
        "A protein highly abundant on kidney cancer cells, used to direct immune cells to attack them.",
        "Ectonucleotide pyrophosphatase/phosphodiesterase 3 — highly expressed on clear cell renal cell "
        "carcinoma; used as the tumor-binding arm of a T-cell-engaging bispecific antibody.",
    ),
    (
        "CLDN6",
        "A protein found almost exclusively on certain reproductive-system tumors, not on healthy adult tissue.",
        "Claudin-6 — a tight-junction protein normally restricted to fetal development, re-expressed on "
        "gynecologic and germ cell tumors, making it an attractive target with minimal on-target, "
        "off-tumor risk.",
    ),
]

# (name, ticker, stage, one_liner, verification_source_url)
COMPANIES = [
    (
        "Janux Therapeutics",
        "JANX",
        "Clinical — Phase I",
        "Tumor-activated T-cell engagers (TRACTr platform) designed to stay inactive until they reach tumor "
        "tissue, aiming to widen the therapeutic window versus first-generation bispecifics.",
        "https://www.sec.gov/Archives/edgar/data/0001817713/000119312526338078/janx-20260630.htm",
    ),
    (
        "Cardiff Oncology",
        "CRDF",
        "Clinical — Phase II",
        "Single-asset company advancing onvansertib, a PLK1 inhibitor, in combination regimens for "
        "RAS-mutated colorectal cancer.",
        "https://investors.cardiffoncology.com/news-events/press-releases",
    ),
    (
        "Erasca",
        "ERAS",
        "Clinical — Phase I",
        "Precision oncology company singularly focused on RAS/MAPK pathway-driven cancers.",
        "https://www.globenewswire.com/news-release/2026/08/11/3343134/0/en/erasca-reports-second-quarter-2026-business-updates-and-financial-results.html",
    ),
    (
        "IDEAYA Biosciences",
        "IDYA",
        "Clinical — Phase II/III",
        "Precision-medicine pipeline combining synthetic lethality and antibody-drug conjugates for "
        "molecularly defined solid tumors.",
        "https://media.ideayabio.com/2026-08-04-IDEAYA-Biosciences-Reports-Second-Quarter-2026-Financial-Results-and-Provides-Business-Update",
    ),
    (
        "Relay Therapeutics",
        "RLAY",
        "Clinical — Phase III",
        "Structure/motion-based drug design platform (Dynamo) building mutant-selective oncology inhibitors.",
        "https://ir.relaytx.com/news-releases/news-release-details/relay-therapeutics-announces-zovegalisib-granted-breakthrough",
    ),
    (
        "Nuvation Bio",
        "NUVB",
        "Commercial — 1 approved product",
        "Commercial-stage oncology company with an FDA-approved ROS1 inhibitor and an active early-stage "
        "pipeline.",
        "https://www.morningstar.com/news/pr-newswire/20260806ny20121/nuvation-bio-reports-second-quarter-2026-financial-results-and-provides-business-update",
    ),
    (
        "Kura Oncology",
        "KURA",
        "Commercial — 1 approved product",
        "Commercial-stage precision oncology company targeting menin and farnesyltransferase in leukemias "
        "and solid tumors.",
        "https://ir.kuraoncology.com/news-releases/news-release-details/kura-oncology-highlights-recent-accomplishments-preliminary",
    ),
    (
        "Zentalis Pharmaceuticals",
        "ZNTL",
        "Clinical — Phase III",
        "Single-asset DNA-damage-repair company advancing a WEE1 inhibitor through registrational ovarian "
        "cancer trials.",
        "https://seekingalpha.com/article/4851698-zentalis-pharmaceuticals-late-stage-lots-of-cash-crushed-by-the-market",
    ),
    (
        "Xencor",
        "XNCR",
        "Clinical — Phase I",
        "Bispecific-antibody engineering platform (XmAb) advancing wholly-owned T-cell engagers in solid "
        "tumors.",
        "https://investors.xencor.com/news-releases/news-release-details/xencor-highlights-corporate-priorities-and-2026-pipeline",
    ),
    (
        "Arvinas",
        "ARVN",
        "Clinical — Phase I/II",
        "Pioneer of PROTAC targeted protein degradation, with an FDA-approved breast cancer PROTAC "
        "(licensed out in 2026) and an early KRAS G12D degrader pipeline.",
        "https://ir.arvinas.com/news-releases/news-release-details/arvinas-provides-update-collaboration-pfizer-and-announces",
    ),
]

# (company, drug_name, target, modality, phase, indication, one_liner)
DRUGS = [
    (
        "Janux Therapeutics",
        "JANX007",
        "PSMA",
        "Tumor-activated bispecific antibody (TRACTr)",
        "Phase I",
        "Metastatic castration-resistant prostate cancer",
        "Designed to stay inactive until it reaches tumor tissue, aiming to reduce the cytokine-release "
        "toxicity seen with earlier PSMA bispecifics.",
    ),
    (
        "Cardiff Oncology",
        "Onvansertib",
        "PLK1",
        "PLK1 inhibitor (small molecule)",
        "Phase II",
        "First-line RAS-mutated metastatic colorectal cancer",
        "Oral PLK1 inhibitor evaluated in combination with FOLFIRI/bevacizumab in first-line KRAS/NRAS-mutant "
        "mCRC.",
    ),
    (
        "Erasca",
        "ERAS-0015",
        "Pan-RAS",
        "Molecular glue degrader",
        "Phase I",
        "RAS-mutant solid tumors (pancreatic, lung)",
        "A potentially best-in-class pan-RAS molecular glue designed to work across a range of RAS-mutant "
        "tumors, not just one hotspot mutation.",
    ),
    (
        "Erasca",
        "ERAS-4001",
        "KRAS",
        "KRAS inhibitor (small molecule)",
        "Phase I",
        "KRAS-mutant solid tumors",
        "An oral, potentially first-in-class and best-in-class pan-KRAS inhibitor, positioned alongside "
        "ERAS-0015 in Erasca's RAS-pathway franchise.",
    ),
    (
        "IDEAYA Biosciences",
        "Darovasertib",
        "PKC",
        "PKC inhibitor (small molecule)",
        "Phase II/III",
        "First-line HLA-A*02:01-negative metastatic uveal melanoma",
        "Lead registrational program, evaluated in combination with crizotinib; met its primary endpoint "
        "with a statistically significant PFS improvement over investigator's choice of therapy.",
    ),
    (
        "IDEAYA Biosciences",
        "IDE849",
        "DLL3",
        "Antibody-drug conjugate (TOP1 payload)",
        "Phase I/II",
        "DLL3-expressing solid tumors, including small cell lung cancer",
        "A potential first-in-class DLL3-targeted ADC, in a global trial spanning SCLC, neuroendocrine "
        "tumors, and melanoma, plus a combination study with a PARG inhibitor.",
    ),
    (
        "Relay Therapeutics",
        "Zovegalisib",
        "PI3Kalpha",
        "PI3Kα inhibitor (mutant-selective, small molecule)",
        "Phase III",
        "PIK3CA-mutant, HR+/HER2- advanced breast cancer",
        "The first pan-mutant-selective PI3Kα inhibitor to enter clinical development; holds FDA "
        "Breakthrough Therapy designation in combination with fulvestrant.",
    ),
    (
        "Relay Therapeutics",
        "RLY-8161",
        "NRAS",
        "NRAS-selective inhibitor (small molecule)",
        "Phase I",
        "NRAS-mutant melanoma and other solid tumors",
        "The first NRAS-selective inhibitor designed to spare KRAS and HRAS, addressing a mutation that has "
        "lacked a selective drug until now.",
    ),
    (
        "Nuvation Bio",
        "Taletrectinib (IBTROZI)",
        "ROS1",
        "ROS1 tyrosine kinase inhibitor (small molecule)",
        "Approved",
        "ROS1-positive non-small cell lung cancer",
        "FDA-approved in June 2025; now the most-prescribed ROS1 TKI in both first-line and overall new "
        "patient starts as of 2026.",
    ),
    (
        "Nuvation Bio",
        "Safusidenib",
        "IDH1",
        "IDH1 inhibitor (small molecule)",
        "Phase II",
        "IDH1-mutant glioma",
        "Positive updated Phase 2 data across grade 2 and high-grade IDH1-mutant glioma; program is "
        "expanding into two additional studies.",
    ),
    (
        "Kura Oncology",
        "Ziftomenib (KOMZIFTI)",
        "Menin",
        "Menin inhibitor (small molecule)",
        "Approved",
        "Relapsed/refractory NPM1-mutant acute myeloid leukemia",
        "FDA-approved oral menin inhibitor; a frontline combination Phase 3 program (KOMET-017) is now "
        "underway with Kyowa Kirin.",
    ),
    (
        "Kura Oncology",
        "KO-2806 (darlifarnib)",
        "Farnesyltransferase",
        "Farnesyltransferase inhibitor (small molecule)",
        "Phase I",
        "Advanced solid tumors (combinations in ccRCC, KRAS G12C NSCLC)",
        "Next-generation farnesyltransferase inhibitor evaluated as monotherapy and in combination with "
        "cabozantinib and adagrasib to address resistance to other targeted therapies.",
    ),
    (
        "Zentalis Pharmaceuticals",
        "Azenosertib",
        "WEE1",
        "WEE1 inhibitor (small molecule)",
        "Phase III",
        "Cyclin E1-positive platinum-resistant ovarian cancer",
        "First-in-class WEE1 inhibitor in a registrational Phase 3 (ASPENOVA) versus standard-of-care "
        "chemotherapy in a biomarker-selected population with no approved targeted option.",
    ),
    (
        "Xencor",
        "XmAb819",
        "ENPP3",
        "Bispecific T-cell engaging antibody (XmAb 2+1)",
        "Phase I",
        "Advanced clear cell renal cell carcinoma",
        "First-in-class ENPP3 x CD3 bispecific; tumor-expansion cohorts are open in CRC, NSCLC, and "
        "papillary RCC alongside the lead ccRCC indication.",
    ),
    (
        "Xencor",
        "XmAb541",
        "CLDN6",
        "Bispecific T-cell engaging antibody (XmAb 2+1)",
        "Phase I",
        "Advanced gynecologic and germ cell tumors",
        "First-in-class CLDN6 x CD3 bispecific; confirmed partial responses observed in ovarian cancer and "
        "germ cell tumor patients in the dose-escalation portion.",
    ),
    (
        "Arvinas",
        "ARV-806",
        "KRAS",
        "PROTAC protein degrader",
        "Phase I/II",
        "KRAS G12D-mutated advanced solid tumors",
        "A PROTAC designed to selectively degrade mutant KRAS G12D, targeting an unmet need in pancreatic, "
        "colorectal, and lung cancers.",
    ),
]

# (company, drug, nct_id_or_None, trial_label, phase, indication, sponsor, source_url)
TRIALS = [
    (
        "Janux Therapeutics",
        "JANX007",
        "NCT05519449",
        "ENGAGER-PSMA-01",
        "Phase I",
        "Metastatic castration-resistant prostate cancer",
        "Janux Therapeutics",
        "https://investors.januxrx.com/investor-media/news/news-details/2025/Janux-Announces-Encouraging-Efficacy-and-Safety-Profile-from-Ongoing-Phase-1-Clinical-Trial-for-JANX007-in-mCRPC/default.aspx",
    ),
    (
        "Cardiff Oncology",
        "Onvansertib",
        "NCT06106308",
        "CRDF-004",
        "Phase II",
        "First-line RAS-mutated metastatic colorectal cancer",
        "Cardiff Oncology",
        "https://cardiffoncology.gcs-web.com/news-releases/news-release-details/cardiff-oncology-announces-completion-enrollment-phase-2-crdf",
    ),
    (
        "Erasca",
        "ERAS-0015",
        "NCT06983743",
        "AURORAS-1",
        "Phase I",
        "RAS-mutant solid tumors",
        "Erasca",
        "https://investors.erasca.com/news-releases/news-release-details/erasca-announces-updated-preliminary-phase-1-data-and",
    ),
    (
        "Erasca",
        "ERAS-4001",
        None,
        "BOREALIS-1",
        "Phase I",
        "KRAS-mutant solid tumors",
        "Erasca",
        "https://investors.erasca.com/news-releases/news-release-details/erasca-announces-ind-clearance-potential-first-class-and-best",
    ),
    (
        "IDEAYA Biosciences",
        "Darovasertib",
        "NCT05987332",
        "OptimUM-02",
        "Phase II/III",
        "First-line HLA-A*02:01-negative metastatic uveal melanoma",
        "IDEAYA Biosciences / Servier",
        "https://ir.ideayabio.com/2026-04-13-IDEAYA-Biosciences-and-Servier-Announce-Positive-Topline-Results-from-Phase-2-3-Registrational-Trial-OptimUM-02-of-Darovasertib-in-Combination-with-Crizotinib-in-First-line-HLA-A-02-01-Negative-Metastatic-Uveal-Melanoma",
    ),
    (
        "IDEAYA Biosciences",
        "IDE849",
        "NCT07174583",
        None,
        "Phase I/II",
        "DLL3-expressing solid tumors, including small cell lung cancer",
        "IDEAYA Biosciences",
        "https://www.centerwatch.com/clinical-trials/listings/NCT07174583/a-study-of-ide849-in-patients-with-dll3-expressing-tumors-including-small-cell-lung-cancer",
    ),
    (
        "Relay Therapeutics",
        "Zovegalisib",
        "NCT06982521",
        "ReDiscover-2",
        "Phase III",
        "PIK3CA-mutant, HR+/HER2- advanced breast cancer",
        "Relay Therapeutics",
        "https://ascopubs.org/doi/10.1200/JCO.2026.44.16_suppl.TPS1148",
    ),
    (
        "Relay Therapeutics",
        "RLY-8161",
        "NCT07584226",
        None,
        "Phase I",
        "NRAS-mutant melanoma and other solid tumors",
        "Relay Therapeutics",
        "https://www.uclahealth.org/clinical-trials/first-human-study-rly-8161-advanced-nras-mutant-solid-tumors",
    ),
    (
        "Nuvation Bio",
        "Taletrectinib (IBTROZI)",
        "NCT04395677",
        "TRUST-I",
        "Phase II",
        "ROS1-positive non-small cell lung cancer (China)",
        "Nuvation Bio",
        "https://investors.nuvationbio.com/news/news-details/2024/Positive-Pooled-Data-from-Nuvation-Bios-TRUST-I-and-TRUST-II-Studies-Highlight-Taletrectinibs-Best-in-Class-Potential-for-Patients-with-Advanced-ROS1-positive-NSCLC-Supporting-Planned-New-Drug-Application-Submission-in-the-Fourth-Quarter-of-2024/default.aspx",
    ),
    (
        "Nuvation Bio",
        "Taletrectinib (IBTROZI)",
        "NCT04919811",
        "TRUST-II",
        "Phase II",
        "ROS1-positive non-small cell lung cancer (global)",
        "Nuvation Bio",
        "https://investors.nuvationbio.com/news/news-details/2024/Positive-Pooled-Data-from-Nuvation-Bios-TRUST-I-and-TRUST-II-Studies-Highlight-Taletrectinibs-Best-in-Class-Potential-for-Patients-with-Advanced-ROS1-positive-NSCLC-Supporting-Planned-New-Drug-Application-Submission-in-the-Fourth-Quarter-of-2024/default.aspx",
    ),
    (
        "Nuvation Bio",
        "Safusidenib",
        "NCT04458272",
        "J201",
        "Phase II",
        "Grade 2 IDH1-mutant glioma",
        "Nuvation Bio",
        "https://www.centerwatch.com/clinical-trials/listings/NCT05303519/safusidenib-phase-2-study-in-idh1-mutant-glioma",
    ),
    (
        "Nuvation Bio",
        "Safusidenib",
        "NCT05303519",
        "G203",
        "Phase II",
        "High-grade IDH1-mutant glioma",
        "Nuvation Bio",
        "https://ufhealth.org/clinical-trials/nuvation-bio-sigma-ab-218-g203-safusidenib-phase-2-study-in-idh1-mutant-glioma",
    ),
    (
        "Kura Oncology",
        "Ziftomenib (KOMZIFTI)",
        "NCT04067336",
        "KOMET-001",
        "Phase I/II",
        "Relapsed/refractory NPM1-mutant acute myeloid leukemia",
        "Kura Oncology / Kyowa Kirin",
        "https://ascopubs.org/doi/10.1200/JCO-25-01694",
    ),
    (
        "Kura Oncology",
        "Ziftomenib (KOMZIFTI)",
        "NCT07007312",
        "KOMET-017",
        "Phase III",
        "Newly diagnosed NPM1-mutated or KMT2A-rearranged AML (frontline)",
        "Kura Oncology / Kyowa Kirin",
        "https://ir.kuraoncology.com/news-releases/news-release-details/kura-oncology-and-kyowa-kirin-announce-first-patient-dosed",
    ),
    (
        "Kura Oncology",
        "KO-2806 (darlifarnib)",
        "NCT06026410",
        "FIT-001",
        "Phase I",
        "Advanced solid tumors",
        "Kura Oncology",
        "https://kuraoncology.com/wp-content/uploads/ASCO_2024_FIT-001_Poster.pdf",
    ),
    (
        "Zentalis Pharmaceuticals",
        "Azenosertib",
        "NCT07546500",
        "ASPENOVA",
        "Phase III",
        "Cyclin E1-positive platinum-resistant ovarian cancer",
        "Zentalis Pharmaceuticals",
        "https://www.biospace.com/press-releases/zentalis-pharmaceuticals-announces-first-patient-dosed-in-aspenova-phase-3-trial-of-azenosertib-in-patients-with-cyclin-e1-positive-platinum-resistant-ovarian-cancer",
    ),
    (
        "Xencor",
        "XmAb819",
        "NCT05433142",
        None,
        "Phase I",
        "Advanced clear cell renal cell carcinoma",
        "Xencor",
        "https://clinicaltrials.gov/study/NCT05433142",
    ),
    (
        "Xencor",
        "XmAb541",
        "NCT06276491",
        None,
        "Phase I",
        "Advanced gynecologic and germ cell tumors",
        "Xencor",
        "https://clinicaltrials.gov/study/NCT06276491",
    ),
    (
        "Arvinas",
        "ARV-806",
        "NCT07023731",
        None,
        "Phase I/II",
        "KRAS G12D-mutated advanced solid tumors",
        "Arvinas",
        "https://www.centerwatch.com/clinical-trials/listings/NCT07023731/a-study-to-evaluate-arv-806-in-adults-with-advanced-cancer-that-has-the-kras-g12d-mutation",
    ),
]


def sql_str(value: str | None) -> str:
    if value is None:
        return "null"
    return "'" + value.replace("'", "''") + "'"


def main() -> None:
    lines: list[str] = [
        "-- BioLens — Phase 2 oncology seed data.",
        "-- Generated by db/seed/generate_oncology_seed.py — do not hand-edit, edit the",
        "-- generator instead and re-run it.",
        "--",
        "-- Real, individually verified (Aug 2026) companies/drugs/targets/trials only.",
        "-- No trial_results (statistics) seeded here — see the generator's docstring.",
        "",
    ]

    indications = sorted({d[5] for d in DRUGS} | {t[5] for t in TRIALS})

    lines.append("-- Targets")
    for name, simple, detailed in TARGETS:
        lines.append(
            "insert into targets (id, name, simple_explanation, detailed_explanation) values "
            f"({sql_str(uid('target', name))}, {sql_str(name)}, {sql_str(simple)}, {sql_str(detailed)}) "
            "on conflict (name) do nothing;"
        )
    lines.append("")

    lines.append("-- Indications")
    for name in indications:
        lines.append(
            f"insert into indications (id, name) values ({sql_str(uid('indication', name))}, {sql_str(name)}) "
            "on conflict (name) do nothing;"
        )
    lines.append("")

    lines.append("-- Companies")
    company_source_ids = {}
    for name, ticker, stage, one_liner, source_url in COMPANIES:
        source_id = uid("source:company_verification", name)
        company_source_ids[name] = source_id
        lines.append(
            "insert into sources (id, type, label, url) values "
            f"({sql_str(source_id)}, 'press_release', {sql_str(f'{name} — investor relations / SEC filing')}, "
            f"{sql_str(source_url)}) on conflict (id) do nothing;"
        )
        lines.append(
            "insert into companies "
            "(id, name, ticker, stage, therapeutic_area, one_liner, is_mock_data, last_verified_at) values "
            f"({sql_str(uid('company', name))}, {sql_str(name)}, {sql_str(ticker)}, {sql_str(stage)}, "
            "'Oncology', "
            f"{sql_str(one_liner)}, false, now());"
        )
    lines.append("")

    lines.append("-- Drugs")
    for company, drug_name, target, modality, phase, indication, one_liner in DRUGS:
        lines.append(
            "insert into drugs "
            "(id, company_id, name, target_id, modality, phase, one_liner, confidence, is_mock_data) values "
            f"({sql_str(uid('drug', f'{company}:{drug_name}'))}, {sql_str(uid('company', company))}, "
            f"{sql_str(drug_name)}, {sql_str(uid('target', target))}, {sql_str(modality)}, {sql_str(phase)}, "
            f"{sql_str(one_liner)}, 'moderate', false);"
        )
        lines.append(
            "insert into drug_indications (drug_id, indication_id) values "
            f"({sql_str(uid('drug', f'{company}:{drug_name}'))}, {sql_str(uid('indication', indication))}) "
            "on conflict do nothing;"
        )
    lines.append("")

    lines.append("-- Trials")
    for company, drug, nct_id, label, phase, indication, sponsor, source_url in TRIALS:
        trial_key = f"{company}:{drug}:{label or nct_id}"
        source_id = uid("source:trial", trial_key)
        source_type = "clinicaltrials_gov" if nct_id else "press_release"
        source_label = nct_id or (label or "trial announcement")
        lines.append(
            "insert into sources (id, type, label, url) values "
            f"({sql_str(source_id)}, {sql_str(source_type)}, {sql_str(source_label)}, {sql_str(source_url)}) "
            "on conflict (id) do nothing;"
        )
        drug_id_expr = sql_str(uid("drug", f"{company}:{drug}"))
        lines.append(
            "insert into trials "
            "(id, nct_id, drug_id, company_id, phase, indication_id, status, sponsor, is_mock_data, "
            "last_verified_at) values "
            f"({sql_str(uid('trial', trial_key))}, {sql_str(nct_id)}, {drug_id_expr}, "
            f"{sql_str(uid('company', company))}, {sql_str(phase)}, {sql_str(uid('indication', indication))}, "
            f"'active', {sql_str(sponsor)}, false, now());"
        )
    lines.append("")

    out_path = Path(__file__).parent / "oncology_seed.sql"
    out_path.write_text("\n".join(lines) + "\n")
    print(
        f"Wrote {out_path} ({len(TARGETS)} targets, {len(COMPANIES)} companies, {len(DRUGS)} drugs, "
        f"{len(TRIALS)} trials, {len(indications)} indications)"
    )


if __name__ == "__main__":
    main()
