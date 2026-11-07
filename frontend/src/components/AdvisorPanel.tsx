import { type ReactNode, useCallback, useEffect, useState } from "react";
import { applyProposal, askAdvisor, screenIncentives, simulateIncentive } from "../api";
import { fmtUsd0 } from "../format";
import type { AdvisorResult, CompareRequest, IncentiveCard, MatchStatus, Simulation } from "../types";

interface Props {
  projectId: string;
  contextLine: string;
  inputs: CompareRequest;
  selectedHomes: number | null;
  /** Called only after the user clicks "Apply as hypothetical" and the backend validates it. */
  onApplied: (next: CompareRequest, description: string) => void;
}

const STATUS_CLASS: Record<MatchStatus, string> = {
  potential_match: "st-potential",
  needs_information: "st-info",
  appears_incompatible: "st-incompatible",
  unavailable_or_closed: "st-closed",
  unsupported: "st-unsupported",
};
const STATUS_SHORT: Record<MatchStatus, string> = {
  potential_match: "Potential",
  needs_information: "Needs info",
  appears_incompatible: "Conflicts",
  unavailable_or_closed: "Closed",
  unsupported: "Unverified",
};
const AMOUNT_LABEL: Record<string, string> = {
  tax_cost_reduction: "Eligible property-tax cost removed",
  grant: "Hypothetical award amount",
  restricted_grant: "Hypothetical award (land/site work only)",
  timing_only: "Fees deferred (timing only)",
};
const QUICK = [
  "Find property-tax relief for this site.",
  "Could any tax incentives or funding programs help close this gap?",
];

/** Minimal, safe rendering of the model's text: paragraphs, line breaks and **bold** only. */
function renderText(text: string): ReactNode {
  return text.split(/\n{2,}/).map((para, i) => (
    <p key={i}>
      {para.split("\n").map((line, j) => (
        <span key={j}>
          {j > 0 && <br />}
          {line.split(/(\*\*[^*]+\*\*)/).map((part, k) =>
            part.startsWith("**") && part.endsWith("**") ? <strong key={k}>{part.slice(2, -2)}</strong> : part,
          )}
        </span>
      ))}
    </p>
  ));
}

function CardView({
  card,
  projectId,
  inputs,
  selectedHomes,
  preset,
  onApplied,
}: {
  card: IncentiveCard;
  projectId: string;
  inputs: CompareRequest;
  selectedHomes: number | null;
  preset?: Simulation;
  onApplied: Props["onApplied"];
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<string>(card.suggested_amount != null ? String(card.suggested_amount) : "");
  const [sim, setSim] = useState<Simulation | null>(preset ?? null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const row = sim?.deltas.find((d) => d.homes === selectedHomes) ?? sim?.deltas[0];

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      setSim(await simulateIncentive(projectId, inputs, card.program_id, amount === "" ? null : Number(amount)));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const apply = async () => {
    if (!sim?.proposal_id) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await applyProposal(sim.proposal_id, inputs);
      onApplied(res.inputs, sim.change_description ?? sim.program_name);
      setSim(null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="adv-card">
      <div className="adv-card-head">
        <strong>{card.name}</strong>
        <span className={`st ${STATUS_CLASS[card.match_status]}`} title={card.status_label}>
          {STATUS_SHORT[card.match_status]}
        </span>
      </div>
      <p className="adv-how">{card.how_it_works}</p>
      {card.conflicts.length > 0 && (
        <ul className="adv-list conflicts">
          {card.conflicts.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      )}
      <details className="info" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
        <summary>ⓘ what's known, missing &amp; source</summary>
        <div className="info-body">
          {card.matches.length > 0 && (
            <>
              <p>
                <strong>Known matches</strong>
              </p>
              <ul className="adv-list matches">
                {card.matches.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </>
          )}
          <p>
            <strong>Missing / must be verified</strong>
          </p>
          <ul className="adv-list">
            {card.missing_information.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          <p>{card.availability_note}</p>
          <p>
            Effect: <code>{card.financial_effect_type}</code> · complexity {card.complexity}
          </p>
          <p>
            Source:{" "}
            {card.source_url ? (
              <a href={card.source_url} target="_blank" rel="noreferrer">
                {card.source_title}
              </a>
            ) : (
              card.source_title
            )}{" "}
            · checked {card.source_checked_on} ·{" "}
            {card.source_verification === "team_verified"
              ? "read by team"
              : card.source_verification === "spec_reference"
                ? "reference, not re-read"
                : "unverified lead"}
          </p>
        </div>
      </details>

      {(card.can_simulate || sim) && (
        <div className="adv-sim">
          {card.can_simulate && card.simulation !== "timing_only" ? (
            <label className="adv-amount">
              {AMOUNT_LABEL[card.simulation] ?? "Amount"}
              <span className="input-row">
                <span className="affix">$</span>
                <input type="number" min={0} step={1000} value={amount} onChange={(e) => setAmount(e.target.value)} />
              </span>
            </label>
          ) : null}
          {card.tax_estimate && (
            <div className="adv-estimate">
              <span className="tag illustrative">{card.tax_estimate.label}</span>
              <p>{card.tax_estimate.formula}</p>
              {card.tax_estimate.capped_by_budget_line && (
                <p className="hint">
                  Capped at the budget's property-tax line ({fmtUsd0(card.tax_estimate.budget_tax_line)}) — a saving can't exceed the cost.
                </p>
              )}
              <details className="info">
                <summary>ⓘ estimate assumptions</summary>
                <div className="info-body">
                  <ul className="adv-list">
                    {card.tax_estimate.assumptions.map((a) => (
                      <li key={a.name}>
                        <strong>{a.name}:</strong> {a.value} <span className="muted">({a.label})</span> — {a.basis}
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            </div>
          )}
          {card.simulate_note && <p className="hint">{card.simulate_note}</p>}
          {card.can_simulate && (
            <button type="button" onClick={run} disabled={busy}>
              {busy && !sim ? "Simulating…" : "Simulate impact"}
            </button>
          )}
          {sim && (
            <div className={`adv-result${sim.ok ? "" : " refused"}`}>
              <p>{sim.message}</p>
              {sim.ok && row && (
                <table className="adv-delta">
                  <tbody>
                    <tr>
                      <td>Modeled gap now ({row.homes} homes)</td>
                      <td>{fmtUsd0(row.baseline_gap)}</td>
                    </tr>
                    <tr>
                      <td>Hypothetical gap</td>
                      <td>{fmtUsd0(row.hypothetical_gap)}</td>
                    </tr>
                    <tr className="d">
                      <td>Change</td>
                      <td>{row.gap_change === 0 ? "$0" : `${row.gap_change < 0 ? "−" : "+"}${fmtUsd0(Math.abs(row.gap_change))}`}</td>
                    </tr>
                  </tbody>
                </table>
              )}
              {sim.ok && <span className="tag illustrative">{sim.status_label}</span>}
              {sim.proposal_id && (
                <div className="adv-apply">
                  <button type="button" className="primary" onClick={apply} disabled={busy}>
                    Apply as hypothetical
                  </button>
                  <span className="hint">Updates the dashboard and 3D as a labeled what-if. Undo anytime.</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {err && <p className="hint no">{err}</p>}
    </div>
  );
}

/** Spec: Funding & Incentive Advisor. Claude explains; the backend screens, simulates and applies. */
export function AdvisorPanel({ projectId, contextLine, inputs, selectedHomes, onApplied }: Props) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AdvisorResult | null>(null);
  const [cards, setCards] = useState<IncentiveCard[] | null>(null);
  const [history, setHistory] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // Offline-capable baseline: backend-screened leads, no Claude needed.
  const refreshScreen = useCallback(async () => {
    try {
      const r = await screenIncentives(projectId, inputs);
      setCards(r.candidates);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [projectId, inputs]);

  useEffect(() => {
    const t = setTimeout(() => void refreshScreen(), 400); // debounce while sliders move
    return () => clearTimeout(t);
  }, [refreshScreen]);

  useEffect(() => {
    setResult(null);
    setHistory([]);
  }, [projectId]);

  const ask = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await askAdvisor(projectId, inputs, selectedHomes, q.trim(), history);
      setResult(r);
      setHistory((h) => [...h, { role: "user" as const, content: q.trim() }, { role: "assistant" as const, content: r.summary }].slice(-8));
      setQuestion("");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const shown = result?.candidates.length ? result.candidates : (cards ?? []).filter((c) => c.match_status !== "unsupported");
  const others = result ? [] : (cards ?? []).filter((c) => c.match_status === "unsupported");
  const presetSim = (id: string) => result?.simulations.find((s) => s.program_id === id && s.ok);

  return (
    <div className="advisor-body">
      <div className="adv-context">{contextLine}</div>
      <form
        className="adv-ask"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
      >
        <textarea
          rows={2}
          placeholder="Find tax relief or financing that could help this site."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void ask(question);
            }
          }}
        />
        <button type="submit" className="primary" disabled={loading || !question.trim()}>
          {loading ? "Thinking…" : "Ask"}
        </button>
      </form>
      <div className="preset-row">
        {QUICK.map((q) => (
          <button key={q} type="button" className="chip-btn" disabled={loading} onClick={() => void ask(q)}>
            {q}
          </button>
        ))}
      </div>

      {err && <p className="hint no">{err}</p>}
      {loading && <p className="hint">Claude is reading the scenario and checking the cached catalog…</p>}

      {result && (
        <div className="adv-answer">
          <div className="adv-answer-meta">
            {result.used_claude ? `Claude (${result.model}) · tools: ${result.tool_trace.join(", ") || "none"}` : `Offline screen — ${result.error}`}
          </div>
          {renderText(result.summary)}
        </div>
      )}

      <h3>{result ? "Leads Claude checked" : "Screened leads (no AI needed)"}</h3>
      {shown.map((c) => (
        <CardView
          key={`${c.program_id}-${result ? "r" : "s"}`}
          card={c}
          projectId={projectId}
          inputs={inputs}
          selectedHomes={selectedHomes}
          preset={presetSim(c.program_id)}
          onApplied={onApplied}
        />
      ))}
      {others.length > 0 && (
        <details className="section">
          <summary>Unverified leads from team research ({others.length})</summary>
          {others.map((c) => (
            <CardView key={c.program_id} card={c} projectId={projectId} inputs={inputs} selectedHomes={selectedHomes} onApplied={onApplied} />
          ))}
        </details>
      )}
      <p className="adv-foot">
        Research and preliminary financial modeling only; eligibility and funding availability require verification. Not legal, tax,
        lending, or financial advice.
      </p>
    </div>
  );
}
