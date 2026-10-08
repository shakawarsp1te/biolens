import React, { useMemo } from "react";
import { StyleSheet } from "react-native";
import { colors, typography } from "../../constants/theme";
import { useSignals } from "../../hooks/useCompanyData";
import type { CompanyRecord } from "../../types/domain";
import { buildAskBioLensContext } from "../../utils/askBiolensContext";
import AskBioLensBox from "../AskBioLensBox";
import ResearchDisclaimer from "../ResearchDisclaimer";
import SignalRow from "../SignalRow";
import Panel from "../ui/Panel";
import { Text } from "../ui/Text";
import { Columns } from "./Layout";
import { NumberedList, PanelState, SummaryPanel } from "./panels";

export default function ResearchTab({ company }: { company: CompanyRecord }) {
  const signals = useSignals(company.id);
  const items = signals?.status === "loaded" ? signals.data : [];
  const askContext = useMemo(() => buildAskBioLensContext(company), [company]);

  return (
    <Columns
      main={
        <>
          <Panel
            title="New papers and filings"
            meta={items.length ? `${items.length} most recent` : undefined}
            footer={<ResearchDisclaimer />}
          >
            {items.length === 0 ? (
              <PanelState resource={signals} empty="Nothing new found by BioLens's scan yet" />
            ) : (
              items.map((signal) => <SignalRow key={signal.id} signal={signal} />)
            )}
          </Panel>
        </>
      }
      side={
        <>
          <SummaryPanel company={company} />
          <Panel title="Why it surfaced">
            <NumberedList items={company.whyItSurfaced} />
          </Panel>
          <Panel title="Why investors are watching">
            <NumberedList items={company.whyItMatters} />
          </Panel>
          <Panel title="Ask BioLens">
            <Text style={styles.hint}>
              Answers use only the facts on this page — nothing from the open web.
            </Text>
            <AskBioLensBox facts={askContext.facts} sourceIds={askContext.sourceIds} />
          </Panel>
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  hint: { ...typography.caption, fontSize: 12, color: colors.textTertiary, marginBottom: 8 },
});
