import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../constants/theme";
import { checkPasswordRules } from "../utils/passwordPolicy";

/** Live checklist against utils/passwordPolicy.ts's rules — the same rules
 * api/app/services/password_policy.py authoritatively re-checks on signup.
 * Hidden entirely until the user starts typing, so an empty field doesn't
 * greet them with a wall of red X's. */
export default function PasswordStrengthMeter({
  password,
  email,
}: {
  password: string;
  email?: string;
}) {
  if (password.length === 0) return null;

  const rules = checkPasswordRules(password, email);
  const passedCount = rules.filter((rule) => rule.passed).length;
  const allPassed = passedCount === rules.length;

  return (
    <View style={styles.container}>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            {
              width: `${(passedCount / rules.length) * 100}%`,
              backgroundColor: allPassed ? colors.gain : colors.accent,
            },
          ]}
        />
      </View>
      {rules.map((rule) => (
        <Text key={rule.label} style={[styles.ruleText, rule.passed && styles.ruleTextPassed]}>
          {rule.passed ? "✓" : "•"} {rule.label}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  barTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceRaised,
    overflow: "hidden",
    marginBottom: spacing.sm,
  },
  barFill: {
    height: 4,
    borderRadius: 2,
  },
  ruleText: {
    ...typography.caption,
    color: colors.textTertiary,
    fontWeight: "400",
    marginBottom: 2,
  },
  ruleTextPassed: {
    color: colors.gain,
  },
});
