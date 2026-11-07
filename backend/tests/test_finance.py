from decimal import Decimal as D

import pytest

from backend.optimize import compare
from backend.tests.helpers import concept

ORACLE = {  # plan §6 scenario oracle
    6: dict(tdc="3437800.00", proceeds="2074059.90", gap="563740.10", fits=True),
    8: dict(tdc="4335400.00", proceeds="2765413.20", gap="769986.80", fits=True),
    10: dict(tdc="5233000.00", proceeds="3456766.50", gap="976233.50", fits=False),
}


def by_homes(result):
    return {s.homes: s for s in result.scenarios}


@pytest.mark.parametrize("homes", [6, 8, 10])
def test_scenario_oracle(homes):
    s = by_homes(compare(concept()))[homes]
    o = ORACLE[homes]
    assert s.total_development_cost == D(o["tdc"])
    assert s.sale_proceeds == D(o["proceeds"])
    assert s.counted_project_support == D("800000.00")
    assert s.remaining_gap == D(o["gap"])
    assert s.within_subsidy_cap is o["fits"]


def test_eight_home_detail_matches_api_contract_example():
    s = by_homes(compare(concept()))[8]
    assert (s.hard_cost, s.soft_cost, s.contingency, s.financing_cost) == (
        D("2640000.00"), D("528000.00"), D("274000.00"), D("193400.00"))
    assert s.gap_per_home == D("96248.35")
    assert s.additional_budget_headroom == D("130013.20")
    assert s.land_cost + s.site_work_cost + s.hard_cost + s.soft_cost + s.contingency + s.financing_cost == s.total_development_cost


def test_higher_hard_cost_raises_cost_and_gap():
    base, higher = by_homes(compare(concept())), by_homes(compare(concept(development__hard_cost_per_sqft=350)))
    for n in (6, 8, 10):
        assert higher[n].total_development_cost > base[n].total_development_cost
        assert higher[n].remaining_gap > base[n].remaining_gap


def test_subsidy_budget_changes_nothing_financial():
    base, more = by_homes(compare(concept())), by_homes(compare(concept(development__additional_subsidy_budget=1000000)))
    for n in (6, 8, 10):
        for f in ("total_development_cost", "sale_proceeds", "raw_gap", "remaining_gap"):
            assert getattr(base[n], f) == getattr(more[n], f)


def test_higher_income_lowers_gap():
    base, richer = by_homes(compare(concept())), by_homes(compare(concept(household__annual_income=120000)))
    for n in (6, 8, 10):
        assert richer[n].sale_proceeds > base[n].sale_proceeds
        assert richer[n].remaining_gap < base[n].remaining_gap


def test_negative_raw_gap_is_zero_need_with_surplus():
    s = by_homes(compare(concept(development__land_cost=0, development__hard_cost_per_sqft=50)))[6]
    assert s.raw_gap < 0
    assert s.remaining_gap == 0 and s.gap_per_home == 0
    assert s.modeled_surplus == -s.raw_gap
