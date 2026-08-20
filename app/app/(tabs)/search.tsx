import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import PaperResultRow from "../../components/PaperResultRow";
import ScreenShell from "../../components/ScreenShell";
import TrialResultRow from "../../components/TrialResultRow";
import { colors, radii, spacing, typography } from "../../constants/theme";
import {
  ApiError,
  PubMedPaper,
  TrialSearchResult,
  searchPubMedByDrug,
  searchTrialsByIntervention,
  searchTrialsBySponsor,
} from "../../services/api";

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; trials: TrialSearchResult[]; papers: PubMedPaper[] };

/**
 * Live search against the real backend (ClinicalTrials.gov sponsor +
 * intervention search, PubMed drug search — api/app/routers/clinicaltrials.py
 * and pubmed.py). No seed database exists yet, so this searches the public
 * source APIs directly rather than a `companies`/`drugs` table — company
 * and drug name search work identically once that table exists; this
 * screen's job is proving the live-data path end to end today.
 *
 * Requires the API running locally (`cd api && uvicorn app.main:app --reload`)
 * — the ApiError path below is what renders if it isn't.
 */
export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>({ status: "idle" });

  async function runSearch() {
    const trimmed = query.trim();
    if (!trimmed) return;
    setState({ status: "loading" });

    const [sponsorResult, interventionResult, papersResult] = await Promise.allSettled([
      searchTrialsBySponsor(trimmed),
      searchTrialsByIntervention(trimmed),
      searchPubMedByDrug(trimmed),
    ]);

    if (sponsorResult.status === "rejected" && interventionResult.status === "rejected") {
      const error = sponsorResult.reason;
      const message =
        error instanceof ApiError ? error.message : "Something went wrong while searching.";
      setState({ status: "error", message });
      return;
    }

    const trialsById = new Map<string, TrialSearchResult>();
    for (const result of [sponsorResult, interventionResult]) {
      if (result.status === "fulfilled") {
        for (const trial of result.value) {
          if (trial.nct_id) trialsById.set(trial.nct_id, trial);
        }
      }
    }
    const papers = papersResult.status === "fulfilled" ? papersResult.value.papers : [];

    setState({ status: "success", trials: Array.from(trialsById.values()), papers });
  }

  return (
    <ScreenShell
      title="Search"
      subtitle="Companies, drugs, and trials — live from ClinicalTrials.gov and PubMed."
    >
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.textTertiary} style={styles.searchIcon} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={runSearch}
          placeholder="Try a drug or company, e.g. onvansertib"
          placeholderTextColor={colors.textTertiary}
          style={styles.input}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {/* onSubmitEditing alone isn't reliable enough across web/native to
            be the only way to submit — an explicit button is both a more
            discoverable affordance and a safety net. */}
        <Pressable
          style={({ pressed }) => [
            styles.searchButton,
            query.trim().length === 0 && styles.searchButtonDisabled,
            pressed && styles.searchButtonPressed,
          ]}
          onPress={runSearch}
          disabled={query.trim().length === 0}
        >
          <Text style={styles.searchButtonText}>Search</Text>
        </Pressable>
      </View>

      {state.status === "idle" ? (
        <Text style={styles.hint}>
          Search hits the real ClinicalTrials.gov and PubMed APIs directly — no seed data needed.
        </Text>
      ) : null}

      {state.status === "loading" ? (
        <View style={styles.centeredRow}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : null}

      {state.status === "error" ? <Text style={styles.error}>{state.message}</Text> : null}

      {state.status === "success" ? (
        <>
          <Text style={styles.sectionLabel}>Clinical Trials ({state.trials.length})</Text>
          {state.trials.length === 0 ? (
            <Text style={styles.hint}>No matching trials found.</Text>
          ) : (
            state.trials.map((trial, i) => <TrialResultRow key={trial.nct_id ?? i} trial={trial} />)
          )}

          <Text style={styles.sectionLabel}>Research Papers ({state.papers.length})</Text>
          {state.papers.length === 0 ? (
            <Text style={styles.hint}>No matching papers found.</Text>
          ) : (
            state.papers.map((paper, i) => <PaperResultRow key={paper.pmid ?? i} paper={paper} />)
          )}
        </>
      ) : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    marginLeft: spacing.xs,
  },
  searchButtonPressed: {
    opacity: 0.85,
  },
  searchButtonDisabled: {
    opacity: 0.4,
  },
  searchButtonText: {
    ...typography.caption,
    color: "#04070D",
    fontWeight: "700",
  },
  input: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    color: colors.textPrimary,
    fontSize: 15,
  },
  hint: {
    ...typography.body,
    color: colors.textTertiary,
  },
  centeredRow: {
    alignItems: "center",
    paddingVertical: spacing.lg,
  },
  error: {
    ...typography.body,
    color: colors.confidenceModerate,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
});
