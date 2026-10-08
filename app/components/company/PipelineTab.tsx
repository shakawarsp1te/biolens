import React, { useMemo, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { useCatalysts, useCompetitors } from "../../hooks/useCompanyData";
import type { AssetCompetitors } from "../../services/api";
import type { CatalystEvent, CompanyRecord, PipelineAsset } from "../../types/domain";
import DataTable, { Cell } from "../ui/DataTable";
import Missing from "../ui/Missing";
import Panel from "../ui/Panel";
import Chip from "../ui/Chip";
import PhaseIndicator, {
  phaseRank,
  STAGE_BUCKETS,
  stageBucket,
  type StageBucket,
} from "../ui/PhaseIndicator";
import SourceNote from "../ui/SourceNote";
import { Text, TextInput } from "../ui/Text";
import WatchButton from "../WatchButton";
import { disclosed } from "../../utils/format";
import { Stack } from "./Layout";
import { catalystDate, CT_GOV_URL, EVENT_LABEL, statusLabel } from "./panels";

export default function PipelineTab({ company }: { company: CompanyRecord }) {
  const catalysts = useCatalysts(company.id);
  const competitors = useCompetitors(company.id);
  const [stage, setStage] = useState<StageBucket | null>(null);
  const [indication, setIndication] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  // Trial status and the next disclosed date come from the company's
  // catalysts (ClinicalTrials.gov), matched to an asset by NCT ID.
  const eventsByNct = useMemo(() => {
    const map = new Map<string, CatalystEvent[]>();
    if (catalysts?.status === "loaded")
      for (const e of catalysts.data) map.set(e.nctId, [...(map.get(e.nctId) ?? []), e]);
    return map;
  }, [catalysts]);

  const eventsFor = (asset: PipelineAsset) =>
    asset.trialIds
      .flatMap((id) => eventsByNct.get(id) ?? [])
      .sort((a, b) => a.expectedDate.localeCompare(b.expectedDate));

  const indications = useMemo(
    () => Array.from(new Set(company.pipeline.map((a) => a.disease))).sort(),
    [company.pipeline],
  );

  const rows = company.pipeline.filter((asset) => {
    const stageMatch = !stage || stageBucket(asset.stage) === stage;
    const q = query.trim().toLowerCase();
    const textMatch =
      !q ||
      [asset.drugName, asset.target, asset.modality, asset.disease, ...asset.trialIds].some((f) =>
        f.toLowerCase().includes(q),
      );
    return stageMatch && textMatch && (!indication || asset.disease === indication);
  });

  const competitorsFor = (asset: PipelineAsset) =>
    competitors?.status === "loaded"
      ? competitors.data.find((c) => c.drugName === asset.drugName)
      : undefined;

  return (
    <Stack>
      <View style={styles.toolbar}>
        <View style={styles.search}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Filter by drug, target, indication or NCT ID"
            placeholderTextColor={colors.textTertiary}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <View style={styles.chips}>
          <Chip label="All stages" selected={!stage} onPress={() => setStage(null)} />
          {STAGE_BUCKETS.map((f) => (
            <Chip
              key={f.key}
              label={f.label}
              selected={stage === f.key}
              onPress={() => setStage(f.key)}
            />
          ))}
        </View>
      </View>
      {indications.length > 1 ? (
        <View style={styles.chips}>
          <Text style={styles.chipsLabel}>Indication</Text>
          <Chip label="All" selected={!indication} onPress={() => setIndication(null)} />
          {indications.map((d) => (
            <Chip key={d} label={d} selected={indication === d} onPress={() => setIndication(d)} />
          ))}
        </View>
      ) : null}

      <Panel
        title="Clinical pipeline"
        meta={`${rows.length} of ${company.pipeline.length} assets`}
        flush
        footer={
          <SourceNote source="BioLens company profile">
            trial status and dates from ClinicalTrials.gov. Stage is position in development, not a
            probability of approval
          </SourceNote>
        }
      >
        <DataTable
          minWidth={900}
          rows={rows}
          rowKey={(a) => a.drugId}
          initialSort={{ key: "stage", direction: "desc" }}
          onRowPress={(a) => setExpanded((e) => (e === a.drugId ? null : a.drugId))}
          isExpanded={(a) => expanded === a.drugId}
          emptyText="No assets match these filters."
          renderExpanded={(a) => (
            <AssetDetail asset={a} events={eventsFor(a)} competitors={competitorsFor(a)} />
          )}
          columns={[
            {
              key: "drug",
              title: "Therapy",
              flex: 1.1,
              sortValue: (a) => a.drugName,
              render: (a) => (
                <View style={styles.drugCell}>
                  <Cell strong>{a.drugName}</Cell>
                  <WatchButton entityType="drug" entityId={a.drugId} size={13} />
                </View>
              ),
            },
            {
              key: "disease",
              title: "Indication",
              flex: 1.5,
              sortValue: (a) => a.disease,
              render: (a) => <Cell numberOfLines={2}>{a.disease}</Cell>,
            },
            {
              key: "mechanism",
              title: "Mechanism",
              flex: 1.4,
              render: (a) => {
                const parts = [disclosed(a.target), disclosed(a.modality)].filter(Boolean);
                return parts.length > 0 ? (
                  <Cell numberOfLines={2}>{parts.join(" · ")}</Cell>
                ) : (
                  <Missing label="Not disclosed" />
                );
              },
            },
            {
              key: "stage",
              title: "Stage",
              width: 190,
              sortValue: (a) => phaseRank(a.stage),
              render: (a) => <PhaseIndicator phase={a.stage} />,
            },
            {
              key: "status",
              title: "Trial status",
              width: 150,
              render: (a) => {
                const status = statusLabel(eventsFor(a)[0]?.overallStatus ?? null);
                return status ? (
                  <Cell>{status}</Cell>
                ) : catalysts?.status === "loading" ? (
                  <Cell muted>Loading…</Cell>
                ) : (
                  <Missing label="No upcoming trial" />
                );
              },
            },
            {
              key: "next",
              title: "Next milestone",
              width: 170,
              sortValue: (a) => eventsFor(a)[0]?.expectedDate ?? null,
              render: (a) => {
                const next = eventsFor(a)[0];
                if (next)
                  return (
                    <Cell>
                      {EVENT_LABEL[next.eventType]}, {catalystDate(next)}
                    </Cell>
                  );
                return a.nextMilestone ? (
                  <Cell numberOfLines={2}>{a.nextMilestone}</Cell>
                ) : (
                  <Missing label="None disclosed" />
                );
              },
            },
            {
              key: "trials",
              title: "Trials",
              width: 120,
              render: (a) =>
                a.trialIds.length > 0 ? (
                  <Cell>
                    {a.trialIds[0]}
                    {a.trialIds.length > 1 ? ` +${a.trialIds.length - 1}` : ""}
                  </Cell>
                ) : (
                  <Missing label="None listed" />
                ),
            },
          ]}
        />
      </Panel>
    </Stack>
  );
}

function AssetDetail({
  asset,
  events,
  competitors,
}: {
  asset: PipelineAsset;
  events: CatalystEvent[];
  competitors: AssetCompetitors | undefined;
}) {
  const comp = competitors;
  return (
    <View style={styles.detail}>
      <View style={styles.detailCol}>
        <Text style={styles.detailHead}>Trials on ClinicalTrials.gov</Text>
        {asset.trialIds.length === 0 ? (
          <Missing label="No trial IDs on this profile" />
        ) : (
          asset.trialIds.map((id) => (
            <Text key={id} style={styles.link} onPress={() => Linking.openURL(CT_GOV_URL + id)}>
              {id} ↗
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
              {e.dateType === "ESTIMATED" ? "est." : "actual"})
            </Text>
          ))
        )}
      </View>
      <View style={styles.detailCol}>
        <Text style={styles.detailHead}>
          Other companies on {disclosed(asset.target) ?? "the same target"}
        </Text>
        {!comp || !comp.searchable ? (
          <Missing
            label={
              disclosed(asset.target) ? "Target too general to search" : "Target not disclosed"
            }
          />
        ) : !comp.available ? (
          <Missing label="ClinicalTrials.gov unavailable just now" />
        ) : comp.competitors.length === 0 ? (
          <Missing label="No other Phase II+ industry trials found" />
        ) : (
          comp.competitors.slice(0, 5).map((c) => (
            <Text key={c.company} style={styles.detailText}>
              {c.company} · {c.mostAdvancedPhase}
            </Text>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, alignItems: "center" },
  search: {
    flexGrow: 1,
    minWidth: 240,
    maxWidth: 380,
    height: 30,
    justifyContent: "center",
    paddingHorizontal: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
  },
  searchInput: { fontSize: 13, color: colors.textPrimary, outlineStyle: "none" } as object,
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },
  chipsLabel: { ...typography.caption, color: colors.textTertiary, marginRight: 4 },
  drugCell: { flexDirection: "row", alignItems: "center", gap: 6 },
  detail: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xl },
  detailCol: { minWidth: 200, flex: 1, gap: 3 },
  detailHead: {
    ...typography.caption,
    fontWeight: "500",
    color: colors.textTertiary,
    marginBottom: 2,
  },
  detailText: { fontSize: 12, color: colors.textSecondary },
  link: { fontSize: 12, color: colors.accent },
});
