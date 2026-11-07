import type { DevelopmentInputs, InputProvenance, Provenance } from "../types";
import { Field } from "./Field";
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
  prefix?: string;
  suffix?: string;
  hint?: string;
}

const ESSENTIAL: FieldSpec[] = [
  {
    key: "hard_cost_per_sqft",
    label: "Construction cost",
    prefix: "$",
    suffix: "/ sq ft",
    step: 5,
    min: 0,
    slider: { min: 150, max: 600, step: 5 },
    hint: "Hard construction cost. Not taken from the 2020 Terner Center paper.",
  },
];

const ADVANCED: FieldSpec[] = [
  { key: "land_cost", label: "Land / acquisition", prefix: "$", step: 10000, min: 0 },
  { key: "site_work_cost", label: "Site work", prefix: "$", step: 5000, min: 0 },
  { key: "gross_sqft_per_home", label: "Floor area per home", suffix: "sq ft", step: 10, min: 1 },
  { key: "soft_cost_rate", label: "Design, permits & fees", suffix: "% of construction", scale: 100, step: 1, min: 0, max: 100 },
  { key: "contingency_rate", label: "Cushion for surprises", suffix: "% of constr. + site", scale: 100, step: 1, min: 0, max: 100 },
  {
    key: "financing_rate",
    label: "Interest & holding while building",
    suffix: "%",
    scale: 100,
    step: 0.5,
    min: 0,
    max: 100,
    hint: "Coarse carrying-cost allowance, not an APR or loan model.",
  },
  {
    key: "property_tax_carry",
    label: "Property taxes while held",
    prefix: "$",
    step: 1000,
    min: 0,
    hint: "Total property tax paid while the nonprofit holds and builds (all homes). A possible exemption can only reduce this line — the Funding Advisor refuses savings if it is $0.",
  },
  { key: "illustrative_site_capacity", label: "Max homes on this site", suffix: "homes", step: 1, min: 0 },
  {
    key: "additional_subsidy_budget",
    label: "Additional funding you assume could be raised",
    prefix: "$",
    step: 25000,
    min: 0,
    hint: "A comparison line for the scenario table only — not money secured, never subtracted from the gap.",
  },
];

interface Props {
  section: "essential" | "advanced";
  value: DevelopmentInputs;
  provenance: Record<string, InputProvenance>;
  onChange: (next: DevelopmentInputs, key: Key) => void;
}

export function DevelopmentControls({ section, value, provenance, onChange }: Props) {
  const field = (f: FieldSpec) => {
    const scale = f.scale ?? 1;
    const p = provenance[`development.${f.key}`];
    const note = p?.note && p.kind !== "user" ? p.note : undefined;
    return (
      <Field
        key={f.key}
        label={f.label}
        value={+((value[f.key] ?? 0) * scale).toFixed(6)}
        onChange={(raw) => {
          const n = Number(raw);
          if (raw === "" || !Number.isFinite(n)) return;
          onChange({ ...value, [f.key]: +(n / scale).toFixed(10) }, f.key);
        }}
        step={f.step}
        min={f.min}
        max={f.max}
        slider={f.slider}
        prefix={f.prefix}
        suffix={f.suffix}
        tag={<ProvenanceTag kind={(p?.kind as Provenance) ?? "assumption"} />}
        info={
          f.hint || note ? (
            <>
              {f.hint && <p>{f.hint}</p>}
              {note && <p>{note}</p>}
            </>
          ) : undefined
        }
      />
    );
  };
  return <>{(section === "essential" ? ESSENTIAL : ADVANCED).map(field)}</>;
}
