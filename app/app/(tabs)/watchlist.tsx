import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import DiscoveryCard from "../../components/DiscoveryCard";
import ScreenShell from "../../components/ScreenShell";
import WatchButton from "../../components/WatchButton";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { useCompanies } from "../../context/CompaniesContext";
import { useWatchlist } from "../../context/WatchlistContext";
import { searchTrialsBySponsor } from "../../services/api";
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

  return (
    <ScreenShell title="Watchlist" subtitle="Companies, drugs, and targets you're following.">
      {loading ? (
        <View style={styles.centeredRow}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : nothingFollowed ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Nothing followed yet</Text>
          <Text style={styles.emptyBody}>
            Tap the bookmark icon on any company, drug, or target to follow it — it will show up
            here, and stays saved on this device even after you close the app.
          </Text>
        </View>
      ) : (
        <>
          {watchedCompanies.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>Companies</Text>
              {watchedCompanies.map((card) => (
                <DiscoveryCard
                  key={card.id}
                  data={card}
                  onExplore={() => router.push(`/company/${card.id}`)}
                  newActivityCount={newActivityCounts[card.id]}
                />
              ))}
            </>
          ) : null}

          {watchedDrugs.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>Drugs</Text>
              {watchedDrugs.map((asset) => (
                <Pressable
                  key={asset.drugId}
                  style={styles.entityCard}
                  onPress={() => router.push(`/company/${asset.companyId}`)}
                >
                  <View style={styles.entityCardHeader}>
                    <Text style={styles.entityName}>{asset.drugName}</Text>
                    <WatchButton entityType="drug" entityId={asset.drugId} size={18} />
                  </View>
                  <Text style={styles.entityMeta}>{asset.companyName}</Text>
                  <Text style={styles.entityMeta}>
                    {asset.target} · {asset.modality} · {asset.stage}
                  </Text>
                </Pressable>
              ))}
            </>
          ) : null}

          {watchedTargets.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>Targets</Text>
              {watchedTargets.map(({ target, assets }) => (
                <View key={target} style={styles.entityCard}>
                  <View style={styles.entityCardHeader}>
                    <Text style={styles.entityName}>{target}</Text>
                    <WatchButton entityType="target" entityId={target} size={18} />
                  </View>
                  {assets.length === 0 ? (
                    <Text style={styles.entityMeta}>
                      No programs against this target in BioLens yet.
                    </Text>
                  ) : (
                    assets.map((asset) => (
                      <Pressable
                        key={asset.drugId}
                        onPress={() => router.push(`/company/${asset.companyId}`)}
                      >
                        <Text style={styles.entityMetaLink}>
                          {asset.drugName} — {asset.companyName}
                        </Text>
                      </Pressable>
                    ))
                  )}
                </View>
              ))}
            </>
          ) : null}
        </>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  centeredRow: {
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  emptyState: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  emptyTitle: {
    ...typography.heading,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  emptyBody: {
    ...typography.body,
    color: colors.textSecondary,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  entityCard: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  entityCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  entityName: {
    ...typography.heading,
    fontSize: 16,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  entityMeta: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
  },
  entityMetaLink: {
    ...typography.caption,
    color: colors.accent,
    marginTop: spacing.xs,
  },
});
