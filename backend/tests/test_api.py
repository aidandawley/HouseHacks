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


def test_case_study_includes_fixture_and_references():
    r = client.get("/api/case-study")
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == "homeforge-oc-illustrative-v2"
    assert body["case_type"] == "illustrative"
    assert body["candidate_home_counts"] == [6, 8, 10]
    assert len(body["reference_links"]) == 4
    assert all(link["usage"] == "reference_only" for link in body["reference_links"])
    assert {s["basis"] for s in body["funding_sources"]} <= {"illustrative_assumption", "reference_only"}


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
