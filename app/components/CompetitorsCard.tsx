import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../constants/theme";
import { AssetCompetitors, getCompanyCompetitors } from "../services/api";
import ListContainer from "./ListContainer";

/**
 * Competitor pipelines: for each of this company's drugs, other companies'
 * active Phase 2+ industry trials naming the same target
 * (api/app/services/competitors.py) — grouped by company, linked to the
 * real ClinicalTrials.gov records. The footnote states the method's limit
 * plainly: a trial that names only its drug, not its target, isn't found.
 */
export default function CompetitorsCard({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [assets, setAssets] = useState<AssetCompetitors[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCompanyCompetitors(companyId)
      .then((result) => {
        if (!cancelled) setAssets(result);
      })
      .catch(() => {
        if (!cancelled) setAssets([]);
      });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const searchable = (assets ?? []).filter((a) => a.searchable);
  if (searchable.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Competitor pipelines</Text>
      {searchable.map((asset) => (
        <View key={asset.drugName} style={styles.asset}>
          <Text style={styles.assetTitle}>
            {asset.drugName} <Text style={styles.assetTarget}>· targets {asset.target}</Text>
          </Text>
          {!asset.available ? (
            <Text style={styles.empty}>Couldn&apos;t reach ClinicalTrials.gov just now.</Text>
          ) : asset.competitors.length === 0 ? (
            <Text style={styles.empty}>
              No other company&apos;s active Phase II+ trial names {asset.searchTerms.join(" or ")}{" "}
              in its title or drug description.
            </Text>
          ) : (
            <ListContainer>
              {asset.competitors.map((c) => (
                <View key={c.company} style={styles.row}>
                  <View style={styles.rowHeader}>
                    <Text
                      style={[styles.company, c.trackedCompanyId ? styles.link : null]}
                      onPress={
                        c.trackedCompanyId
                          ? () =>
                              router.push({
                                pathname: "/company/[id]",
                                params: { id: c.trackedCompanyId as string },
                              })
                          : undefined
                      }
                    >
                      {c.company}
                      {c.ticker ? <Text style={styles.ticker}> {c.ticker}</Text> : null}
                    </Text>
                    <Text style={styles.phase}>{c.mostAdvancedPhase}</Text>
                  </View>
                  {c.drugs.length > 0 ? (
                    <Text style={styles.drugs} numberOfLines={2}>
                      {c.drugs.join(", ")}
                    </Text>
                  ) : null}
                  <Text style={styles.trials}>
                    {c.trialCount} active trial{c.trialCount === 1 ? "" : "s"} ·{" "}
                    {c.trials.map((t, i) => (
                      <Text key={t.nctId}>
                        {i > 0 ? ", " : ""}
                        <Text style={styles.link} onPress={() => Linking.openURL(t.url)}>
                          {t.nctId}
                        </Text>
                      </Text>
                    ))}
                  </Text>
                </View>
              ))}
            </ListContainer>
          )}
        </View>
      ))}
      <Text style={styles.footnote}>
        From ClinicalTrials.gov: other companies&apos; recruiting or active Phase II+ trials that
        name the same target in their title or drug description. Trials that name only a drug, not
        its target, won&apos;t appear, so this is a starting map of the field, not a complete one.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.xl },
  heading: {
    ...typography.heading,
    fontSize: 17,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  asset: { marginBottom: spacing.md },
  assetTitle: { ...typography.label, color: colors.textPrimary, marginBottom: spacing.xs },
  assetTarget: { ...typography.caption, color: colors.textTertiary },
  empty: { ...typography.body, fontSize: 13.5, color: colors.textTertiary },
  row: { paddingVertical: spacing.sm + 2 },
  rowHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  company: {
    ...typography.label,
    color: colors.textPrimary,
    flexShrink: 1,
    paddingRight: spacing.sm,
  },
  ticker: { ...typography.caption, color: colors.textTertiary },
  phase: { ...typography.caption, color: colors.textSecondary },
  drugs: { ...typography.body, fontSize: 13.5, color: colors.textSecondary, marginTop: 2 },
  trials: { ...typography.caption, color: colors.textTertiary, marginTop: 2 },
  link: { color: colors.accent },
  footnote: {
    ...typography.body,
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: spacing.sm,
    lineHeight: 16,
  },
});
