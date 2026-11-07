import { fmtUsd, fmtUsd0 } from "../format";
import type { FundingSource, FundingStatus, FundingSummary } from "../types";
import { ProvenanceTag } from "./ProvenanceTag";

const INSTRUMENT: Record<string, string> = {
  development_grant: "Development grant",
  donation: "Donation",
  repayable_loan: "Repayable loan",
  buyer_assistance: "Buyer assistance",
};

interface Props {
  rows: FundingSource[];
  summary: FundingSummary | null; // backend result; source of truth for what counts
  stale: boolean;
  onChange: (rows: FundingSource[]) => void;
}

export function FundingStack({ rows, summary, stale, onChange }: Props) {
  const result = new Map(summary?.rows.map((r) => [r.id, r]));
  const update = (id: string, patch: Partial<FundingSource>) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch, basis: r.basis === "reference_only" ? r.basis : "user_entered" } : r)));

  return (
    <div className={stale ? "stale" : undefined}>
      <table className="stack">
        <thead>
          <tr>
            <th>Source</th>
            <th>Status</th>
            <th>Modeled amount</th>
            <th>In gap?</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const res = result.get(r.id);
            const isCandidate = r.basis === "reference_only";
            const max = r.documented_max ?? undefined;
            return (
              <tr key={r.id} className={res?.counted ? "counted" : "excluded"}>
                <td>
                  <strong>{r.name}</strong>
                  <div className="small muted">
                    {INSTRUMENT[r.instrument]} ·{" "}
                    {isCandidate ? (
                      <ProvenanceTag kind="candidate" />
                    ) : r.status === "conditional" ? (
                      <span className="tag verified" title="Ceiling documented in a public record; disbursement unknown.">
                        DOCUMENTED CONDITIONAL AWARD — NOT VERIFIED DISBURSED
                      </span>
                    ) : (
                      <ProvenanceTag kind={r.basis === "user_entered" ? "user" : "assumption"} />
                    )}
                  </div>
                  {max != null && (
                    <div className="small">
                      Documented ceiling: up to {fmtUsd0(max)}
                      {r.source && (
                        <>
                          {" "}
                          ·{" "}
                          <a href={r.source.url} target="_blank" rel="noreferrer">
                            {r.source.page_or_section ?? "source"}
                          </a>
                        </>
                      )}
                    </div>
                  )}
                </td>
                <td>
                  {isCandidate ? (
                    <span className="muted small">potential</span>
                  ) : (
                    <select
                      value={r.status}
                      onChange={(e) => update(r.id, { status: e.target.value as FundingStatus })}
                    >
                      {r.documented_max != null && <option value="conditional">conditional (modeled)</option>}
                      <option value="committed">assumed committed</option>
                      <option value="potential">potential — not counted</option>
                    </select>
                  )}
                </td>
                <td>
                  {isCandidate ? (
                    <span className="muted small">unknown</span>
                  ) : (
                    <>
                      {max != null && (
                        <input
                          type="range"
                          min={0}
                          max={max}
                          step={50000}
                          value={r.amount ?? 0}
                          onChange={(e) => update(r.id, { amount: Number(e.target.value) })}
                        />
                      )}
                      <input
                        type="number"
                        min={0}
                        max={max}
                        step={5000}
                        value={r.amount ?? 0}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          if (e.target.value !== "" && Number.isFinite(n)) update(r.id, { amount: n });
                        }}
                      />
                    </>
                  )}
                </td>
                <td title={res?.reason}>
                  {res ? (res.counted ? <strong className="ok">✓ {fmtUsd0(res.counted_amount)}</strong> : <span className="no">✗ excluded</span>) : "…"}
                  {res && <div className="small muted">{res.reason}</div>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {summary && (
        <p className="small">
          Counted toward the gap: <strong>{fmtUsd(summary.counted_project_support)}</strong> (assumed committed{" "}
          {fmtUsd0(summary.committed_assumed_amount)} + modeled conditional {fmtUsd0(summary.conditional_modeled_amount)}).
          Nothing here is a real award unless a source says so.
        </p>
      )}
    </div>
  );
}
