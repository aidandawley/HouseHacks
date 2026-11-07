"""Project cost and funding-gap calculations. Pure, deterministic Decimal math.

Milestone 3 adds the 6/8/10-home development-cost engine here. For now this
holds the generic line-item balance used by the organizers' synthetic
one-home bill: cost to create - sources = residual gap.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Mapping


@dataclass(frozen=True)
class LineItemBalance:
    total_cost: Decimal
    total_sources: Decimal
    residual_gap: Decimal  # positive = still needs funding, negative = surplus


def balance_line_items(costs: Mapping[str, Decimal], sources: Mapping[str, Decimal]) -> LineItemBalance:
    total_cost = sum(costs.values(), Decimal(0))
    total_sources = sum(sources.values(), Decimal(0))
    return LineItemBalance(total_cost, total_sources, total_cost - total_sources)
