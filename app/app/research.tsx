import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { StyleSheet } from "react-native";
import { Columns } from "../components/company/Layout";
import { PanelLink, PanelState } from "../components/company/panels";
import ResearchDisclaimer from "../components/ResearchDisclaimer";
import SignalRow from "../components/SignalRow";
import KeyValueTable from "../components/ui/KeyValueTable";
import Missing from "../components/ui/Missing";
import Page from "../components/ui/Page";
import Panel from "../components/ui/Panel";
import { Text } from "../components/ui/Text";
import { SearchField, Select, Toolbar } from "../components/ui/Toolbar";
import { colors, typography } from "../constants/theme";
import { useCompanies } from "../context/CompaniesContext";
import { useRecentSignals, useTrackRecord } from "../hooks/useCompanyData";
import type { ImpactDirection, SignalEvent } from "../types/domain";

const CALLS: { value: ImpactDirection | "none"; label: string }[] = [
  { value: "likely_positive", label: "Likely positive" },
  { value: "likely_negative", label: "Likely negative" },
  { value: "mixed", label: "Mixed" },
  { value: "unlikely_to_matter", label: "Unlikely to matter" },
  { value: "none", label: "No call (filings, pending)" },
];

const TYPES = [
  { value: "new_paper", label: "Papers" },
  { value: "new_filing", label: "SEC filings" },
];

/**
 * Research Reports: the newest papers and SEC filings BioLens's scan found
 * across every tracked company, each paper with BioLens's call on whether
 * it's likely good or bad news -- and, alongside, how those calls have
 * held up against the stock's actual move.
 */
export default function ResearchReportsScreen() {
  const router = useRouter();
  const { companies, getById } = useCompanies();
  const signals = useRecentSignals(100);
  const trackRecord = useTrackRecord();
  const [type, setType] = useState<string | null>(null);
  const [call, setCall] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const all = useMemo(() => (signals?.status === "loaded" ? signals.data : []), [signals]);
  const rows = all.filter((s: SignalEvent) => {
    if (type && s.signalType !== type) return false;
    if (companyId && s.companyId !== companyId) return false;
    if (call && (s.impact?.direction ?? "none") !== call) return false;
    const q = query.trim().toLowerCase();
    return (
      !q ||
      [s.title, s.detail ?? "", s.source, getById(s.companyId)?.name ?? ""].some((f) =>
        f.toLowerCase().includes(q),
      )
    );
  });

  const tr = trackRecord?.status === "loaded" ? trackRecord.data : null;
  const horizon = (key: "1d" | "5d" | "20d") => {
    const h = tr?.horizons[key];
    if (!h || h.directionalCallsScored === 0) return null;
    return `${h.hits} of ${h.directionalCallsScored}${h.hitRate != null ? ` (${Math.round(h.hitRate * 100)}%)` : ""}`;
  };

  return (
    <Page
      title="Research Reports"
      subtitle="New papers and SEC filings across tracked companies, with BioLens's read on each paper."
    >
      <Toolbar>
        <SearchField value={query} onChange={setQuery} placeholder="Title, journal or company" />
        <Select label="Type" value={type} options={TYPES} onChange={setType} />
        <Select label="Call" value={call} options={CALLS} onChange={setCall} />
        <Select
          label="Company"
          value={companyId}
          options={companies.map((c) => ({ value: c.id, label: c.name }))}
          onChange={setCompanyId}
        />
      </Toolbar>

      <Columns
        main={
          <Panel
            title="Latest findings"
            meta={all.length ? `${rows.length} of ${all.length} most recent` : undefined}
            footer={<ResearchDisclaimer />}
          >
            {rows.length > 0 ? (
              rows.map((signal) => (
                <SignalRow
                  key={signal.id}
                  signal={signal}
                  companyName={getById(signal.companyId)?.name}
                />
              ))
            ) : all.length > 0 ? (
              <Missing label="Nothing matches these filters" />
            ) : (
              <PanelState resource={signals} empty="BioLens's scan hasn't found anything new yet" />
            )}
          </Panel>
        }
        side={
          <Panel
            title="Track record"
            meta={tr ? `vs ${tr.benchmark}` : undefined}
            action={<PanelLink label="Every call →" onPress={() => router.push("/track-record")} />}
          >
            {tr ? (
              <>
                <KeyValueTable
                  rows={[
                    { label: "Calls made", value: String(tr.totalCalls) },
                    {
                      label: "Direction right after 1 day",
                      value: horizon("1d"),
                      missingLabel: "Not enough scored yet",
                    },
                    {
                      label: "After 5 trading days",
                      value: horizon("5d"),
                      missingLabel: "Not enough scored yet",
                    },
                    {
                      label: "After 20 trading days",
                      value: horizon("20d"),
                      missingLabel: "Not enough scored yet",
                    },
                  ]}
                />
                <Text style={styles.note}>
                  Only likely-positive and likely-negative calls are scored: one counts as right
                  when the stock beat or lagged the {tr.benchmark} biotech index the way the call
                  said. Every call is published, misses included. Small samples say little.
                </Text>
              </>
            ) : (
              <PanelState resource={trackRecord} empty="No calls scored yet" />
            )}
          </Panel>
        }
      />
    </Page>
  );
}

const styles = StyleSheet.create({
  note: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 8,
    lineHeight: 17,
  },
});
