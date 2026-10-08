import React from "react";
import { Linking } from "react-native";
import { colors } from "../../constants/theme";
import { useCatalysts } from "../../hooks/useCompanyData";
import type { CompanyRecord } from "../../types/domain";
import DataTable, { Cell } from "../ui/DataTable";
import Missing from "../ui/Missing";
import Panel from "../ui/Panel";
import { phaseRank } from "../ui/PhaseIndicator";
import SourceNote from "../ui/SourceNote";
import { Text } from "../ui/Text";
import { catalystDate, EVENT_LABEL, PanelState } from "./panels";

export default function CatalystsTab({ company }: { company: CompanyRecord }) {
  const catalysts = useCatalysts(company.id);
  const events = catalysts?.status === "loaded" ? catalysts.data : [];
  const drugName = (drugId: string | null) =>
    company.pipeline.find((a) => a.drugId === drugId)?.drugName ?? null;

  return (
    <Panel
      title="Catalyst calendar"
      meta={events.length ? `${events.length} disclosed dates` : undefined}
      flush={events.length > 0}
      footer={
        <SourceNote source="ClinicalTrials.gov">
          each date is the sponsor&apos;s own disclosed estimate for that trial. Sponsors revise
          them, so read them as a direction, not a deadline
        </SourceNote>
      }
    >
      {events.length === 0 ? (
        <PanelState
          resource={catalysts}
          empty="No upcoming dates disclosed on ClinicalTrials.gov"
        />
      ) : (
        <DataTable
          minWidth={720}
          rows={events}
          rowKey={(e) => e.id}
          initialSort={{ key: "date", direction: "asc" }}
          onRowPress={(e) => Linking.openURL(e.sourceUrl)}
          columns={[
            {
              key: "date",
              title: "Expected",
              width: 120,
              sortValue: (e) => e.expectedDate,
              render: (e) => <Cell strong>{catalystDate(e)}</Cell>,
            },
            {
              key: "basis",
              title: "Basis",
              width: 90,
              render: (e) => (
                <Cell muted>{e.dateType === "ESTIMATED" ? "Estimated" : "Actual"}</Cell>
              ),
            },
            {
              key: "event",
              title: "Event",
              width: 140,
              render: (e) => <Cell>{EVENT_LABEL[e.eventType]}</Cell>,
            },
            {
              key: "drug",
              title: "Therapy",
              flex: 1,
              render: (e) => {
                const name = drugName(e.drugId);
                return name ? <Cell>{name}</Cell> : <Missing label="Not matched" />;
              },
            },
            {
              key: "phase",
              title: "Phase",
              width: 90,
              sortValue: (e) => phaseRank(e.phase),
              render: (e) => (e.phase ? <Cell>{e.phase}</Cell> : <Missing label="Not listed" />),
            },
            {
              key: "nct",
              title: "Source",
              width: 120,
              render: (e) => (
                <Text style={{ fontSize: 12, color: colors.accent }}>{e.nctId} ↗</Text>
              ),
            },
          ]}
        />
      )}
    </Panel>
  );
}
