import type { DevelopmentInputs, InputProvenance, Provenance } from "../types";
import { ProvenanceTag } from "./ProvenanceTag";

type Key = keyof DevelopmentInputs;

interface FieldSpec {
  key: Key;
  label: string;
  scale?: number; // 100 shows a ratio as a percent
  step: number;
  min: number;
  max?: number;
  slider?: { min: number; max: number; step: number };
  hint?: string;
}

const MAIN: FieldSpec[] = [
  { key: "hard_cost_per_sqft", label: "Hard cost ($ / sq ft)", step: 5, min: 0, slider: { min: 150, max: 600, step: 5 } },
  {
    key: "additional_subsidy_budget",
    label: "Extra-subsidy cap we can tolerate ($)",
    step: 25000,
    min: 0,
    slider: { min: 0, max: 4000000, step: 25000 },
    hint: "A budget constraint for the recommendation only — not money secured; never subtracted from the gap.",
  },
];

const ADVANCED: FieldSpec[] = [
  { key: "land_cost", label: "Land / acquisition ($)", step: 10000, min: 0 },
  { key: "site_work_cost", label: "Site work ($)", step: 5000, min: 0 },
  { key: "gross_sqft_per_home", label: "Gross sq ft per home", step: 10, min: 1 },
  { key: "soft_cost_rate", label: "Soft costs (% of hard)", scale: 100, step: 1, min: 0, max: 100 },
  { key: "contingency_rate", label: "Contingency (% of hard + site)", scale: 100, step: 1, min: 0, max: 100 },
  {
    key: "financing_rate",
    label: "Financing / carrying allowance (%)",
    scale: 100,
    step: 0.5,
    min: 0,
    max: 100,
    hint: "Coarse carrying-cost allowance, not an APR or loan model.",
  },
  { key: "illustrative_site_capacity", label: "Site capacity (homes)", step: 1, min: 0 },
];

interface Props {
  value: DevelopmentInputs;
  provenance: Record<string, InputProvenance>;
  candidateCounts: number[];
  selected: number | null;
  scenarioLabels: Record<string, string>;
  onSelect: (homes: number) => void;
  onChange: (next: DevelopmentInputs, key: Key) => void;
}

export function DevelopmentControls({ value, provenance, candidateCounts, selected, scenarioLabels, onSelect, onChange }: Props) {
  const field = (f: FieldSpec) => {
    const scale = f.scale ?? 1;
    const shown = +(value[f.key] * scale).toFixed(6);
    const p = provenance[`development.${f.key}`];
    const set = (raw: string) => {
      const n = Number(raw);
      if (raw === "" || !Number.isFinite(n)) return;
      onChange({ ...value, [f.key]: +(n / scale).toFixed(10) }, f.key);
    };
    return (
      <label className="field" key={f.key}>
        <span className="label-row">
          {f.label}
          <ProvenanceTag kind={(p?.kind as Provenance) ?? "assumption"} />
        </span>
        {f.slider && (
          <input type="range" min={f.slider.min} max={f.slider.max} step={f.slider.step} value={shown} onChange={(e) => set(e.target.value)} />
        )}
        <input type="number" min={f.min} max={f.max} step={f.step} value={shown} onChange={(e) => set(e.target.value)} />
        {f.hint && <span className="hint">{f.hint}</span>}
        {p?.note && p.kind !== "user" && <span className="hint">{p.note}</span>}
      </label>
    );
  };

  return (
    <div>
      <div className="field">
        <span className="label-row">Home count</span>
        <div className="seg">
          {candidateCounts.map((n) => (
            <button key={n} type="button" className={n === selected ? "on" : ""} onClick={() => onSelect(n)}>
              {n}
            </button>
          ))}
        </div>
        {selected !== null && scenarioLabels[String(selected)] && <span className="hint">{scenarioLabels[String(selected)]}</span>}
      </div>
      {MAIN.map(field)}
      <details>
        <summary>Land, site, soft-cost &amp; capacity assumptions</summary>
        {ADVANCED.map(field)}
      </details>
    </div>
  );
}
