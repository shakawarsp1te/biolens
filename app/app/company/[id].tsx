import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import CatalystsTab from "../../components/company/CatalystsTab";
import CommercialTab from "../../components/company/CommercialTab";
import CompanyHeader from "../../components/company/CompanyHeader";
import FinancialsTab from "../../components/company/FinancialsTab";
import OverviewTab from "../../components/company/OverviewTab";
import PipelineTab from "../../components/company/PipelineTab";
import ResearchTab from "../../components/company/ResearchTab";
import { COMPANY_TABS, isCompanyTab, type CompanyTabKey } from "../../components/shell/routes";
import TabBar from "../../components/ui/TabBar";
import { Text } from "../../components/ui/Text";
import { colors, spacing, typography } from "../../constants/theme";
import { useCompanies } from "../../context/CompaniesContext";
import { useIsWideWeb } from "../../utils/layout";

/**
 * Company dashboard. A fixed header (identity, price, key figures) over
 * six views of the same company. The active view lives in the URL
 * (`?tab=financials`), so it survives a reload, can be linked to, and the
 * sidebar's company section can switch it.
 *
 * Every number on these views comes from a named source (SEC filings,
 * ClinicalTrials.gov, the market-data feed) or is labeled BioLens
 * calculated; anything BioLens doesn't have is shown as missing, in words,
 * never as zero or an estimate.
 */
export default function CompanyDashboardScreen() {
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const router = useRouter();
  const { getById, isLoading } = useCompanies();
  const isWide = useIsWideWeb();
  const company = id ? getById(id) : undefined;
  const active: CompanyTabKey = isCompanyTab(tab) ? tab : "overview";
  const goTo = (next: CompanyTabKey) => router.setParams({ tab: next });

  if (!company) {
    return (
      <View style={styles.centered}>
        {isLoading ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <>
            <Text style={styles.notFoundTitle}>Company not found</Text>
            <Text style={styles.notFoundBody}>
              BioLens has no profile for this company. Search for it in the top bar, or browse the
              Company Explorer.
            </Text>
          </>
        )}
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, isWide && styles.contentWide]}
    >
      <CompanyHeader company={company} />
      <View style={styles.tabs}>
        <TabBar tabs={[...COMPANY_TABS]} active={active} onChange={goTo} />
      </View>
      {active === "overview" ? <OverviewTab company={company} goTo={goTo} /> : null}
      {active === "financials" ? <FinancialsTab company={company} /> : null}
      {active === "pipeline" ? <PipelineTab company={company} /> : null}
      {active === "commercial" ? <CommercialTab company={company} /> : null}
      {active === "research" ? <ResearchTab company={company} /> : null}
      {active === "catalysts" ? <CatalystsTab company={company} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    width: "100%",
    maxWidth: 1480,
    alignSelf: "center",
  },
  contentWide: { padding: spacing.xl, paddingTop: spacing.lg },
  tabs: { marginTop: spacing.md, marginBottom: spacing.md },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.sm,
  },
  notFoundTitle: { ...typography.title, color: colors.textPrimary },
  notFoundBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    maxWidth: 420,
  },
});
