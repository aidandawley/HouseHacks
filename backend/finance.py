"""Project cost, funding stack and gap calculations. Pure, deterministic Decimal math.

Cost formula (plan §5B):
    HARD        = homes × gross_sqft_per_home × hard_cost_per_sqft
    SOFT        = HARD × soft_cost_rate
    CONTINGENCY = (HARD + site_work_cost) × contingency_rate
    FINANCING   = (land + site_work + HARD + SOFT) × financing_rate
    TAX         = property_tax_carry − hypothetical reductions (default 0; never below 0)
    TDC         = land + site_work + HARD + SOFT + CONTINGENCY + FINANCING + TAX

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
        return False, "Potential / candidate — unconfirmed, so never counted."
    if src.instrument not in COUNTED_INSTRUMENTS:
        if src.instrument == FundingInstrument.repayable_loan:
            return False, "Repayable loan — helps timing/liquidity but must be repaid; does not close the subsidy gap."
        return False, "Buyer assistance — raises what the buyer can pay; not a second developer grant."
    if src.amount is None:
        return False, "No amount entered."
    if src.status == FundingStatus.conditional:
        return True, "Counted at the amount you modeled from a conditional grant agreement — an assumption, not cash disbursed."
    return True, "Counted as assumed committed support within this scenario (not a verified commitment)."


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


class PerHome(BaseModel):
    """Scenario totals ÷ homes, each rounded to cents (so lines may differ from the total by a few cents)."""

    property_tax: Money
    land: Money
    site_work: Money
    hard: Money
    soft: Money
    contingency: Money
    financing: Money
    total_cost: Money
    family_pays: Money
    counted_funding: Money
    gap: Money


class GiftImpact(BaseModel):
    """Organizer scenario M03: what a hypothetical gift does, measured against this scenario's modeled gap.

    The gift is NOT added to the funding stack here; it is a what-if lens. All comparisons
    are to modeled (assumption-based) per-home figures, not Habitat's actual budget.
    """

    gift_amount: Money
    share_of_one_home_gap: Money | None  # 0..1+, None when there is no gap
    gifts_to_close_one_home: int | None
    construction_sqft_equivalent: Money | None  # gift ÷ assumed hard cost per sq ft
    comparable_line: str | None  # largest per-home cost line the gift fully covers
    comparable_line_amount: Money | None
    project_gap_after_gift: Money


class ScenarioResult(BaseModel):
    homes: int
    land_cost: Money
    site_work_cost: Money
    hard_cost: Money
    soft_cost: Money
    contingency: Money
    financing_cost: Money
    property_tax_carry: Money  # after any HYPOTHETICAL reductions
    property_tax_reduction: Money  # hypothetical what-if reductions applied (0 = none)
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
    per_home: PerHome
    gift: GiftImpact | None = None


LINE_LABELS = {
    "land": "land cost",
    "site_work": "site work",
    "hard": "construction",
    "soft": "design, permits & fees (soft costs)",
    "contingency": "contingency cushion",
    "financing": "interest & holding costs",
    "property_tax": "property taxes while held",
}


def gift_impact(s: ScenarioResult, gift: Decimal, hard_cost_per_sqft: Decimal) -> GiftImpact:
    with localcontext() as ctx:
        ctx.prec = 50
        g = round_money(gift)
        gap1 = s.per_home.gap
        share = (g / gap1).quantize(Decimal("0.0001")) if gap1 > 0 else None
        gifts = int((gap1 / g).to_integral_value(rounding="ROUND_CEILING")) if gap1 > 0 and g > 0 else None
        sqft = (g / hard_cost_per_sqft).quantize(Decimal("1")) if hard_cost_per_sqft > 0 else None
        covered = [(k, getattr(s.per_home, k)) for k in LINE_LABELS if 0 < getattr(s.per_home, k) <= g]
        best = max(covered, key=lambda kv: kv[1]) if covered else None
        return GiftImpact(
            gift_amount=g,
            share_of_one_home_gap=share,
            gifts_to_close_one_home=gifts,
            construction_sqft_equivalent=sqft,
            comparable_line=LINE_LABELS[best[0]] if best else None,
            comparable_line_amount=best[1] if best else None,
            project_gap_after_gift=max(ZERO, s.remaining_gap - g),
        )


def analyze_development(
    homes: int,
    dev: DevelopmentInputs,
    sale_price_per_home: Decimal,
    counted_support: Decimal,
    property_tax_reduction: Decimal = Decimal(0),
) -> ScenarioResult:
    with localcontext() as ctx:
        ctx.prec = 50
        land = round_money(dev.land_cost)
        site = round_money(dev.site_work_cost)
        hard = round_money(homes * dev.gross_sqft_per_home * dev.hard_cost_per_sqft)
        soft = round_money(hard * dev.soft_cost_rate)
        contingency = round_money((hard + site) * dev.contingency_rate)
        financing = round_money((land + site + hard + soft) * dev.financing_rate)
        tax_reduction = round_money(min(property_tax_reduction, dev.property_tax_carry))
        tax = round_money(dev.property_tax_carry) - tax_reduction
        tdc = land + site + hard + soft + contingency + financing + tax

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
            property_tax_carry=tax,
            property_tax_reduction=tax_reduction,
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
            per_home=PerHome(
                property_tax=round_money(tax / homes),
                land=round_money(land / homes),
                site_work=round_money(site / homes),
                hard=round_money(hard / homes),
                soft=round_money(soft / homes),
                contingency=round_money(contingency / homes),
                financing=round_money(financing / homes),
                total_cost=round_money(tdc / homes),
                family_pays=price,
                counted_funding=round_money(support / homes),
                gap=round_money(remaining / homes),
            ),
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
