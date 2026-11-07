"""Pydantic contracts for the HomeForge API (plan section 7).

All money inputs are plain JSON numbers. They are parsed as Decimal so the
finance engines can do exact arithmetic.
"""

from __future__ import annotations

from decimal import Decimal
from enum import Enum
from typing import Annotated, Optional

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, PlainSerializer, field_validator, model_validator

# Money/ratio outputs: exact Decimal in Python, plain JSON number on the wire.
Money = Annotated[Decimal, PlainSerializer(float, return_type=float, when_used="json")]


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


# ---------------------------------------------------------------- enums


class FundingStatus(str, Enum):
    committed = "committed"
    potential = "potential"


class FundingInstrument(str, Enum):
    development_grant = "development_grant"
    donation = "donation"
    repayable_loan = "repayable_loan"
    buyer_assistance = "buyer_assistance"


class FundingBasis(str, Enum):
    illustrative_assumption = "illustrative_assumption"
    user_entered = "user_entered"
    reference_only = "reference_only"
    verified_public_source = "verified_public_source"


# ---------------------------------------------------------------- inputs


class SourceMetadata(_Strict):
    """Required when a figure claims to be backed by a verified public source."""

    title: str = Field(min_length=1)
    publisher: str = Field(min_length=1)
    url: HttpUrl
    publication_date: Optional[str] = None
    page_or_section: Optional[str] = None
    fact_supported: str = Field(min_length=1)


class HouseholdInputs(_Strict):
    annual_income: Decimal = Field(ge=0)
    household_size: int = Field(ge=1, le=12)
    housing_cost_ratio: Decimal = Field(gt=0, le=1)
    annual_mortgage_rate: Decimal = Field(ge=0, lt=1)
    mortgage_term_years: int = Field(gt=0, le=50)
    other_housing_costs_monthly: Decimal = Field(ge=0)
    buyer_cash_down_payment: Decimal = Field(ge=0)


class DevelopmentInputs(_Strict):
    land_cost: Decimal = Field(ge=0)
    site_work_cost: Decimal = Field(ge=0)
    gross_sqft_per_home: Decimal = Field(gt=0)
    hard_cost_per_sqft: Decimal = Field(ge=0)
    soft_cost_rate: Decimal = Field(ge=0, le=1)
    contingency_rate: Decimal = Field(ge=0, le=1)
    financing_rate: Decimal = Field(ge=0, le=1)
    illustrative_site_capacity: int = Field(ge=0)
    additional_subsidy_budget: Decimal = Field(ge=0)


class FundingSource(_Strict):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    amount: Optional[Decimal] = Field(default=None, ge=0)
    status: FundingStatus
    instrument: FundingInstrument
    basis: FundingBasis
    source: Optional[SourceMetadata] = None

    @model_validator(mode="after")
    def _verified_needs_source(self) -> "FundingSource":
        if self.basis == FundingBasis.verified_public_source and self.source is None:
            raise ValueError(
                "basis 'verified_public_source' requires source metadata "
                "(title, publisher, url, fact_supported)"
            )
        return self


class CompareRequest(_Strict):
    candidate_home_counts: list[int] = Field(min_length=1)
    household: HouseholdInputs
    development: DevelopmentInputs
    funding_sources: list[FundingSource] = Field(default_factory=list)

    @field_validator("candidate_home_counts")
    @classmethod
    def _counts_valid(cls, v: list[int]) -> list[int]:
        if any(n <= 0 for n in v):
            raise ValueError("candidate_home_counts must be positive integers")
        if len(set(v)) != len(v):
            raise ValueError("candidate_home_counts must be unique")
        return sorted(v)

    @field_validator("funding_sources")
    @classmethod
    def _unique_ids(cls, v: list[FundingSource]) -> list[FundingSource]:
        ids = [s.id for s in v]
        if len(set(ids)) != len(ids):
            raise ValueError("funding_sources ids must be unique")
        return v
