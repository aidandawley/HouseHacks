"""Spec §12 mandatory tests for the Funding & Incentive Advisor (all run without Claude)."""

import copy
import json
from decimal import Decimal as D

from fastapi.testclient import TestClient

from backend import incentives
from backend.main import app
from backend.models import CompareRequest
from backend.optimize import compare
from backend.projects import get_project

client = TestClient(app)
SA = "santa-ana-1921-w-washington"
ALLOWED = {"potential_match", "needs_information", "appears_incompatible", "unavailable_or_closed", "unsupported"}


def sa_inputs(**dev) -> dict:
    p = client.get(f"/api/projects/{SA}").json()
    req = copy.deepcopy({k: p[k] for k in ("candidate_home_counts", "household", "development", "funding_sources",
                                         "documented_home_count", "cost_reductions")})
    req["development"].update(dev)
    return req


def simulate(program_id, amount, inputs=None):
    return client.post("/api/incentives/simulate", json={"project_id": SA, "inputs": inputs or sa_inputs(),
                                                         "program_id": program_id, "amount": amount}).json()


def six(analysis_or_inputs):
    r = compare(CompareRequest.model_validate(analysis_or_inputs))
    return next(s for s in r.scenarios if s.homes == 6)


# 1. Unknown legal conditions: nonprofit status alone never yields eligible / guaranteed savings
def test_nonprofit_alone_is_not_eligible():
    cards = client.post("/api/incentives/screen", json={"project_id": SA, "inputs": sa_inputs()}).json()["candidates"]
    assert {c["match_status"] for c in cards} <= ALLOWED
    welfare = next(c for c in cards if c["program_id"] == "CA_RTC_214_15_1")
    assert "Owner is a nonprofit corporation" in welfare["matches"]
    assert welfare["match_status"] != "potential_match"  # recorded agreement + buyers unknown; 33% ratio conflicts
    assert any("recorded agreement" in m for m in welfare["missing_information"])
    assert welfare["estimated_savings_usd"] is None
    assert all(c["estimated_savings_usd"] is None for c in cards)
    for c in cards:
        assert "eligible" not in c["match_status"] and "approved" not in c["status_label"].lower()


def test_modeled_conflicts_are_flagged_and_change_with_inputs():
    welfare = client.post("/api/incentives/check", json={"project_id": SA, "inputs": sa_inputs(), "program_id": "CA_RTC_214_15_1"}).json()
    assert welfare["match_status"] == "appears_incompatible"
    assert any("30%" in c and "33%" in c for c in welfare["conflicts"])
    req = sa_inputs()
    req["household"]["housing_cost_ratio"] = 0.30
    welfare = client.post("/api/incentives/check", json={"project_id": SA, "inputs": req, "program_id": "CA_RTC_214_15_1"}).json()
    assert welfare["match_status"] == "needs_information"  # no conflict, still missing facts — never "eligible"
    zero_rate = client.post("/api/incentives/check", json={"project_id": SA, "inputs": sa_inputs(), "program_id": "CA_RTC_214_15"}).json()
    assert any("zero-interest" in c for c in zero_rate["conflicts"])


# 2. No tax cost line -> no savings claimed
def test_no_tax_line_refuses_savings():
    sim = simulate("CA_RTC_214_15_1", 10000, sa_inputs(property_tax_carry=0))
    assert sim["ok"] is False and sim["proposal_id"] is None and sim["deltas"] == []
    assert "no property-tax" in sim["message"].lower()


# 3. Double counting: two exemptions cannot reduce the same tax twice
def test_two_exemptions_cannot_reduce_same_tax():
    first = simulate("CA_RTC_214_15_1", 20000)
    applied = client.post("/api/scenarios/apply-proposal", json={"proposal_id": first["proposal_id"], "inputs": sa_inputs(),
                                                                  "user_confirmed": True}).json()["inputs"]
    second = simulate("CA_RTC_214_15", 10000, applied)  # same exclusive group
    assert second["ok"] is False and "twice" in second["message"]
    again = simulate("CA_RTC_214_15_1", 5000, applied)
    assert again["ok"] is False
    # model-level guard too: reductions can never exceed the line
    bad = copy.deepcopy(applied)
    bad["cost_reductions"].append({"id": "x", "program_id": "CA_RTC_214_15", "line": "property_tax_carry", "amount": 20000,
                                   "status": "hypothetical", "label": "x"})
    assert client.post("/api/compare", json=bad).status_code == 422


# 4. Math: $30,000 tax line, $20,000 hypothetical reduction -> TDC down exactly $20,000, gap recomputed
def test_tax_reduction_math():
    base = sa_inputs()
    assert base["development"]["property_tax_carry"] == 30000
    sim = simulate("CA_RTC_214_15_1", 20000, base)
    assert sim["ok"] and sim["status_label"] == "ASSUMPTION / NOT CONFIRMED"
    for d in sim["deltas"]:
        assert round(d["baseline_tdc"] - d["hypothetical_tdc"], 2) == 20000
        assert round(d["baseline_gap"] - d["hypothetical_gap"], 2) == 20000  # no surplus floor in play
    over = simulate("CA_RTC_214_15_1", 30001, base)
    assert over["ok"] is False and "exceeds" in over["message"]


# 5. Loans: a $100,000 bridge loan does not reduce the permanent gap
def test_bridge_loan_does_not_reduce_gap():
    base = sa_inputs()
    loan = copy.deepcopy(base)
    loan["funding_sources"].append({"id": "bridge", "name": "Bridge loan", "amount": 100000, "status": "committed",
                                    "instrument": "repayable_loan", "basis": "user_entered", "source": None})
    assert six(loan).remaining_gap == six(base).remaining_gap


# 6. Deferrals: delaying $20,000 of fees does not reduce permanent cost
def test_fee_deferral_does_not_reduce_cost():
    sim = simulate("CA_SB_937_FEE_DEFERRAL", 20000)
    assert sim["ok"] and sim["proposal_id"] is None
    assert all(d["gap_change"] == 0 and d["baseline_tdc"] == d["hypothetical_tdc"] for d in sim["deltas"])


# 7. Program status: CalHome is closed as last checked — never called open
def test_calhome_closed():
    c = client.post("/api/incentives/check", json={"project_id": SA, "inputs": sa_inputs(), "program_id": "CA_CALHOME"}).json()
    assert c["match_status"] == "unavailable_or_closed"
    assert "CLOSED" in c["availability_note"] and "open" not in c["status_label"].lower()
    sim = simulate("CA_CALHOME", 250000)
    assert sim["ok"] and "CLOSED" in sim["message"]


# 8. No mutation before confirmation; apply is version-checked and single-use
def test_no_mutation_without_confirmation():
    before_file = json.dumps(get_project(SA).model_dump(mode="json"), sort_keys=True)
    base = sa_inputs()
    sim = simulate("CA_RTC_214_15_1", 20000, base)
    assert json.dumps(get_project(SA).model_dump(mode="json"), sort_keys=True) == before_file
    assert base["cost_reductions"] == []
    assert six(base).total_development_cost == six(sa_inputs()).total_development_cost
    r = client.post("/api/scenarios/apply-proposal", json={"proposal_id": sim["proposal_id"], "inputs": base, "user_confirmed": False})
    assert r.status_code == 400
    stale = copy.deepcopy(base)
    stale["household"]["annual_income"] = 99000
    assert client.post("/api/scenarios/apply-proposal", json={"proposal_id": sim["proposal_id"], "inputs": stale,
                                                               "user_confirmed": True}).status_code == 409
    ok = client.post("/api/scenarios/apply-proposal", json={"proposal_id": sim["proposal_id"], "inputs": base, "user_confirmed": True})
    assert ok.status_code == 200
    patched = ok.json()["inputs"]
    assert patched["cost_reductions"][0]["status"] == "hypothetical" and "not approved" in patched["cost_reductions"][0]["label"]
    assert six(base).total_development_cost - six(patched).total_development_cost == D("20000.00")
    assert client.post("/api/scenarios/apply-proposal", json={"proposal_id": sim["proposal_id"], "inputs": base,
                                                               "user_confirmed": True}).status_code == 404  # single use


def test_hypothetical_grant_is_labeled_and_restricted_grant_capped():
    sim = simulate("HUD_HOME", 100000)
    patched = client.post("/api/scenarios/apply-proposal", json={"proposal_id": sim["proposal_id"], "inputs": sa_inputs(),
                                                                  "user_confirmed": True}).json()["inputs"]
    row = next(f for f in patched["funding_sources"] if f["id"] == "hyp-HUD_HOME")
    assert row["basis"] == "hypothetical_whatif" and "not awarded" in row["name"]
    assert six(sa_inputs()).remaining_gap - six(patched).remaining_gap == D("100000.00")
    capped = simulate("HUD_SHOP", 10_000_000)
    assert capped["ok"] is False and "restricted to land" in capped["message"]
    buyer = simulate("CA_CALHFA_MYHOME", 10000)
    assert buyer["ok"] is False and "not developer funding" in buyer["message"]


# 9. Metadata: every program and card carries status, source and checked date
def test_catalog_and_card_metadata():
    for p in incentives.load_catalog():
        assert p.source["title"] and p.source["checked_on"] and p.source["verification"]
        assert p.availability and p.availability_note and not p.automatic_eligibility_decision_allowed
        if p.source["verification"] == "team_research_unverified":
            assert p.simulation in ("none", "timing_only")  # no savings from unverified leads
    cards = client.post("/api/incentives/screen", json={"project_id": SA, "inputs": sa_inputs()}).json()["candidates"]
    for c in cards:
        assert c["status_label"] and c["source_title"] and c["source_checked_on"] and c["source_verification"]
    unverified = [c for c in cards if c["source_verification"] == "team_research_unverified"]
    assert unverified and all(c["match_status"] == "unsupported" for c in unverified)


# 10. Offline fallback: no Claude key -> still returns screened candidates and a clear note
def test_agent_offline_fallback():
    r = client.post("/api/agent/chat", json={"project_id": SA, "inputs": sa_inputs(), "selected_homes": 6,
                                             "message": "Could any tax incentives help close this gap?"})
    assert r.status_code == 200
    body = r.json()
    assert body["used_claude"] is False and "unavailable" in body["summary"]
    assert body["candidates"] and body["candidates"][0]["category"] == "cost_reduction"
    assert "not legal, tax" in body["disclaimer"].lower()


def test_agent_tools_are_read_only_and_bound():
    from backend.advisor import tool_definitions

    names = {t["name"] for t in tool_definitions()}
    assert names == {"get_current_scenario", "list_incentive_candidates", "check_candidate", "simulate_opportunity"}
    for t in tool_definitions():
        assert t["strict"] is True and t["input_schema"]["additionalProperties"] is False
        assert "scenario" not in t["input_schema"]["properties"]  # Claude cannot pass scenario data
