import { useCallback, useEffect, useRef, useState } from "react";
import { fetchCaseStudy, postCompare } from "./api";
import { FinancialSummary } from "./components/FinancialSummary";
import { HouseholdControls, type HouseholdProvenance } from "./components/HouseholdControls";
import type { CaseStudy, CompareRequest, CompareResponse } from "./types";

const DEBOUNCE_MS = 300;

function toRequest(cs: CaseStudy): CompareRequest {
  // Deep copy so edits never mutate the fixture we reset to.
  return structuredClone({
    candidate_home_counts: cs.candidate_home_counts,
    household: cs.household,
    development: cs.development,
    funding_sources: cs.funding_sources,
  });
}

export default function App() {
  const [caseStudy, setCaseStudy] = useState<CaseStudy | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [inputs, setInputs] = useState<CompareRequest | null>(null);
  const [householdProv, setHouseholdProv] = useState<HouseholdProvenance>({});

  // Last successful (labeled) result is kept on error, but marked stale.
  const [analysis, setAnalysis] = useState<CompareResponse | null>(null);
  const [pending, setPending] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const reqSeq = useRef(0);

  const loadCaseStudy = useCallback(async () => {
    setLoadError(null);
    try {
      const cs = await fetchCaseStudy();
      setCaseStudy(cs);
      setInputs(toRequest(cs));
      setHouseholdProv({});
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void loadCaseStudy();
  }, [loadCaseStudy]);

  // Debounced analysis on every input change; out-of-order responses are dropped.
  useEffect(() => {
    if (!inputs) return;
    const seq = ++reqSeq.current;
    const ctrl = new AbortController();
    setPending(true);
    const t = setTimeout(async () => {
      try {
        const data = await postCompare(inputs, ctrl.signal);
        if (seq !== reqSeq.current) return;
        setAnalysis(data);
        setAnalysisError(null);
      } catch (e) {
        if (seq !== reqSeq.current || (e as Error).name === "AbortError") return;
        setAnalysisError((e as Error).message);
      } finally {
        if (seq === reqSeq.current) setPending(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [inputs]);

  const stale = pending || analysisError !== null;
  const refs = caseStudy?.reference_sources.records ?? [];
  const rateRefs = refs
    .filter((r) => r.source_kind === "published_rate" && r.value !== undefined)
    .sort((a, b) => (b.effective_date ?? "").localeCompare(a.effective_date ?? ""));
  const incomeLimitRef = refs.find((r) => r.id === "hcd-state-il-2026-orange");

  return (
    <div className="app">
      <header className="topbar">
        <strong>HOMEFORGE</strong>
        <span className="pill">FUND IT</span>
        <span className="muted">Scenario-based feasibility screening — not underwriting</span>
        <button className="reset" onClick={() => void loadCaseStudy()}>
          Reset demo
        </button>
      </header>
      <p className="disclaimer">
        Prototype for early-stage screening only — not legal, financial or lending advice. Every number marked ASSUMPTION is
        made up; consult a qualified professional before any decision.
      </p>

      {loadError && <div className="banner error">{loadError}</div>}
      {analysisError && (
        <div className="banner error">
          Analysis failed: {analysisError}
          {analysis && " — figures below are from the last successful run and do not reflect your latest edits."}
        </div>
      )}

      <main className="grid">
        <section className="panel">
          <h2>Affordability</h2>
          {inputs && caseStudy ? (
            <HouseholdControls
              value={inputs.household}
              provenance={householdProv}
              rateRefs={rateRefs}
              incomeLimitRef={incomeLimitRef}
              onChange={(household, key, kind) => {
                setInputs({ ...inputs, household });
                setHouseholdProv((p) => ({ ...p, [key]: kind }));
              }}
            />
          ) : (
            <p className="muted">Loading case study…</p>
          )}
        </section>

        <section className="panel scene-placeholder">
          <h2>3D concept view</h2>
          <p className="muted">Conceptual model — no zoning/site verification. (Milestone 6)</p>
        </section>

        <section className="panel">
          <h2>Financial summary</h2>
          <FinancialSummary analysis={analysis} stale={stale} />
        </section>

        {caseStudy && (
          <section className="panel wide">
            <h2>Sources &amp; assumptions</h2>
            <p className="small">
              <strong>{caseStudy.name}</strong> — {caseStudy.location} ({caseStudy.case_type}). {caseStudy.notes}
            </p>
            <p className="small">
              The reference sources below are <strong>not</strong> verification of the demo values.
            </p>
            <ul className="small">
              {caseStudy.reference_links.map((l) => (
                <li key={l.url}>
                  <a href={l.url} target="_blank" rel="noreferrer">
                    {l.title}
                  </a>{" "}
                  <span className="tag reference">Reference only</span>
                  {(() => {
                    const r = refs.find((x) => x.id === l.reference_source_id);
                    return r ? <span className="muted"> — checked {r.checked_at}. {r.limitations}</span> : null;
                  })()}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
