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

// A handful of real names from BioLens's own seed companies (see
// mocks/companyProfile.ts) — every one of these actually returns something,
// unlike a made-up placeholder query would.
const SUGGESTED_QUERIES = [
  "onvansertib",
  "Cardiff Oncology",
  "Xencor",
  "Erasca",
  "Janux Therapeutics",
  "PLK1 inhibitor",
];

// How long to hold off hiding the suggestions dropdown after the input
// blurs. On web, a tap on a suggestion fires the input's blur before the
// suggestion's own onPress — hiding immediately would unmount the button
// out from under the tap. Native doesn't have this race, but the same
// delay is harmless there.
const BLUR_HIDE_DELAY_MS = 150;

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
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const blurTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleFocus() {
    if (blurTimeout.current) clearTimeout(blurTimeout.current);
    setShowSuggestions(true);
  }

  function handleBlur() {
    blurTimeout.current = setTimeout(() => setShowSuggestions(false), BLUR_HIDE_DELAY_MS);
  }

  function selectSuggestion(text: string) {
    setShowSuggestions(false);
    setQuery(text);
    runSearch(text);
  }

  async function runSearch(overrideQuery?: string) {
    const trimmed = (overrideQuery ?? query).trim();
    if (!trimmed) return;
    setShowSuggestions(false);
    setState({ status: "loading" });
    setRecentQueries((prev) => [trimmed, ...prev.filter((q) => q !== trimmed)].slice(0, 5));

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
          onFocus={handleFocus}
          onBlur={handleBlur}
          onSubmitEditing={() => runSearch()}
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
          onPress={() => runSearch()}
          disabled={query.trim().length === 0}
        >
          <Text style={styles.searchButtonText}>Search</Text>
        </Pressable>
      </View>

      {showSuggestions ? (
        <View style={styles.suggestionsCard}>
          {recentQueries.length > 0 ? (
            <>
              <Text style={styles.suggestionsLabel}>Recent</Text>
              <View style={styles.suggestionChips}>
                {recentQueries.map((text) => (
                  <Pressable
                    key={`recent-${text}`}
                    onPress={() => selectSuggestion(text)}
                    style={styles.suggestionChip}
                  >
                    <Ionicons name="time-outline" size={13} color={colors.textTertiary} />
                    <Text style={styles.suggestionChipText}>{text}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}
          <Text style={styles.suggestionsLabel}>Try searching</Text>
          <View style={styles.suggestionChips}>
            {SUGGESTED_QUERIES.filter((text) => !recentQueries.includes(text)).map((text) => (
              <Pressable
                key={text}
                onPress={() => selectSuggestion(text)}
                style={styles.suggestionChip}
              >
                <Text style={styles.suggestionChipText}>{text}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {!showSuggestions && state.status === "idle" ? (
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
    marginBottom: spacing.sm,
  },
  suggestionsCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  suggestionsLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  suggestionChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  suggestionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
  },
  suggestionChipText: {
    ...typography.body,
    fontSize: 13,
    color: colors.textSecondary,
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
