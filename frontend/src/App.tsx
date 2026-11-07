import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createProject,
  deleteProject,
  fetchDefaultProject,
  fetchProject,
  listProjects,
  postCompare,
  updateProject,
} from "./api";
import { DevelopmentControls } from "./components/DevelopmentControls";
import { FinancialSummary } from "./components/FinancialSummary";
import { FundingStack } from "./components/FundingStack";
import { HouseholdControls, type HouseholdKey, type HouseholdProvenance } from "./components/HouseholdControls";
import { ProjectBar } from "./components/ProjectBar";
import { ProvenanceTag } from "./components/ProvenanceTag";
import { ScenarioComparison } from "./components/ScenarioComparison";
import { SiteFacts } from "./components/SiteFacts";
import type { CompareRequest, CompareResponse, InputProvenance, Project, ProjectSummary, Provenance } from "./types";

const DEBOUNCE_MS = 300;

function toRequest(p: Project): CompareRequest {
  // Deep copy so edits never mutate the loaded project we revert to.
  return structuredClone({
    candidate_home_counts: p.candidate_home_counts,
    household: p.household,
    development: p.development,
    funding_sources: p.funding_sources,
  });
}

const defaultCount = (p: Project) => p.default_home_count ?? p.candidate_home_counts[0];

const CASE_TYPE_LABEL: Record<string, string> = {
  documented_site: "Real documented site",
  illustrative: "Illustrative concept",
  user: "User project",
};

export default function App() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [inputs, setInputs] = useState<CompareRequest | null>(null);
  // Input provenance keyed "<section>.<field>", seeded from the project file.
  const [prov, setProv] = useState<Record<string, InputProvenance>>({});
  const [selectedHomes, setSelectedHomes] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Last successful (labeled) result is kept on error, but marked stale.
  const [analysis, setAnalysis] = useState<CompareResponse | null>(null);
  const [pending, setPending] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const reqSeq = useRef(0);

  const show = useCallback((p: Project) => {
    setProject(p);
    setInputs(toRequest(p));
    setProv(structuredClone(p.input_provenance));
    setSelectedHomes(defaultCount(p));
  }, []);

  const run = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true);
    setLoadError(null);
    try {
      await fn();
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  const refreshList = useCallback(async () => setProjects(await listProjects()), []);

  const loadDefault = useCallback(
    () =>
      run(async () => {
        const [p] = await Promise.all([fetchDefaultProject(), refreshList()]);
        show(p);
      }),
    [run, refreshList, show],
  );

  useEffect(() => {
    void loadDefault();
  }, [loadDefault]);

  const dirty = useMemo(() => {
    if (!project || !inputs) return false;
    return (
      JSON.stringify(inputs) !== JSON.stringify(toRequest(project)) ||
      JSON.stringify(prov) !== JSON.stringify(project.input_provenance)
    );
  }, [project, inputs, prov]);

  const confirmDiscard = () => !dirty || window.confirm("Discard unsaved edits to this project?");

  const mergedProvenance = (): Record<string, InputProvenance> => prov;

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
  const scenario = analysis?.scenarios.find((s) => s.homes === selectedHomes) ?? null;
  const refs = project?.reference_sources.records ?? [];
  const rateRefs = refs
    .filter((r) => r.source_kind === "published_rate" && r.value !== undefined)
    .sort((a, b) => (b.effective_date ?? "").localeCompare(a.effective_date ?? ""));
  const incomeLimitRef = refs.find((r) => r.id === "hcd-state-il-2026-orange");

  const householdProv = Object.entries(prov).filter(([k]) => k.startsWith("household."));
  const householdKinds: HouseholdProvenance = Object.fromEntries(
    householdProv.map(([k, v]) => [k.slice("household.".length), v.kind as Provenance]),
  );
  const householdNotes = Object.fromEntries(
    householdProv
      .filter(([, v]) => v.note)
      .map(([k, v]) => [k.slice("household.".length), v.note!]),
  ) as Partial<Record<HouseholdKey, string>>;

  // ------------------------------------------------------------ project actions

  const onSelect = (id: string) => {
    if (id === project?.id || !confirmDiscard()) return;
    void run(async () => show(await fetchProject(id)));
  };

  const onNewBlank = () => {
    if (!confirmDiscard()) return;
    const name = window.prompt("Name for the new project:", "New project");
    if (!name?.trim()) return;
    void run(async () => {
      const p = await createProject({ name: name.trim() });
      await refreshList();
      show(p);
    });
  };

  const onSaveAsNew = () => {
    if (!project || !inputs) return;
    const name = window.prompt("Save a copy (with your current edits) as:", `${project.name} (copy)`);
    if (!name?.trim()) return;
    void run(async () => {
      let p = await createProject({ name: name.trim(), from_id: project.id, inputs });
      p = await updateProject(p.id, { input_provenance: mergedProvenance() });
      await refreshList();
      show(p);
    });
  };

  const onSave = () => {
    if (!project || !inputs || project.kind === "seed") return;
    void run(async () => {
      const p = await updateProject(project.id, { inputs, input_provenance: mergedProvenance() });
      await refreshList();
      show(p);
    });
  };

  const onDelete = () => {
    if (!project || project.kind === "seed") return;
    if (!window.confirm(`Delete "${project.name}"? This cannot be undone.`)) return;
    void run(async () => {
      await deleteProject(project.id);
      const [p] = await Promise.all([fetchDefaultProject(), refreshList()]);
      show(p);
    });
  };

  const onRevert = () => project && show(project);

  return (
    <div className="app">
      <header className="topbar">
        <strong>HOMEFORGE</strong>
        <span className="pill">FUND IT</span>
        <span className="muted">Scenario-based feasibility screening — not underwriting</span>
        <button className="reset" disabled={busy} onClick={() => confirmDiscard() && void loadDefault()}>
          Reset demo
        </button>
      </header>
      <p className="disclaimer">
        Conceptual financial model. Not a verified site design, legal determination, lending quote, or the developer's actual
        budget — prototype only, not legal, financial or lending advice.
      </p>
      <ProjectBar
        projects={projects}
        current={project}
        dirty={dirty}
        busy={busy}
        onSelect={onSelect}
        onNewBlank={onNewBlank}
        onSaveAsNew={onSaveAsNew}
        onSave={onSave}
        onDelete={onDelete}
        onRevert={onRevert}
      />

      {loadError && <div className="banner error">{loadError}</div>}
      {analysisError && (
        <div className="banner error">
          Analysis failed: {analysisError}
          {analysis && " — figures below are from the last successful run and do not reflect your latest edits."}
        </div>
      )}

      <main className="grid">
        {project && (
          <section className="panel wide">
            <div className="project-head">
              <h1>{project.name}</h1>
              <span className="tag reference">{CASE_TYPE_LABEL[project.case_type] ?? project.case_type}</span>
              {project.kind === "seed" && <span className="muted small">read-only demo — use “Save as new…” to keep edits</span>}
            </div>
            {project.summary && <p className="small">{project.summary}</p>}
            <details open={project.case_type === "documented_site"}>
              <summary>Site facts &amp; sources</summary>
              <SiteFacts project={project} />
            </details>
          </section>
        )}

        <section className="panel">
          <h2>Affordability</h2>
          {inputs ? (
            <HouseholdControls
              value={inputs.household}
              provenance={householdKinds}
              notes={householdNotes}
              rateRefs={rateRefs}
              incomeLimitRef={incomeLimitRef}
              onChange={(household, key, kind) => {
                setInputs({ ...inputs, household });
                const sourceId =
                  kind === "published_rate" ? rateRefs.find((r) => r.value === household.annual_mortgage_rate)?.id : undefined;
                setProv((p) => ({ ...p, [`household.${key}`]: sourceId ? { kind, source_id: sourceId } : { kind } }));
              }}
            />
          ) : (
            <p className="muted">Loading project…</p>
          )}
        </section>

        <section className="panel scene-placeholder">
          <h2>3D concept view</h2>
          {project?.site?.buildings ? (
            <p className="muted">
              {project.site.buildings} buildings × {project.site.units_per_building} homes — conceptual 3D visualization, not to
              scale. (Milestone 6)
            </p>
          ) : (
            <p className="muted">Conceptual model — no zoning/site verification. (Milestone 6)</p>
          )}
        </section>

        <section className="panel">
          <h2>Financial summary</h2>
          <FinancialSummary analysis={analysis} scenario={scenario} stale={stale} />
        </section>

        {inputs && project && (
          <>
            <section className="panel">
              <h2>Development</h2>
              <DevelopmentControls
                value={inputs.development}
                provenance={prov}
                candidateCounts={inputs.candidate_home_counts}
                selected={selectedHomes}
                scenarioLabels={project.scenario_labels}
                onSelect={setSelectedHomes}
                onChange={(development, key) => {
                  setInputs({ ...inputs, development });
                  setProv((p) => ({ ...p, [`development.${key}`]: { kind: "user" } }));
                }}
              />
            </section>
            <section className="panel span2">
              <h2>Funding stack</h2>
              <FundingStack
                rows={inputs.funding_sources}
                summary={analysis?.funding ?? null}
                stale={stale}
                onChange={(funding_sources) => setInputs({ ...inputs, funding_sources })}
              />
            </section>
            <section className="panel wide">
              <h2>Compare configurations</h2>
              <ScenarioComparison
                analysis={analysis}
                selected={selectedHomes}
                scenarioLabels={project.scenario_labels}
                stale={stale}
                onSelect={setSelectedHomes}
              />
            </section>
          </>
        )}

        {project && (
          <section className="panel wide">
            <h2>Published references &amp; assumptions</h2>
            {project.notes && <p className="small">{project.notes}</p>}
            <p className="small">
              These references are <strong>not</strong> verification of the modeled values. <ProvenanceTag kind="assumption" />{" "}
              marks made-up numbers.
            </p>
            <ul className="small">
              {project.reference_links.map((l) => {
                const r = refs.find((x) => x.id === l.reference_source_id);
                return (
                  <li key={l.url}>
                    <a href={l.url} target="_blank" rel="noreferrer">
                      {l.title}
                    </a>{" "}
                    <span className="tag reference">Reference only</span>
                    {r && <span className="muted"> — checked {r.checked_at}. {r.limitations}</span>}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
