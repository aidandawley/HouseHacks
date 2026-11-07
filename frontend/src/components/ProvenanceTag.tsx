import type { Provenance } from "../types";

// Label wording follows the plan / organizer rules.
const LABELS: Record<Provenance, { text: string; cls: string; title: string }> = {
  assumption: { text: "ASSUMPTION", cls: "illustrative", title: "Made up for this demo scenario. Not real Habitat, lender or program data." },
  documented: { text: "DOCUMENTED", cls: "verified", title: "Stated in a cited public record (see Site facts for the page)." },
  derived: { text: "DERIVED", cls: "computed", title: "Calculated from documented facts; see the note for how." },
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

const UNKNOWN_LABEL = { text: "UNKNOWN", cls: "unknown", title: "No source states this. Not guessed." };

export function ProvenanceTag({ kind, title }: { kind: Provenance | "unknown"; title?: string }) {
  const l = kind === "unknown" ? UNKNOWN_LABEL : LABELS[kind] ?? LABELS.assumption;
  return (
    <span className={`tag ${l.cls}`} title={title ? `${l.title} ${title}` : l.title}>
      {l.text}
    </span>
  );
}
