import React from "react";
import { StyleSheet, Text } from "react-native";
import ScreenShell from "../components/ScreenShell";
import { colors, spacing, typography } from "../constants/theme";

/**
 * Plain-language privacy summary, reachable from Profile. Every statement
 * here describes what the code actually does -- keep it that way: if a
 * change adds data collection (analytics, server-side watchlists, logging
 * of questions), update this screen in the same change.
 *
 * Current facts it rests on: accounts are email + bcrypt hash
 * (api/app/services/auth.py), deletable via DELETE /auth/me; the watchlist
 * lives in on-device storage (services/watchlist.ts); Ask BioLens sends
 * the question plus the page's facts to the API, which calls Anthropic
 * (api/app/services/ask_biolens.py); the app itself only ever talks to
 * the BioLens API; no analytics or tracking SDK is included.
 */
export default function PrivacyScreen() {
  return (
    <ScreenShell title="Privacy" subtitle="What BioLens collects, and what it doesn't.">
      <Section title="You can use BioLens without an account">
        Browsing companies, search, calls and the track record all work signed out.
      </Section>

      <Section title="If you create an account">
        BioLens stores your email address and a securely hashed version of your password (never the
        password itself). Your email is used to verify your account and reset your password. You can
        delete your account at any time from Profile, which removes it from BioLens&apos;s servers.
      </Section>

      <Section title="Your watchlist stays on your device">
        The companies, drugs and targets you follow are saved on this device only. BioLens&apos;s
        servers don&apos;t receive or store them.
      </Section>

      <Section title="Ask BioLens">
        When you ask a question, it&apos;s sent with the facts on that page to BioLens&apos;s
        server, which passes it to Anthropic&apos;s Claude to write the answer. Don&apos;t include
        personal or financial details in questions.
      </Section>

      <Section title="No tracking">
        BioLens doesn&apos;t include analytics, advertising or tracking tools, and doesn&apos;t sell
        or share your information.
      </Section>

      <Section title="Where the data comes from">
        Research and market data come from ClinicalTrials.gov, PubMed, SEC EDGAR and market data
        providers, fetched by BioLens&apos;s server. Your device only talks to BioLens itself,
        except when you open a link to an original source.
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
