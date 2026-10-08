import { useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from "react-native";
import { Text } from "../../components/ui/Text";
import Avatar from "../../components/Avatar";
import ListContainer from "../../components/ListContainer";
import ScreenShell from "../../components/ScreenShell";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";

// Hidden until set (app/.env.example): it ships in the bundle, so it must be
// an address meant to be public.
const FEEDBACK_EMAIL = process.env.EXPO_PUBLIC_FEEDBACK_EMAIL;

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
          <Pressable
            style={styles.secondaryButton}
            onPress={() => router.push("/auth/change-password")}
          >
            <Text style={styles.secondaryButtonText}>Change password</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={logOut}>
            <Text style={styles.secondaryButtonText}>Log out</Text>
          </Pressable>
          <Pressable style={styles.dangerLink} onPress={() => router.push("/auth/delete-account")}>
            <Text style={styles.dangerLinkText}>Delete account</Text>
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

      <Text style={styles.sectionTitle}>About BioLens</Text>
      <ListContainer>
        <LinkRow label="Not investment advice" onPress={() => router.push("/disclaimer")} />
        <LinkRow label="Privacy" onPress={() => router.push("/privacy")} />
        <LinkRow label="Track record of past calls" onPress={() => router.push("/track-record")} />
        {FEEDBACK_EMAIL ? (
          <LinkRow
            label="Send beta feedback"
            onPress={() =>
              Linking.openURL(
                `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent("BioLens beta feedback")}`,
              )
            }
          />
        ) : null}
      </ListContainer>

      <Text style={styles.disclaimer}>
        BioLens surfaces research activity and clinical evidence for biotechnology companies. It
        never recommends buying, selling, or holding any security, and nothing in this app is
        investment advice.
      </Text>
    </ScreenShell>
  );
}

function LinkRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.linkRow} accessibilityRole="link">
      <Text style={styles.linkLabel}>{label}</Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    ...typography.heading,
    fontSize: 17,
    color: colors.textPrimary,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  linkRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm + 4,
  },
  linkLabel: { ...typography.body, color: colors.textPrimary },
  chevron: { ...typography.body, color: colors.textTertiary },
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
  dangerLink: {
    alignItems: "center",
    marginTop: spacing.md,
  },
  dangerLinkText: {
    ...typography.caption,
    color: colors.loss,
  },
  disclaimer: {
    ...typography.caption,
    color: colors.textTertiary,
    fontWeight: "400",
    marginTop: spacing.lg,
    lineHeight: 16,
  },
});
