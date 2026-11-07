import copy

import pytest
from fastapi.testclient import TestClient

from backend.main import app, load_case_study

client = TestClient(app)


def default_request() -> dict:
    cs = load_case_study()
    return {
        "candidate_home_counts": cs["candidate_home_counts"],
        "household": cs["household"],
        "development": cs["development"],
        "funding_sources": cs["funding_sources"],
    }


def test_case_study_returns_default_santa_ana_project_with_references():
    r = client.get("/api/case-study")
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == "santa-ana-1921-w-washington"
    assert body["is_default"] and body["case_type"] == "documented_site"
    assert body["candidate_home_counts"] == [6]
    assert len(body["reference_links"]) >= 4
    refs = {r["id"]: r for r in body["reference_sources"]["records"]}
    assert refs["pmms-30yr-2026-11-05"]["value"] == 0.0718
    assert refs["pmms-30yr-2026-11-05"]["effective_date"] == "2026-11-05"
    oc = refs["hcd-state-il-2026-orange"]
    assert oc["effective_date"] == "2026-06-23" and oc["area_median_income_4_person"] == 138600
    assert all(len(v) == 8 for v in oc["limits"].values())
    # every linked reference resolves to a cached record
    assert all(link["reference_source_id"] in refs for link in body["reference_links"])
    # candidate programs carry no amount
    assert all("value" not in r for r in refs.values() if r["source_kind"] == "candidate_program")
    assert all(link["usage"] == "reference_only" for link in body["reference_links"])
    # the city grant is a conditional award at a modeled allocation, never defaulted to the $2.2M ceiling
    grant = next(f for f in body["funding_sources"] if f["id"] == "santa-ana-inclusionary-grant")
    assert grant["status"] == "conditional" and grant["documented_max"] == 2200000 and grant["amount"] < 2200000


def test_compare_accepts_default_request():
    r = client.post("/api/compare", json=default_request())
    assert r.status_code == 200, r.text
    assert r.json()["candidate_home_counts"] == [6, 8, 10]


def _mutate(path, value):
    req = default_request()
    target = req
    for key in path[:-1]:
        target = target[key]
    target[path[-1]] = value
    return req


@pytest.mark.parametrize(
    "path,value",
    [
        (("household", "annual_income"), -1),
        (("household", "housing_cost_ratio"), 0),
        (("household", "housing_cost_ratio"), 1.5),
        (("household", "annual_mortgage_rate"), -0.01),
        (("household", "mortgage_term_years"), 0),
        (("development", "hard_cost_per_sqft"), -10),
        (("development", "land_cost"), -1),
        (("candidate_home_counts",), []),
        (("candidate_home_counts",), [6, 6, 8]),
        (("candidate_home_counts",), [0, 8]),
    ],
)
def test_compare_rejects_invalid_inputs(path, value):
    r = client.post("/api/compare", json=_mutate(path, value))
    assert r.status_code == 422


def test_compare_rejects_malformed_funding_rows():
    req = default_request()
    bad = copy.deepcopy(req)
    bad["funding_sources"][0]["status"] = "awarded"  # invalid enum
    assert client.post("/api/compare", json=bad).status_code == 422

    bad = copy.deepcopy(req)
    bad["funding_sources"][0]["amount"] = -5
    assert client.post("/api/compare", json=bad).status_code == 422

    bad = copy.deepcopy(req)
    bad["funding_sources"][0]["basis"] = "verified_public_source"  # no source metadata
    assert client.post("/api/compare", json=bad).status_code == 422

    bad = copy.deepcopy(req)
    bad["funding_sources"][1]["id"] = bad["funding_sources"][0]["id"]
    assert client.post("/api/compare", json=bad).status_code == 422


def test_reference_source_validation_rejects_unsourced_values():
    from backend.provenance import validate_reference_sources

    bad = {"records": [{"id": "x", "name": "x", "source_url": "https://e.org", "checked_at": "2026-11-07",
                        "source_kind": "published_rate", "verification_status": "organizer_verified_page",
                        "limitations": "", "value": 0.07}]}
    with pytest.raises(ValueError):
        validate_reference_sources(bad)
