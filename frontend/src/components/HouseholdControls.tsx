import type { ReactNode } from "react";
import { fmtPct, fmtUsd0 } from "../format";
import type { HouseholdInputs, Provenance, ReferenceSource } from "../types";
import { Field } from "./Field";
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
  prefix?: string;
  suffix?: string;
  hint?: string;
}

const F = {
  income: {
    key: "annual_income",
    label: "Household income",
    prefix: "$",
    suffix: "/ yr",
    step: 1000,
    min: 0,
    slider: { min: 30000, max: 200000, step: 1000 },
  },
  rate: {
    key: "annual_mortgage_rate",
    label: "Mortgage rate",
    suffix: "%",
    scale: 100,
    step: 0.01,
    min: 0,
    max: 99,
    hint: "Freddie Mac PMMS is a national average for conventional 30-year loans — not a Habitat or CalHFA buyer's rate.",
  },
  ratio: {
    key: "housing_cost_ratio",
    label: "Share of income for housing",
    suffix: "%",
    scale: 100,
    step: 0.5,
    min: 1,
    max: 100,
    hint: "ASSUMPTION. The organizers cite ~30–35% as guidance. This simplified model is not the HSC §50052.5 formula and does not assert legal compliance.",
  },
  other: {
    key: "other_housing_costs_monthly",
    label: "Taxes, insurance & HOA",
    prefix: "$",
    suffix: "/ mo",
    step: 25,
    min: 0,
    hint: "ASSUMPTION: flat monthly estimate; no real property-tax calculation.",
  },
  cash: {
    key: "buyer_cash_down_payment",
    label: "Buyer cash down payment",
    prefix: "$",
    step: 500,
    min: 0,
    hint: "Counted once, as part of the sale price — never again as project funding.",
  },
  term: { key: "mortgage_term_years", label: "Mortgage term", suffix: "years", step: 1, min: 1, max: 50 },
  size: { key: "household_size", label: "Household size", suffix: "people", step: 1, min: 1, max: 8 },
} satisfies Record<string, FieldSpec>;

const LIMIT_LABELS: Record<string, string> = {
  extremely_low: "Extremely low",
  very_low: "Very low",
  low: "Low",
  median: "Median",
  moderate: "Moderate",
};

interface Props {
  /** "essential" = sidebar basics; "advanced" = collapsed assumptions. */
  section: "essential" | "advanced";
  value: HouseholdInputs;
  provenance: HouseholdProvenance;
  /** Per-field provenance notes from the project file (e.g. why a value was chosen). */
  notes?: Partial<Record<HouseholdKey, string>>;
  onChange: (next: HouseholdInputs, key: HouseholdKey, kind: Provenance) => void;
  rateRefs: ReferenceSource[]; // newest first
  incomeLimitRef?: ReferenceSource;
}

function SourceNote({ src }: { src: ReferenceSource }) {
  return (
    <>
      <a href={src.landing_url ?? src.source_url} target="_blank" rel="noreferrer">
        {src.name}
      </a>{" "}
      · effective {src.effective_date} · checked {src.checked_at}. {src.limitations}
    </>
  );
}

export function HouseholdControls({ section, value, provenance, notes, onChange, rateRefs, incomeLimitRef }: Props) {
  const kindOf = (k: HouseholdKey): Provenance => provenance[k] ?? "assumption";

  const field = (f: FieldSpec, opts?: { extraInfo?: ReactNode; children?: ReactNode }) => {
    const scale = f.scale ?? 1;
    const note = notes?.[f.key] && kindOf(f.key) !== "user" ? notes[f.key] : undefined;
    const info =
      f.hint || note || opts?.extraInfo ? (
        <>
          {f.hint && <p>{f.hint}</p>}
          {note && <p>{note}</p>}
          {opts?.extraInfo}
        </>
      ) : undefined;
    return (
      <Field
        key={f.key}
        label={f.label}
        value={+(value[f.key] * scale).toFixed(6)}
        onChange={(raw) => {
          const n = Number(raw);
          if (raw === "" || !Number.isFinite(n)) return;
          onChange({ ...value, [f.key]: +(n / scale).toFixed(10) }, f.key, "user");
        }}
        step={f.step}
        min={f.min}
        max={f.max}
        slider={f.slider}
        prefix={f.prefix}
        suffix={f.suffix}
        tag={<ProvenanceTag kind={kindOf(f.key)} />}
        info={info}
      >
        {opts?.children}
      </Field>
    );
  };

  if (section === "essential") {
    const activeRate = rateRefs.find(
      (r) => kindOf("annual_mortgage_rate") === "published_rate" && r.value === value.annual_mortgage_rate,
    );
    return (
      <>
        {field(F.income)}
        {field(F.rate, {
          extraInfo: activeRate ? (
            <p>
              <SourceNote src={activeRate} />
            </p>
          ) : kindOf("annual_mortgage_rate") === "assumption" ? (
            <p>ASSUMPTION: not a dated survey value.</p>
          ) : null,
          children: (
            <div className="preset-row" aria-label="Freddie Mac published rates">
              {rateRefs.map((r, i) => (
                <button
                  key={r.id}
                  type="button"
                  className={`chip-btn${activeRate?.id === r.id ? " on" : ""}`}
                  title={`Freddie Mac PMMS 30-yr, week of ${r.effective_date}`}
                  onClick={() => onChange({ ...value, annual_mortgage_rate: r.value! }, "annual_mortgage_rate", "published_rate")}
                >
                  {fmtPct(r.value!)} {i === 0 ? "latest" : r.effective_date?.slice(5)}
                </button>
              ))}
            </div>
          ),
        })}
      </>
    );
  }

  const sizeIdx = incomeLimitRef?.household_sizes?.indexOf(value.household_size) ?? -1;
  const incomeLimitInfo =
    incomeLimitRef && incomeLimitRef.limits ? (
      <>
        <p>
          <ProvenanceTag kind="published_income_limit" /> Orange County, {value.household_size}-person — eligibility thresholds,
          not what a household can pay:
        </p>
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
          <p>Unknown for this household size.</p>
        )}
        <p>
          <a href={incomeLimitRef.source_url} target="_blank" rel="noreferrer">
            HCD 2026 State Income Limits
          </a>{" "}
          p.{incomeLimitRef.page} · revised {incomeLimitRef.effective_date} · checked {incomeLimitRef.checked_at}. The modeled
          income is an ASSUMPTION, not an HCD limit. In Orange County HCD's Low Income row is higher than its Median row — that is
          how the table reads. 80% of the 4-person median is {fmtUsd0(Math.round(incomeLimitRef.limits.median[3] * 0.8))}{" "}
          (arithmetic, not a published limit).
        </p>
      </>
    ) : undefined;

  return (
    <>
      {field(F.size, { extraInfo: incomeLimitInfo })}
      {field(F.ratio)}
      {field(F.other)}
      {field(F.cash)}
      {field(F.term)}
    </>
  );
}
