"""Household affordability engine (plan section 5A). Pure, deterministic Decimal math.

annual income -> monthly housing budget -> P&I available -> mortgage principal
-> affordable sale-price ceiling per home (principal + buyer cash down payment).

Intermediate values are kept at full precision; only the outputs are rounded
half-up to cents.
"""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal, localcontext

from pydantic import BaseModel

from .models import HouseholdInputs, Money

CENT = Decimal("0.01")
_PRECISION = 50


def round_money(value: Decimal) -> Decimal:
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


class AffordabilityResult(BaseModel):
    monthly_housing_budget: Money
    monthly_principal_interest_available: Money
    mortgage_principal: Money
    affordable_sale_price_per_home: Money
    affordability_valid: bool
    warning: str | None = None


def calculate_affordability(h: HouseholdInputs) -> AffordabilityResult:
    with localcontext() as ctx:
        ctx.prec = _PRECISION

        budget = h.annual_income * h.housing_cost_ratio / 12
        pi_available = budget - h.other_housing_costs_monthly
        monthly_rate = h.annual_mortgage_rate / 12
        n_months = h.mortgage_term_years * 12

        if pi_available <= 0:
            return AffordabilityResult(
                monthly_housing_budget=round_money(budget),
                monthly_principal_interest_available=Decimal("0.00"),
                mortgage_principal=Decimal("0.00"),
                affordable_sale_price_per_home=Decimal("0.00"),
                affordability_valid=False,
                warning=(
                    "Other monthly housing costs meet or exceed the modeled housing budget; "
                    "no mortgage is supportable under these assumptions."
                ),
            )

        if monthly_rate == 0:
            principal = pi_available * n_months
        else:
            principal = pi_available * (1 - (1 + monthly_rate) ** (-n_months)) / monthly_rate

        principal_c = round_money(principal)
        # Buyer cash is counted once, here, as part of the price paid to the developer.
        price = principal_c + round_money(h.buyer_cash_down_payment)

        return AffordabilityResult(
            monthly_housing_budget=round_money(budget),
            monthly_principal_interest_available=round_money(pi_available),
            mortgage_principal=principal_c,
            affordable_sale_price_per_home=round_money(price),
            affordability_valid=True,
        )
