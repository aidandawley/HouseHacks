from decimal import Decimal as D

from fastapi.testclient import TestClient

from backend.main import app
from backend.optimize import compare
from backend.tests.helpers import concept, concept_request

client = TestClient(app)


def test_default_recommends_8_and_explains_10():
    r = compare(concept())
    assert r.recommended_home_count == 8
    assert "976,233.50" in r.recommendation_reason and "76,233.50" in r.recommendation_reason


def test_one_million_cap_recommends_10_with_identical_gaps():
    base, more = compare(concept()), compare(concept(development__additional_subsidy_budget=1000000))
    assert more.recommended_home_count == 10
    assert [s.remaining_gap for s in base.scenarios] == [s.remaining_gap for s in more.scenarios]


def test_budget_too_low_returns_null_and_minimum_need():
    r = compare(concept(development__additional_subsidy_budget=100000))
    assert r.recommended_home_count is None
    assert r.minimum_needed_if_none_fit == D("563740.10")  # 6 homes is least demanding


def test_capacity_below_six_recommends_nothing():
    r = compare(concept(development__illustrative_site_capacity=5))
    assert r.recommended_home_count is None and r.minimum_needed_if_none_fit is None
    assert "site capacity" in r.recommendation_reason


def test_api_returns_all_scenarios_ascending_with_cent_numbers():
    body = client.post("/api/compare", json=concept_request()).json()
    assert [s["homes"] for s in body["scenarios"]] == [6, 8, 10]
    eight = body["scenarios"][1]
    assert eight["total_development_cost"] == 4335400.0
    assert eight["sale_proceeds"] == 2765413.2
    assert eight["remaining_gap"] == 769986.8
    assert body["recommended_home_count"] == 8
    assert body["funding"]["counted_project_support"] == 800000.0


def santa_ana_request() -> dict:
    p = client.get("/api/projects/santa-ana-1921-w-washington").json()
    return {k: p[k] for k in ("candidate_home_counts", "household", "development", "funding_sources", "documented_home_count")}


def test_santa_ana_default_project_compares_4_6_8_and_never_recommends_8():
    req = santa_ana_request()
    body = client.post("/api/compare", json=req).json()
    assert [s["homes"] for s in body["scenarios"]] == [4, 6, 8]
    eight = body["scenarios"][2]
    assert not eight["within_capacity"] and not eight["eligible"]
    # documented total floor area flows through: 6 × 1813.6667 sq ft × $300
    assert body["scenarios"][1]["hard_cost"] == 3264600.06
    # grant at modeled $0 by default; sliding it to the $2.2M ceiling closes $2.2M of gap
    grant = next(f for f in req["funding_sources"] if f["id"] == "santa-ana-inclusionary-grant")
    grant["amount"] = 2200000
    body2 = client.post("/api/compare", json=req).json()
    g0, g1 = body["scenarios"][1]["raw_gap"], body2["scenarios"][1]["raw_gap"]
    assert round(g0 - g1, 2) == 2200000


def test_documented_site_centers_on_documented_config_with_no_best_fit():
    req = santa_ana_request()
    assert req["documented_home_count"] == 6
    grant = next(f for f in req["funding_sources"] if f["id"] == "santa-ana-inclusionary-grant")
    grant["amount"] = 2200000  # the case where max-homes-under-cap would have picked unapproved 4
    body = client.post("/api/compare", json=req).json()
    assert body["analysis_mode"] == "documented_configuration"
    assert body["recommended_home_count"] is None and body["minimum_needed_if_none_fit"] is None
    six = next(s for s in body["scenarios"] if s["homes"] == 6)
    assert f"{six['remaining_gap']:,.2f}" in body["recommendation_reason"]
    assert "documented 6-home" in body["recommendation_reason"]
    assert "4 and 8 homes are unapproved what-if" in body["recommendation_reason"]


def test_concept_project_keeps_max_homes_mode():
    body = client.post("/api/compare", json=concept_request()).json()
    assert body["analysis_mode"] == "max_homes_under_cap" and body["documented_home_count"] is None


def test_documented_count_must_be_a_candidate():
    req = santa_ana_request()
    req["documented_home_count"] = 7
    assert client.post("/api/compare", json=req).status_code == 422


def test_saving_inputs_does_not_drop_documented_count():
    req = santa_ana_request()
    req.pop("documented_home_count")
    p = client.post("/api/projects", json={"name": "SA copy", "from_id": "santa-ana-1921-w-washington", "inputs": req}).json()
    assert p["documented_home_count"] == 6
