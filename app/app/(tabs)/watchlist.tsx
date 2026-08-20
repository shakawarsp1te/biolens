import { useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import DiscoveryCard from "../../components/DiscoveryCard";
import ScreenShell from "../../components/ScreenShell";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { useWatchlist } from "../../context/WatchlistContext";
import { MOCK_DISCOVERY_CARDS } from "../../mocks/discoveryCards";

/**
 * Phase 9: real device-local persistence via WatchlistContext / AsyncStorage
 * (app/services/watchlist.ts) — not a stub. Tap the bookmark icon on any
 * Discovery Card to follow/unfollow a company; it shows up (or disappears)
 * here immediately, since both screens read the same context.
 *
 * Company lookup is against the Discover mock data since there's no live
 * `companies` table yet — the entries themselves (entityType/entityId)
 * already match that table's shape, so swapping this lookup for a real
 * fetch-by-id later doesn't change anything else about how this screen works.
 */
export default function WatchlistScreen() {
  const router = useRouter();
  const { entries, loading } = useWatchlist();

  const watchedCompanies = entries
    .filter((entry) => entry.entityType === "company")
    .map((entry) => MOCK_DISCOVERY_CARDS.find((card) => card.id === entry.entityId))
    .filter((card): card is (typeof MOCK_DISCOVERY_CARDS)[number] => card !== undefined);

  return (
    <ScreenShell title="Watchlist" subtitle="Companies, drugs, and targets you're following.">
      {loading ? (
        <View style={styles.centeredRow}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : watchedCompanies.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Nothing followed yet</Text>
          <Text style={styles.emptyBody}>
            Tap the bookmark icon on any company in Discover to follow it — it will show up here,
            and stays saved on this device even after you close the app.
          </Text>
        </View>
      ) : (
        watchedCompanies.map((card) => (
          <DiscoveryCard
            key={card.id}
            data={card}
            onExplore={() => router.push(`/company/${card.id}`)}
          />
        ))
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
});
