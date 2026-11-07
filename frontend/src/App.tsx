import { useCallback, useEffect, useRef, useState } from "react";
import { fetchCaseStudy, postCompare } from "./api";
import type { CaseStudy, CompareRequest, CompareResponse } from "./types";

type Load<T> = { state: "idle" | "loading" } | { state: "ok"; data: T } | { state: "error"; message: string };

function toRequest(cs: CaseStudy): CompareRequest {
  return {
    candidate_home_counts: cs.candidate_home_counts,
    household: cs.household,
    development: cs.development,
    funding_sources: cs.funding_sources,
  };
}

export default function App() {
  const [caseStudy, setCaseStudy] = useState<Load<CaseStudy>>({ state: "loading" });
  const [analysis, setAnalysis] = useState<Load<CompareResponse>>({ state: "idle" });
  const reqSeq = useRef(0);

  const loadCaseStudy = useCallback(async () => {
    setCaseStudy({ state: "loading" });
    try {
      setCaseStudy({ state: "ok", data: await fetchCaseStudy() });
    } catch (e) {
      setCaseStudy({ state: "error", message: (e as Error).message });
    }
  }, []);

  const runAnalysis = useCallback(async (cs: CaseStudy) => {
    const seq = ++reqSeq.current; // ignore out-of-order responses
    setAnalysis({ state: "loading" });
    try {
      const data = await postCompare(toRequest(cs));
      if (seq === reqSeq.current) setAnalysis({ state: "ok", data });
    } catch (e) {
      if (seq === reqSeq.current) setAnalysis({ state: "error", message: (e as Error).message });
    }
  }, []);

  useEffect(() => {
    void loadCaseStudy();
  }, [loadCaseStudy]);

  useEffect(() => {
    if (caseStudy.state === "ok") void runAnalysis(caseStudy.data);
  }, [caseStudy, runAnalysis]);

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

      {caseStudy.state === "error" && <div className="banner error">{caseStudy.message}</div>}
      {analysis.state === "error" && <div className="banner error">Analysis failed: {analysis.message}</div>}

      <main className="grid">
        <section className="panel">
          <h2>Case study</h2>
          {caseStudy.state === "loading" && <p className="muted">Loading case study…</p>}
          {caseStudy.state === "ok" && (
            <>
              <p>
                <strong>{caseStudy.data.name}</strong>
                <br />
                {caseStudy.data.location}
              </p>
              <p>
                <span className="tag illustrative">Illustrative</span> case type: {caseStudy.data.case_type}
              </p>
              <p className="muted small">{caseStudy.data.notes}</p>
              <p>Candidate home counts: {caseStudy.data.candidate_home_counts.join(" / ")}</p>
              <p>Funding rows: {caseStudy.data.funding_sources.length}</p>
            </>
          )}
        </section>

        <section className="panel scene-placeholder">
          <h2>3D concept view</h2>
          <p className="muted">Conceptual model — no zoning/site verification. (Milestone 6)</p>
        </section>

        <section className="panel">
          <h2>Analysis request</h2>
          <button
            disabled={caseStudy.state !== "ok"}
            onClick={() => caseStudy.state === "ok" && void runAnalysis(caseStudy.data)}
          >
            Submit analysis
          </button>
          {analysis.state === "loading" && <p className="muted">Submitting…</p>}
          {analysis.state === "ok" && <pre className="small">{JSON.stringify(analysis.data, null, 2)}</pre>}
        </section>

        {caseStudy.state === "ok" && (
          <section className="panel wide">
            <h2>Sources &amp; assumptions</h2>
            <p className="small">
              Reference sources below are <strong>not</strong> verification of the demo values. Every demo number is an
              illustrative assumption.
            </p>
            <ul className="small">
              {caseStudy.data.reference_links.map((l) => (
                <li key={l.url}>
                  <a href={l.url} target="_blank" rel="noreferrer">
                    {l.title}
                  </a>{" "}
                  <span className="tag reference">Reference only</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
