import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import ScreenShell from "../../components/ScreenShell";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { ApiError } from "../../services/api";

const CONFIRM_PHRASE = "DELETE";

type ScreenState = { status: "form" } | { status: "submitting" } | { status: "error"; message: string };

/**
 * Destructive and irreversible, so it asks for two independent confirmations
 * (typing "DELETE" and the account password) rather than a single tap —
 * same bar as any hard-to-reverse action, just enforced in the UI since
 * there's no confirmation dialog primitive that works identically across
 * iOS/Android/web in this app.
 */
export default function DeleteAccountScreen() {
  const router = useRouter();
  const { deleteAccount } = useAuth();
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<ScreenState>({ status: "form" });

  const canSubmit = confirmText.trim().toUpperCase() === CONFIRM_PHRASE && password.length > 0;

  async function handleSubmit() {
    if (!canSubmit) return;
    setState({ status: "submitting" });
    try {
      await deleteAccount(password);
      router.replace("/(tabs)/profile");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Something went wrong.";
      setState({ status: "error", message });
    }
  }

  return (
    <ScreenShell
      title="Delete account"
      subtitle="This permanently deletes your BioLens account. This can't be undone."
    >
      <View style={styles.warningBox}>
        <Text style={styles.warningText}>
          Your watchlist and account will be gone for good — there is no recovery.
        </Text>
      </View>

      <Text style={styles.label}>Type DELETE to confirm</Text>
      <TextInput
        value={confirmText}
        onChangeText={setConfirmText}
        placeholder="DELETE"
        placeholderTextColor={colors.textTertiary}
        style={styles.input}
        autoCapitalize="characters"
        autoCorrect={false}
      />

      <Text style={styles.label}>Password</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Your password"
        placeholderTextColor={colors.textTertiary}
        style={styles.input}
        secureTextEntry
        autoCapitalize="none"
      />

      {state.status === "error" ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{state.message}</Text>
        </View>
      ) : null}

      <Pressable
        style={[styles.dangerButton, !canSubmit && styles.dangerButtonDisabled]}
        onPress={handleSubmit}
        disabled={!canSubmit || state.status === "submitting"}
      >
        <Text style={styles.dangerButtonText}>
          {state.status === "submitting" ? "Deleting…" : "Permanently delete my account"}
        </Text>
      </Pressable>

      <Pressable style={styles.cancelButton} onPress={() => router.back()}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </Pressable>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  warningBox: {
    backgroundColor: colors.mockDataBanner,
    borderRadius: radii.md,
    padding: spacing.sm + 2,
    marginBottom: spacing.md,
  },
  warningText: {
    ...typography.body,
    fontSize: 13,
    color: colors.textPrimary,
  },
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
  errorBox: {
    backgroundColor: colors.mockDataBanner,
    borderRadius: radii.md,
    padding: spacing.sm + 2,
    marginTop: spacing.md,
  },
  errorText: {
    ...typography.body,
    fontSize: 13,
    color: colors.textPrimary,
  },
  dangerButton: {
    backgroundColor: colors.loss,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm + 4,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  dangerButtonDisabled: {
    opacity: 0.4,
  },
  dangerButtonText: {
    ...typography.body,
    fontWeight: "700",
    color: "#04070D",
  },
  cancelButton: {
    paddingVertical: spacing.sm + 4,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  cancelButtonText: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
