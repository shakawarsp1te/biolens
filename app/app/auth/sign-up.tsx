import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import PasswordStrengthMeter from "../../components/PasswordStrengthMeter";
import ScreenShell from "../../components/ScreenShell";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { API_BASE_URL, ApiError } from "../../services/api";
import { isPasswordValid } from "../../utils/passwordPolicy";

type ScreenState =
  | { status: "form" }
  | { status: "submitting" }
  | { status: "error"; message: string; violations?: string[] }
  | { status: "created"; email: string; devVerificationToken: string | null };

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [state, setState] = useState<ScreenState>({ status: "form" });

  const emailLooksValid = EMAIL_PATTERN.test(email.trim());
  const passwordValid = isPasswordValid(password, email);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const canSubmit = emailLooksValid && passwordValid && passwordsMatch;

  async function handleSubmit() {
    if (!canSubmit) return;
    setState({ status: "submitting" });
    try {
      const result = await signUp(email.trim(), password);
      setState({
        status: "created",
        email: email.trim(),
        devVerificationToken: result.devVerificationToken,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setState({ status: "error", message: err.message, violations: err.violations });
      } else {
        setState({ status: "error", message: "Something went wrong. Please try again." });
      }
    }
  }

  if (state.status === "created") {
    const verifyUrl = state.devVerificationToken
      ? `${API_BASE_URL}/auth/verify?token=${state.devVerificationToken}`
      : null;
    return (
      <ScreenShell title="Check your email" subtitle={`We sent a verification link to ${state.email}.`}>
        {verifyUrl ? (
          <View style={styles.devBox}>
            <Text style={styles.devBoxTitle}>Development mode</Text>
            <Text style={styles.devBoxBody}>
              No real email service is configured on this backend yet, so nothing was actually
              delivered to that inbox. Tap below to open the same verification link a real email
              would contain.
            </Text>
            <Pressable style={styles.primaryButton} onPress={() => Linking.openURL(verifyUrl)}>
              <Text style={styles.primaryButtonText}>Open verification link</Text>
            </Pressable>
          </View>
        ) : null}
        <Pressable style={styles.secondaryButton} onPress={() => router.replace("/auth/log-in")}>
          <Text style={styles.secondaryButtonText}>Go to Log In</Text>
        </Pressable>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Create your account" subtitle="Track companies, drugs, and trials — free.">
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
      />

      <Text style={styles.label}>Password</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Create a password"
        placeholderTextColor={colors.textTertiary}
        style={styles.input}
        secureTextEntry
        autoCapitalize="none"
      />
      <PasswordStrengthMeter password={password} email={email} />

      <Text style={styles.label}>Confirm password</Text>
      <TextInput
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="Re-enter your password"
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
          {state.violations && state.violations.length > 0 ? (
            state.violations.map((v) => (
              <Text key={v} style={styles.errorText}>
                • {v}
              </Text>
            ))
          ) : (
            <Text style={styles.errorText}>{state.message}</Text>
          )}
        </View>
      ) : null}

      <Pressable
        style={[styles.primaryButton, !canSubmit && styles.primaryButtonDisabled]}
        onPress={handleSubmit}
        disabled={!canSubmit || state.status === "submitting"}
      >
        <Text style={styles.primaryButtonText}>
          {state.status === "submitting" ? "Creating account…" : "Create account"}
        </Text>
      </Pressable>

      <Pressable style={styles.linkRow} onPress={() => router.replace("/auth/log-in")}>
        <Text style={styles.linkText}>Already have an account? Log in</Text>
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
