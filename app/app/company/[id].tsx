import { useLocalSearchParams } from "expo-router";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import AskBioLensBox from "../../components/AskBioLensBox";
import Avatar from "../../components/Avatar";
import EvidenceBadge from "../../components/EvidenceBadge";
import MockDataFlag from "../../components/MockDataFlag";
import PipelineAssetRow from "../../components/PipelineAssetRow";
import ScreenShell from "../../components/ScreenShell";
import ThesisMap from "../../components/ThesisMap";
import { colors, spacing, typography } from "../../constants/theme";
import { MOCK_COMPANY_PROFILES } from "../../mocks/companyProfile";
import { buildAskBioLensContext } from "../../utils/askBiolensContext";

/**
 * Company profile screen (BUILD_BRIEF.txt §18-21): BioLens Summary ->
 * Why It Matters -> Pipeline view -> Thesis Map, per the information
 * hierarchy rule (§65) of leading with "what matters" before depth.
 *
 * Four real profiles exist as mock data today (Janux, Cardiff, Erasca,
 * Xencor — all four of Discover's Discovery Cards), looked up by id so each
 * "Explore" button actually opens the company that was tapped, not always
 * the same one.
 */
export default function CompanyProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const company = id ? MOCK_COMPANY_PROFILES[id] : undefined;
  // Hooks must run unconditionally on every render (even before the
  // not-found early return below), since `id` can change across renders of
  // the same mounted screen as the user navigates between profiles.
  const askContext = useMemo(
    () => (company ? buildAskBioLensContext(company) : { facts: [], sourceIds: [] }),
    [company],
  );

  if (!company) {
    return (
      <ScreenShell title="Company not found" subtitle="No profile exists yet for this company.">
        <Text style={styles.paragraph}>
          Only companies shown on Discover have a profile today — go back and tap one of those.
        </Text>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title={company.name}
      subtitle={`${company.ticker ? company.ticker + " · " : ""}${company.status}`}
    >
      {company.isMockData ? <MockDataFlag /> : null}

      <View style={styles.identityRow}>
        <Avatar name={company.name} size={44} />
        <View style={styles.headerMeta}>
          <MetaRow label="Primary focus" value={company.primaryFocus} />
          <MetaRow label="Technology" value={company.technology} />
        </View>
      </View>
      <EvidenceBadge level={company.confidence} />

      <Section title="BioLens Summary">
        <Text style={styles.paragraph}>{company.biolensSummary}</Text>
      </Section>

      <Section title="Why investors are watching">
        {company.whyItMatters.map((statement, i) => (
          <Text key={i} style={styles.bulletParagraph}>
            {"• "}
            {statement}
          </Text>
        ))}
      </Section>

      <Section title="Pipeline">
        {company.pipeline.map((asset) => (
          <PipelineAssetRow key={asset.drugId} asset={asset} />
        ))}
      </Section>

      <Section title="Thesis Map">
        <ThesisMap data={company.thesisMap} />
      </Section>

      <Section title="Ask BioLens">
        <Text style={styles.askSubtitle}>
          Answers are grounded strictly in what&apos;s on this page — nothing from the open web.
        </Text>
        <AskBioLensBox facts={askContext.facts} sourceIds={askContext.sourceIds} />
      </Section>
    </ScreenShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <Text style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}: </Text>
      {value}
    </Text>
  );
}

const styles = StyleSheet.create({
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  headerMeta: {
    marginLeft: spacing.md,
    flexShrink: 1,
  },
  metaRow: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  metaLabel: {
    color: colors.textTertiary,
  },
  section: {
    marginTop: spacing.lg,
  },
  sectionTitle: {
    ...typography.title,
    fontSize: 19,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  paragraph: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  bulletParagraph: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  askSubtitle: {
    ...typography.caption,
    color: colors.textTertiary,
    marginBottom: spacing.sm,
  },
});
