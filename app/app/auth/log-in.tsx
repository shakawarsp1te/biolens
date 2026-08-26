import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput } from "react-native";
import Callout from "../../components/Callout";
import ScreenShell from "../../components/ScreenShell";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { ApiError, resendVerification } from "../../services/api";

type ScreenState =
  | { status: "form" }
  | { status: "submitting" }
  | { status: "error"; message: string }
  | { status: "unverified" }
  | { status: "resent" };

export default function LogInScreen() {
  const router = useRouter();
  const { logIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<ScreenState>({ status: "form" });

  const canSubmit = email.trim().length > 0 && password.length > 0;

  async function handleSubmit() {
    if (!canSubmit) return;
    setState({ status: "submitting" });
    try {
      await logIn(email.trim(), password);
      router.replace("/(tabs)/profile");
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setState({ status: "unverified" });
      } else if (err instanceof ApiError) {
        setState({ status: "error", message: err.message });
      } else {
        setState({ status: "error", message: "Something went wrong. Please try again." });
      }
    }
  }

  async function handleResend() {
    try {
      await resendVerification(email.trim());
      setState({ status: "resent" });
    } catch {
      setState({ status: "error", message: "Couldn't resend the verification email. Try again." });
    }
  }

  return (
    <ScreenShell title="Log in" subtitle="Welcome back.">
      <Text style={styles.label}>Email</Text>
      <TextInput
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          if (state.status !== "form" && state.status !== "submitting") setState({ status: "form" });
        }}
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
        placeholder="Your password"
        placeholderTextColor={colors.textTertiary}
        style={styles.input}
        secureTextEntry
        autoCapitalize="none"
        onSubmitEditing={handleSubmit}
      />

      {state.status === "error" ? <Text style={styles.errorText}>{state.message}</Text> : null}

      {state.status === "unverified" ? (
        <Callout>
          Please verify your email before logging in — check your inbox for the link.{" "}
          <Text style={styles.linkText} onPress={handleResend}>
            Resend verification email
          </Text>
        </Callout>
      ) : null}

      {state.status === "resent" ? (
        <Callout>If that email exists and isn&apos;t verified yet, we&apos;ve sent a new link.</Callout>
      ) : null}

      <Pressable
        style={[styles.primaryButton, !canSubmit && styles.primaryButtonDisabled]}
        onPress={handleSubmit}
        disabled={!canSubmit || state.status === "submitting"}
      >
        <Text style={styles.primaryButtonText}>
          {state.status === "submitting" ? "Logging in…" : "Log in"}
        </Text>
      </Pressable>

      <Pressable style={styles.linkRow} onPress={() => router.push("/auth/forgot-password")}>
        <Text style={styles.linkText}>Forgot password?</Text>
      </Pressable>

      <Pressable style={styles.linkRow} onPress={() => router.replace("/auth/sign-up")}>
        <Text style={styles.linkText}>Don&apos;t have an account? Sign up</Text>
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
  errorText: {
    ...typography.body,
    fontSize: 13,
    color: colors.loss,
    marginTop: spacing.md,
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
  linkRow: {
    marginTop: spacing.lg,
    alignItems: "center",
  },
  linkText: {
    ...typography.body,
    color: colors.accent,
  },
});
