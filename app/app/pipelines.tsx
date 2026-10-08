import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, View } from "react-native";
import { catalystDate, CT_GOV_URL, EVENT_LABEL, statusLabel } from "../components/company/panels";
import DataTable, { Cell } from "../components/ui/DataTable";
import Missing from "../components/ui/Missing";
import Page from "../components/ui/Page";
import Panel from "../components/ui/Panel";
import PhaseIndicator, {
  phaseRank,
  STAGE_BUCKETS,
  stageBucket,
  type StageBucket,
} from "../components/ui/PhaseIndicator";
import SourceNote from "../components/ui/SourceNote";
import StatTile, { StatRow } from "../components/ui/StatTile";
import { Text } from "../components/ui/Text";
import { SearchField, Select, Toolbar } from "../components/ui/Toolbar";
import WatchButton from "../components/WatchButton";
import { colors, spacing, typography } from "../constants/theme";
import { useCompanies } from "../context/CompaniesContext";
import { useAllCatalysts } from "../hooks/useCompanyData";
import type { CatalystEvent, CompanyRecord, PipelineAsset } from "../types/domain";
import { disclosed } from "../utils/format";

type Row = { company: CompanyRecord; asset: PipelineAsset; key: string };

/**
 * Clinical Pipelines: every drug across every tracked company in one
 * table. The stage tiles double as the stage filter. Trial status and the
 * next disclosed date join in from each company's ClinicalTrials.gov
 * catalysts by NCT ID; expanding a row lists its trials with links to the
 * registry.
 */
export default function PipelinesScreen() {
  const router = useRouter();
  const { companies, isLoading } = useCompanies();
  const [stage, setStage] = useState<StageBucket | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [indication, setIndication] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const catalystsOf = useAllCatalysts(useMemo(() => companies.map((c) => c.id), [companies]));

  const allRows: Row[] = useMemo(
    () =>
      companies.flatMap((company) =>
        company.pipeline.map((asset) => ({ company, asset, key: `${company.id}:${asset.drugId}` })),
      ),
    [companies],
  );

  const eventsFor = (row: Row): CatalystEvent[] => {
    const resource = catalystsOf(row.company.id);
    if (resource?.status !== "loaded") return [];
    return resource.data
      .filter((e) => row.asset.trialIds.includes(e.nctId))
      .sort((a, b) => a.expectedDate.localeCompare(b.expectedDate));
  };

  const counts = useMemo(() => {
    const result: Record<StageBucket, number> = { early: 0, mid: 0, late: 0, filed: 0 };
    for (const row of allRows) {
      const bucket = stageBucket(row.asset.stage);
      if (bucket) result[bucket] += 1;
    }
    return result;
  }, [allRows]);

  const indications = useMemo(
    () =>
      Array.from(new Set(allRows.map((r) => r.asset.disease)))
        .sort()
        .map((d) => ({ value: d, label: d })),
    [allRows],
  );

  const rows = allRows.filter((row) => {
    if (stage && stageBucket(row.asset.stage) !== stage) return false;
    if (companyId && row.company.id !== companyId) return false;
    if (indication && row.asset.disease !== indication) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [
      row.asset.drugName,
      row.asset.target,
      row.asset.modality,
      row.asset.disease,
      row.company.name,
      row.company.ticker ?? "",
      ...row.asset.trialIds,
    ].some((f) => f.toLowerCase().includes(q));
  });

  return (
    <Page
      title="Clinical Pipelines"
      subtitle="Every drug in development across the companies BioLens tracks."
    >
      <StatRow>
        <StatTile
          label="All assets"
          value={String(allRows.length)}
          detail={`${companies.length} companies`}
          onPress={() => setStage(null)}
        />
        {STAGE_BUCKETS.map((bucket) => (
          <StatTile
            key={bucket.key}
            label={bucket.label}
            value={String(counts[bucket.key])}
            detail={stage === bucket.key ? "Filtering by this stage" : "Click to filter"}
            onPress={() => setStage((s) => (s === bucket.key ? null : bucket.key))}
          />
        ))}
      </StatRow>

      <Toolbar>
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Drug, target, company or NCT ID"
        />
        <Select
          label="Stage"
          value={stage}
          options={STAGE_BUCKETS.map((b) => ({ value: b.key, label: b.label }))}
          onChange={(v) => setStage(v as StageBucket | null)}
        />
        <Select
          label="Company"
          value={companyId}
          options={companies.map((c) => ({ value: c.id, label: c.name }))}
          onChange={setCompanyId}
        />
        <Select
          label="Indication"
          value={indication}
          options={indications}
          onChange={setIndication}
        />
      </Toolbar>

      <Panel
        title="Pipeline assets"
        meta={`${rows.length} of ${allRows.length}`}
        flush
        footer={
          <SourceNote source="BioLens company profiles">
            trial status and dates from ClinicalTrials.gov. Stage is a drug&apos;s position in
            development, not a probability of approval
          </SourceNote>
        }
      >
        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
          <DataTable
            minWidth={1080}
            rows={rows}
            rowKey={(r) => r.key}
            initialSort={{ key: "stage", direction: "desc" }}
            onRowPress={(r) => setExpanded((e) => (e === r.key ? null : r.key))}
            isExpanded={(r) => expanded === r.key}
            emptyText="No assets match these filters."
            renderExpanded={(r) => (
              <AssetDetail
                row={r}
                events={eventsFor(r)}
                onOpenCompany={() =>
                  router.push({
                    pathname: "/company/[id]",
                    params: { id: r.company.id, tab: "pipeline" },
                  })
                }
              />
            )}
            columns={[
              {
                key: "drug",
                title: "Therapy",
                flex: 1.3,
                sortValue: (r) => r.asset.drugName,
                render: (r) => (
                  <View style={styles.drugCell}>
                    <WatchButton entityType="drug" entityId={r.asset.drugId} size={13} />
                    <Cell strong>{r.asset.drugName}</Cell>
                  </View>
                ),
              },
              {
                key: "company",
                title: "Company",
                flex: 1,
                sortValue: (r) => r.company.name,
                render: (r) => <Cell>{r.company.name}</Cell>,
              },
              {
                key: "disease",
                title: "Indication",
                flex: 1.6,
                sortValue: (r) => r.asset.disease,
                render: (r) => <Cell numberOfLines={2}>{r.asset.disease}</Cell>,
              },
              {
                key: "mechanism",
                title: "Mechanism",
                flex: 1.3,
                render: (r) => {
                  const parts = [disclosed(r.asset.target), disclosed(r.asset.modality)].filter(
                    Boolean,
                  );
                  return parts.length ? (
                    <Cell numberOfLines={2}>{parts.join(" · ")}</Cell>
                  ) : (
                    <Missing label="Not disclosed" />
                  );
                },
              },
              {
                key: "stage",
                title: "Stage",
                width: 180,
                sortValue: (r) => phaseRank(r.asset.stage),
                render: (r) => <PhaseIndicator phase={r.asset.stage} />,
              },
              {
                key: "status",
                title: "Trial status",
                width: 140,
                render: (r) => {
                  const status = statusLabel(eventsFor(r)[0]?.overallStatus ?? null);
                  if (status) return <Cell>{status}</Cell>;
                  return catalystsOf(r.company.id)?.status === "loading" ? (
                    <Cell muted>…</Cell>
                  ) : (
                    <Missing label="No upcoming trial" />
                  );
                },
              },
              {
                key: "next",
                title: "Next disclosed date",
                width: 150,
                sortValue: (r) => eventsFor(r)[0]?.expectedDate ?? null,
                render: (r) => {
                  const next = eventsFor(r)[0];
                  return next ? (
                    <Cell>{catalystDate(next)}</Cell>
                  ) : (
                    <Missing label="None disclosed" />
                  );
                },
              },
            ]}
          />
        )}
      </Panel>
    </Page>
  );
}

function AssetDetail({
  row,
  events,
  onOpenCompany,
}: {
  row: Row;
  events: CatalystEvent[];
  onOpenCompany: () => void;
}) {
  const { asset, company } = row;
  return (
    <View style={styles.detail}>
      <View style={styles.detailCol}>
        <Text style={styles.detailHead}>Trials</Text>
        {asset.trialIds.length === 0 ? (
          <Missing label="No trial IDs on this profile" />
        ) : (
          asset.trialIds.map((id) => (
            <Text key={id} style={styles.link} onPress={() => Linking.openURL(CT_GOV_URL + id)}>
              {id} on ClinicalTrials.gov ↗
            </Text>
          ))
        )}
      </View>
      <View style={styles.detailCol}>
        <Text style={styles.detailHead}>Disclosed dates</Text>
        {events.length === 0 ? (
          <Missing label={asset.nextMilestone ?? "None disclosed"} />
        ) : (
          events.map((e) => (
            <Text key={e.id} style={styles.detailText}>
              {EVENT_LABEL[e.eventType]}: {catalystDate(e)} (
              {e.dateType === "ESTIMATED" ? "estimated" : "actual"})
            </Text>
          ))
        )}
      </View>
      <View style={styles.detailCol}>
        <Text style={styles.detailHead}>Company</Text>
        <Text style={styles.link} onPress={onOpenCompany}>
          {company.name} pipeline →
        </Text>
        {company.reviewStatus === "ai_drafted_unreviewed" ? (
          <Text style={styles.detailText}>AI-drafted profile, pending review</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { padding: spacing.xl, alignItems: "center" },
  drugCell: { flexDirection: "row", alignItems: "center", gap: 8 },
  detail: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xl },
  detailCol: { minWidth: 220, flex: 1, gap: 3 },
  detailHead: {
    ...typography.caption,
    fontWeight: "500",
    color: colors.textTertiary,
    marginBottom: 2,
  },
  detailText: { fontSize: 12, color: colors.textSecondary },
  link: { fontSize: 12, color: colors.accent },
});
