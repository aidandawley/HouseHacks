import { fmtCompact, fmtPct1, fmtUsd0 } from "../format";
import type { ScenarioResult } from "../types";

interface Props {
  scenario: ScenarioResult | null;
  gift: number;
  hardCostPerSqft: number;
  stale: boolean;
  onGiftChange: (n: number) => void;
  onAddToStack: () => void;
}

const COST_LINES: { key: keyof ScenarioResult["per_home"]; label: string; color: string }[] = [
  { key: "land", label: "Land", color: "#a3b18a" },
  { key: "site_work", label: "Site work", color: "#c9b79c" },
  { key: "hard", label: "Construction", color: "#7c9cbf" },
  { key: "soft", label: "Design, permits & fees", color: "#b8a1d9" },
  { key: "contingency", label: "Cushion for surprises", color: "#e0b866" },
  { key: "financing", label: "Interest & holding", color: "#d9a3a3" },
  { key: "property_tax", label: "Property taxes", color: "#9fb3c8" },
];

/**
 * Organizer scenario M03 — "If I give $25,000, what does that actually pay for?"
 * Every figure comes from the backend (per-home lines and GiftImpact). Bar widths are
 * display proportions of those figures.
 */
export function GiftExplainer({ scenario, gift, hardCostPerSqft, stale, onGiftChange, onAddToStack }: Props) {
  if (!scenario) return <p className="muted">No analysis yet.</p>;
  const ph = scenario.per_home;
  const g = scenario.gift;
  const total = Math.max(ph.total_cost, ph.family_pays + ph.counted_funding + ph.gap) || 1;
  const pctW = (n: number) => `${Math.max(0, (n / total) * 100)}%`;
  const giftInGap = Math.min(gift, ph.gap);

  return (
    <div className={`gift${stale ? " stale" : ""}`}>
      <label className="gift-input">
        A gift of{" "}
        <input
          type="number"
          min={0}
          step={1000}
          value={gift}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (e.target.value !== "" && Number.isFinite(n) && n >= 0) onGiftChange(n);
          }}
        />
        {[10000, 25000, 100000].map((n) => (
          <button key={n} type="button" className={n === gift ? "on" : ""} onClick={() => onGiftChange(n)}>
            {fmtCompact(n)}
          </button>
        ))}
      </label>

      <p className="gift-lead">
        In this model, one home costs about <strong>{fmtCompact(ph.total_cost)}</strong> to build. A qualifying family can pay
        about <strong>{fmtCompact(ph.family_pays)}</strong>
        {ph.counted_funding > 0 && (
          <>
            , counted grants cover about <strong>{fmtCompact(ph.counted_funding)}</strong>
          </>
        )}
        , leaving about <strong>{fmtCompact(ph.gap)}</strong> per home still to raise.
      </p>

      {/* one-home bill: what it costs vs. who pays */}
      <div className="bill">
        <div className="bill-row">
          <span className="bill-label">Costs</span>
          <div className="bar">
            {COST_LINES.map((l) =>
              ph[l.key] > 0 ? (
                <span key={l.key} style={{ width: pctW(ph[l.key]), background: l.color }} title={`${l.label}: ${fmtUsd0(ph[l.key])}`} />
              ) : null,
            )}
          </div>
        </div>
        <div className="bill-row">
          <span className="bill-label">Paid by</span>
          <div className="bar">
            <span style={{ width: pctW(ph.family_pays), background: "#4f9d69" }} title={`Family pays: ${fmtUsd0(ph.family_pays)}`} />
            {ph.counted_funding > 0 && (
              <span style={{ width: pctW(ph.counted_funding), background: "#3d7cc9" }} title={`Counted funding: ${fmtUsd0(ph.counted_funding)}`} />
            )}
            {giftInGap > 0 && (
              <span className="gift-slice" style={{ width: pctW(giftInGap) }} title={`Your gift: ${fmtUsd0(gift)}`} />
            )}
            <span style={{ width: pctW(ph.gap - giftInGap), background: "#d64545" }} title={`Still to raise: ${fmtUsd0(ph.gap)}`} />
          </div>
        </div>
        <div className="bill-legend">
          {COST_LINES.map((l) => (
            <span key={l.key}>
              <i style={{ background: l.color }} />
              {l.label} {fmtCompact(ph[l.key])}
            </span>
          ))}
        </div>
      </div>

      {g && ph.gap > 0 ? (
        <ul className="gift-facts">
          <li>
            <strong>{fmtUsd0(g.gift_amount)}</strong> is about <strong>{fmtPct1(g.share_of_one_home_gap ?? 0)}</strong> of one home's
            remaining gap.
          </li>
          {g.comparable_line && g.comparable_line_amount !== null && (
            <li>
              That's roughly the <strong>{g.comparable_line}</strong> for one home (≈{fmtCompact(g.comparable_line_amount)}).
            </li>
          )}
          {g.construction_sqft_equivalent !== null && (
            <li>
              Or about <strong>{Math.round(g.construction_sqft_equivalent).toLocaleString()} sq ft</strong> of construction at the
              assumed {fmtUsd0(hardCostPerSqft)}/sq ft.
            </li>
          )}
          {g.gifts_to_close_one_home !== null && (
            <li>
              About <strong>{g.gifts_to_close_one_home}</strong> gifts this size would close one home's gap.
            </li>
          )}
        </ul>
      ) : (
        <p className="small">In this scenario every home is already covered by modeled sources.</p>
      )}

      <p className="small">
        <button type="button" onClick={onAddToStack} disabled={gift <= 0}>
          Add {fmtCompact(gift)} to the funding stack as a hypothetical gift
        </button>
      </p>
      <p className="small muted">
        Illustrative: gifts usually support the whole project, not one line item. Per-home figures are this model's assumptions,
        not Habitat's actual budget.
      </p>
    </div>
  );
}
