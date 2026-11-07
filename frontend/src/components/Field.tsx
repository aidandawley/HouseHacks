import { type ReactNode, useId } from "react";

interface Props {
  label: string;
  value: number;
  onChange: (raw: string) => void;
  step: number;
  min: number;
  max?: number;
  slider?: { min: number; max: number; step: number };
  prefix?: string;
  suffix?: string;
  tag?: ReactNode;
  /** Long explanations / source notes — collapsed behind an ⓘ toggle. */
  info?: ReactNode;
  children?: ReactNode;
}

/** One labeled numeric input with its provenance tag; explanations are progressive-disclosure. */
export function Field({ label, value, onChange, step, min, max, slider, prefix, suffix, tag, info, children }: Props) {
  const id = useId();
  return (
    <div className="field">
      <div className="label-row">
        <label htmlFor={id}>{label}</label>
        {tag}
      </div>
      <div className="input-row">
        {prefix && <span className="affix">{prefix}</span>}
        <input id={id} type="number" min={min} max={max} step={step} value={value} onChange={(e) => onChange(e.target.value)} />
        {suffix && <span className="affix">{suffix}</span>}
      </div>
      {slider && (
        <input
          type="range"
          aria-label={label}
          min={slider.min}
          max={slider.max}
          step={slider.step}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {children}
      {info && (
        <details className="info">
          <summary>ⓘ details</summary>
          <div className="info-body">{info}</div>
        </details>
      )}
    </div>
  );
}
