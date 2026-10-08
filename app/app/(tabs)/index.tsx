import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Columns } from "../../components/company/Layout";
import { catalystDate, EVENT_LABEL, PanelLink, PanelState } from "../../components/company/panels";
import EventCard from "../../components/EventCard";
import ResearchDisclaimer from "../../components/ResearchDisclaimer";
import SignalRow from "../../components/SignalRow";
import TrialMetric from "../../components/TrialMetric";
import DataTable, { Cell } from "../../components/ui/DataTable";
import HBarList from "../../components/ui/HBarList";
import Missing from "../../components/ui/Missing";
import Page from "../../components/ui/Page";
import Panel from "../../components/ui/Panel";
import { STAGE_BUCKETS, stageBucket } from "../../components/ui/PhaseIndicator";
import SourceNote from "../../components/ui/SourceNote";
import StatTile, { StatRow } from "../../components/ui/StatTile";
import Tag from "../../components/ui/Tag";
import { Text } from "../../components/ui/Text";
import { colors, spacing, typography } from "../../constants/theme";
import { useCompanies } from "../../context/CompaniesContext";
import { useWatchlist } from "../../context/WatchlistContext";
import { useAllCatalysts, useRecentSignals, useTrackRecord } from "../../hooks/useCompanyData";
import { MOCK_EVENTS, MOCK_TRIAL_METRICS } from "../../mocks/phase1Preview";
import type { CatalystEvent, CompanyRecord } from "../../types/domain";
import { useIsWideWeb } from "../../utils/layout";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Overview: the research desk's front page. Headline counts, what's new
 * (papers and filings BioLens's scan found), what's next (disclosed trial
 * dates), where the pipeline sits, and the watchlist -- each panel opening
 * its full view. Everything here is live data; the one illustrative
 * section is labeled as such.
 */
export default function OverviewScreen() {
  const router = useRouter();
  const isWide = useIsWideWeb();
  const { companies, getById } = useCompanies();
  const { entries } = useWatchlist();
  const signals = useRecentSignals(100);
  const trackRecord = useTrackRecord();
  const catalystsOf = useAllCatalysts(useMemo(() => companies.map((c) => c.id), [companies]));
  const [showExamples, setShowExamples] = useState(false);

  const allSignals = signals?.status === "loaded" ? signals.data : [];
  // Render-time "now" is fine here: these are coarse day-level windows.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const lastWeek = allSignals.filter((s) => now - new Date(s.detectedAt).getTime() < 7 * DAY_MS);

  const today = new Date(now).toISOString().slice(0, 10);
  const in90 = new Date(now + 90 * DAY_MS).toISOString().slice(0, 10);
  const upcoming: (CatalystEvent & { company: CompanyRecord })[] = companies
    .flatMap((company) => {
      const r = catalystsOf(company.id);
      return r?.status === "loaded" ? r.data.map((e) => ({ ...e, company })) : [];
    })
    .filter((e) => e.expectedDate >= today)
    .sort((a, b) => a.expectedDate.localeCompare(b.expectedDate));
  const next90 = upcoming.filter((e) => e.expectedDate <= in90);
  const catalystsLoading = companies.some((c) => catalystsOf(c.id)?.status === "loading");

  const assets = companies.flatMap((c) => c.pipeline);
  const stageItems = STAGE_BUCKETS.map((b) => ({
    key: b.key,
    label: b.label,
    value: assets.filter((a) => stageBucket(a.stage) === b.key).length,
    onPress: () => router.push("/pipelines"),
  }));

  const watchedCompanies = entries
    .filter((e) => e.entityType === "company")
    .map((e) => getById(e.entityId))
    .filter((c): c is CompanyRecord => !!c);

  const tr = trackRecord?.status === "loaded" ? trackRecord.data : null;
  const fiveDay = tr?.horizons["5d"];

  return (
    <Page
      title="Overview"
      subtitle="Science, trials, and financials across the biotech companies BioLens tracks."
    >
      <StatRow>
        <StatTile
          label="Companies tracked"
          value={String(companies.length)}
          detail="Open Company Explorer"
          onPress={() => router.push("/discover")}
        />
        <StatTile
          label="Pipeline assets"
          value={String(assets.length)}
          detail="Open Clinical Pipelines"
          onPress={() => router.push("/pipelines")}
        />
        <StatTile
          label="Disclosed dates, next 90 days"
          value={catalystsLoading && next90.length === 0 ? "…" : String(next90.length)}
          detail="Open Catalyst Calendar"
          onPress={() => router.push("/catalysts")}
        />
        <StatTile
          label="New papers & filings, 7 days"
          value={signals?.status === "loading" ? "…" : String(lastWeek.length)}
          detail="Open Research Reports"
          onPress={() => router.push("/research")}
        />
      </StatRow>

      {!isWide ? <ResearchViews /> : null}

      <Columns
        main={
          <>
            <Panel
              title="Latest findings"
              action={<PanelLink label="All research →" onPress={() => router.push("/research")} />}
              footer={<ResearchDisclaimer />}
            >
              {allSignals.length > 0 ? (
                allSignals
                  .slice(0, 6)
                  .map((signal) => (
                    <SignalRow
                      key={signal.id}
                      signal={signal}
                      companyName={getById(signal.companyId)?.name}
                    />
                  ))
              ) : (
                <PanelState
                  resource={signals}
                  empty="BioLens's scan hasn't found anything new yet"
                />
              )}
            </Panel>

            <Panel
              title="Upcoming disclosed dates"
              action={
                <PanelLink label="Full calendar →" onPress={() => router.push("/catalysts")} />
              }
              flush={upcoming.length > 0}
              footer={
                <SourceNote source="ClinicalTrials.gov">
                  sponsor-disclosed estimates; they move
                </SourceNote>
              }
            >
              {upcoming.length === 0 ? (
                <Missing label={catalystsLoading ? "Loading…" : "No upcoming dates disclosed"} />
              ) : (
                <DataTable
                  minWidth={560}
                  rows={upcoming.slice(0, 8)}
                  rowKey={(e) => `${e.company.id}:${e.id}`}
                  onRowPress={(e) =>
                    router.push({
                      pathname: "/company/[id]",
                      params: { id: e.company.id, tab: "catalysts" },
                    })
                  }
                  columns={[
                    {
                      key: "date",
                      title: "Expected",
                      width: 116,
                      render: (e) => <Cell strong>{catalystDate(e)}</Cell>,
                    },
                    {
                      key: "company",
                      title: "Company",
                      flex: 1,
                      render: (e) => <Cell>{e.company.name}</Cell>,
                    },
                    {
                      key: "event",
                      title: "Event",
                      width: 140,
                      render: (e) => <Cell>{EVENT_LABEL[e.eventType]}</Cell>,
                    },
                    {
                      key: "phase",
                      title: "Phase",
                      width: 90,
                      render: (e) =>
                        e.phase ? <Cell>{e.phase}</Cell> : <Missing label="Not listed" />,
                    },
                  ]}
                />
              )}
            </Panel>
          </>
        }
        side={
          <>
            <Panel
              title="Pipeline by stage"
              meta={`${assets.length} assets`}
              action={<PanelLink label="Pipelines →" onPress={() => router.push("/pipelines")} />}
            >
              <HBarList items={stageItems} format={(n) => String(n)} />
            </Panel>

            <Panel
              title="Watchlist"
              action={<PanelLink label="Open →" onPress={() => router.push("/watchlist")} />}
            >
              {watchedCompanies.length === 0 ? (
                <Text style={styles.muted}>
                  Bookmark a company in the Company Explorer to follow it here.
                </Text>
              ) : (
                watchedCompanies.slice(0, 8).map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => router.push({ pathname: "/company/[id]", params: { id: c.id } })}
                    style={({ hovered }: { hovered?: boolean }) => [
                      styles.watchRow,
                      hovered && styles.watchRowHovered,
                    ]}
                  >
                    <Text style={styles.watchTicker}>{c.ticker ?? "—"}</Text>
                    <Text style={styles.watchName} numberOfLines={1}>
                      {c.name}
                    </Text>
                    <Text style={styles.watchStage}>{c.stage}</Text>
                  </Pressable>
                ))
              )}
            </Panel>

            <Panel
              title="Signal track record"
              action={
                <PanelLink label="Every call →" onPress={() => router.push("/track-record")} />
              }
            >
              {tr ? (
                <Text style={styles.body}>
                  {tr.totalCalls} calls made on new papers.{" "}
                  {fiveDay && fiveDay.directionalCallsScored > 0
                    ? `After 5 trading days, ${fiveDay.hits} of ${fiveDay.directionalCallsScored} directional calls matched the stock's move relative to ${tr.benchmark}.`
                    : "Not enough calls have been scored yet to say how they're holding up."}
                </Text>
              ) : (
                <PanelState resource={trackRecord} empty="No calls scored yet" />
              )}
            </Panel>
          </>
        }
      />

      <Panel
        title="How BioLens reads a trial readout"
        action={
          <PanelLink
            label={showExamples ? "Hide examples" : "Show examples"}
            onPress={() => setShowExamples((s) => !s)}
          />
        }
      >
        <View style={styles.exampleHeader}>
          <Tag label="Illustrative examples, not real readouts" tone="caution" />
          <Text style={styles.muted}>
            Sample readouts and trial statistics showing how BioLens classifies evidence and
            presents trial numbers.
          </Text>
        </View>
        {showExamples ? (
          <View style={styles.examples}>
            {MOCK_EVENTS.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
            {MOCK_TRIAL_METRICS.map((metric, i) => (
              <TrialMetric key={`${metric.kind}-${i}`} data={metric} />
            ))}
          </View>
        ) : null}
      </Panel>
    </Page>
  );
}

/** Phones have no sidebar: link the research views from the front page. */
function ResearchViews() {
  const router = useRouter();
  const views = [
    { label: "Clinical Pipelines", href: "/pipelines" },
    { label: "Catalyst Calendar", href: "/catalysts" },
    { label: "Financial Analysis", href: "/financials" },
    { label: "Research Reports", href: "/research" },
    { label: "Signal track record", href: "/track-record" },
  ] as const;
  return (
    <Panel title="Research views" flush>
      {views.map((view) => (
        <Pressable key={view.href} onPress={() => router.push(view.href)} style={styles.viewRow}>
          <Text style={styles.viewLabel}>{view.label}</Text>
          <Text style={styles.muted}>›</Text>
        </Pressable>
      ))}
    </Panel>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 13, lineHeight: 19, color: colors.textSecondary },
  muted: { ...typography.caption, fontSize: 12, color: colors.textTertiary, lineHeight: 17 },
  watchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: 30,
    paddingHorizontal: 4,
    borderRadius: 2,
  },
  watchRowHovered: { backgroundColor: colors.surfaceRaised },
  watchTicker: { width: 56, fontSize: 12, fontWeight: "600", color: colors.textPrimary },
  watchName: { flex: 1, fontSize: 13, color: colors.textSecondary },
  watchStage: { ...typography.caption, color: colors.textTertiary },
  exampleHeader: { gap: spacing.sm },
  examples: { marginTop: spacing.md, gap: spacing.md },
  viewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    height: 40,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  viewLabel: { fontSize: 14, color: colors.textPrimary },
});
