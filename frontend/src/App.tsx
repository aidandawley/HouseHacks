import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createProject,
  deleteProject,
  fetchDefaultProject,
  fetchProject,
  listProjects,
  postCompare,
  updateProject,
} from "./api";
import { AdvisorPanel } from "./components/AdvisorPanel";
import { DevelopmentControls } from "./components/DevelopmentControls";
import { FundingStack } from "./components/FundingStack";
import { GiftExplainer } from "./components/GiftExplainer";
import { HouseholdControls, type HouseholdKey, type HouseholdProvenance } from "./components/HouseholdControls";
import { KpiCards } from "./components/KpiCards";
import { ProjectBar } from "./components/ProjectBar";
import { ProjectDialog, type ProjectDialogResult } from "./components/ProjectDialog";
import { ProvenanceTag } from "./components/ProvenanceTag";
import { ConditionalGrantControl, HomesSelector } from "./components/ScenarioControls";
import { ScenarioComparison } from "./components/ScenarioComparison";
import { SiteFacts } from "./components/SiteFacts";
import { SourcesUses } from "./components/SourcesUses";
import { fmtCompact, fmtUsd0 } from "./format";
import type {
  CompareRequest,
  CompareResponse,
  FundingSource,
  InputProvenance,
  Project,
  ProjectSummary,
  Provenance,
} from "./types";

const DEBOUNCE_MS = 250;
const HousingScene = lazy(() => import("./components/HousingScene"));

type Tab = "funding" | "compare" | "sources";

function toRequest(p: Project): CompareRequest {
  // Deep copy so edits never mutate the loaded project we revert to.
  return structuredClone({
    candidate_home_counts: p.candidate_home_counts,
    household: p.household,
    development: p.development,
    funding_sources: p.funding_sources,
    documented_home_count: p.documented_home_count ?? null,
    cost_reductions: p.cost_reductions ?? [],
  });
}

/** Remove every advisor what-if (hypothetical tax reductions and hypothetical awards), keeping other edits. */
function withoutWhatIfs(r: CompareRequest): CompareRequest {
  return {
    ...r,
    cost_reductions: [],
    funding_sources: r.funding_sources.filter((f) => f.basis !== "hypothetical_whatif"),
  };
}

const defaultCount = (p: Project) => p.default_home_count ?? p.candidate_home_counts[0];

const CASE_TYPE_LABEL: Record<string, string> = {
  documented_site: "Real project",
  illustrative: "Illustrative concept",
  user: "Your project",
};

export default function App() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [inputs, setInputs] = useState<CompareRequest | null>(null);
  // Input provenance keyed "<section>.<field>", seeded from the project file.
  const [prov, setProv] = useState<Record<string, InputProvenance>>({});
  const [selectedHomes, setSelectedHomes] = useState<number | null>(null);
  const [gift, setGift] = useState(25000);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"blank" | "copy" | null>(null);
  const [tab, setTab] = useState<Tab>("funding");
  const [advisorOpen, setAdvisorOpen] = useState(false);
  // Undo stack for applied advisor what-ifs (each entry = inputs before an apply).
  const [whatIfUndo, setWhatIfUndo] = useState<CompareRequest[]>([]);

  // Last successful (labeled) result is kept on error, but marked stale.
  const [analysis, setAnalysis] = useState<CompareResponse | null>(null);
  const [pending, setPending] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const reqSeq = useRef(0);

  // Baseline for "vs baseline" deltas: the project as loaded, or a pinned run.
  const [baseline, setBaseline] = useState<{ analysis: CompareResponse; label: string } | null>(null);
  const needBaseline = useRef(true);

  const show = useCallback((p: Project) => {
    setProject(p);
    setInputs(toRequest(p));
    setProv(structuredClone(p.input_provenance));
    setSelectedHomes(defaultCount(p));
    setBaseline(null);
    setWhatIfUndo([]);
    needBaseline.current = true;
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
        setGift(25000);
        setTab("funding");
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

  // Debounced analysis on every input change; out-of-order responses are dropped.
  useEffect(() => {
    if (!inputs) return;
    const seq = ++reqSeq.current;
    const ctrl = new AbortController();
    setPending(true);
    const t = setTimeout(async () => {
      try {
        const data = await postCompare({ ...inputs, gift_amount: gift > 0 ? gift : null }, ctrl.signal);
        if (seq !== reqSeq.current) return;
        setAnalysis(data);
        setAnalysisError(null);
        if (needBaseline.current) {
          needBaseline.current = false;
          setBaseline({ analysis: data, label: "as loaded" });
        }
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
  }, [inputs, gift]);

  const stale = pending || analysisError !== null;
  const scenario = analysis?.scenarios.find((s) => s.homes === selectedHomes) ?? null;
  const baselineScenario = baseline?.analysis.scenarios.find((s) => s.homes === selectedHomes) ?? null;
  const documented = project?.documented_home_count ?? null;
  const fact = (key: string) => project?.site?.facts.find((f) => f.key === key);
  const parkingFact = fact("parking");
  const areaFact = fact("site_area");
  const siteAddress = project?.site?.address;
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
    householdProv.filter(([, v]) => v.note).map(([k, v]) => [k.slice("household.".length), v.note!]),
  ) as Partial<Record<HouseholdKey, string>>;

  const scenarioLabel =
    selectedHomes === null
      ? null
      : documented !== null
        ? selectedHomes === documented
          ? "documented configuration"
          : "conceptual what-if"
        : (project?.scenario_labels[String(selectedHomes)] ?? "modeled configuration");

  // ------------------------------------------------------------ input handlers (single state)

  const setFunding = (rows: FundingSource[]) => {
    if (inputs) setInputs({ ...inputs, funding_sources: rows });
  };
  const updateFunding = (id: string, patch: Partial<FundingSource>) => {
    if (!inputs) return;
    setFunding(
      inputs.funding_sources.map((r) =>
        r.id === id ? { ...r, ...patch, basis: r.basis === "reference_only" ? r.basis : "user_entered" } : r,
      ),
    );
  };
  const onHousehold = (household: CompareRequest["household"], key: HouseholdKey, kind: Provenance) => {
    if (!inputs) return;
    setInputs({ ...inputs, household });
    const sourceId = kind === "published_rate" ? rateRefs.find((r) => r.value === household.annual_mortgage_rate)?.id : undefined;
    setProv((p) => ({ ...p, [`household.${key}`]: sourceId ? { kind, source_id: sourceId } : { kind } }));
  };
  const onDevelopment = (development: CompareRequest["development"], key: string) => {
    if (!inputs) return;
    setInputs({ ...inputs, development });
    setProv((p) => ({ ...p, [`development.${key}`]: { kind: "user" } }));
  };
  const addGiftToStack = () => {
    if (!inputs || gift <= 0) return;
    const donor = inputs.funding_sources.find(
      (r) => r.instrument === "donation" && r.status === "committed" && r.basis !== "reference_only",
    );
    if (donor) updateFunding(donor.id, { amount: (donor.amount ?? 0) + gift });
    else
      setFunding([
        ...inputs.funding_sources,
        {
          id: `user-gift-${Date.now().toString(36)}`,
          name: "Hypothetical gift",
          amount: gift,
          status: "committed",
          instrument: "donation",
          basis: "user_entered",
          source: null,
        },
      ]);
  };

  // ------------------------------------------------------------ project actions

  const onSelect = (id: string) => {
    if (id === project?.id || !confirmDiscard()) return;
    void run(async () => show(await fetchProject(id)));
  };

  const onDialogSubmit = (r: ProjectDialogResult) => {
    const mode = dialog;
    void run(async () => {
      let p: Project;
      if (mode === "copy" && project && inputs) {
        p = await createProject({ name: r.name, from_id: project.id, inputs, location: r.location });
        p = await updateProject(p.id, { input_provenance: prov });
      } else {
        p = await createProject({ name: r.name, location: r.location, candidate_home_counts: r.candidate_home_counts });
      }
      await refreshList();
      setDialog(null);
      show(p);
    });
  };

  const onSave = () => {
    if (!project || !inputs || project.kind === "seed") return;
    void run(async () => {
      const p = await updateProject(project.id, { inputs, input_provenance: prov });
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

  const onRevert = () => {
    if (project) show(project);
  };

  const grantRows = inputs?.funding_sources.filter((r) => r.documented_max != null) ?? [];
  const whatIfLabels = [
    ...(inputs?.cost_reductions ?? []).map((r) => `${r.label} (−${fmtUsd0(r.amount)} property tax)`),
    ...(inputs?.funding_sources ?? []).filter((f) => f.basis === "hypothetical_whatif").map((f) => `${f.name} (${fmtUsd0(f.amount ?? 0)})`),
  ];
  const onAdvisorApplied = (next: CompareRequest) => {
    if (!inputs) return;
    setWhatIfUndo((u) => [...u, inputs]);
    const { gift_amount: _ignored, ...rest } = next;
    void _ignored;
    setInputs({ ...rest, documented_home_count: inputs.documented_home_count ?? null });
  };
  const unitsFact = fact("units");
  const buildingsFact = fact("buildings");
  const grantFact = fact("city_grant_max");
  const primarySource = project?.sources.find((s) => s.verification_status === "team_verified");
  const a = analysis?.affordability;

  return (
    <div className={`app${advisorOpen ? " advisor-open" : ""}`}>
      <header className="topbar">
        <strong className="brand">HomeForge</strong>
        <span className="tagline">Does it pencil, and who closes the gap?</span>
        <span className="spacer" />
        <button type="button" className="ghost-btn" onClick={() => setAdvisorOpen((o) => !o)} aria-expanded={advisorOpen}>
          AI Funding Advisor
        </button>
        <button
          type="button"
          className="ghost-btn"
          disabled={busy}
          onClick={() => {
            if (confirmDiscard()) void loadDefault();
          }}
        >
          Reset demo
        </button>
      </header>
      <ProjectBar
        projects={projects}
        current={project}
        dirty={dirty}
        busy={busy}
        onSelect={onSelect}
        onNewBlank={() => {
          if (confirmDiscard()) setDialog("blank");
        }}
        onSaveAsNew={() => setDialog("copy")}
        onSave={onSave}
        onDelete={onDelete}
        onRevert={onRevert}
      />

      {loadError && <div className="banner error">{loadError}</div>}
      {analysisError && (
        <div className="banner error">
          Analysis failed: {analysisError}
          {analysis && " — figures shown are from the last successful run and do not reflect your latest edits."}
        </div>
      )}

      {whatIfLabels.length > 0 && inputs && (
        <div className="banner whatif">
          <strong>Hypothetical branch</strong> — not approved, awarded or verified:{" "}
          {whatIfLabels.join(" · ")}
          <span className="spacer" />
          <button
            type="button"
            onClick={() => {
              const prev = whatIfUndo[whatIfUndo.length - 1];
              setWhatIfUndo((u) => u.slice(0, -1));
              setInputs(prev ?? withoutWhatIfs(inputs));
            }}
          >
            Undo
          </button>
          <button
            type="button"
            onClick={() => {
              setWhatIfUndo([]);
              setInputs(withoutWhatIfs(inputs));
            }}
          >
            Reset to baseline
          </button>
        </div>
      )}

      <div className="page">
        <KpiCards
          scenario={scenario}
          baseline={baselineScenario}
          baselineLabel={baseline?.label ?? "—"}
          scenarioLabel={scenarioLabel}
          stale={stale}
          onPinBaseline={() => {
            if (analysis)
              setBaseline({
                analysis,
                label: `pinned ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
              });
          }}
        />

        <div className="layout">
          {/* ---------------- sidebar: the one place for each essential input */}
          <aside className="card sidebar">
            <h2>Project settings</h2>
            {inputs && project ? (
              <>
                <HomesSelector
                  counts={inputs.candidate_home_counts}
                  selected={selectedHomes}
                  documented={documented}
                  labels={project.scenario_labels}
                  onSelect={setSelectedHomes}
                />
                <DevelopmentControls section="essential" value={inputs.development} provenance={prov} onChange={onDevelopment} />
                <HouseholdControls
                  section="essential"
                  value={inputs.household}
                  provenance={householdKinds}
                  notes={householdNotes}
                  rateRefs={rateRefs}
                  incomeLimitRef={incomeLimitRef}
                  onChange={onHousehold}
                />
                {grantRows.map((g) => (
                  <ConditionalGrantControl key={g.id} row={g} onChange={(amount) => updateFunding(g.id, { amount })} />
                ))}
                <details className="advanced">
                  <summary>Advanced assumptions</summary>
                  <h3>Buyer</h3>
                  <HouseholdControls
                    section="advanced"
                    value={inputs.household}
                    provenance={householdKinds}
                    notes={householdNotes}
                    rateRefs={rateRefs}
                    incomeLimitRef={incomeLimitRef}
                    onChange={onHousehold}
                  />
                  <h3>Development</h3>
                  <DevelopmentControls section="advanced" value={inputs.development} provenance={prov} onChange={onDevelopment} />
                </details>
              </>
            ) : (
              <p className="muted">Loading project…</p>
            )}
          </aside>

          {/* ---------------- center: the project and its 3D scene */}
          <section className="card scene-card">
            {project && (
              <div className="scene-head">
                <div>
                  <h1>{project.site?.address?.split(",")[0] ?? project.name}</h1>
                  <div className="scene-sub">
                    {project.site
                      ? [
                          project.location,
                          project.site.apn && `APN ${project.site.apn}`,
                          unitsFact && buildingsFact && `${unitsFact.value} homes · ${buildingsFact.value}`,
                          grantFact && `city grant agreement up to ${fmtCompact(Number(grantFact.value))}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")
                      : (project.location ?? project.summary)}
                    {primarySource && (
                      <>
                        {" · "}
                        <button type="button" className="link-btn" onClick={() => setTab("sources")}>
                          sources
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <span className={`badge ${project.case_type === "documented_site" ? "real" : ""}`}>
                  {CASE_TYPE_LABEL[project.case_type] ?? project.case_type}
                </span>
              </div>
            )}
            {selectedHomes !== null ? (
              <Suspense fallback={<div className="scene-fallback">Loading 3D view…</div>}>
                <HousingScene
                  homes={selectedHomes}
                  documentedHomes={documented}
                  parkingSpaces={typeof parkingFact?.value === "number" ? parkingFact.value : null}
                  streetName={siteAddress ? `${siteAddress.split(",")[0].replace(/^\d+\s+/, "")} (orientation schematic)` : null}
                  siteLabel={
                    typeof areaFact?.value === "number"
                      ? `Parcel ≈ ${areaFact.value} acre (documented) — boundary schematic`
                      : "Conceptual site — no parcel data"
                  }
                  scenario={scenario}
                  stale={stale}
                />
              </Suspense>
            ) : (
              <div className="scene-fallback">Loading project…</div>
            )}
            <p className="caption">
              Conceptual 3D representation of the {selectedHomes ?? ""}-home {documented !== null && selectedHomes !== documented ? "what-if" : "development"}
              {" — "}not to scale, not a site plan.
            </p>
          </section>
        </div>

        {/* ---------------- secondary information in tabs */}
        {inputs && project && (
          <section className="card tabs-card">
            <div className="tabs" role="tablist">
              {(
                [
                  ["funding", "Funding Stack"],
                  ["compare", "Compare Scenarios"],
                  ["sources", "Sources & Assumptions"],
                ] as [Tab, string][]
              ).map(([k, label]) => (
                <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
                  {label}
                </button>
              ))}
            </div>

            {tab === "funding" && (
              <div className={`tab-body${stale ? " stale" : ""}`}>
                {scenario && analysis ? (
                  <SourcesUses scenario={scenario} funding={analysis.funding} rows={inputs.funding_sources} />
                ) : (
                  <p className="muted">Calculating…</p>
                )}
                <details className="section" open>
                  <summary>Edit funding sources</summary>
                  <FundingStack rows={inputs.funding_sources} summary={analysis?.funding ?? null} stale={stale} onChange={setFunding} />
                </details>
                <details className="section">
                  <summary>What does a gift do?</summary>
                  <GiftExplainer
                    scenario={scenario}
                    gift={gift}
                    hardCostPerSqft={inputs.development.hard_cost_per_sqft}
                    stale={stale}
                    onGiftChange={setGift}
                    onAddToStack={addGiftToStack}
                  />
                </details>
              </div>
            )}

            {tab === "compare" && (
              <div className="tab-body">
                <ScenarioComparison
                  analysis={analysis}
                  selected={selectedHomes}
                  scenarioLabels={project.scenario_labels}
                  stale={stale}
                  onSelect={setSelectedHomes}
                />
              </div>
            )}

            {tab === "sources" && (
              <div className="tab-body">
                {project.site && (
                  <>
                    <h3>Site facts</h3>
                    <SiteFacts project={project} />
                  </>
                )}
                {a && (
                  <>
                    <h3>How the buyer price is calculated</h3>
                    <p className="small">
                      {fmtUsd0(a.monthly_housing_budget)}/mo housing budget − taxes, insurance &amp; HOA ={" "}
                      {fmtUsd0(a.monthly_principal_interest_available)}/mo mortgage payment → {fmtUsd0(a.mortgage_principal)} loan +
                      buyer cash = <strong>{fmtUsd0(a.affordable_sale_price_per_home)}</strong> affordable price per home.{" "}
                      <ProvenanceTag kind="computed" />
                    </p>
                  </>
                )}
                <h3>Published references</h3>
                <p className="small muted">
                  These references are not verification of the modeled values. <ProvenanceTag kind="assumption" /> marks made-up
                  numbers; <ProvenanceTag kind="user" /> marks numbers your team entered.
                </p>
                <ul className="small refs">
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
                <h3>Model notes</h3>
                <ul className="small refs">
                  {project.notes && <li>{project.notes}</li>}
                  {analysis?.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  <li>Prototype screening model — not legal, financial or lending advice.</li>
                </ul>
              </div>
            )}
          </section>
        )}
      </div>

      {/* P1 placeholder: closed by default, not implemented */}
      <aside className={`advisor${advisorOpen ? " open" : ""}`} aria-hidden={!advisorOpen}>
        <div className="advisor-head">
          <h2>AI Funding Advisor</h2>
          <button type="button" className="ghost-btn" onClick={() => setAdvisorOpen(false)} aria-label="Close advisor">
            ✕
          </button>
        </div>
        {project && inputs ? (
          <AdvisorPanel
            projectId={project.id}
            contextLine={[
              project.location ?? project.name,
              selectedHomes !== null &&
                `${selectedHomes} ${documented !== null && selectedHomes === documented ? "planned" : "modeled"} homes`,
              "Homeownership",
              "Illustrative finances",
            ]
              .filter(Boolean)
              .join(" · ")}
            inputs={inputs}
            selectedHomes={selectedHomes}
            onApplied={onAdvisorApplied}
          />
        ) : (
          <p className="muted">Loading…</p>
        )}
      </aside>

      {dialog && (
        <ProjectDialog
          mode={dialog}
          sourceName={project?.name}
          busy={busy}
          onCancel={() => setDialog(null)}
          onSubmit={onDialogSubmit}
        />
      )}
    </div>
  );
}
