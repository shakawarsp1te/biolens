import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import ScreenShell from "../../components/ScreenShell";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { API_BASE_URL } from "../../services/api";

type ScreenState =
  | { status: "form" }
  | { status: "submitting" }
  | { status: "sent"; devResetToken: string | null };

/**
 * Requests a password-reset link. The reset itself happens on a web page
 * (GET/POST /auth/reset-password) opened from the email — same pattern as
 * email verification — so this screen's job ends at "we sent the link."
 */
export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<ScreenState>({ status: "form" });

  async function handleSubmit() {
    if (email.trim().length === 0) return;
    setState({ status: "submitting" });
    const result = await requestPasswordReset(email.trim());
    setState({ status: "sent", devResetToken: result.devResetToken });
  }

  if (state.status === "sent") {
    const resetUrl = state.devResetToken
      ? `${API_BASE_URL}/auth/reset-password?token=${state.devResetToken}`
      : null;
    return (
      <ScreenShell
        title="Check your email"
        subtitle="If that address has a BioLens account, we've sent a reset link."
      >
        {resetUrl ? (
          <View style={styles.devBox}>
            <Text style={styles.devBoxTitle}>Development mode</Text>
            <Text style={styles.devBoxBody}>
              No real email service is configured on this backend yet. Tap below to open the
              same reset link a real email would contain.
            </Text>
            <Pressable style={styles.primaryButton} onPress={() => Linking.openURL(resetUrl)}>
              <Text style={styles.primaryButtonText}>Open reset link</Text>
            </Pressable>
          </View>
        ) : null}
        <Pressable style={styles.secondaryButton} onPress={() => router.replace("/auth/log-in")}>
          <Text style={styles.secondaryButtonText}>Back to Log In</Text>
        </Pressable>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="Reset your password"
      subtitle="Enter your email and we'll send a link to choose a new password."
    >
      <Text style={styles.label}>Email</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        placeholderTextColor={colors.textTertiary}
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        onSubmitEditing={handleSubmit}
      />
      <Pressable
        style={[styles.primaryButton, email.trim().length === 0 && styles.primaryButtonDisabled]}
        onPress={handleSubmit}
        disabled={email.trim().length === 0 || state.status === "submitting"}
      >
        <Text style={styles.primaryButtonText}>
          {state.status === "submitting" ? "Sending…" : "Send reset link"}
        </Text>
      </Pressable>
      <Pressable style={styles.linkRow} onPress={() => router.replace("/auth/log-in")}>
        <Text style={styles.linkText}>Back to Log In</Text>
      </Pressable>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  label: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    fontSize: 15,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm + 4,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    ...typography.body,
    fontWeight: "700",
    color: "#04070D",
  },
  secondaryButton: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm + 4,
    alignItems: "center",
    marginTop: spacing.md,
  },
  secondaryButtonText: {
    ...typography.body,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  linkRow: {
    marginTop: spacing.lg,
    alignItems: "center",
  },
  linkText: {
    ...typography.body,
    color: colors.accent,
  },
  devBox: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  devBoxTitle: {
    ...typography.heading,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  devBoxBody: {
    ...typography.body,
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
});
