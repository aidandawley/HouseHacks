import type { Project, ProjectSummary } from "../types";

interface Props {
  projects: ProjectSummary[];
  current: Project | null;
  dirty: boolean;
  busy: boolean;
  onSelect: (id: string) => void;
  onNewBlank: () => void;
  onSaveAsNew: () => void;
  onSave: () => void;
  onDelete: () => void;
  onRevert: () => void;
}

export function ProjectBar({ projects, current, dirty, busy, onSelect, onNewBlank, onSaveAsNew, onSave, onDelete, onRevert }: Props) {
  const seeds = projects.filter((p) => p.kind === "seed");
  const users = projects.filter((p) => p.kind === "user");
  const isSeed = current?.kind === "seed";

  return (
    <div className="projectbar">
      <label>
        Project{" "}
        <select value={current?.id ?? ""} disabled={busy} onChange={(e) => onSelect(e.target.value)}>
          <optgroup label="Demo / seed projects (read-only)">
            {seeds.map((p) => (
              <option key={p.id} value={p.id}>
                {p.is_default ? "★ " : ""}
                {p.name}
              </option>
            ))}
          </optgroup>
          {users.length > 0 && (
            <optgroup label="My projects">
              {users.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </label>
      {dirty && <span className="dirty">● unsaved edits</span>}
      <span className="spacer" />
      <button disabled={busy} onClick={onNewBlank} title="Start from the all-ASSUMPTION template">
        + New project
      </button>
      <button disabled={busy || !current} onClick={onSaveAsNew} title="Copy this project, including your current edits">
        Save as new…
      </button>
      {!isSeed && (
        <>
          <button disabled={busy || !dirty} onClick={onSave}>
            Save
          </button>
          <button disabled={busy} onClick={onDelete}>
            Delete
          </button>
        </>
      )}
      <button disabled={busy || !dirty} onClick={onRevert}>
        Discard edits
      </button>
    </div>
  );
}
