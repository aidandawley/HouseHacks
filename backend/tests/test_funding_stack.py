from decimal import Decimal as D

from backend.optimize import compare
from backend.models import CompareRequest
from backend.tests.helpers import concept_request


def run(req):
    return compare(CompareRequest.model_validate(req))


def gaps(result):
    return {s.homes: s.remaining_gap for s in result.scenarios}


def with_row(**row):
    req = concept_request()
    req["funding_sources"].append({"id": "extra", "name": "extra", "basis": "user_entered", "source": None, **row})
    return req


def test_default_counts_two_illustrative_rows():
    r = run(concept_request())
    assert r.funding.counted_project_support == D("800000.00")
    assert r.funding.has_illustrative_commitments  # assumed, not real secured support
    calhome = next(x for x in r.funding.rows if x.id == "calhome-reference")
    assert not calhome.counted and "unconfirmed" in calhome.reason


def test_donor_to_potential_raises_gap_300k():
    base = gaps(run(concept_request()))
    req = concept_request()
    next(f for f in req["funding_sources"] if f["id"] == "demo-donor")["status"] = "potential"
    r = run(req)
    assert r.funding.counted_project_support == D("500000.00")
    assert r.funding.potential_uncommitted_amount == D("300000.00")
    for n, g in gaps(r).items():
        assert g - base[n] == D("300000.00")


def test_potential_million_never_reduces_gap():
    base = gaps(run(concept_request()))
    r = run(with_row(amount=1000000, status="potential", instrument="development_grant"))
    assert gaps(r) == base


def test_committed_construction_loan_does_not_reduce_gap():
    base = gaps(run(concept_request()))
    r = run(with_row(amount=2000000, status="committed", instrument="repayable_loan"))
    assert gaps(r) == base
    assert r.funding.excluded_instruments == ["repayable_loan"]


def test_buyer_assistance_does_not_reduce_development_gap():
    base = gaps(run(concept_request()))
    r = run(with_row(amount=150000, status="committed", instrument="buyer_assistance"))
    assert gaps(r) == base


def test_conditional_award_counts_only_modeled_amount():
    base = gaps(run(concept_request()))
    r = run(with_row(amount=250000, documented_max=2200000, status="conditional", instrument="development_grant"))
    assert r.funding.conditional_modeled_amount == D("250000.00")
    for n, g in gaps(r).items():
        assert base[n] - g == D("250000.00")


def test_m03_hypothetical_25k_gift_reduces_gap_by_25k():
    base = gaps(run(concept_request()))
    r = run(with_row(amount=25000, status="committed", instrument="donation"))
    for n, g in gaps(r).items():
        assert base[n] - g == D("25000.00")
