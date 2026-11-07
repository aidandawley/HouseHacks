import type { ReactNode } from "react";
import { fmtUsd } from "../format";
import type { CompareResponse, ScenarioResult } from "../types";
import { ProvenanceTag } from "./ProvenanceTag";

interface Props {
  analysis: CompareResponse | null;
  scenario: ScenarioResult | null;
  stale: boolean;
}

function Row({ label, value, big, strong }: { label: ReactNode; value: number; big?: boolean; strong?: boolean }) {
  return (
    <div className={`kpi${big ? " big" : ""}`}>
      <span>{label}</span>
      <span className="value" style={strong ? undefined : { fontWeight: 500 }}>
        {fmtUsd(value)}
      </span>
    </div>
  );
}

/** Displays backend-computed figures only. Never computes finance locally. */
export function FinancialSummary({ analysis, scenario, stale }: Props) {
  if (!analysis) return <p className="muted">No analysis yet.</p>;
  const a = analysis.affordability;
  const s = scenario;
  return (
    <div className={stale ? "stale" : undefined}>
      <p className="small muted" style={{ marginTop: 0 }}>
        Every figure below is <ProvenanceTag kind="computed" /> by the backend from the labeled inputs.
      </p>
      {!a.affordability_valid && (
        <div className="banner warn" style={{ margin: "0 0 8px" }}>
          Not feasible: other monthly housing costs use up the whole housing budget, so no mortgage is supportable.
        </div>
      )}
      <Row label="Affordable price ceiling / home" value={a.affordable_sale_price_per_home} big strong />
      <div className="small muted">
        {fmtUsd(a.monthly_housing_budget)}/mo budget → {fmtUsd(a.monthly_principal_interest_available)}/mo P&amp;I →{" "}
        {fmtUsd(a.mortgage_principal)} mortgage
      </div>

      {s && (
        <>
          <h3 className="sub">{s.homes} homes</h3>
          <details>
            <summary>
              <Row label="Total development cost" value={s.total_development_cost} strong />
            </summary>
            <Row label="Land" value={s.land_cost} />
            <Row label="Site work" value={s.site_work_cost} />
            <Row label="Hard construction" value={s.hard_cost} />
            <Row label="Soft costs" value={s.soft_cost} />
            <Row label="Contingency" value={s.contingency} />
            <Row label="Financing / carrying" value={s.financing_cost} />
          </details>
          <Row label={`− Sale proceeds (${s.homes} × price)`} value={s.sale_proceeds} />
          <Row label="− Counted funding (assumed / modeled)" value={s.counted_project_support} />
          <Row label="Remaining gap" value={s.remaining_gap} big strong />
          {s.modeled_surplus > 0 && <Row label="Modeled surplus" value={s.modeled_surplus} />}
          <Row label="Gap per home" value={s.gap_per_home} />
          <div className="small" style={{ marginTop: 6 }}>
            {s.within_capacity ? "✓ within site capacity" : "✗ exceeds site capacity"} ·{" "}
            {s.within_subsidy_cap
              ? `✓ fits extra-subsidy cap (${fmtUsd(s.additional_budget_headroom)} headroom)`
              : `✗ ${fmtUsd(-s.additional_budget_headroom)} over the extra-subsidy cap`}
          </div>
        </>
      )}
      <p className="hint small muted">
        A financing scenario, not permission to charge buyers more than program rules allow. Simplified: no loan draws,
        amortization, matching requirements, subsidy-layering rules or program eligibility.
      </p>
    </div>
  );
}
