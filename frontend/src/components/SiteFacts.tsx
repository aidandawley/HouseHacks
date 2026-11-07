import type { FactStatus, Project } from "../types";
import { ProvenanceTag } from "./ProvenanceTag";

const TAG: Record<FactStatus, "documented" | "derived" | "assumption" | "unknown"> = {
  DOCUMENTED: "documented",
  DERIVED: "derived",
  ASSUMPTION: "assumption",
  UNKNOWN: "unknown",
};

function fmtValue(v: string | number | null, unit?: string | null): string {
  if (v === null) return "Unknown";
  const s = typeof v === "number" ? v.toLocaleString("en-US") : v;
  if (unit?.startsWith("USD")) return unit.includes("up to") ? `up to $${s}` : `$${s}`;
  return unit ? `${s} ${unit}` : s;
}

/** Documented site facts with their source + page; unknowns stay unknown. */
export function SiteFacts({ project }: { project: Project }) {
  const site = project.site;
  if (!site) {
    return (
      <p className="muted small">
        No documented site for this project. Every input is an ASSUMPTION until you replace it with a sourced value.
      </p>
    );
  }
  const sources = new Map(project.sources.map((s) => [s.id, s]));
  return (
    <div>
      <table className="facts">
        <tbody>
          {site.facts.map((f) => {
            const src = f.source_id ? sources.get(f.source_id) : undefined;
            return (
              <tr key={f.key}>
                <td>{f.label}</td>
                <td className="v">
                  {fmtValue(f.value, f.unit)}
                  {f.note && <span className="note">{f.note}</span>}
                </td>
                <td>
                  <ProvenanceTag kind={TAG[f.status]} />
                </td>
                <td className="small">
                  {src ? (
                    <a href={src.url} target="_blank" rel="noreferrer" title={src.note ?? undefined}>
                      {src.title.replace(/ \(.*\)$/, "")}
                      {f.page ? `, p.${f.page}` : ""}
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="small">
        <strong>Sources:</strong>{" "}
        {project.sources.map((s, i) => (
          <span key={s.id}>
            {i > 0 && " · "}
            <a href={s.url} target="_blank" rel="noreferrer">
              {s.publisher}: {s.title}
            </a>{" "}
            <span className="muted">
              ({s.verification_status === "team_verified" ? `read by team ${s.checked_at}` : "not checked"})
            </span>
          </span>
        ))}
      </p>
    </div>
  );
}
