import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Linking, StyleSheet } from "react-native";
import { Split } from "../components/company/Layout";
import { catalystDate, EVENT_LABEL, statusLabel } from "../components/company/panels";
import BarChart from "../components/ui/BarChart";
import DataTable, { Cell } from "../components/ui/DataTable";
import HBarList from "../components/ui/HBarList";
import Missing from "../components/ui/Missing";
import Page from "../components/ui/Page";
import Panel from "../components/ui/Panel";
import { phaseRank } from "../components/ui/PhaseIndicator";
import SourceNote from "../components/ui/SourceNote";
import { Text } from "../components/ui/Text";
import { Select, Toolbar } from "../components/ui/Toolbar";
import { colors, spacing } from "../constants/theme";
import { useCompanies } from "../context/CompaniesContext";
import { useAllCatalysts } from "../hooks/useCompanyData";
import type { CatalystEvent, CompanyRecord } from "../types/domain";

type Row = CatalystEvent & { company: CompanyRecord; drugName: string | null };

const WINDOWS = [
  { value: "3", label: "Next 3 months" },
  { value: "6", label: "Next 6 months" },
  { value: "12", label: "Next 12 months" },
  { value: "24", label: "Next 24 months" },
];

function monthsFromNow(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function quarterOf(iso: string): string {
  const [year, month] = iso.split("-").map(Number);
  return `Q${Math.ceil(month / 3)} ${year}`;
}

/**
 * Catalyst Calendar: every disclosed trial completion date across the
 * tracked companies. Each date is the sponsor's own estimate on
 * ClinicalTrials.gov -- BioLens never adds scraped or guessed dates (e.g.
 * PDUFA rumors) -- so the page says plainly that dates move.
 */
export default function CatalystCalendarScreen() {
  const router = useRouter();
  const { companies } = useCompanies();
  const ids = useMemo(() => companies.map((c) => c.id), [companies]);
  const catalystsOf = useAllCatalysts(ids);
  const [window, setWindow] = useState<string | null>("12");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [phase, setPhase] = useState<string | null>(null);

  const loading = ids.filter((id) => catalystsOf(id)?.status === "loading").length;
  const failed = companies.filter((c) => catalystsOf(c.id)?.status === "error");

  const allRows: Row[] = companies.flatMap((company) => {
    const resource = catalystsOf(company.id);
    if (resource?.status !== "loaded") return [];
    return resource.data.map((event) => ({
      ...event,
      company,
      drugName: company.pipeline.find((a) => a.drugId === event.drugId)?.drugName ?? null,
    }));
  });

  const today = new Date().toISOString().slice(0, 10);
  const until = window ? monthsFromNow(Number(window)) : null;
  const rows = allRows.filter(
    (r) =>
      r.expectedDate >= today &&
      (!until || r.expectedDate <= until) &&
      (!companyId || r.company.id === companyId) &&
      (!phase || r.phase === phase),
  );

  const phases = Array.from(new Set(allRows.map((r) => r.phase).filter((p) => p !== null)))
    .sort((a, b) => (phaseRank(a) ?? 0) - (phaseRank(b) ?? 0))
    .map((p) => ({ value: p as string, label: p as string }));

  // Dates per quarter, every quarter in the window shown (zeros included,
  // so an empty quarter reads as empty rather than disappearing).
  const quarters: string[] = [];
  if (rows.length > 0) {
    const last = rows.reduce((m, r) => (r.expectedDate > m ? r.expectedDate : m), today);
    const cursor = new Date(today);
    cursor.setDate(1);
    while (cursor.toISOString().slice(0, 10) <= last) {
      const q = quarterOf(cursor.toISOString().slice(0, 10));
      if (!quarters.includes(q)) quarters.push(q);
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }
  const perQuarter = quarters.map(
    (q) => rows.filter((r) => quarterOf(r.expectedDate) === q).length,
  );

  const byCompany = companies
    .map((c) => ({ c, n: rows.filter((r) => r.company.id === c.id).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n);

  return (
    <Page
      title="Catalyst Calendar"
      subtitle="Disclosed trial completion dates across every company BioLens tracks."
    >
      <Toolbar>
        <Select label="Window" value={window} options={WINDOWS} onChange={setWindow} />
        <Select
          label="Company"
          value={companyId}
          options={companies.map((c) => ({ value: c.id, label: c.name }))}
          onChange={setCompanyId}
        />
        <Select label="Phase" value={phase} options={phases} onChange={setPhase} />
        {loading > 0 ? <Text style={styles.status}>Loading {loading} companies…</Text> : null}
      </Toolbar>

      <Split>
        <Panel title="Disclosed dates per quarter" meta={`${rows.length} dates`}>
          {rows.length > 0 ? (
            <BarChart
              categories={quarters}
              series={[{ name: "Dates", color: colors.chartNeutral, values: perQuarter }]}
              formatValue={(v) => `${v} date${v === 1 ? "" : "s"}`}
              formatAxis={(v) => String(Math.round(v))}
              height={180}
              integer
            />
          ) : (
            <Missing label={loading ? "Loading…" : "No disclosed dates in this window"} />
          )}
        </Panel>
        <Panel title="By company" meta="in this window">
          {byCompany.length > 0 ? (
            <HBarList
              items={byCompany.map(({ c, n }) => ({
                key: c.id,
                label: c.name,
                value: n,
                onPress: () => setCompanyId(c.id),
              }))}
              format={(v) => `${v}`}
            />
          ) : (
            <Missing label={loading ? "Loading…" : "No disclosed dates in this window"} />
          )}
        </Panel>
      </Split>

      <Panel
        title="Upcoming dates"
        flush={rows.length > 0}
        footer={
          <SourceNote source="ClinicalTrials.gov">
            each date is the sponsor&apos;s own estimate for that trial. Sponsors revise them, so
            read them as a direction, not a deadline
            {failed.length > 0 ? `. Couldn't load: ${failed.map((c) => c.name).join(", ")}` : ""}
          </SourceNote>
        }
      >
        {rows.length === 0 ? (
          <Missing label={loading ? "Loading…" : "No disclosed dates match these filters"} />
        ) : (
          <DataTable
            minWidth={900}
            rows={rows}
            rowKey={(r) => `${r.company.id}:${r.id}`}
            initialSort={{ key: "date", direction: "asc" }}
            columns={[
              {
                key: "date",
                title: "Expected",
                width: 116,
                sortValue: (r) => r.expectedDate,
                render: (r) => <Cell strong>{catalystDate(r)}</Cell>,
              },
              {
                key: "basis",
                title: "Basis",
                width: 84,
                render: (r) => (
                  <Cell muted>{r.dateType === "ESTIMATED" ? "Estimated" : "Actual"}</Cell>
                ),
              },
              {
                key: "company",
                title: "Company",
                flex: 1.2,
                sortValue: (r) => r.company.name,
                render: (r) => (
                  <Text
                    style={styles.link}
                    numberOfLines={1}
                    onPress={() =>
                      router.push({
                        pathname: "/company/[id]",
                        params: { id: r.company.id, tab: "catalysts" },
                      })
                    }
                  >
                    {r.company.name}
                  </Text>
                ),
              },
              {
                key: "drug",
                title: "Therapy",
                flex: 1.2,
                sortValue: (r) => r.drugName,
                render: (r) =>
                  r.drugName ? <Cell>{r.drugName}</Cell> : <Missing label="Not matched" />,
              },
              {
                key: "event",
                title: "Event",
                width: 140,
                render: (r) => <Cell>{EVENT_LABEL[r.eventType]}</Cell>,
              },
              {
                key: "phase",
                title: "Phase",
                width: 90,
                sortValue: (r) => phaseRank(r.phase),
                render: (r) => (r.phase ? <Cell>{r.phase}</Cell> : <Missing label="Not listed" />),
              },
              {
                key: "status",
                title: "Trial status",
                width: 150,
                render: (r) => {
                  const s = statusLabel(r.overallStatus);
                  return s ? <Cell>{s}</Cell> : <Missing label="Not listed" />;
                },
              },
              {
                key: "source",
                title: "Source",
                width: 120,
                render: (r) => (
                  <Text style={styles.link} onPress={() => Linking.openURL(r.sourceUrl)}>
                    {r.nctId} ↗
                  </Text>
                ),
              },
            ]}
          />
        )}
      </Panel>
    </Page>
  );
}

const styles = StyleSheet.create({
  status: { fontSize: 12, color: colors.textTertiary, marginLeft: spacing.sm },
  link: { fontSize: 12, color: colors.accent },
});
