"""File-based project directory (no database).

- Seed projects: backend/data/projects/*.json — checked in, read-only.
- User projects: backend/data/user_projects/*.json (gitignored), or the
  directory in HOMEFORGE_USER_PROJECTS_DIR. Created/updated/deleted via the API.

A new project is created by copying a template project (the illustrative
concept by default, or any existing project to duplicate it). Copied site
facts and sources come along unchanged; edited inputs are marked user-entered.
"""

from __future__ import annotations

import json
import os
import re
import secrets
from datetime import datetime, timezone
from pathlib import Path

from .models import CompareRequest, Project

SEED_DIR = Path(__file__).parent / "data" / "projects"
BLANK_TEMPLATE_ID = "homeforge-oc-illustrative-v2"


class ProjectNotFound(KeyError):
    pass


class ProjectReadOnly(PermissionError):
    pass


def user_dir() -> Path:
    d = Path(os.environ.get("HOMEFORGE_USER_PROJECTS_DIR", Path(__file__).parent / "data" / "user_projects"))
    d.mkdir(parents=True, exist_ok=True)
    return d


def _read(path: Path) -> Project:
    return Project.model_validate_json(path.read_text(encoding="utf-8"))


def _seeds() -> dict[str, Project]:
    out = {}
    for p in sorted(SEED_DIR.glob("*.json")):
        proj = _read(p)
        out[proj.id] = proj.model_copy(update={"kind": "seed"})
    return out


def _user_path(project_id: str) -> Path:
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", project_id):
        raise ProjectNotFound(project_id)
    return user_dir() / f"{project_id}.json"


def list_projects() -> list[Project]:
    seeds = _seeds()
    users = [_read(p).model_copy(update={"kind": "user", "is_default": False}) for p in sorted(user_dir().glob("*.json"))]
    users.sort(key=lambda p: p.updated_at or "", reverse=True)
    ordered = sorted(seeds.values(), key=lambda p: (not p.is_default, p.name))
    return ordered + users


def get_project(project_id: str) -> Project:
    seeds = _seeds()
    if project_id in seeds:
        return seeds[project_id]
    path = _user_path(project_id)
    if not path.exists():
        raise ProjectNotFound(project_id)
    return _read(path).model_copy(update={"kind": "user", "is_default": False})


def default_project() -> Project:
    seeds = _seeds()
    defaults = [p for p in seeds.values() if p.is_default]
    return defaults[0] if defaults else next(iter(seeds.values()))


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _slug(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:40].strip("-")
    return f"{s or 'project'}-{secrets.token_hex(3)}"


def _save(project: Project) -> Project:
    path = _user_path(project.id)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(project.model_dump_json(indent=2), encoding="utf-8")
    tmp.replace(path)
    return project


def create_project(
    name: str,
    from_id: str | None = None,
    inputs: CompareRequest | None = None,
    location: str | None = None,
    candidate_home_counts: list[int] | None = None,
) -> Project:
    template = get_project(from_id or BLANK_TEMPLATE_ID)
    data = template.model_dump(mode="json")
    now = _now()
    data.update(
        id=_slug(name),
        name=name,
        kind="user",
        is_default=False,
        case_type=template.case_type if from_id else "user",
        created_at=now,
        updated_at=now,
    )
    if not from_id:
        # Blank project: no site facts or sources carried over; every input is an ASSUMPTION.
        counts = sorted(set(candidate_home_counts or data["candidate_home_counts"]))
        if not counts or any(n <= 0 for n in counts):
            raise ValueError("candidate_home_counts must be positive integers")
        data.update(
            site=None, sources=[], notes=None, input_provenance={}, location=location or None,
            summary="New project. Every input starts as an ASSUMPTION until you replace it with your own or a sourced value.",
            candidate_home_counts=counts, default_home_count=counts[len(counts) // 2], documented_home_count=None,
            scenario_labels={},
        )
        data["development"]["illustrative_site_capacity"] = max(counts)
    else:
        data.update(summary=f"Copy of “{template.name}” with your edits. {template.summary or ''}".strip())
        if location:
            data["location"] = location
    project = Project.model_validate(data)
    if inputs is not None:
        project = _apply_inputs(project, inputs, mark_user=True)
    return _save(project)


def _apply_inputs(project: Project, inputs: CompareRequest, mark_user: bool) -> Project:
    data = project.model_dump(mode="json")
    # documented_home_count is a property of the project record, not an editable input.
    new = inputs.model_dump(mode="json", exclude={"documented_home_count", "gift_amount"})
    prov = dict(data.get("input_provenance") or {})
    if mark_user:
        for section in ("household", "development"):
            for k, v in new[section].items():
                if data[section].get(k) != v:
                    prov[f"{section}.{k}"] = {"kind": "user"}
    data.update(new, input_provenance=prov, updated_at=_now())
    return Project.model_validate(data)


def update_project(project_id: str, name: str | None, inputs: CompareRequest | None,
                   input_provenance: dict | None = None) -> Project:
    project = get_project(project_id)
    if project.kind == "seed":
        raise ProjectReadOnly(project_id)
    if inputs is not None:
        project = _apply_inputs(project, inputs, mark_user=input_provenance is None)
    data = project.model_dump(mode="json")
    if input_provenance is not None:
        data["input_provenance"] = input_provenance
    if name:
        data["name"] = name
    data["updated_at"] = _now()
    return _save(Project.model_validate(data))


def delete_project(project_id: str) -> None:
    project = get_project(project_id)
    if project.kind == "seed":
        raise ProjectReadOnly(project_id)
    _user_path(project_id).unlink()
