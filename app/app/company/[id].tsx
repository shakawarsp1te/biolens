import { useLocalSearchParams } from "expo-router";
import React, { useMemo } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import AskBioLensBox from "../../components/AskBioLensBox";
import Avatar from "../../components/Avatar";
import CatalystCalendarCard from "../../components/CatalystCalendarCard";
import EvidenceBadge from "../../components/EvidenceBadge";
import FinancialHealthCard from "../../components/FinancialHealthCard";
import ListContainer from "../../components/ListContainer";
import PipelineAssetRow from "../../components/PipelineAssetRow";
import ScreenShell from "../../components/ScreenShell";
import StockQuoteCard from "../../components/StockQuoteCard";
import ThesisMap from "../../components/ThesisMap";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { useCompanies } from "../../context/CompaniesContext";
import { buildAskBioLensContext } from "../../utils/askBiolensContext";

/**
 * Company profile screen (BUILD_BRIEF.txt §18-21): BioLens Summary ->
 * Why It Matters -> Pipeline view -> Thesis Map, per the information
 * hierarchy rule (§65) of leading with "what matters" before depth.
 *
 * Reads as a document now, not a stack of identically-boxed "Section"
 * cards: BioLens Summary is a flowing lead paragraph, Why It Matters a
 * plain bullet list, Pipeline a divided row list, Thesis Map its own
 * distinct two-column module. Why It Surfaced and Key Risk (previously
 * repeated on every Discover list row) live here instead, since a list
 * row's job is to be scannable and a profile's job is to be complete.
 *
 * Companies are fetched live from GET /companies (CompaniesContext) rather
 * than bundled as static mock data, so the set of profiles that exist here
 * can grow (manual research or api/app/services/discovery.py's
 * auto-discovery) without shipping a new app build.
 */
export default function CompanyProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getById, isLoading } = useCompanies();
  const company = id ? getById(id) : undefined;
  // Hooks must run unconditionally on every render (even before the
  // not-found early return below), since `id` can change across renders of
  // the same mounted screen as the user navigates between profiles.
  const askContext = useMemo(
    () => (company ? buildAskBioLensContext(company) : { facts: [], sourceIds: [] }),
    [company],
  );

  if (isLoading) {
    return (
      <ScreenShell title="Loading…" subtitle="">
        <View style={styles.centeredRow}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </ScreenShell>
    );
  }

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
      subtitle={`${company.ticker ? company.ticker + " · " : ""}${company.status}${
        company.isMockData ? " · Illustrative data" : ""
      }${company.reviewStatus === "ai_drafted_unreviewed" ? " · AI-drafted, pending review" : ""}`}
    >
      {company.ticker ? <StockQuoteCard key={company.ticker} ticker={company.ticker} /> : null}

      <View style={styles.identityRow}>
        <Avatar name={company.name} size={44} />
        <View style={styles.headerMeta}>
          <MetaRow label="Primary focus" value={company.primaryFocus} />
          <MetaRow label="Technology" value={company.technology} />
        </View>
      </View>
      <EvidenceBadge level={company.confidence} />

      <Text style={styles.paragraph}>{company.biolensSummary}</Text>

      <View style={styles.keyRiskBlock}>
        <Text style={styles.keyRiskLabel}>Key risk</Text>
        <Text style={styles.keyRiskText}>{company.keyRisk}</Text>
      </View>

      <Text style={styles.heading}>Why it surfaced</Text>
      {company.whyItSurfaced.map((statement, i) => (
        <Text key={i} style={styles.bulletParagraph}>
          {"— "}
          {statement}
        </Text>
      ))}

      <Text style={styles.heading}>Why investors are watching</Text>
      {company.whyItMatters.map((statement, i) => (
        <Text key={i} style={styles.bulletParagraph}>
          {"— "}
          {statement}
        </Text>
      ))}

      <Text style={styles.heading}>Pipeline</Text>
      <ListContainer>
        {company.pipeline.map((asset) => (
          <PipelineAssetRow key={asset.drugId} asset={asset} />
        ))}
      </ListContainer>

      <CatalystCalendarCard key={company.id} companyId={company.id} />

      {company.ticker ? <FinancialHealthCard key={company.ticker} ticker={company.ticker} /> : null}

      <Text style={styles.heading}>Thesis map</Text>
      <View style={styles.thesisMapCard}>
        <ThesisMap data={company.thesisMap} />
      </View>

      <Text style={styles.heading}>Ask BioLens</Text>
      <Text style={styles.askSubtitle}>
        Answers are grounded strictly in what&apos;s on this page — nothing from the open web.
      </Text>
      <AskBioLensBox facts={askContext.facts} sourceIds={askContext.sourceIds} />
    </ScreenShell>
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
  centeredRow: {
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
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
  heading: {
    ...typography.heading,
    fontSize: 17,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    marginTop: spacing.xl,
  },
  paragraph: {
    ...typography.body,
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 24,
    marginTop: spacing.lg,
  },
  bulletParagraph: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  keyRiskBlock: {
    borderLeftWidth: 2,
    borderLeftColor: colors.accent,
    paddingLeft: spacing.md,
    marginTop: spacing.lg,
  },
  keyRiskLabel: {
    ...typography.label,
    color: colors.accent,
    marginBottom: 2,
  },
  keyRiskText: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 21,
  },
  thesisMapCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  askSubtitle: {
    ...typography.body,
    fontSize: 13,
    color: colors.textTertiary,
    marginBottom: spacing.md,
  },
});
