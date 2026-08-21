import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radii, spacing, typography } from "../constants/theme";
import { ApiError, askBioLens } from "../services/api";

type AskState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "answered"; answer: string; hasSufficientEvidence: boolean };

// BUILD_BRIEF.txt §57's own example questions.
const EXAMPLE_QUESTIONS = [
  "Why is this target important?",
  "How strong is this trial?",
  "What is the biggest remaining uncertainty?",
];

/**
 * BUILD_BRIEF.txt §57: "Ask BioLens" on every analysis page. Scoped
 * strictly to the facts/sourceIds passed in by the caller — this component
 * never reaches for anything else, matching the backend's "no open-web
 * fallback" rule. When the API says evidence is insufficient, that's shown
 * plainly rather than styled as a failure — refusing to guess is the
 * correct outcome, not an error state.
 */
export default function AskBioLensBox({ facts, sourceIds }: { facts: string[]; sourceIds: string[] }) {
  const [question, setQuestion] = useState("");
  const [state, setState] = useState<AskState>({ status: "idle" });

  async function submit(questionText?: string) {
    const trimmed = (questionText ?? question).trim();
    if (!trimmed) return;
    setState({ status: "loading" });
    try {
      const result = await askBioLens({ question: trimmed, facts, sourceIds });
      setState({
        status: "answered",
        answer: result.answer,
        hasSufficientEvidence: result.has_sufficient_evidence,
      });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Something went wrong.";
      setState({ status: "error", message });
    }
  }

  function askExample(example: string) {
    setQuestion(example);
    submit(example);
  }

  return (
    <View>
      <View style={styles.inputRow}>
        <TextInput
          value={question}
          onChangeText={setQuestion}
          onSubmitEditing={() => submit()}
          placeholder="Ask a question about this company..."
          placeholderTextColor={colors.textTertiary}
          style={styles.input}
          returnKeyType="send"
        />
        <Pressable
          style={({ pressed }) => [
            styles.button,
            question.trim().length === 0 && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => submit()}
          disabled={question.trim().length === 0}
        >
          <Text style={styles.buttonText}>Ask</Text>
        </Pressable>
      </View>

      {state.status === "idle" ? (
        <View style={styles.examples}>
          {EXAMPLE_QUESTIONS.map((example) => (
            <Pressable key={example} onPress={() => askExample(example)} style={styles.exampleChip}>
              <Text style={styles.exampleText}>{example}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {state.status === "loading" ? (
        <View style={styles.centeredRow}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : null}

      {state.status === "error" ? <Text style={styles.errorText}>{state.message}</Text> : null}

      {state.status === "answered" ? (
        <View style={[styles.answerBox, !state.hasSufficientEvidence && styles.answerBoxInsufficient]}>
          <Text style={styles.answerText}>{state.answer}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    fontSize: 15,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    marginLeft: spacing.xs,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    ...typography.caption,
    color: "#04070D",
    fontWeight: "700",
  },
  examples: {
    marginTop: spacing.sm,
  },
  exampleChip: {
    paddingVertical: spacing.xs,
  },
  exampleText: {
    ...typography.body,
    color: colors.accent,
  },
  centeredRow: {
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  errorText: {
    ...typography.body,
    color: colors.confidenceModerate,
    marginTop: spacing.sm,
  },
  answerBox: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  answerBoxInsufficient: {
    backgroundColor: colors.mockDataBanner,
  },
  answerText: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 21,
  },
});
