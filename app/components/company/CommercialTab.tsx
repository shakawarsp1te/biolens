import React, { useMemo } from "react";
import { StyleSheet } from "react-native";
import { colors, spacing, typography } from "../../constants/theme";
import { useFinancialHistory, useValuation } from "../../hooks/useCompanyData";
import type { CompanyRecord } from "../../types/domain";
import { formatIsoDate, formatUsdCompact } from "../../utils/format";
import DataTable, { Cell } from "../ui/DataTable";
import KeyValueTable from "../ui/KeyValueTable";
import Missing from "../ui/Missing";
import Panel from "../ui/Panel";
import PhaseIndicator, { phaseRank } from "../ui/PhaseIndicator";
import SourceNote from "../ui/SourceNote";
import { Text } from "../ui/Text";
import { Split, Stack } from "./Layout";
import { CompetitionPanel, NumberedList } from "./panels";

/**
 * What the company sells or could sell, who it competes with, and what
 * has to happen commercially. Only sourced facts: BioLens has no verified
 * source for drug pricing, payer coverage or market size, so the market
 * access panel says so instead of estimating.
 */
export default function CommercialTab({ company }: { company: CompanyRecord }) {
  const valuation = useValuation(company.ticker);
  const history = useFinancialHistory(company.ticker);
  const v = valuation?.status === "loaded" ? valuation.data : null;
  const years = history?.status === "loaded" ? (history.data?.years ?? []) : [];
  const latest = [...years].reverse().find((y) => y.revenue != null);

  const indications = useMemo(() => {
    const byDisease = new Map<string, { disease: string; assets: string[]; best: string }>();
    for (const asset of company.pipeline) {
      const row = byDisease.get(asset.disease) ?? {
        disease: asset.disease,
        assets: [],
        best: asset.stage,
      };
      row.assets.push(asset.drugName);
      if ((phaseRank(asset.stage) ?? 0) > (phaseRank(row.best) ?? 0)) row.best = asset.stage;
      byDisease.set(asset.disease, row);
    }
    return Array.from(byDisease.values());
  }, [company.pipeline]);

  return (
    <Stack>
      <Split>
        <Panel
          title="Revenue base"
          footer={
            v?.ttmRevenue != null || latest ? <SourceNote source="SEC EDGAR filings" /> : null
          }
        >
          {!company.ticker ? (
            <Missing label="Private company: no public revenue figures" />
          ) : (
            <KeyValueTable
              rows={[
                {
                  label: "Revenue, trailing 12 months",
                  value: v?.ttmRevenue != null ? formatUsdCompact(v.ttmRevenue) : null,
                  detail: v?.ttmRevenueThrough
                    ? `Through ${formatIsoDate(v.ttmRevenueThrough)}`
                    : null,
                  missingLabel: valuation?.status === "loading" ? "Loading…" : "Not in SEC filings",
                },
                {
                  label: "Revenue, latest fiscal year",
                  value: latest?.revenue != null ? formatUsdCompact(latest.revenue) : null,
                  detail: latest ? `FY${latest.year}` : null,
                  missingLabel: history?.status === "loading" ? "Loading…" : "Not in SEC filings",
                },
              ]}
            />
          )}
        </Panel>
        <Panel title="Market access & reimbursement">
          <Text style={styles.body}>
            Not covered yet. BioLens doesn&apos;t have a verified source for drug pricing, payer
            coverage, reimbursement decisions or addressable market size, so it doesn&apos;t
            estimate them.
          </Text>
          <Text style={styles.hint}>
            The company&apos;s own 10-K (Business and Risk Factors sections) is the primary source
            for its stated pricing and coverage risks.
          </Text>
        </Panel>
      </Split>

      <Panel
        title="Target indications"
        meta={`${indications.length} indication${indications.length === 1 ? "" : "s"}`}
        flush
        footer={<SourceNote source="BioLens company profile" />}
      >
        <DataTable
          minWidth={560}
          rows={indications}
          rowKey={(r) => r.disease}
          initialSort={{ key: "stage", direction: "desc" }}
          columns={[
            {
              key: "disease",
              title: "Indication",
              flex: 2,
              sortValue: (r) => r.disease,
              render: (r) => (
                <Cell strong numberOfLines={2}>
                  {r.disease}
                </Cell>
              ),
            },
            {
              key: "assets",
              title: "Company's assets",
              flex: 1.5,
              render: (r) => <Cell>{r.assets.join(", ")}</Cell>,
            },
            {
              key: "stage",
              title: "Most advanced",
              width: 190,
              sortValue: (r) => phaseRank(r.best),
              render: (r) => <PhaseIndicator phase={r.best} />,
            },
          ]}
        />
      </Panel>

      <CompetitionPanel companyId={company.id} />

      <Split>
        <Panel title="What has to go right" footer={<SourceNote source="BioLens thesis map" />}>
          <NumberedList items={company.thesisMap.whatHasToGoRight} />
        </Panel>
        <Panel title="What could go wrong" footer={<SourceNote source="BioLens thesis map" />}>
          <NumberedList items={company.thesisMap.whatCouldGoWrong} />
        </Panel>
      </Split>
    </Stack>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 13, lineHeight: 19, color: colors.textSecondary },
  hint: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: spacing.sm,
    lineHeight: 17,
  },
});
