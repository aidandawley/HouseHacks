"""Project cost, funding stack and gap calculations. Pure, deterministic Decimal math.

Cost formula (plan §5B):
    HARD        = homes × gross_sqft_per_home × hard_cost_per_sqft
    SOFT        = HARD × soft_cost_rate
    CONTINGENCY = (HARD + site_work_cost) × contingency_rate
    FINANCING   = (land + site_work + HARD + SOFT) × financing_rate
    TDC         = land + site_work + HARD + SOFT + CONTINGENCY + FINANCING

Each line item is rounded half-up to cents as it is produced, and later lines
use the rounded values, so the displayed lines always add up exactly to TDC.
(For the plan's oracle every line is a whole-dollar amount, so this choice
doesn't change any oracle figure.)

Funding (plan §5C, extended for documented conditional awards):
    counted iff status in {committed, conditional}
             and instrument in {development_grant, donation}
             and amount is not null
    Conditional rows count at their MODELED `amount`, never their documented max.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, localcontext
from typing import Mapping

from pydantic import BaseModel

from .affordability import round_money
from .models import DevelopmentInputs, FundingInstrument, FundingSource, FundingStatus, Money

COUNTED_STATUSES = {FundingStatus.committed, FundingStatus.conditional}
COUNTED_INSTRUMENTS = {FundingInstrument.development_grant, FundingInstrument.donation}
ZERO = Decimal("0.00")


# ---------------------------------------------------------------- funding stack


class FundingRowResult(BaseModel):
    id: str
    name: str
    amount: Money | None
    counted_amount: Money
    counted: bool
    reason: str


class FundingSummary(BaseModel):
    counted_project_support: Money
    committed_assumed_amount: Money
    conditional_modeled_amount: Money
    potential_uncommitted_amount: Money
    excluded_amount: Money  # committed/conditional loans and buyer assistance
    excluded_instruments: list[str]
    has_illustrative_commitments: bool
    rows: list[FundingRowResult]


def _row_reason(src: FundingSource) -> tuple[bool, str]:
    if src.status == FundingStatus.potential:
        return False, "Potential / candidate program — unconfirmed, never counted."
    if src.instrument not in COUNTED_INSTRUMENTS:
        if src.instrument == FundingInstrument.repayable_loan:
            return False, "Repayable loan — helps timing/liquidity but must be repaid; does not close the subsidy gap."
        return False, "Buyer assistance — raises what the buyer can pay; not a second developer grant."
    if src.amount is None:
        return False, "No amount entered."
    if src.status == FundingStatus.conditional:
        return True, "Counted at the MODELED allocation of a conditional award (an assumption, not cash disbursed)."
    return True, "Counted as assumed committed developer support (within this scenario)."


def summarize_funding(sources: list[FundingSource]) -> FundingSummary:
    rows: list[FundingRowResult] = []
    counted = committed = conditional = potential = excluded = Decimal(0)
    excluded_instruments: set[str] = set()
    illustrative = False
    for src in sources:
        ok, reason = _row_reason(src)
        amt = src.amount or Decimal(0)
        if ok:
            counted += amt
            if src.status == FundingStatus.conditional:
                conditional += amt
            else:
                committed += amt
            if src.basis.value in ("illustrative_assumption", "user_entered"):
                illustrative = True
        elif src.status == FundingStatus.potential:
            potential += amt
        elif src.instrument not in COUNTED_INSTRUMENTS:
            excluded += amt
            excluded_instruments.add(src.instrument.value)
        rows.append(
            FundingRowResult(
                id=src.id,
                name=src.name,
                amount=None if src.amount is None else round_money(src.amount),
                counted_amount=round_money(amt) if ok else ZERO,
                counted=ok,
                reason=reason,
            )
        )
    return FundingSummary(
        counted_project_support=round_money(counted),
        committed_assumed_amount=round_money(committed),
        conditional_modeled_amount=round_money(conditional),
        potential_uncommitted_amount=round_money(potential),
        excluded_amount=round_money(excluded),
        excluded_instruments=sorted(excluded_instruments),
        has_illustrative_commitments=illustrative,
        rows=rows,
    )


# ---------------------------------------------------------------- development scenarios


class ScenarioResult(BaseModel):
    homes: int
    land_cost: Money
    site_work_cost: Money
    hard_cost: Money
    soft_cost: Money
    contingency: Money
    financing_cost: Money
    total_development_cost: Money
    sale_price_per_home: Money
    sale_proceeds: Money
    counted_project_support: Money
    raw_gap: Money
    remaining_gap: Money
    modeled_surplus: Money
    gap_per_home: Money
    additional_budget_headroom: Money
    within_subsidy_cap: bool
    within_capacity: bool
    eligible: bool


def analyze_development(
    homes: int,
    dev: DevelopmentInputs,
    sale_price_per_home: Decimal,
    counted_support: Decimal,
) -> ScenarioResult:
    with localcontext() as ctx:
        ctx.prec = 50
        land = round_money(dev.land_cost)
        site = round_money(dev.site_work_cost)
        hard = round_money(homes * dev.gross_sqft_per_home * dev.hard_cost_per_sqft)
        soft = round_money(hard * dev.soft_cost_rate)
        contingency = round_money((hard + site) * dev.contingency_rate)
        financing = round_money((land + site + hard + soft) * dev.financing_rate)
        tdc = land + site + hard + soft + contingency + financing

        price = round_money(sale_price_per_home)  # rounded once, before multiplying (plan §5A)
        proceeds = homes * price
        support = round_money(counted_support)

        raw_gap = tdc - proceeds - support
        remaining = max(ZERO, raw_gap)
        surplus = max(ZERO, -raw_gap)
        budget = round_money(dev.additional_subsidy_budget)
        within_cap = remaining <= budget
        within_capacity = homes <= dev.illustrative_site_capacity

        return ScenarioResult(
            homes=homes,
            land_cost=land,
            site_work_cost=site,
            hard_cost=hard,
            soft_cost=soft,
            contingency=contingency,
            financing_cost=financing,
            total_development_cost=tdc,
            sale_price_per_home=price,
            sale_proceeds=proceeds,
            counted_project_support=support,
            raw_gap=raw_gap,
            remaining_gap=remaining,
            modeled_surplus=surplus,
            gap_per_home=round_money(remaining / homes),
            additional_budget_headroom=budget - remaining,
            within_subsidy_cap=within_cap,
            within_capacity=within_capacity,
            eligible=within_cap and within_capacity,
        )


# ---------------------------------------------------------------- generic line-item balance


@dataclass(frozen=True)
class LineItemBalance:
    total_cost: Decimal
    total_sources: Decimal
    residual_gap: Decimal  # positive = still needs funding, negative = surplus


def balance_line_items(costs: Mapping[str, Decimal], sources: Mapping[str, Decimal]) -> LineItemBalance:
    """Used for the organizers' synthetic one-home bill: cost to create - sources = residual gap."""
    total_cost = sum(costs.values(), Decimal(0))
    total_sources = sum(sources.values(), Decimal(0))
    return LineItemBalance(total_cost, total_sources, total_cost - total_sources)
