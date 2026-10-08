import React from "react";
import type { CompanyRecord } from "../../types/domain";
import { Columns } from "./Layout";
import {
  CompetitionPanel,
  KeyDataPanel,
  MilestonesPanel,
  PipelineSummaryPanel,
  PricePanel,
  RisksPanel,
  RunwayPanel,
  SummaryPanel,
  type GoToTab,
} from "./panels";

/** The snapshot: price and summary on the left, the figures and dates an
 * analyst checks first on the right, each linking into its full tab. */
export default function OverviewTab({ company, goTo }: { company: CompanyRecord; goTo: GoToTab }) {
  return (
    <Columns
      main={
        <>
          {company.ticker ? <PricePanel ticker={company.ticker} /> : null}
          <PipelineSummaryPanel company={company} onViewAll={() => goTo("pipeline")} />
          <CompetitionPanel companyId={company.id} limit={5} onViewAll={() => goTo("commercial")} />
          <SummaryPanel company={company} />
        </>
      }
      side={
        <>
          <KeyDataPanel ticker={company.ticker} />
          <RunwayPanel ticker={company.ticker} />
          <MilestonesPanel companyId={company.id} onViewAll={() => goTo("catalysts")} />
          <RisksPanel company={company} />
        </>
      }
    />
  );
}
