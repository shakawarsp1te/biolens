import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import PasswordStrengthMeter from "../../components/PasswordStrengthMeter";
import ScreenShell from "../../components/ScreenShell";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { ApiError } from "../../services/api";
import { isPasswordValid } from "../../utils/passwordPolicy";

type ScreenState = { status: "form" } | { status: "submitting" } | { status: "error"; message: string };

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { changePassword, user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [state, setState] = useState<ScreenState>({ status: "form" });
  const [done, setDone] = useState(false);

  const newPasswordValid = isPasswordValid(newPassword, user?.email);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit = currentPassword.length > 0 && newPasswordValid && passwordsMatch;

  async function handleSubmit() {
    if (!canSubmit) return;
    setState({ status: "submitting" });
    try {
      await changePassword(currentPassword, newPassword);
      setDone(true);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Something went wrong.";
      setState({ status: "error", message });
    }
  }

  if (done) {
    return (
      <ScreenShell title="Password changed" subtitle="Use your new password next time you log in.">
        <Pressable style={styles.primaryButton} onPress={() => router.back()}>
          <Text style={styles.primaryButtonText}>Back to Profile</Text>
        </Pressable>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Change password" subtitle="You'll stay logged in on this device.">
      <Text style={styles.label}>Current password</Text>
      <TextInput
        value={currentPassword}
        onChangeText={setCurrentPassword}
        placeholder="Your current password"
        placeholderTextColor={colors.textTertiary}
        style={styles.input}
        secureTextEntry
        autoCapitalize="none"
      />

      <Text style={styles.label}>New password</Text>
      <TextInput
        value={newPassword}
        onChangeText={setNewPassword}
        placeholder="Create a new password"
        placeholderTextColor={colors.textTertiary}
        style={styles.input}
        secureTextEntry
        autoCapitalize="none"
      />
      <PasswordStrengthMeter password={newPassword} email={user?.email} />

      <Text style={styles.label}>Confirm new password</Text>
      <TextInput
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="Re-enter your new password"
        placeholderTextColor={colors.textTertiary}
        style={styles.input}
        secureTextEntry
        autoCapitalize="none"
      />
      {confirmPassword.length > 0 && !passwordsMatch ? (
        <Text style={styles.fieldError}>Passwords don&apos;t match.</Text>
      ) : null}

      {state.status === "error" ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{state.message}</Text>
        </View>
      ) : null}

      <Pressable
        style={[styles.primaryButton, !canSubmit && styles.primaryButtonDisabled]}
        onPress={handleSubmit}
        disabled={!canSubmit || state.status === "submitting"}
      >
        <Text style={styles.primaryButtonText}>
          {state.status === "submitting" ? "Changing…" : "Change password"}
        </Text>
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
  fieldError: {
    ...typography.caption,
    color: colors.loss,
    fontWeight: "400",
    marginTop: spacing.xs,
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
});
