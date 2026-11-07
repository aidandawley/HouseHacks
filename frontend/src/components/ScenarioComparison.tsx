import { fmtCompact, fmtUsd0 } from "../format";
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
  const documentedMode = analysis.analysis_mode === "documented_configuration";
  const doc = analysis.documented_home_count;
  const rec = analysis.recommended_home_count;
  const target = documentedMode ? doc : rec;
  return (
    <div className={stale ? "stale" : undefined}>
      <p className="small muted" style={{ marginTop: 0 }}>
        All columns are calculated from the labeled assumptions — not Habitat's budget. Click a row to show it in 3D.
      </p>
      <table className="compare">
        <thead>
          <tr>
            <th>Homes</th>
            <th title="Total development cost">Cost to build</th>
            <th title="Sale proceeds">Families pay</th>
            <th>Counted funding</th>
            <th title="Remaining gap">Still to raise (modeled)</th>
            <th>Per home</th>
            <th>Screening note</th>
          </tr>
        </thead>
        <tbody>
          {analysis.scenarios.map((s) => {
            const whatIf = documentedMode && s.homes !== doc;
            return (
              <tr
                key={s.homes}
                className={`${s.homes === selected ? "sel" : ""}${whatIf ? " whatif-row" : ""}`}
                onClick={() => onSelect(s.homes)}
              >
                <td>
                  <strong>{s.homes}</strong>
                  {documentedMode && s.homes === doc && <span className="tag verified" style={{ marginLeft: 6 }}>documented</span>}
                  {!documentedMode && s.homes === rec && <span className="tag verified" style={{ marginLeft: 6 }}>best fit</span>}
                  {scenarioLabels[String(s.homes)] && <div className="small muted">{scenarioLabels[String(s.homes)]}</div>}
                </td>
                <td>{fmtUsd0(s.total_development_cost)}</td>
                <td>{fmtUsd0(s.sale_proceeds)}</td>
                <td>{fmtUsd0(s.counted_project_support)}</td>
                <td>
                  <strong>{fmtUsd0(s.remaining_gap)}</strong>
                </td>
                <td>{fmtUsd0(s.gap_per_home)}</td>
                <td className={!s.within_capacity ? "no" : s.eligible ? "ok" : "neutral"}>
                  {!s.within_capacity
                    ? documentedMode
                      ? "exceeds approved count"
                      : "✗ over site capacity"
                    : s.remaining_gap === 0
                      ? "✓ fully covered"
                      : s.eligible
                        ? "✓ within assumed raisable funding"
                        : `${fmtCompact(-s.additional_budget_headroom)} beyond assumed raisable funding`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="small">
        <button type="button" disabled={target === null} onClick={() => target !== null && onSelect(target)}>
          {documentedMode ? "Show documented configuration" : "Find best configuration"}
        </button>{" "}
        {analysis.recommendation_reason}
      </p>
      {!documentedMode && (
        <p className="small muted">
          “Best fit” = most homes whose modeled gap is within the additional funding you assume could be raised and within site
          capacity. A screening signal, not an approval or a buildability claim.
        </p>
      )}
    </div>
  );
}
