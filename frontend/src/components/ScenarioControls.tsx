import { fmtCompact } from "../format";
import type { FundingSource } from "../types";

/** The one place to choose the home count. */
export function HomesSelector({
  counts,
  selected,
  documented,
  labels,
  onSelect,
}: {
  counts: number[];
  selected: number | null;
  documented: number | null;
  labels: Record<string, string>;
  onSelect: (n: number) => void;
}) {
  const note =
    selected === null
      ? null
      : documented !== null
        ? selected === documented
          ? "Documented configuration"
          : "Conceptual — not approved or zoning-verified"
        : (labels[String(selected)] ?? null);
  return (
    <div className="field">
      <div className="label-row">
        <span>Homes</span>
        {documented !== null && (
          <span className={`tag ${selected === documented ? "verified" : "reference"}`}>
            {selected === documented ? "DOCUMENTED" : "WHAT-IF"}
          </span>
        )}
      </div>
      <div className="seg">
        {counts.map((n) => (
          <button
            key={n}
            type="button"
            className={`${n === selected ? "on" : ""}${documented !== null && n !== documented ? " whatif" : ""}`}
            onClick={() => onSelect(n)}
          >
            {n}
          </button>
        ))}
      </div>
      {note && <span className="hint">{note}</span>}
    </div>
  );
}

/** The one place to set the modeled amount of a documented conditional grant. */
export function ConditionalGrantControl({
  row,
  onChange,
}: {
  row: FundingSource;
  onChange: (amount: number) => void;
}) {
  const max = row.documented_max ?? 0;
  const counted = row.status === "conditional";
  return (
    <div className="field">
      <div className="label-row">
        <span>City grant you model</span>
        <span className="tag conditional" title="Conditional grant agreement; disbursement UNKNOWN. The amount here is your assumption.">
          CONDITIONAL
        </span>
      </div>
      <div className="grant-value">
        <strong>{fmtCompact(row.amount ?? 0)}</strong> <span className="muted">of up to {fmtCompact(max)}</span>
      </div>
      <input
        type="range"
        aria-label="City grant modeled amount"
        min={0}
        max={max}
        step={50000}
        value={row.amount ?? 0}
        disabled={!counted}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="hint">
        {counted ? "Disbursement unknown — never assumed paid." : "Set to “potential” in Funding Stack — not counted."}
      </span>
    </div>
  );
}
