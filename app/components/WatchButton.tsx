import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { colors, radii } from "../constants/theme";
import { useWatchlist } from "../context/WatchlistContext";
import { WatchlistEntityType } from "../services/watchlist";

/** Self-contained bookmark toggle — reads/writes the shared watchlist
 * context directly, so dropping it into any card makes that entity
 * watchable with no plumbing at the call site. */
export default function WatchButton({
  entityType,
  entityId,
  size = 20,
}: {
  entityType: WatchlistEntityType;
  entityId: string;
  size?: number;
}) {
  const { isWatched, toggle } = useWatchlist();
  const watched = isWatched(entityType, entityId);

  return (
    <Pressable
      style={styles.button}
      onPress={() => toggle(entityType, entityId)}
      hitSlop={8}
      accessibilityLabel={watched ? "Remove from watchlist" : "Add to watchlist"}
    >
      <Ionicons
        name={watched ? "bookmark" : "bookmark-outline"}
        size={size}
        color={colors.accent}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radii.pill,
  },
});
