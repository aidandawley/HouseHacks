import { fmtCompact, fmtDelta, fmtUsd } from "../format";
import type { ScenarioResult } from "../types";

interface Props {
  scenario: ScenarioResult | null;
  baseline: ScenarioResult | null; // same home count, from the pinned baseline run
  baselineLabel: string;
  scenarioLabel: string | null;
  stale: boolean;
  onPinBaseline: () => void;
}

function Delta({ now, base, goodWhenDown }: { now: number; base: number | undefined; goodWhenDown?: boolean }) {
  if (base === undefined || Math.abs(now - base) < 0.5) return null;
  const d = now - base;
  const good = goodWhenDown ? d < 0 : d > 0;
  return <span className={`delta ${good ? "good" : "bad"}`}>{fmtDelta(d)} vs baseline</span>;
}

/** The four numbers that answer "does it pencil?" — shown once, here. Backend figures only. */
export function KpiCards({ scenario: s, baseline, baselineLabel, scenarioLabel, stale, onPinBaseline }: Props) {
  return (
    <div className={`kpis${stale ? " stale" : ""}`}>
      <div className="kpi-card">
        <span className="kpi-label">Homes</span>
        <span className="kpi-value">{s ? s.homes : "—"}</span>
        <span className="kpi-sub">{scenarioLabel ?? " "}</span>
      </div>
      <div className="kpi-card" title={s ? `Total development cost: ${fmtUsd(s.total_development_cost)}` : undefined}>
        <span className="kpi-label">Total development cost</span>
        <span className="kpi-value">{s ? fmtCompact(s.total_development_cost) : "—"}</span>
        <span className="kpi-sub">{s ? `${fmtCompact(s.per_home.total_cost)} per home · modeled` : " "}</span>
        {s && <Delta now={s.total_development_cost} base={baseline?.total_development_cost} goodWhenDown />}
      </div>
      <div className="kpi-card" title={s ? `Sale proceeds: ${fmtUsd(s.sale_proceeds)}` : undefined}>
        <span className="kpi-label">Buyer proceeds</span>
        <span className="kpi-value">{s ? fmtCompact(s.sale_proceeds) : "—"}</span>
        <span className="kpi-sub">{s ? `${fmtCompact(s.sale_price_per_home)} affordable price per home` : " "}</span>
        {s && <Delta now={s.sale_proceeds} base={baseline?.sale_proceeds} />}
      </div>
      <div className="kpi-card gap" title={s ? `Remaining gap: ${fmtUsd(s.remaining_gap)}` : undefined}>
        <span className="kpi-label">Remaining funding gap</span>
        <span className="kpi-value">{s ? (s.remaining_gap > 0 ? fmtCompact(s.remaining_gap) : "$0") : "—"}</span>
        <span className="kpi-sub">
          {s
            ? s.remaining_gap > 0
              ? `${fmtCompact(s.gap_per_home)} per home · after ${fmtCompact(s.counted_project_support)} counted funding`
              : `fully covered · ${fmtCompact(s.modeled_surplus)} surplus`
            : " "}
        </span>
        {s && <Delta now={s.remaining_gap} base={baseline?.remaining_gap} goodWhenDown />}
      </div>
      <div className="kpi-meta">
        <span>Modeled from labeled assumptions — not Habitat's budget.</span>
        <button type="button" className="link-btn" onClick={onPinBaseline} title="Compare future changes against the current numbers">
          Set baseline
        </button>
        <span className="muted">({baselineLabel})</span>
      </div>
    </div>
  );
}
