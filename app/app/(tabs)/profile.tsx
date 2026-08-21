import { useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Avatar from "../../components/Avatar";
import ScreenShell from "../../components/ScreenShell";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";

export default function ProfileScreen() {
  const { user, isLoading, logOut } = useAuth();
  const router = useRouter();

  return (
    <ScreenShell title="Profile" subtitle="Account, disclaimers, and app settings.">
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : user ? (
        <View style={styles.accountCard}>
          <View style={styles.identityRow}>
            <Avatar name={user.email} size={44} />
            <View style={styles.identityMeta}>
              <Text style={styles.email}>{user.email}</Text>
              <Text style={styles.verifiedBadge}>
                {user.is_verified ? "✓ Verified" : "Not verified"}
              </Text>
            </View>
          </View>
          <Pressable style={styles.secondaryButton} onPress={logOut}>
            <Text style={styles.secondaryButtonText}>Log out</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.accountCard}>
          <Text style={styles.paragraph}>
            Create a free account to save your watchlist and personalize BioLens.
          </Text>
          <Pressable style={styles.primaryButton} onPress={() => router.push("/auth/sign-up")}>
            <Text style={styles.primaryButtonText}>Create account</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => router.push("/auth/log-in")}>
            <Text style={styles.secondaryButtonText}>Log in</Text>
          </Pressable>
        </View>
      )}

      <Text style={styles.disclaimer}>
        BioLens surfaces research activity and clinical evidence for biotechnology companies. It
        never recommends buying, selling, or holding any security, and nothing in this app is
        investment advice.
      </Text>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  centered: {
    paddingVertical: spacing.xl,
    alignItems: "center",
  },
  accountCard: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  identityMeta: {
    marginLeft: spacing.md,
  },
  email: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  verifiedBadge: {
    ...typography.caption,
    color: colors.gain,
    marginTop: 2,
  },
  paragraph: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm + 4,
    alignItems: "center",
  },
  primaryButtonText: {
    ...typography.body,
    fontWeight: "700",
    color: "#04070D",
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm + 4,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  secondaryButtonText: {
    ...typography.body,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  disclaimer: {
    ...typography.caption,
    color: colors.textTertiary,
    fontWeight: "400",
    marginTop: spacing.lg,
    lineHeight: 16,
  },
});
