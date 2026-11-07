"""Deterministic scenario comparison and recommendation (plan §8).

Objective: the largest tested home count whose remaining gap fits the
ASSUMED additional-subsidy cap and the site capacity. Plain enumeration.
This is a screening signal, not an approval or a buildability claim.
"""

from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel

from .affordability import AffordabilityResult, calculate_affordability
from .finance import FundingSummary, ScenarioResult, analyze_development, summarize_funding
from .models import CompareRequest, Money


class Comparison(BaseModel):
    affordability: AffordabilityResult
    funding: FundingSummary
    scenarios: list[ScenarioResult]
    recommended_home_count: int | None
    recommendation_reason: str
    minimum_needed_if_none_fit: Money | None
    warnings: list[str]


def _usd(d: Decimal) -> str:
    return f"${d:,.2f}"


def compare(request: CompareRequest) -> Comparison:
    affordability = calculate_affordability(request.household)
    funding = summarize_funding(request.funding_sources)
    scenarios = [
        analyze_development(
            n, request.development, affordability.affordable_sale_price_per_home, funding.counted_project_support
        )
        for n in request.candidate_home_counts  # already unique + ascending (validated)
    ]

    eligible = [s for s in scenarios if s.eligible]
    capacity_ok = [s for s in scenarios if s.within_capacity]
    cap = request.development.additional_subsidy_budget
    minimum_needed = None

    if eligible:
        best = max(eligible, key=lambda s: s.homes)
        recommended = best.homes
        reason = (
            f"{best.homes} homes is the largest tested configuration within the assumed "
            f"{_usd(cap)} extra-subsidy cap and the site capacity "
            f"({request.development.illustrative_site_capacity} homes)."
        )
        larger = [s for s in scenarios if s.homes > best.homes]
        if larger:
            nxt = larger[0]
            if not nxt.within_capacity:
                reason += f" {nxt.homes} homes exceeds the site capacity."
            else:
                reason += (
                    f" {nxt.homes} homes would leave a {_usd(nxt.remaining_gap)} gap, "
                    f"{_usd(nxt.remaining_gap - cap)} over the cap."
                )
    elif capacity_ok:
        least = min(capacity_ok, key=lambda s: s.remaining_gap)
        recommended = None
        minimum_needed = least.remaining_gap
        reason = (
            f"No tested configuration fits the assumed {_usd(cap)} extra-subsidy cap. "
            f"The least-demanding option within site capacity ({least.homes} homes) still needs "
            f"{_usd(least.remaining_gap)} of additional funding."
        )
    else:
        recommended = None
        reason = (
            f"No tested configuration fits within the site capacity of "
            f"{request.development.illustrative_site_capacity} homes."
        )

    warnings = [
        "Costs, buyer income, funding commitments, site capacity and mortgage inputs are scenario "
        "assumptions unless labeled otherwise; not verified Habitat project data."
    ]
    if affordability.warning:
        warnings.append(affordability.warning)
    if funding.potential_uncommitted_amount > 0:
        warnings.append(
            f"{_usd(funding.potential_uncommitted_amount)} of potential/candidate funding is shown but NOT counted."
        )
    if funding.excluded_amount > 0:
        warnings.append(
            f"{_usd(funding.excluded_amount)} of loans/buyer assistance is shown but does not reduce the subsidy gap."
        )

    return Comparison(
        affordability=affordability,
        funding=funding,
        scenarios=scenarios,
        recommended_home_count=recommended,
        recommendation_reason=reason,
        minimum_needed_if_none_fit=minimum_needed,
        warnings=warnings,
    )
