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
    analysis_mode: str  # "max_homes_under_cap" | "documented_configuration"
    documented_home_count: int | None
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

    if request.documented_home_count is not None:
        mode = "documented_configuration"
        recommended, minimum_needed, reason = None, None, _documented_reason(request, scenarios, funding)
    else:
        mode = "max_homes_under_cap"
        recommended, minimum_needed, reason = _max_homes_under_cap(request, scenarios)

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
        analysis_mode=mode,
        documented_home_count=request.documented_home_count,
        affordability=affordability,
        funding=funding,
        scenarios=scenarios,
        recommended_home_count=recommended,
        recommendation_reason=reason,
        minimum_needed_if_none_fit=minimum_needed,
        warnings=warnings,
    )


def _documented_reason(request: CompareRequest, scenarios: list[ScenarioResult], funding: FundingSummary) -> str:
    """Real documented site: report the approved configuration's gap; others are what-ifs only."""
    doc = next(s for s in scenarios if s.homes == request.documented_home_count)
    cap = request.development.additional_subsidy_budget
    if doc.remaining_gap == 0:
        reason = (
            f"The documented {doc.homes}-home configuration pencils under these assumptions "
            f"(modeled surplus {_usd(doc.modeled_surplus)}) after {_usd(funding.counted_project_support)} of counted funding."
        )
    else:
        reason = (
            f"The documented {doc.homes}-home configuration leaves a {_usd(doc.remaining_gap)} gap "
            f"({_usd(doc.gap_per_home)} per home) after {_usd(funding.counted_project_support)} of counted "
            f"assumed/modeled funding. "
        )
        reason += (
            f"That fits the assumed {_usd(cap)} extra-subsidy cap."
            if doc.within_subsidy_cap
            else f"That is {_usd(doc.remaining_gap - cap)} more than the assumed {_usd(cap)} extra-subsidy cap."
        )
    others = [str(s.homes) for s in scenarios if s.homes != doc.homes]
    if others:
        reason += f" {' and '.join(others)} homes are unapproved what-if comparisons, not recommendations."
    return reason


def _max_homes_under_cap(request: CompareRequest, scenarios: list[ScenarioResult]):
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

    return recommended, minimum_needed, reason
