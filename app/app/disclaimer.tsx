import React from "react";
import { StyleSheet, Text } from "react-native";
import ScreenShell from "../components/ScreenShell";
import { colors, spacing, typography } from "../constants/theme";

/**
 * The full "not investment advice" statement, reachable from Profile. The
 * wording tracks docs/PLAN.md §3 rule 10 -- the conditions BioLens's calls
 * are designed around (impersonal, grounded, published on a regular
 * schedule, never an instruction) -- so the app says plainly what it does
 * and doesn't do. Have a securities lawyer review before charging for the
 * product; this is honest plain language, not legal advice.
 */
export default function DisclaimerScreen() {
  return (
    <ScreenShell title="Not investment advice" subtitle="What BioLens is, and what it isn't.">
      <Section title="General research, the same for everyone">
        BioLens publishes research commentary about biotechnology companies: summaries of clinical
        trials, papers, SEC filings and financial data, and BioLens&apos;s read on whether a new
        paper or filing is likely good or bad news for a company. Every reader sees the same
        information. Nothing in BioLens is tailored to your finances, holdings or goals.
      </Section>

      <Section title="Never a recommendation">
        BioLens never tells you to buy, sell or hold any security, never sets a price target, and
        never predicts a stock price or price move. A call like &quot;likely positive&quot; is a
        read on what the evidence means for the company, not a forecast of the stock. Ask BioLens
        declines questions about your own investments.
      </Section>

      <Section title="Not a licensed adviser">
        BioLens is not a registered investment adviser, broker-dealer or financial planner. For
        advice about your own situation, talk to a licensed professional.
      </Section>

      <Section title="Calls can be wrong">
        BioLens&apos;s calls are judgments about incomplete evidence, and some will be wrong. The
        track record shows every call and how it compared with the stock afterward, misses included.
        Past calls don&apos;t predict future ones, and stocks move for many reasons besides any
        single paper or filing.
      </Section>

      <Section title="Data can be delayed, incomplete or mistaken">
        BioLens draws on ClinicalTrials.gov, PubMed, SEC EDGAR and market data providers. Sources
        can be delayed, incomplete or corrected after the fact, and BioLens&apos;s own calculations
        (like cash runway and enterprise value) are only as good as what companies report. Profiles
        drafted by AI are labeled as pending review until a person checks them. Always check the
        linked original source before relying on anything.
      </Section>

      <Section title="Your decisions are yours">
        Investing in biotechnology is risky, and you can lose money. You&apos;re responsible for
        your own investment decisions.
      </Section>
    </ScreenShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <Text style={styles.heading}>{title}</Text>
      <Text style={styles.body}>{children}</Text>
    </>
  );
}

const styles = StyleSheet.create({
  heading: {
    ...typography.heading,
    fontSize: 16,
    color: colors.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  body: { ...typography.body, color: colors.textSecondary },
});
