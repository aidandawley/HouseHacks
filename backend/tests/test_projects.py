from fastapi.testclient import TestClient

from backend.main import app
from backend.models import FactStatus

client = TestClient(app)
SA = "santa-ana-1921-w-washington"
CONCEPT = "homeforge-oc-illustrative-v2"


def inputs_of(project: dict) -> dict:
    return {k: project[k] for k in ("candidate_home_counts", "household", "development", "funding_sources")}


def test_list_has_santa_ana_first_as_default():
    projects = client.get("/api/projects").json()
    assert projects[0]["id"] == SA and projects[0]["is_default"]
    assert {p["id"] for p in projects} >= {SA, CONCEPT}
    assert all(p["kind"] == "seed" for p in projects)


def test_santa_ana_documented_facts_have_sources_and_unknowns_are_null():
    p = client.get(f"/api/projects/{SA}").json()
    facts = {f["key"]: f for f in p["site"]["facts"]}
    source_ids = {s["id"] for s in p["sources"]}
    assert facts["units"]["value"] == 6 and facts["floor_area"]["value"] == 10882
    assert facts["apn"]["value"] == "405-101-37" and facts["city_grant_max"]["value"] == 2200000
    for f in facts.values():
        if f["status"] == FactStatus.documented.value:
            assert f["source_id"] in source_ids and f["page"]
        if f["status"] == FactStatus.unknown.value:
            assert f["value"] is None
    for key in ("grant_disbursed", "total_development_cost", "land_cost", "sale_prices"):
        assert facts[key]["status"] == "UNKNOWN"
    assert p["site"]["buildings"] * p["site"]["units_per_building"] == 6
    # 10,882 / 6 derived per-home area reproduces the documented total within a square foot
    assert abs(p["development"]["gross_sqft_per_home"] * 6 - 10882) < 1


def test_santa_ana_inputs_run_through_compare():
    p = client.get(f"/api/projects/{SA}").json()
    r = client.post("/api/compare", json=inputs_of(p))
    assert r.status_code == 200, r.text
    assert r.json()["affordability"]["affordability_valid"]


def test_unknown_project_404():
    assert client.get("/api/projects/nope").status_code == 404
    assert client.get("/api/projects/..%2Fsecrets").status_code == 404


def test_create_blank_project_uses_assumption_template():
    r = client.post("/api/projects", json={"name": "Garden Grove lot idea"})
    assert r.status_code == 201, r.text
    p = r.json()
    assert p["kind"] == "user" and p["id"].startswith("garden-grove-lot-idea-")
    assert p["site"] is None and p["sources"] == [] and p["input_provenance"] == {}
    assert p["case_type"] == "user"
    ids = [x["id"] for x in client.get("/api/projects").json()]
    assert p["id"] in ids and ids[0] == SA  # default still first


def test_duplicate_santa_ana_keeps_facts_and_marks_edits_user_entered():
    sa = client.get(f"/api/projects/{SA}").json()
    edited = inputs_of(sa)
    edited["development"]["hard_cost_per_sqft"] = 350
    p = client.post("/api/projects", json={"name": "SA higher cost", "from_id": SA, "inputs": edited}).json()
    assert p["site"]["apn"] == "405-101-37"
    assert p["development"]["hard_cost_per_sqft"] == 350
    assert p["input_provenance"]["development.hard_cost_per_sqft"]["kind"] == "user"
    assert p["input_provenance"]["household.annual_mortgage_rate"]["kind"] == "published_rate"
    # the seed itself is untouched
    assert client.get(f"/api/projects/{SA}").json()["development"]["hard_cost_per_sqft"] == 300


def test_update_rename_and_delete_user_project():
    p = client.post("/api/projects", json={"name": "Temp"}).json()
    new_inputs = inputs_of(p)
    new_inputs["household"]["annual_income"] = 120000
    r = client.put(f"/api/projects/{p['id']}", json={"name": "Renamed", "inputs": new_inputs})
    assert r.status_code == 200, r.text
    assert r.json()["name"] == "Renamed" and r.json()["household"]["annual_income"] == 120000
    assert client.get(f"/api/projects/{p['id']}").json()["household"]["annual_income"] == 120000
    assert client.delete(f"/api/projects/{p['id']}").status_code == 204
    assert client.get(f"/api/projects/{p['id']}").status_code == 404


def test_seed_projects_are_read_only():
    sa = client.get(f"/api/projects/{SA}").json()
    assert client.put(f"/api/projects/{SA}", json={"name": "x"}).status_code == 403
    assert client.put(f"/api/projects/{SA}", json={"inputs": inputs_of(sa)}).status_code == 403
    assert client.delete(f"/api/projects/{SA}").status_code == 403


def test_create_rejects_bad_inputs_and_missing_template():
    assert client.post("/api/projects", json={"name": ""}).status_code == 422
    assert client.post("/api/projects", json={"name": "x", "from_id": "nope"}).status_code == 404


def test_conditional_grant_cannot_exceed_documented_max():
    sa = client.get(f"/api/projects/{SA}").json()
    req = inputs_of(sa)
    grant = next(f for f in req["funding_sources"] if f["id"] == "santa-ana-inclusionary-grant")
    grant["amount"] = 2200000
    assert client.post("/api/compare", json=req).status_code == 200
    grant["amount"] = 2200001
    assert client.post("/api/compare", json=req).status_code == 422


def test_new_project_form_fields():
    p = client.post("/api/projects", json={"name": "Garden Grove infill", "location": "Garden Grove, CA",
                                           "candidate_home_counts": [8, 4, 12]}).json()
    assert p["location"] == "Garden Grove, CA"
    assert p["candidate_home_counts"] == [4, 8, 12] and p["default_home_count"] == 8
    assert p["development"]["illustrative_site_capacity"] == 12 and p["documented_home_count"] is None
    assert client.post("/api/projects", json={"name": "x", "candidate_home_counts": [0]}).status_code == 422


def test_copy_summary_says_it_is_a_copy():
    p = client.post("/api/projects", json={"name": "SA copy", "from_id": SA}).json()
    assert p["summary"].startswith("Copy of “Santa Ana")
