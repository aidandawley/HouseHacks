from decimal import Decimal

from fastapi.testclient import TestClient

from backend.affordability import calculate_affordability
from backend.main import app, load_case_study
from backend.models import HouseholdInputs

D = Decimal


def household(**overrides) -> HouseholdInputs:
    data = {**load_case_study()["household"], **overrides}
    return HouseholdInputs(**data)


def test_default_oracle():
    a = calculate_affordability(household())
    assert a.affordability_valid
    assert a.monthly_housing_budget == D("2750.00")
    assert a.monthly_principal_interest_available == D("2200.00")
    assert a.mortgage_principal == D("330676.65")
    assert a.affordable_sale_price_per_home == D("345676.65")


def test_higher_income_raises_ceiling():
    base = calculate_affordability(household())
    higher = calculate_affordability(household(annual_income=120000))
    assert higher.affordable_sale_price_per_home > base.affordable_sale_price_per_home


def test_higher_rate_lowers_principal():
    base = calculate_affordability(household())
    higher = calculate_affordability(household(annual_mortgage_rate=0.08))
    assert higher.monthly_principal_interest_available == base.monthly_principal_interest_available
    assert higher.mortgage_principal < base.mortgage_principal


def test_zero_interest_branch():
    a = calculate_affordability(household(annual_mortgage_rate=0))
    assert a.mortgage_principal == D("2200.00") * 360
    assert a.affordable_sale_price_per_home == D("792000.00") + D("15000.00")


def test_costs_at_budget_are_infeasible():
    for other in (2750, 3000):
        a = calculate_affordability(household(other_housing_costs_monthly=other))
        assert not a.affordability_valid
        assert a.mortgage_principal == 0
        assert a.affordable_sale_price_per_home == 0
        assert a.warning


def test_down_payment_counted_once():
    base = calculate_affordability(household(buyer_cash_down_payment=0))
    with_cash = calculate_affordability(household(buyer_cash_down_payment=15000))
    assert with_cash.mortgage_principal == base.mortgage_principal
    assert with_cash.affordable_sale_price_per_home - base.affordable_sale_price_per_home == D("15000.00")


def test_api_returns_affordability_as_numbers():
    cs = load_case_study()
    req = {k: cs[k] for k in ("candidate_home_counts", "household", "development", "funding_sources")}
    body = TestClient(app).post("/api/compare", json=req).json()
    assert body["affordability"] == {
        "monthly_housing_budget": 2750.0,
        "monthly_principal_interest_available": 2200.0,
        "mortgage_principal": 330676.65,
        "affordable_sale_price_per_home": 345676.65,
        "affordability_valid": True,
    }


def test_m02_published_rate_move_shrinks_price():
    """Scenario M02: cached PMMS 7.40% (2026-10-08) -> 7.18% (2026-11-05)."""
    from backend.provenance import load_reference_sources

    refs = {r["id"]: r for r in load_reference_sources()["records"]}
    old = calculate_affordability(household(annual_mortgage_rate=refs["pmms-30yr-2026-10-08"]["value"]))
    new = calculate_affordability(household(annual_mortgage_rate=refs["pmms-30yr-2026-11-05"]["value"]))
    assert new.monthly_principal_interest_available == old.monthly_principal_interest_available
    assert new.affordable_sale_price_per_home > old.affordable_sale_price_per_home
