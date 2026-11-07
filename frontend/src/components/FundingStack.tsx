import { useState } from "react";
import { fmtCompact, fmtUsd0 } from "../format";
import type { FundingInstrument, FundingSource, FundingStatus, FundingSummary } from "../types";
import { ProvenanceTag } from "./ProvenanceTag";

const INSTRUMENT: Record<FundingInstrument, string> = {
  development_grant: "Grant to the project",
  donation: "Donation",
  repayable_loan: "Loan (must be repaid)",
  buyer_assistance: "Buyer down-payment help",
};

interface Props {
  rows: FundingSource[];
  summary: FundingSummary | null; // backend result; source of truth for what counts
  stale: boolean;
  onChange: (rows: FundingSource[]) => void;
}

const isUserRow = (r: FundingSource) => r.id.startsWith("user-");

export function FundingStack({ rows, summary, stale, onChange }: Props) {
  const result = new Map(summary?.rows.map((r) => [r.id, r]));
  const [draft, setDraft] = useState<{ name: string; instrument: FundingInstrument; status: FundingStatus; amount: string } | null>(null);

  const update = (id: string, patch: Partial<FundingSource>) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch, basis: r.basis === "reference_only" ? r.basis : "user_entered" } : r)));
  const remove = (id: string) => onChange(rows.filter((r) => r.id !== id));
  const addDraft = () => {
    if (!draft || !draft.name.trim()) return;
    const amount = Number(draft.amount);
    onChange([
      ...rows,
      {
        id: `user-${Date.now().toString(36)}`,
        name: draft.name.trim(),
        amount: Number.isFinite(amount) && amount >= 0 ? amount : 0,
        status: draft.status,
        instrument: draft.instrument,
        basis: "user_entered",
        source: null,
      },
    ]);
    setDraft(null);
  };

  return (
    <div className={stale ? "stale" : undefined}>
      <table className="stack">
        <thead>
          <tr>
            <th>Source</th>
            <th>Status</th>
            <th>Amount you model</th>
            <th>Counts toward the gap?</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const res = result.get(r.id);
            const isCandidate = r.basis === "reference_only";
            const isWhatIf = r.basis === "hypothetical_whatif";
            const max = r.documented_max ?? undefined;
            const hasCeiling = max !== undefined && max !== null;
            return (
              <tr key={r.id} className={res?.counted ? "counted" : "excluded"}>
                <td>
                  {isUserRow(r) ? (
                    <input className="name-input" value={r.name} onChange={(e) => update(r.id, { name: e.target.value || " " })} />
                  ) : (
                    <strong>{r.name}</strong>
                  )}
                  <div className="small muted">
                    {INSTRUMENT[r.instrument]} ·{" "}
                    {isWhatIf ? (
                      <span className="tag illustrative" title="Added by an applied advisor what-if. Not awarded.">
                        HYPOTHETICAL — not awarded
                      </span>
                    ) : isCandidate ? (
                      <ProvenanceTag kind="candidate" />
                    ) : hasCeiling ? (
                      <span
                        className="tag conditional"
                        title="Ceiling recited in a public record. Whether or how much has been disbursed is UNKNOWN; the amount here is your assumption."
                      >
                        Conditional grant agreement · up to {fmtCompact(max)} · disbursed: unknown
                      </span>
                    ) : (
                      <ProvenanceTag kind={r.basis === "user_entered" ? "user" : "assumption"} />
                    )}
                  </div>
                  {hasCeiling && r.source && (
                    <div className="small">
                      <a href={r.source.url} target="_blank" rel="noreferrer">
                        {r.source.publisher}, {r.source.page_or_section ?? "source"}
                        {r.source.publication_date ? ` (adopted ${r.source.publication_date})` : ""}
                      </a>
                    </div>
                  )}
                </td>
                <td>
                  {isWhatIf ? (
                    <span className="muted small">advisor what-if</span>
                  ) : isCandidate ? (
                    <span className="muted small">potential — unconfirmed</span>
                  ) : (
                    <select value={r.status} onChange={(e) => update(r.id, { status: e.target.value as FundingStatus })}>
                      {hasCeiling ? (
                        <>
                          <option value="conditional">conditional — model an amount</option>
                          <option value="potential">potential — don't count</option>
                        </>
                      ) : (
                        <>
                          <option value="committed">assumed committed</option>
                          <option value="potential">potential — don't count</option>
                        </>
                      )}
                    </select>
                  )}
                </td>
                <td>
                  {isWhatIf ? (
                    <span className="small">
                      <strong>{fmtUsd0(r.amount ?? 0)}</strong>
                      <br />
                      <span className="muted">undo or reset from the what-if banner</span>
                    </span>
                  ) : isCandidate ? (
                    <span className="muted small">unknown — not modeled</span>
                  ) : hasCeiling ? (
                    <span className="small">
                      <strong>{fmtUsd0(r.amount ?? 0)}</strong>
                      <br />
                      <span className="muted">set with the city-grant slider in Project settings</span>
                    </span>
                  ) : (
                    <input
                      type="number"
                      min={0}
                      step={5000}
                      value={r.amount ?? 0}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (e.target.value === "" || !Number.isFinite(n)) return;
                        update(r.id, { amount: Math.max(0, n) });
                      }}
                    />
                  )}
                </td>
                <td title={res?.reason}>
                  {res ? (
                    res.counted ? (
                      <strong className="ok">✓ {fmtUsd0(res.counted_amount)}</strong>
                    ) : (
                      <span className="no">✗ not counted</span>
                    )
                  ) : (
                    "…"
                  )}
                  {res && <div className="small muted">{res.reason}</div>}
                  {isUserRow(r) && (
                    <button type="button" className="mini" onClick={() => remove(r.id)}>
                      remove
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
          {draft && (
            <tr className="draft">
              <td>
                <input
                  className="name-input"
                  autoFocus
                  placeholder="e.g. FHLBank AHP, land donation"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
                <select value={draft.instrument} onChange={(e) => setDraft({ ...draft, instrument: e.target.value as FundingInstrument })}>
                  {Object.entries(INSTRUMENT).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as FundingStatus })}>
                  <option value="committed">assumed committed</option>
                  <option value="potential">potential — don't count</option>
                </select>
              </td>
              <td>
                <input type="number" min={0} step={5000} value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} />
              </td>
              <td>
                <button type="button" onClick={addDraft} disabled={!draft.name.trim()}>
                  Add
                </button>{" "}
                <button type="button" className="mini" onClick={() => setDraft(null)}>
                  cancel
                </button>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <p className="small">
        {!draft && (
          <button type="button" onClick={() => setDraft({ name: "", instrument: "development_grant", status: "committed", amount: "0" })}>
            + Add funding source
          </button>
        )}{" "}
        {summary && (
          <>
            Counted toward the gap: <strong>{fmtUsd0(summary.counted_project_support)}</strong> (assumed committed{" "}
            {fmtUsd0(summary.committed_assumed_amount)} + modeled conditional {fmtUsd0(summary.conditional_modeled_amount)}). Loans
            and buyer help are shown but never reduce the gap. Nothing here is a real award unless a source says so.
          </>
        )}
      </p>
    </div>
  );
}
