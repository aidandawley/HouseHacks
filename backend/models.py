"""Pydantic contracts for the HomeForge API (plan section 7).

All money inputs are plain JSON numbers. They are parsed as Decimal so the
finance engines can do exact arithmetic.
"""

from __future__ import annotations

from decimal import Decimal
from enum import Enum
from typing import Annotated, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, PlainSerializer, field_validator, model_validator

# Money/ratio outputs: exact Decimal in Python, plain JSON number on the wire.
Money = Annotated[Decimal, PlainSerializer(float, return_type=float, when_used="json")]


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


# ---------------------------------------------------------------- enums


class FundingStatus(str, Enum):
    committed = "committed"  # assumed committed within the scenario (not necessarily real)
    conditional = "conditional"  # documented conditional award; `amount` is the MODELED allocation
    potential = "potential"  # candidate / unconfirmed; never counted


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
    hypothetical_whatif = "hypothetical_whatif"  # added by an applied advisor what-if; never real


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
    annual_income: Money = Field(ge=0)
    household_size: int = Field(ge=1, le=12)
    housing_cost_ratio: Money = Field(gt=0, le=1)
    annual_mortgage_rate: Money = Field(ge=0, lt=1)
    mortgage_term_years: int = Field(gt=0, le=50)
    other_housing_costs_monthly: Money = Field(ge=0)
    buyer_cash_down_payment: Money = Field(ge=0)


class DevelopmentInputs(_Strict):
    land_cost: Money = Field(ge=0)
    site_work_cost: Money = Field(ge=0)
    gross_sqft_per_home: Money = Field(gt=0)
    hard_cost_per_sqft: Money = Field(ge=0)
    soft_cost_rate: Money = Field(ge=0, le=1)
    contingency_rate: Money = Field(ge=0, le=1)
    financing_rate: Money = Field(ge=0, le=1)
    illustrative_site_capacity: int = Field(ge=0)
    additional_subsidy_budget: Money = Field(ge=0)
    # Property taxes paid while the nonprofit holds/builds (ASSUMPTION). A separate line so a
    # possible tax exemption can only ever remove a cost the model actually contains.
    property_tax_carry: Money = Field(default=Decimal(0), ge=0)


class CostReduction(_Strict):
    """A HYPOTHETICAL reduction of a modeled cost line (e.g. a possible property-tax exemption)."""

    id: str = Field(min_length=1)
    program_id: str = Field(min_length=1)
    line: Literal["property_tax_carry"]
    amount: Money = Field(ge=0)
    status: Literal["hypothetical"] = "hypothetical"
    label: str = Field(min_length=1)


class FundingSource(_Strict):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    amount: Optional[Money] = Field(default=None, ge=0)
    # For conditional awards: the documented ceiling (e.g. "up to $2.2M"). Never cash received.
    documented_max: Optional[Money] = Field(default=None, ge=0)
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
        if self.documented_max is not None and self.status == FundingStatus.committed:
            raise ValueError(
                f"{self.id!r} has a documented conditional ceiling; model it as 'conditional' or 'potential', not 'committed'"
            )
        if self.documented_max is not None and self.amount is not None and self.amount > self.documented_max:
            raise ValueError(f"modeled amount for {self.id!r} exceeds its documented maximum")
        return self


class CompareRequest(_Strict):
    candidate_home_counts: list[int] = Field(min_length=1)
    household: HouseholdInputs
    development: DevelopmentInputs
    funding_sources: list[FundingSource] = Field(default_factory=list)
    # Set for real documented sites: the analysis centers on this approved
    # configuration and treats other counts as what-if comparisons (no "best fit").
    documented_home_count: Optional[int] = None
    # Organizer scenario M03: a hypothetical gift to explain (not added to the funding stack).
    gift_amount: Optional[Money] = Field(default=None, ge=0, le=100_000_000)
    # Applied advisor what-ifs that reduce modeled cost lines (never applied automatically).
    cost_reductions: list[CostReduction] = Field(default_factory=list)

    @model_validator(mode="after")
    def _reductions_within_lines(self) -> "CompareRequest":
        total = sum((r.amount for r in self.cost_reductions if r.line == "property_tax_carry"), Decimal(0))
        if total > self.development.property_tax_carry:
            raise ValueError(
                "cost reductions exceed the modeled property-tax line — a saving cannot remove more than the cost it reduces"
            )
        ids = [r.id for r in self.cost_reductions]
        if len(set(ids)) != len(ids):
            raise ValueError("cost_reductions ids must be unique")
        return self

    @model_validator(mode="after")
    def _documented_is_candidate(self) -> "CompareRequest":
        if self.documented_home_count is not None and self.documented_home_count not in self.candidate_home_counts:
            raise ValueError("documented_home_count must be one of candidate_home_counts")
        return self

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


# ---------------------------------------------------------------- projects


class FactStatus(str, Enum):
    documented = "DOCUMENTED"
    derived = "DERIVED"
    assumption = "ASSUMPTION"
    unknown = "UNKNOWN"


class SiteFact(_Strict):
    key: str
    label: str
    value: Optional[str | int | float] = None  # null when UNKNOWN; never guessed
    unit: Optional[str] = None
    status: FactStatus
    source_id: Optional[str] = None
    page: Optional[int] = None
    note: Optional[str] = None

    @model_validator(mode="after")
    def _status_rules(self) -> "SiteFact":
        if self.status == FactStatus.documented and not self.source_id:
            raise ValueError(f"DOCUMENTED fact {self.key!r} needs a source_id")
        if self.status == FactStatus.unknown and self.value is not None:
            raise ValueError(f"UNKNOWN fact {self.key!r} must not carry a value")
        return self


class ProjectSource(_Strict):
    id: str
    title: str
    publisher: str
    url: HttpUrl
    published: Optional[str] = None
    checked_at: str
    verification_status: str
    note: Optional[str] = None


class Site(_Strict):
    address: Optional[str] = None
    apn: Optional[str] = None
    buildings: Optional[int] = Field(default=None, ge=1)
    units_per_building: Optional[int] = Field(default=None, ge=1)
    visualization_status: str = "schematic_not_to_scale"
    facts: list[SiteFact] = Field(default_factory=list)


class InputProvenance(_Strict):
    kind: str  # assumption | user | published_rate | published_income_limit | documented | derived
    source_id: Optional[str] = None
    note: Optional[str] = None


class ScreeningFact(_Strict):
    """A project fact used by the incentive screen. `value` "unknown" is never inferred into true."""

    value: str
    status: FactStatus
    source_id: Optional[str] = None
    page: Optional[int] = None
    note: Optional[str] = None


class Project(_Strict):
    id: str = Field(min_length=1, pattern=r"^[a-z0-9][a-z0-9-]*$")
    name: str = Field(min_length=1, max_length=120)
    kind: str = "user"  # seed | user
    is_default: bool = False
    case_type: str = "user"  # documented_site | illustrative | user
    location: Optional[str] = None
    summary: Optional[str] = None
    site: Optional[Site] = None
    sources: list[ProjectSource] = Field(default_factory=list)
    reference_links: list[dict] = Field(default_factory=list)
    candidate_home_counts: list[int] = Field(min_length=1)
    default_home_count: Optional[int] = None  # selected on load / reset
    documented_home_count: Optional[int] = None  # see CompareRequest
    # Per-count labels, e.g. {"6": "DOCUMENTED", "8": "UNAPPROVED CONCEPT / NOT ZONING-VALIDATED"}
    scenario_labels: dict[str, str] = Field(default_factory=dict)
    household: HouseholdInputs
    development: DevelopmentInputs
    funding_sources: list[FundingSource] = Field(default_factory=list)
    cost_reductions: list[CostReduction] = Field(default_factory=list)
    screening_facts: dict[str, ScreeningFact] = Field(default_factory=dict)
    input_provenance: dict[str, InputProvenance] = Field(default_factory=dict)
    verified_facts: dict = Field(default_factory=dict)
    notes: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    @field_validator("candidate_home_counts")
    @classmethod
    def _counts_valid(cls, v: list[int]) -> list[int]:
        return CompareRequest._counts_valid(v)

    @model_validator(mode="after")
    def _default_count_is_candidate(self) -> "Project":
        if self.default_home_count is not None and self.default_home_count not in self.candidate_home_counts:
            raise ValueError("default_home_count must be one of candidate_home_counts")
        return self

    def inputs(self) -> CompareRequest:
        return CompareRequest(
            candidate_home_counts=self.candidate_home_counts,
            household=self.household,
            development=self.development,
            funding_sources=self.funding_sources,
            documented_home_count=self.documented_home_count,
            cost_reductions=self.cost_reductions,
        )
