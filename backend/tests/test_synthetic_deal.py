"""Organizer SYNTHETIC one-home bill (claude-impact-lab-uci, lanes/3-fund-it).

Every number in the fixture is a made-up ASSUMPTION. This test checks our
balance math only; it is separate from, and does not replace, the 6/8/10 oracle.
"""

import json
from decimal import Decimal
from pathlib import Path

from backend.finance import balance_line_items

FIXTURE = Path(__file__).parent / "fixtures" / "official_synthetic_example_deal.json"


def load():
    deal = json.loads(FIXTURE.read_text())
    assert "SYNTHETIC" in deal  # never treat as real data

    def lines(section):
        return {k: Decimal(v["value"]) for k, v in deal[section].items() if k != "total"}

    return deal, lines("cost_to_create"), lines("paid_by")


def test_total_cost_to_create():
    deal, costs, _ = load()
    total = balance_line_items(costs, {}).total_cost
    assert total == Decimal(360000 + 85000 + 40000 + 50000) == Decimal(535000)
    assert total == Decimal(deal["cost_to_create"]["total"]["value"])


def test_residual_fundraising_gap_is_95k():
    _, costs, paid_by = load()
    without_fundraising = {k: v for k, v in paid_by.items() if k != "fundraising_the_gap"}
    b = balance_line_items(costs, without_fundraising)
    assert b.total_sources == Decimal(285000 + 100000 + 55000) == Decimal(440000)
    assert b.residual_gap == Decimal(95000)
    assert b.residual_gap == paid_by["fundraising_the_gap"]


def test_fully_balanced_to_zero():
    deal, costs, paid_by = load()
    b = balance_line_items(costs, paid_by)
    assert b.residual_gap == 0
    assert b.total_sources - b.total_cost == Decimal(deal["balance"]["value"])
