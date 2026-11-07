import type { Provenance } from "../types";

// Label wording follows the plan / organizer rules.
const LABELS: Record<Provenance, { text: string; cls: string; title: string }> = {
  assumption: { text: "ASSUMPTION", cls: "illustrative", title: "Made up for this demo scenario. Not real Habitat, lender or program data." },
  user: { text: "User-entered", cls: "user", title: "Entered by you in this session; not verified." },
  published_rate: { text: "Official published rate", cls: "verified", title: "Read from a dated Freddie Mac PMMS observation." },
  published_income_limit: {
    text: "Published income-limit reference",
    cls: "verified",
    title: "Read from the dated HCD 2026 State Income Limits PDF. An eligibility threshold, not what a household can afford.",
  },
  candidate: { text: "Candidate program — unconfirmed", cls: "reference", title: "Program page exists; eligibility, amount and funds not confirmed. Never counted in the gap." },
  computed: { text: "Calculated", cls: "computed", title: "Computed by the backend from the labeled inputs; only as good as those inputs." },
};

export function ProvenanceTag({ kind }: { kind: Provenance }) {
  const l = LABELS[kind];
  return (
    <span className={`tag ${l.cls}`} title={l.title}>
      {l.text}
    </span>
  );
}
