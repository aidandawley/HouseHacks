import { fmtUsd0 } from "../format";
import type { CompareResponse } from "../types";

interface Props {
  analysis: CompareResponse | null;
  selected: number | null;
  scenarioLabels: Record<string, string>;
  stale: boolean;
  onSelect: (homes: number) => void;
}

export function ScenarioComparison({ analysis, selected, scenarioLabels, stale, onSelect }: Props) {
  if (!analysis) return <p className="muted">No analysis yet.</p>;
  const rec = analysis.recommended_home_count;
  return (
    <div className={stale ? "stale" : undefined}>
      <table className="compare">
        <thead>
          <tr>
            <th>Homes</th>
            <th>Total cost</th>
            <th>Sale proceeds</th>
            <th>Counted funding</th>
            <th>Remaining gap</th>
            <th>Gap / home</th>
            <th>Screening result</th>
          </tr>
        </thead>
        <tbody>
          {analysis.scenarios.map((s) => (
            <tr key={s.homes} className={s.homes === selected ? "sel" : undefined} onClick={() => onSelect(s.homes)}>
              <td>
                <strong>{s.homes}</strong>
                {s.homes === rec && <span className="tag verified" style={{ marginLeft: 6 }}>best fit</span>}
                {scenarioLabels[String(s.homes)] && <div className="small muted">{scenarioLabels[String(s.homes)]}</div>}
              </td>
              <td>{fmtUsd0(s.total_development_cost)}</td>
              <td>{fmtUsd0(s.sale_proceeds)}</td>
              <td>{fmtUsd0(s.counted_project_support)}</td>
              <td>
                <strong>{fmtUsd0(s.remaining_gap)}</strong>
              </td>
              <td>{fmtUsd0(s.gap_per_home)}</td>
              <td className={s.eligible ? "ok" : "no"}>
                {s.eligible
                  ? "✓ fits cap & capacity"
                  : !s.within_capacity
                    ? "✗ over site capacity"
                    : `✗ ${fmtUsd0(-s.additional_budget_headroom)} over cap`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="small">
        <button type="button" disabled={rec === null} onClick={() => rec !== null && onSelect(rec)}>
          Find best configuration
        </button>{" "}
        {analysis.recommendation_reason}
      </p>
      <p className="small muted">
        “Best fit” = most homes whose remaining gap fits the assumed extra-subsidy cap and site capacity. A screening signal,
        not an approval or a buildability claim.
      </p>
    </div>
  );
}
