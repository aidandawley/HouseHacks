import { useState } from "react";

export interface ProjectDialogResult {
  name: string;
  location?: string;
  candidate_home_counts?: number[];
}

interface Props {
  mode: "blank" | "copy";
  sourceName?: string;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (r: ProjectDialogResult) => void;
}

function parseCounts(raw: string): number[] | null {
  const nums = raw
    .split(/[,\s]+/)
    .filter(Boolean)
    .map(Number);
  if (!nums.length || nums.some((n) => !Number.isInteger(n) || n <= 0 || n > 500)) return null;
  return [...new Set(nums)].sort((a, b) => a - b);
}

/** Create a project in seconds: the path from one demo site to the next 100. */
export function ProjectDialog({ mode, sourceName, busy, onCancel, onSubmit }: Props) {
  const [name, setName] = useState(mode === "copy" ? `${sourceName ?? "Project"} (copy)` : "");
  const [location, setLocation] = useState("");
  const [counts, setCounts] = useState("4, 6, 8");
  const parsed = parseCounts(counts);
  const valid = name.trim().length > 0 && (mode === "copy" || parsed !== null);

  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <form
        className="dialog"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          onSubmit({
            name: name.trim(),
            location: location.trim() || undefined,
            candidate_home_counts: mode === "blank" ? parsed! : undefined,
          });
        }}
      >
        <h3>{mode === "blank" ? "New project" : `Save a copy of “${sourceName}”`}</h3>
        <label className="field">
          Project name
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Garden Grove infill lot" />
        </label>
        <label className="field">
          Location (city, or a public address)
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="optional" />
        </label>
        {mode === "blank" && (
          <label className="field">
            Home counts to compare
            <input value={counts} onChange={(e) => setCounts(e.target.value)} />
            {parsed === null && <span className="hint no">Enter whole numbers, e.g. 4, 6, 8</span>}
          </label>
        )}
        <p className="small muted">
          {mode === "blank"
            ? "Every input starts as a labeled ASSUMPTION. Replace them with your own numbers or sourced values; edits are tagged “User-entered”. Saved as a JSON file on this server — no account needed."
            : "Copies the site facts, sources and your current edits. The demo project stays unchanged."}
        </p>
        <div className="dialog-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="primary" disabled={!valid || busy}>
            {mode === "blank" ? "Create project" : "Save copy"}
          </button>
        </div>
      </form>
    </div>
  );
}
