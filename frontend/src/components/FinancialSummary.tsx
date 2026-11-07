import { fmtUsd } from "../format";
import type { CompareResponse } from "../types";
import { ProvenanceTag } from "./ProvenanceTag";

interface Props {
  analysis: CompareResponse | null;
  stale: boolean;
}

/** Displays backend-computed figures only. Never computes finance locally. */
export function FinancialSummary({ analysis, stale }: Props) {
  if (!analysis) return <p className="muted">No analysis yet.</p>;
  const a = analysis.affordability;
  return (
    <div className={stale ? "stale" : undefined}>
      {!a.affordability_valid && (
        <div className="banner warn" style={{ margin: "0 0 8px" }}>
          Not feasible: other monthly housing costs use up the whole housing budget, so no mortgage is supportable.
        </div>
      )}
      <div className="kpi big">
        <span>
          Affordable price ceiling / home <ProvenanceTag kind="computed" />
        </span>
        <span className="value">{fmtUsd(a.affordable_sale_price_per_home)}</span>
      </div>
      <div className="kpi">
        <span>Monthly housing budget</span>
        <span className="value">{fmtUsd(a.monthly_housing_budget)}</span>
      </div>
      <div className="kpi">
        <span>Available for principal + interest</span>
        <span className="value">{fmtUsd(a.monthly_principal_interest_available)}</span>
      </div>
      <div className="kpi">
        <span>Estimated mortgage principal</span>
        <span className="value">{fmtUsd(a.mortgage_principal)}</span>
      </div>
      <p className="hint small muted">
        A financing scenario from illustrative/user inputs — not permission to charge buyers more than program rules allow.
        Development cost and funding gap arrive in the next milestone.
      </p>
    </div>
  );
}
