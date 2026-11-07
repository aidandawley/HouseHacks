import type { ReactNode } from "react";
import { fmtPct, fmtUsd0 } from "../format";
import type { HouseholdInputs, Provenance, ReferenceSource } from "../types";
import { ProvenanceTag } from "./ProvenanceTag";

export type HouseholdKey = keyof HouseholdInputs;
export type HouseholdProvenance = Partial<Record<HouseholdKey, Provenance>>;

interface FieldSpec {
  key: HouseholdKey;
  label: string;
  /** Display multiplier: 100 shows a ratio as a percent. */
  scale?: number;
  step: number;
  min: number;
  max?: number;
  slider?: { min: number; max: number; step: number };
  hint?: string;
}

const F = {
  income: { key: "annual_income", label: "Annual household income ($)", step: 1000, min: 0, slider: { min: 30000, max: 200000, step: 1000 } },
  ratio: {
    key: "housing_cost_ratio",
    label: "Housing-cost ratio (% of income)",
    scale: 100,
    step: 0.5,
    min: 1,
    max: 100,
    slider: { min: 25, max: 40, step: 0.5 },
    hint: "ASSUMPTION. The organizers cite ~30–35% as guidance. This simplified model is not the HSC §50052.5 formula and does not assert legal compliance.",
  },
  rate: { key: "annual_mortgage_rate", label: "Mortgage rate (% APR)", scale: 100, step: 0.01, min: 0, max: 99 },
  other: {
    key: "other_housing_costs_monthly",
    label: "Taxes / insurance / HOA ($/month)",
    step: 25,
    min: 0,
    hint: "ASSUMPTION: flat monthly estimate; no real property-tax calculation.",
  },
  cash: { key: "buyer_cash_down_payment", label: "Buyer cash down payment ($)", step: 500, min: 0, hint: "Counted once, as part of the sale price." },
  term: { key: "mortgage_term_years", label: "Mortgage term (years)", step: 1, min: 1, max: 50 },
  size: { key: "household_size", label: "Household size", step: 1, min: 1, max: 8, hint: "Selects the income-limit reference row below." },
} satisfies Record<string, FieldSpec>;

const LIMIT_LABELS: Record<string, string> = {
  extremely_low: "Extremely low",
  very_low: "Very low",
  low: "Low",
  median: "Median",
  moderate: "Moderate",
};

interface Props {
  value: HouseholdInputs;
  provenance: HouseholdProvenance;
  onChange: (next: HouseholdInputs, key: HouseholdKey, kind: Provenance) => void;
  rateRefs: ReferenceSource[]; // newest first
  incomeLimitRef?: ReferenceSource;
}

function SourceNote({ src, children }: { src: ReferenceSource; children?: ReactNode }) {
  return (
    <span className="source-note">
      {children}
      <a href={src.landing_url ?? src.source_url} target="_blank" rel="noreferrer">
        {src.name}
      </a>{" "}
      · effective {src.effective_date} · checked {src.checked_at}. {src.limitations}
    </span>
  );
}

export function HouseholdControls({ value, provenance, onChange, rateRefs, incomeLimitRef }: Props) {
  const kindOf = (k: HouseholdKey): Provenance => provenance[k] ?? "assumption";

  const field = (f: FieldSpec, extra?: ReactNode) => {
    const scale = f.scale ?? 1;
    const shown = +(value[f.key] * scale).toFixed(6);
    const set = (raw: string) => {
      const n = Number(raw);
      if (raw === "" || !Number.isFinite(n)) return;
      onChange({ ...value, [f.key]: +(n / scale).toFixed(10) }, f.key, "user");
    };
    return (
      <label className="field" key={f.key}>
        <span className="label-row">
          {f.label}
          <ProvenanceTag kind={kindOf(f.key)} />
        </span>
        {f.slider && (
          <input type="range" min={f.slider.min} max={f.slider.max} step={f.slider.step} value={shown} onChange={(e) => set(e.target.value)} />
        )}
        <input type="number" min={f.min} max={f.max} step={f.step} value={shown} onChange={(e) => set(e.target.value)} />
        {f.hint && <span className="hint">{f.hint}</span>}
        {extra}
      </label>
    );
  };

  const activeRate = rateRefs.find((r) => kindOf("annual_mortgage_rate") === "published_rate" && r.value === value.annual_mortgage_rate);

  const rateExtras = (
    <>
      {rateRefs.map((r) => (
        <button
          key={r.id}
          type="button"
          className="preset"
          onClick={(e) => {
            e.preventDefault();
            onChange({ ...value, annual_mortgage_rate: r.value! }, "annual_mortgage_rate", "published_rate");
          }}
        >
          Use Freddie Mac {fmtPct(r.value!)} ({r.effective_date})
        </button>
      ))}
      {activeRate ? (
        <SourceNote src={activeRate} />
      ) : kindOf("annual_mortgage_rate") === "assumption" ? (
        <span className="hint">ASSUMPTION: 7% demo default, not a dated survey value.</span>
      ) : null}
    </>
  );

  const sizeIdx = incomeLimitRef?.household_sizes?.indexOf(value.household_size) ?? -1;
  const incomeExtras =
    incomeLimitRef && incomeLimitRef.limits ? (
      <span className="source-note">
        <ProvenanceTag kind="published_income_limit" /> Orange County, {value.household_size}-person (eligibility thresholds,
        not what a household can pay):
        {sizeIdx >= 0 ? (
          <table className="il">
            <tbody>
              {Object.entries(LIMIT_LABELS).map(([k, label]) => (
                <tr key={k}>
                  <td>{label}</td>
                  <td>{fmtUsd0(incomeLimitRef.limits![k][sizeIdx])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <> unknown for this household size.</>
        )}
        <a href={incomeLimitRef.source_url} target="_blank" rel="noreferrer">
          HCD 2026 State Income Limits
        </a>{" "}
        p.{incomeLimitRef.page} · revised {incomeLimitRef.effective_date} · checked {incomeLimitRef.checked_at}. The modeled
        income above is an ASSUMPTION, not an HCD limit.
      </span>
    ) : null;

  return (
    <div>
      {field(F.income, incomeExtras)}
      {field(F.ratio)}
      {field(F.rate, rateExtras)}
      {field(F.other)}
      <details>
        <summary>Advanced buyer assumptions</summary>
        {field(F.cash)}
        {field(F.term)}
        {field(F.size)}
      </details>
    </div>
  );
}
