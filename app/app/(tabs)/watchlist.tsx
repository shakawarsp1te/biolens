import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import DataTable, { Cell } from "../../components/ui/DataTable";
import Missing from "../../components/ui/Missing";
import Page from "../../components/ui/Page";
import Panel from "../../components/ui/Panel";
import PhaseIndicator, { phaseRank } from "../../components/ui/PhaseIndicator";
import SourceNote from "../../components/ui/SourceNote";
import Tag from "../../components/ui/Tag";
import { Text } from "../../components/ui/Text";
import WatchButton from "../../components/WatchButton";
import { colors, spacing, typography } from "../../constants/theme";
import { useCompanies } from "../../context/CompaniesContext";
import { useWatchlist } from "../../context/WatchlistContext";
import { useValuations } from "../../hooks/useCompanyData";
import { searchTrialsBySponsor } from "../../services/api";
import { disclosed, formatUsdCompact } from "../../utils/format";
import { findPipelineAssetByDrugId, findPipelineAssetsByTarget } from "../../utils/pipelineLookup";
import { diffAndUpdateSeenTrials } from "../../utils/watchlistFreshness";

/**
 * Phase 9: real device-local persistence via WatchlistContext / AsyncStorage
 * (app/services/watchlist.ts) — not a stub. Tap the bookmark icon on any
 * Discovery Card, DrugCard, or pipeline asset row to follow/unfollow it; it
 * shows up (or disappears) here immediately, since all three screens read
 * the same context.
 *
 * Companies come from the live company list (CompaniesContext, backed by
 * GET /companies) — the entries themselves (entityType/entityId) already
 * match the real `companies` table's shape, so swapping this lookup for a
 * direct Postgres-backed fetch later doesn't change anything else about
 * how this screen works. Drugs and targets resolve through
 * utils/pipelineLookup.ts against that same live list, since there's no
 * standalone `drugs`/`targets` table yet either.
 */
export default function WatchlistScreen() {
  const router = useRouter();
  const { entries, loading } = useWatchlist();
  const { companies } = useCompanies();

  const watchedCompanies = entries
    .filter((entry) => entry.entityType === "company")
    .map((entry) => companies.find((card) => card.id === entry.entityId))
    .filter((card): card is (typeof companies)[number] => card !== undefined);

  const watchedDrugs = entries
    .filter((entry) => entry.entityType === "drug")
    .map((entry) => findPipelineAssetByDrugId(companies, entry.entityId))
    .filter((asset): asset is NonNullable<typeof asset> => asset !== undefined);

  const watchedTargets = entries
    .filter((entry) => entry.entityType === "target")
    .map((entry) => ({
      target: entry.entityId,
      assets: findPipelineAssetsByTarget(companies, entry.entityId),
    }));

  const nothingFollowed =
    watchedCompanies.length === 0 && watchedDrugs.length === 0 && watchedTargets.length === 0;

  // Real "new since your last visit" counts — a live ClinicalTrials.gov
  // sponsor search per followed company, diffed against what was seen last
  // time (utils/watchlistFreshness.ts). Keyed by company id; a company that
  // hasn't resolved yet (or whose lookup failed) simply shows no badge.
  const [newActivityCounts, setNewActivityCounts] = useState<Record<string, number>>({});
  const watchedCompanyIds = watchedCompanies.map((card) => card.id).join(",");

  useEffect(() => {
    let cancelled = false;
    watchedCompanies.forEach((card) => {
      searchTrialsBySponsor(card.name)
        .then((trials) => {
          const ids = trials.map((trial) => trial.nct_id).filter((id): id is string => id !== null);
          return diffAndUpdateSeenTrials(card.id, ids);
        })
        .then((newCount) => {
          if (!cancelled && newCount > 0) {
            setNewActivityCounts((prev) => ({ ...prev, [card.id]: newCount }));
          }
        })
        .catch(() => {
          // No backend reachable, or this company's name doesn't resolve to
          // a sponsor — silently skip its badge rather than showing an error
          // on a screen that's otherwise just a list.
        });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- watchedCompanyIds is the intentional dependency key (see above), not watchedCompanies itself (a new array every render).
  }, [watchedCompanyIds]);

  const valuationOf = useValuations(
    watchedCompanies.map((c) => c.ticker).filter((t): t is string => !!t),
  );

  return (
    <Page title="Watchlist" subtitle="Companies, drugs, and targets you're following.">
      {loading ? (
        <View style={styles.centeredRow}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : nothingFollowed ? (
        <Panel title="Nothing followed yet">
          <Text style={styles.emptyBody}>
            Use the bookmark icon on any company, drug, or target to follow it. It shows up here and
            stays saved on this device.
          </Text>
        </Panel>
      ) : (
        <>
          {watchedCompanies.length > 0 ? (
            <Panel
              title="Companies"
              meta={String(watchedCompanies.length)}
              flush
              footer={
                <SourceNote source="SEC EDGAR filings, Yahoo Finance and ClinicalTrials.gov">
                  new trials = trials ClinicalTrials.gov lists for this sponsor that weren&apos;t
                  there on your last visit
                </SourceNote>
              }
            >
              <DataTable
                minWidth={760}
                rows={watchedCompanies}
                rowKey={(c) => c.id}
                onRowPress={(c) => router.push({ pathname: "/company/[id]", params: { id: c.id } })}
                columns={[
                  {
                    key: "company",
                    title: "Company",
                    flex: 1.6,
                    sortValue: (c) => c.name,
                    render: (c) => (
                      <View style={styles.nameCell}>
                        <WatchButton entityType="company" entityId={c.id} size={13} />
                        <Cell strong>{c.name}</Cell>
                        {newActivityCounts[c.id] ? (
                          <Tag
                            label={`${newActivityCounts[c.id]} new trial${newActivityCounts[c.id] === 1 ? "" : "s"}`}
                            tone="accent"
                          />
                        ) : null}
                      </View>
                    ),
                  },
                  {
                    key: "ticker",
                    title: "Ticker",
                    width: 84,
                    render: (c) =>
                      c.ticker ? <Cell>{c.ticker}</Cell> : <Missing label="No ticker" />,
                  },
                  {
                    key: "marketCap",
                    title: "Market cap",
                    width: 110,
                    align: "right",
                    render: (c) => {
                      if (!c.ticker) return <Missing label="No ticker" />;
                      const v = valuationOf(c.ticker);
                      if (!v || v.status === "loading") return <Cell muted>…</Cell>;
                      return v.status === "loaded" && v.data ? (
                        <Cell numeric>{formatUsdCompact(v.data.marketCap)}</Cell>
                      ) : (
                        <Missing label="n/a" />
                      );
                    },
                  },
                  {
                    key: "stage",
                    title: "Most advanced",
                    width: 180,
                    sortValue: (c) => phaseRank(c.stage),
                    render: (c) => <PhaseIndicator phase={c.stage} />,
                  },
                ]}
              />
            </Panel>
          ) : null}

          {watchedDrugs.length > 0 ? (
            <Panel title="Drugs" meta={String(watchedDrugs.length)} flush>
              <DataTable
                minWidth={760}
                rows={watchedDrugs}
                rowKey={(a) => a.drugId}
                onRowPress={(a) =>
                  router.push({
                    pathname: "/company/[id]",
                    params: { id: a.companyId, tab: "pipeline" },
                  })
                }
                columns={[
                  {
                    key: "drug",
                    title: "Therapy",
                    flex: 1.3,
                    sortValue: (a) => a.drugName,
                    render: (a) => (
                      <View style={styles.nameCell}>
                        <WatchButton entityType="drug" entityId={a.drugId} size={13} />
                        <Cell strong>{a.drugName}</Cell>
                      </View>
                    ),
                  },
                  {
                    key: "company",
                    title: "Company",
                    flex: 1,
                    render: (a) => <Cell>{a.companyName}</Cell>,
                  },
                  {
                    key: "mechanism",
                    title: "Mechanism",
                    flex: 1.3,
                    render: (a) => {
                      const parts = [disclosed(a.target), disclosed(a.modality)].filter(Boolean);
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
                    sortValue: (a) => phaseRank(a.stage),
                    render: (a) => <PhaseIndicator phase={a.stage} />,
                  },
                ]}
              />
            </Panel>
          ) : null}

          {watchedTargets.length > 0 ? (
            <Panel title="Targets" meta={String(watchedTargets.length)} flush>
              {watchedTargets.map(({ target, assets }) => (
                <View key={target} style={styles.targetRow}>
                  <View style={styles.nameCell}>
                    <WatchButton entityType="target" entityId={target} size={13} />
                    <Text style={styles.targetName}>{target}</Text>
                  </View>
                  <View style={styles.targetPrograms}>
                    {assets.length === 0 ? (
                      <Missing label="No programs against this target in BioLens yet" />
                    ) : (
                      assets.map((asset) => (
                        <Text
                          key={asset.drugId}
                          style={styles.link}
                          onPress={() =>
                            router.push({
                              pathname: "/company/[id]",
                              params: { id: asset.companyId, tab: "pipeline" },
                            })
                          }
                        >
                          {asset.drugName} · {asset.companyName} · {asset.stage}
                        </Text>
                      ))
                    )}
                  </View>
                </View>
              ))}
            </Panel>
          ) : null}
        </>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  centeredRow: { alignItems: "center", paddingVertical: spacing.xl },
  emptyBody: { ...typography.body, fontSize: 13, color: colors.textSecondary },
  nameCell: { flexDirection: "row", alignItems: "center", gap: 8 },
  targetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  targetName: { fontSize: 13, fontWeight: "500", color: colors.textPrimary, minWidth: 160 },
  targetPrograms: { flex: 1, gap: 3, minWidth: 240 },
  link: { fontSize: 12, color: colors.accent },
});
