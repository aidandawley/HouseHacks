import { fmtUsd, fmtUsd0 } from "../format";
import type { FundingSource, FundingSummary, ScenarioResult } from "../types";

interface Props {
  scenario: ScenarioResult;
  funding: FundingSummary;
  rows: FundingSource[];
}

type Group = "whatif" | "conditional" | "fundraising" | "grants" | "potential" | "excluded";

const GROUPS: { key: Group; title: string; counted: boolean; note: string }[] = [
  { key: "whatif", title: "Advisor what-ifs (hypothetical)", counted: true, note: "Applied from the Funding Advisor. Not awarded — undo from the banner." },
  { key: "grants", title: "Assumed committed grants", counted: true, note: "Hypothetical within this scenario — not verified commitments." },
  { key: "conditional", title: "Conditional city grant (modeled)", counted: true, note: "Counted at the amount you model. Disbursement unknown." },
  { key: "fundraising", title: "Hypothetical fundraising", counted: true, note: "Donor gifts you assume; no real pledges implied." },
  { key: "potential", title: "Potential / unconfirmed programs", counted: false, note: "Never counted until terms and an award are verified." },
  { key: "excluded", title: "Loans & buyer help", counted: false, note: "Must be repaid or go to the buyer — never reduce the gap." },
];

function groupOf(r: FundingSource, counted: boolean): Group {
  if (r.basis === "hypothetical_whatif") return "whatif";
  if (!counted) return r.status === "potential" || r.basis === "reference_only" ? "potential" : "excluded";
  if (r.status === "conditional") return "conditional";
  if (r.instrument === "donation") return "fundraising";
  return "grants";
}

/** Sources & uses for the selected scenario. Every figure is a backend result. */
export function SourcesUses({ scenario: s, funding, rows }: Props) {
  const res = new Map(funding.rows.map((r) => [r.id, r]));
  const uses: [string, number, string][] = [
    ["Land", s.land_cost, "Land / acquisition"],
    ["Site work", s.site_work_cost, "Site work"],
    ["Construction", s.hard_cost, "Hard costs"],
    ["Design, permits & fees", s.soft_cost, "Soft costs"],
    ["Cushion for surprises", s.contingency, "Contingency"],
    ["Interest & holding", s.financing_cost, "Financing / carrying allowance"],
    ["Property taxes while held", s.property_tax_carry, "Property-tax carrying cost (ASSUMPTION)"],
  ];

  return (
    <div className="su">
      <div className="su-col">
        <h4>Uses — cost to build {s.homes} homes</h4>
        {uses.map(([label, v, tech]) => (
          <div className="su-row" key={label} title={`${tech}: ${fmtUsd(v)}`}>
            <span>{label}</span>
            <span>{fmtUsd0(v)}</span>
          </div>
        ))}
        {s.property_tax_reduction > 0 && (
          <div className="su-row sub whatif-line" title="Hypothetical exemption what-if — not approved">
            <span>incl. hypothetical tax exemption what-if</span>
            <span>−{fmtUsd0(s.property_tax_reduction)}</span>
          </div>
        )}
        <div className="su-row total">
          <span>Total development cost</span>
          <span>{fmtUsd0(s.total_development_cost)}</span>
        </div>
      </div>

      <div className="su-col">
        <h4>Sources — who pays</h4>
        <div className="su-row counted" title={`Sale proceeds: ${fmtUsd(s.sale_proceeds)}`}>
          <span>
            Buyer proceeds <span className="muted">({s.homes} × {fmtUsd0(s.sale_price_per_home)})</span>
          </span>
          <span>{fmtUsd0(s.sale_proceeds)}</span>
        </div>
        {GROUPS.map((g) => {
          const members = rows.filter((r) => {
            const rr = res.get(r.id);
            return rr && groupOf(r, rr.counted) === g.key;
          });
          if (!members.length) return null;
          return (
            <div key={g.key} className={`su-group ${g.counted ? "counted" : "not-counted"}`}>
              <div className="su-group-title" title={g.note}>
                {g.title} <span className="su-flag">{g.counted ? "counted" : "not counted"}</span>
              </div>
              {members.map((r) => {
                const rr = res.get(r.id)!;
                return (
                  <div className="su-row sub" key={r.id} title={rr.reason}>
                    <span>
                      {r.name}
                      {r.documented_max != null && <span className="muted"> · of up to {fmtUsd0(r.documented_max)}</span>}
                    </span>
                    <span>{rr.counted ? fmtUsd0(rr.counted_amount) : r.amount == null ? "unknown" : <s>{fmtUsd0(r.amount)}</s>}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
        <div className="su-row total gap">
          <span>Remaining modeled gap</span>
          <span>{fmtUsd0(s.remaining_gap)}</span>
        </div>
        {s.modeled_surplus > 0 && (
          <div className="su-row sub">
            <span>Modeled surplus</span>
            <span>{fmtUsd0(s.modeled_surplus)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
