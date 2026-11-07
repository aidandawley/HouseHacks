"""HomeForge FastAPI app.

Projects: a file-based directory of seed projects (read-only, checked in; the
Santa Ana Washington Ave. case is the default demo) plus user-created projects.

POST /api/compare returns backend-computed affordability, funding stack,
every candidate scenario and the deterministic recommendation.
"""

from __future__ import annotations

from typing import Optional

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import projects as store
from .models import CompareRequest, InputProvenance, Project
from .optimize import compare as run_comparison
from .provenance import UI_LABELS, load_reference_sources

app = FastAPI(title="HomeForge API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)


def load_case_study() -> dict:
    """The illustrative 6/8/10 concept that backs the plan's numeric test oracle."""
    return store.get_project(store.BLANK_TEMPLATE_ID).model_dump(mode="json")


def _full(project: Project) -> dict:
    return {**project.model_dump(mode="json"), "reference_sources": load_reference_sources(), "ui_labels": UI_LABELS}


def _get_or_404(project_id: str) -> Project:
    try:
        return store.get_project(project_id)
    except store.ProjectNotFound:
        raise HTTPException(404, f"Project {project_id!r} not found")


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/case-study")
def get_case_study() -> dict:
    """Default demo project (kept for the plan's API contract)."""
    return _full(store.default_project())


# ---------------------------------------------------------------- projects


class ProjectSummary(BaseModel):
    id: str
    name: str
    kind: str
    is_default: bool
    case_type: str
    location: Optional[str]
    summary: Optional[str]
    candidate_home_counts: list[int]
    updated_at: Optional[str]


class CreateProjectRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    from_id: Optional[str] = None  # duplicate this project; omit for a blank (all-ASSUMPTION) project
    inputs: Optional[CompareRequest] = None  # e.g. "save as new" with current edits


class UpdateProjectRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    inputs: Optional[CompareRequest] = None
    input_provenance: Optional[dict[str, InputProvenance]] = None


@app.get("/api/projects")
def list_projects() -> list[ProjectSummary]:
    return [ProjectSummary(**p.model_dump(include=set(ProjectSummary.model_fields))) for p in store.list_projects()]


@app.get("/api/projects/{project_id}")
def get_project(project_id: str) -> dict:
    return _full(_get_or_404(project_id))


@app.post("/api/projects", status_code=201)
def create_project(req: CreateProjectRequest) -> dict:
    if req.from_id:
        _get_or_404(req.from_id)
    return _full(store.create_project(req.name, req.from_id, req.inputs))


@app.put("/api/projects/{project_id}")
def update_project(project_id: str, req: UpdateProjectRequest) -> dict:
    _get_or_404(project_id)
    prov = {k: v.model_dump() for k, v in req.input_provenance.items()} if req.input_provenance is not None else None
    try:
        return _full(store.update_project(project_id, req.name, req.inputs, prov))
    except store.ProjectReadOnly:
        raise HTTPException(403, "Seed projects are read-only. Save your edits as a new project instead.")


@app.delete("/api/projects/{project_id}", status_code=204)
def delete_project(project_id: str) -> Response:
    _get_or_404(project_id)
    try:
        store.delete_project(project_id)
    except store.ProjectReadOnly:
        raise HTTPException(403, "Seed projects cannot be deleted.")
    return Response(status_code=204)


# ---------------------------------------------------------------- analysis


@app.post("/api/compare")
def compare(request: CompareRequest) -> dict:
    result = run_comparison(request)
    body = result.model_dump(mode="json", exclude={"affordability": {"warning"}})
    body["candidate_home_counts"] = request.candidate_home_counts
    return body
