"""Funding & incentive catalog, deterministic screening, and safe what-if simulation.

Everything here runs without Claude. The advisor agent (advisor.py) only *calls* these
functions as read-only tools; applying a what-if requires an explicit user confirmation
through POST /api/scenarios/apply-proposal.

Safety rules enforced in code (spec §7, §12):
  * No result is ever "eligible"/"approved" — only the five screening categories.
  * Unknown facts are never inferred true ("verified_true" needs a DOCUMENTED "true").
  * A tax exemption can only reduce a property-tax line the model already contains,
    never by more than that line, and never twice (same program or exclusive group).
  * Loans, fee deferrals and buyer assistance never reduce the permanent development gap.
  * Simulations run on a copy; nothing is mutated until a confirmed, version-checked apply.
"""

from __future__ import annotations

import hashlib
import json
import secrets
import time
from decimal import Decimal
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict

from .models import CompareRequest, CostReduction, FundingSource, Project
from .optimize import compare

CATALOG_PATH = Path(__file__).parent / "data" / "incentives.json"

MatchStatus = Literal["potential_match", "needs_information", "appears_incompatible", "unavailable_or_closed", "unsupported"]

STATUS_LABEL: dict[str, str] = {
    "potential_match": "Potential match — not an eligibility determination",
    "needs_information": "Research lead — key facts missing",
    "appears_incompatible": "Appears incompatible with the current scenario",
    "unavailable_or_closed": "Closed or unavailable as last checked",
    "unsupported": "Unverified lead — no savings claimed",
}
STATUS_ORDER = ["potential_match", "needs_information", "appears_incompatible", "unavailable_or_closed", "unsupported"]
DISCLAIMER = "Research and preliminary financial modeling only; eligibility and funding availability require verification. Not legal, tax, lending, or financial advice."


# ---------------------------------------------------------------- catalog


class _Loose(BaseModel):
    model_config = ConfigDict(extra="allow")


class Program(_Loose):
    id: str
    name: str
    jurisdiction: list[str]
    project_types: list[str]
    category: str
    financial_mechanism: str
    simulation: Literal["tax_cost_reduction", "grant", "restricted_grant", "timing_only", "buyer_side", "none"]
    exclusive_group: Optional[str] = None
    restricted_to_lines: list[str] = []
    complexity: str
    how_it_works: str
    availability: str
    availability_note: str
    eligibility_rules: list[dict[str, Any]]
    requirements_not_automated: list[str]
    source: dict[str, Any]
    automatic_eligibility_decision_allowed: bool

    def model_post_init(self, _ctx: Any) -> None:
        if self.automatic_eligibility_decision_allowed:
            raise ValueError(f"{self.id}: automatic eligibility decisions are not allowed")
        for k in ("title", "checked_on", "verification"):
            if not self.source.get(k):
                raise ValueError(f"{self.id}: source.{k} is required")


@lru_cache(maxsize=1)
def _catalog_text() -> str:
    return CATALOG_PATH.read_text(encoding="utf-8")


def load_catalog() -> list[Program]:
    return [Program.model_validate(p) for p in json.loads(_catalog_text())["programs"]]


def get_program(program_id: str) -> Program:
    for p in load_catalog():
        if p.id == program_id:
            return p
    raise KeyError(program_id)


def program_ids() -> list[str]:
    return [p.id for p in load_catalog()]


# ---------------------------------------------------------------- property-tax relief estimate

# Defaults and bounds for the quick, hypothetical estimate. Each is a labeled ASSUMPTION or sourced.
TAX_RATE_DEFAULT = Decimal("0.011")
TAX_RATE_BOUNDS = (Decimal("0.008"), Decimal("0.02"))
BUILT_SHARE_DEFAULT = Decimal("0.5")
LIEN_DATES_DEFAULT = 1
LIEN_DATES_BOUNDS = (1, 5)


class EstimateAssumption(BaseModel):
    name: str
    value: str
    label: Literal["ASSUMPTION", "SOURCED", "MODEL INPUT", "DERIVED"]
    basis: str


class TaxReliefEstimate(BaseModel):
    """Quick, hypothetical property-tax relief figure. Deterministic; never an assessor value."""

    program_id: str
    homes: int
    land_value: float
    improvements_value: float
    assessed_value_basis: float
    effective_tax_rate: float
    annual_tax_estimate: float
    eligible_lien_dates: int
    estimated_relief: float
    budget_tax_line: float
    suggested_amount: float  # estimated_relief capped at the remaining tax line
    capped_by_budget_line: bool
    formula: str
    assumptions: list[EstimateAssumption]
    label: str = "ESTIMATE — hypothetical; not an assessor determination"


def estimate_tax_relief(
    program: Program,
    inputs: CompareRequest,
    homes: Optional[int] = None,
    effective_tax_rate: Optional[float] = None,
    built_share_at_lien_date: Optional[float] = None,
    eligible_lien_dates: Optional[int] = None,
) -> TaxReliefEstimate:
    if program.simulation != "tax_cost_reduction":
        raise SimulationRefused(f"{program.name} is not a property-tax relief lead; no tax estimate applies.")
    rate = Decimal(str(effective_tax_rate)) if effective_tax_rate is not None else TAX_RATE_DEFAULT
    share = Decimal(str(built_share_at_lien_date)) if built_share_at_lien_date is not None else BUILT_SHARE_DEFAULT
    liens = int(eligible_lien_dates) if eligible_lien_dates is not None else LIEN_DATES_DEFAULT
    if not (TAX_RATE_BOUNDS[0] <= rate <= TAX_RATE_BOUNDS[1]):
        raise SimulationRefused("effective_tax_rate must be between 0.8% and 2%.")
    if not (Decimal(0) <= share <= Decimal(1)):
        raise SimulationRefused("built_share_at_lien_date must be between 0 and 1.")
    if not (LIEN_DATES_BOUNDS[0] <= liens <= LIEN_DATES_BOUNDS[1]):
        raise SimulationRefused("eligible_lien_dates must be between 1 and 5.")

    result = compare(inputs)
    n = homes if homes in inputs.candidate_home_counts else (inputs.documented_home_count or inputs.candidate_home_counts[0])
    s = next(x for x in result.scenarios if x.homes == n)
    land = s.land_cost
    improvements = (s.site_work_cost + s.hard_cost) * share
    basis = land + improvements
    annual = (basis * rate).quantize(Decimal("1"))
    relief = annual * liens
    available = _tax_available(inputs)
    suggested = min(relief, available) if available > 0 else Decimal(0)
    window = program.availability_note
    return TaxReliefEstimate(
        program_id=program.id,
        homes=n,
        land_value=float(land),
        improvements_value=float(improvements.quantize(Decimal("1"))),
        assessed_value_basis=float(basis.quantize(Decimal("1"))),
        effective_tax_rate=float(rate),
        annual_tax_estimate=float(annual),
        eligible_lien_dates=liens,
        estimated_relief=float(relief),
        budget_tax_line=float(available),
        suggested_amount=float(suggested),
        capped_by_budget_line=relief > available,
        formula=(
            f"(${land:,.0f} land + ${improvements:,.0f} improvements in place) × {rate * 100:.2f}% "
            f"≈ ${annual:,.0f}/yr × {liens} eligible lien date{'s' if liens != 1 else ''} = ${relief:,.0f}"
        ),
        assumptions=[
            EstimateAssumption(name="Land value", value=f"${land:,.0f}", label="MODEL INPUT",
                               basis="The scenario's land cost (itself an ASSUMPTION); real assessed value UNKNOWN."),
            EstimateAssumption(name="Share of site work + construction in place on the lien date", value=f"{share * 100:.0f}%",
                               label="ASSUMPTION", basis="Mid-construction placeholder; actual construction status UNKNOWN."),
            EstimateAssumption(name="Effective property-tax rate", value=f"{rate * 100:.2f}%", label="ASSUMPTION",
                               basis="Organizers' data guide: use about 1% plus local assessments as an assumption; actual parcel rate not looked up."),
            EstimateAssumption(name="Eligible lien dates", value=str(liens), label="SOURCED" if liens == 1 else "ASSUMPTION",
                               basis=window if liens == 1 else "User/agent-selected; must fall within the program's operative window."),
        ],
    )


# ---------------------------------------------------------------- screening


class Card(BaseModel):
    program_id: str
    name: str
    match_status: MatchStatus
    status_label: str
    how_it_works: str
    category: str
    financial_effect_type: str
    complexity: str
    matches: list[str]
    conflicts: list[str]
    missing_information: list[str]
    availability: str
    availability_note: str
    source_title: str
    source_url: Optional[str]
    source_checked_on: str
    source_verification: str
    simulation: str
    can_simulate: bool
    simulate_note: Optional[str]
    suggested_amount: Optional[float]
    estimated_savings_usd: None = None  # only the backend simulation produces amounts
    tax_estimate: Optional[TaxReliefEstimate] = None  # quick hypothetical estimate for property-tax leads


def _fact(project: Project, key: str) -> Optional[str]:
    f = project.screening_facts.get(key)
    return f.value if f else None


def _input_value(inputs: CompareRequest, path: str) -> Decimal:
    section, key = path.split(".")
    return Decimal(str(getattr(getattr(inputs, section), key)))


def _fmt_pct(v: Decimal) -> str:
    return f"{(v * 100).normalize():f}%"


def _tax_available(inputs: CompareRequest) -> Decimal:
    used = sum((r.amount for r in inputs.cost_reductions if r.line == "property_tax_carry"), Decimal(0))
    return inputs.development.property_tax_carry - used


def screen(program: Program, project: Project, inputs: CompareRequest) -> Card:
    matches: list[str] = []
    conflicts: list[str] = []
    missing: list[str] = []
    jurisdiction_ok = any(j in ("CA", "US") for j in program.jurisdiction) and (_fact(project, "state") in (None, "CA"))
    if not jurisdiction_ok:
        conflicts.append("Outside the program's jurisdiction.")

    for rule in program.eligibility_rules:
        label = rule["label"]
        if "unknown" in rule:
            missing.append(label)
            continue
        if "fact" in rule:
            v = _fact(project, rule["fact"])
            op = rule["operator"]
            if v is None or v in ("unknown", "intended_unverified"):
                missing.append(label + (" (intended, not verified)" if v == "intended_unverified" else ""))
            elif op == "verified_true":
                fact = project.screening_facts[rule["fact"]]
                (matches if (v == "true" and fact.status.value == "DOCUMENTED") else missing).append(label)
            elif op == "equals":
                (matches if v == rule["value"] else conflicts).append(label)
            elif op == "in":
                (matches if v in rule["value"] else conflicts).append(label)
            continue
        if "input" in rule:
            v = _input_value(inputs, rule["input"])
            target = Decimal(str(rule["value"]))
            ok = v <= target if rule["operator"] == "lte" else v == target
            if ok:
                matches.append(label + " (under current model assumptions)")
            else:
                note = rule.get("conflict_note", label).replace("{value:pct}", _fmt_pct(v))
                conflicts.append(note + " (a modeled assumption you can change)")

    if program.availability == "application_closed_on_checked_page":
        status: MatchStatus = "unavailable_or_closed"
    elif program.source.get("verification") == "team_research_unverified" or program.simulation == "none" and not program.eligibility_rules:
        status = "unsupported"
    elif conflicts:
        status = "appears_incompatible"
    elif missing or not matches or program.availability in ("requires_program_review", "buyer_eligibility_unknown"):
        status = "needs_information"
    else:
        status = "potential_match"

    can_sim, note, suggested = _simulation_readiness(program, inputs)
    tax_est = None
    if program.simulation == "tax_cost_reduction" and can_sim:
        tax_est = estimate_tax_relief(program, inputs)
        suggested = tax_est.suggested_amount
    return Card(
        program_id=program.id,
        name=program.name,
        match_status=status,
        status_label=STATUS_LABEL[status],
        how_it_works=program.how_it_works,
        category=program.category,
        financial_effect_type=program.financial_mechanism,
        complexity=program.complexity,
        matches=matches,
        conflicts=conflicts,
        missing_information=missing + [r for r in program.requirements_not_automated if r not in missing],
        availability=program.availability,
        availability_note=program.availability_note,
        source_title=program.source["title"],
        source_url=program.source.get("url"),
        source_checked_on=program.source["checked_on"],
        source_verification=program.source["verification"],
        simulation=program.simulation,
        can_simulate=can_sim,
        simulate_note=note,
        suggested_amount=suggested,
        tax_estimate=tax_est,
    )


def _simulation_readiness(program: Program, inputs: CompareRequest) -> tuple[bool, Optional[str], Optional[float]]:
    if program.simulation == "tax_cost_reduction":
        if inputs.development.property_tax_carry <= 0:
            return False, "No property-tax carrying cost in this scenario — nothing to reduce. Add an assumed property-tax line first.", None
        if _group_already_applied(program, inputs):
            return False, "A property-tax exemption what-if is already applied; the same tax cannot be removed twice.", None
        return True, "Pre-filled with a quick estimate (see breakdown); adjust as you like.", float(_tax_available(inputs))
    if program.simulation in ("grant", "restricted_grant"):
        if any(f.id == f"hyp-{program.id}" for f in inputs.funding_sources):
            return False, "This program's hypothetical award is already applied.", None
        if program.simulation == "restricted_grant":
            return True, "Restricted to land and site work; the amount is capped at those modeled costs.", None
        return True, "Enter a hypothetical award amount. It will be labeled as not awarded.", None
    if program.simulation == "timing_only":
        return True, "Timing only — a deferral does not change the permanent gap.", None
    if program.simulation == "buyer_side":
        return False, "Buyer-side assistance; it is not developer funding and does not reduce the development gap.", None
    return False, "No financial simulation for this lead.", None


def _group_already_applied(program: Program, inputs: CompareRequest) -> bool:
    if any(r.program_id == program.id for r in inputs.cost_reductions):
        return True
    if program.exclusive_group:
        group_ids = {p.id for p in load_catalog() if p.exclusive_group == program.exclusive_group}
        return any(r.program_id in group_ids for r in inputs.cost_reductions)
    return False


def screen_all(project: Project, inputs: CompareRequest, category: Optional[str] = None) -> list[Card]:
    cards = [
        screen(p, project, inputs)
        for p in load_catalog()
        if "affordable_homeownership" in p.project_types and (category in (None, "all") or p.category == category)
    ]
    return sorted(cards, key=lambda c: STATUS_ORDER.index(c.match_status))


# ---------------------------------------------------------------- simulation + proposals


def scenario_version(inputs: CompareRequest) -> str:
    data = inputs.model_dump(mode="json", exclude={"gift_amount"})
    return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()[:16]


class ScenarioDelta(BaseModel):
    homes: int
    baseline_tdc: float
    hypothetical_tdc: float
    baseline_gap: float
    hypothetical_gap: float
    gap_change: float


class Simulation(BaseModel):
    program_id: str
    program_name: str
    kind: str
    ok: bool
    message: str
    amount: Optional[float]
    proposal_id: Optional[str]
    scenario_version: str
    change_description: Optional[str]
    deltas: list[ScenarioDelta]
    status_label: str = "ASSUMPTION / NOT CONFIRMED"
    disclaimer: str = DISCLAIMER


class SimulationRefused(ValueError):
    pass


_PROPOSALS: dict[str, dict[str, Any]] = {}
_PROPOSAL_TTL_S = 3600


def _patch(program: Program, inputs: CompareRequest, amount: Decimal) -> tuple[Optional[CompareRequest], str]:
    data = inputs.model_dump(mode="json")
    if program.simulation == "tax_cost_reduction":
        if inputs.development.property_tax_carry <= 0:
            raise SimulationRefused(
                "This scenario contains no property-tax carrying cost, so an exemption cannot be shown to save anything. "
                "Add an assumed property-tax line (Advanced assumptions) first."
            )
        if _group_already_applied(program, inputs):
            raise SimulationRefused("A related property-tax exemption what-if already reduces this tax line; the same expense cannot be removed twice.")
        available = _tax_available(inputs)
        if amount <= 0:
            raise SimulationRefused("Enter a positive eligible tax amount.")
        if amount > available:
            raise SimulationRefused(
                f"The eligible amount (${amount:,.0f}) exceeds the property-tax cost in the model (${available:,.0f}). "
                "A saving cannot remove more than the cost it reduces."
            )
        data["cost_reductions"].append(
            CostReduction(
                id=f"cr-{program.id}",
                program_id=program.id,
                line="property_tax_carry",
                amount=amount,
                label=f"HYPOTHETICAL: {program.name} — not approved; requires assessor determination",
            ).model_dump(mode="json")
        )
        return CompareRequest.model_validate(data), f"Remove ${amount:,.0f} of modeled property-tax cost (hypothetical exemption)."

    if program.simulation in ("grant", "restricted_grant"):
        if amount <= 0:
            raise SimulationRefused("Enter a positive hypothetical award amount.")
        if any(f.id == f"hyp-{program.id}" for f in inputs.funding_sources):
            raise SimulationRefused("This program's hypothetical award is already in the scenario.")
        if program.simulation == "restricted_grant":
            cap = inputs.development.land_cost + inputs.development.site_work_cost
            if amount > cap:
                raise SimulationRefused(
                    f"{program.name} funds are restricted to land and infrastructure; the modeled land + site work is "
                    f"${cap:,.0f}, so a hypothetical award above that cannot be counted."
                )
        data["funding_sources"].append(
            FundingSource(
                id=f"hyp-{program.id}",
                name=f"HYPOTHETICAL: {program.name} — not awarded",
                amount=amount,
                status="committed",
                instrument="development_grant",
                basis="hypothetical_whatif",
            ).model_dump(mode="json")
        )
        return CompareRequest.model_validate(data), f"Add a hypothetical ${amount:,.0f} {program.name} award (not awarded)."

    if program.simulation == "timing_only":
        return None, "A fee deferral changes when fees are paid, not how much — the permanent gap is unchanged."
    if program.simulation == "buyer_side":
        raise SimulationRefused("Buyer assistance helps the buyer finance a purchase; it is not developer funding and is not subtracted from the gap.")
    raise SimulationRefused("This lead has no financial simulation (regulatory or unverified).")


def simulate(project: Project, inputs: CompareRequest, program_id: str, amount: float | Decimal | None) -> Simulation:
    program = get_program(program_id)
    version = scenario_version(inputs)
    amt = Decimal(str(amount or 0))
    try:
        patched, description = _patch(program, inputs, amt)
    except SimulationRefused as e:
        return Simulation(
            program_id=program.id, program_name=program.name, kind=program.simulation, ok=False, message=str(e),
            amount=float(amt) if amount is not None else None, proposal_id=None, scenario_version=version,
            change_description=None, deltas=[],
        )

    base = compare(inputs)
    hyp = compare(patched) if patched is not None else base
    deltas = [
        ScenarioDelta(
            homes=b.homes,
            baseline_tdc=float(b.total_development_cost),
            hypothetical_tdc=float(h.total_development_cost),
            baseline_gap=float(b.remaining_gap),
            hypothetical_gap=float(h.remaining_gap),
            gap_change=float(h.remaining_gap - b.remaining_gap),
        )
        for b, h in zip(base.scenarios, hyp.scenarios)
    ]
    proposal_id = None
    if patched is not None:
        _gc()
        proposal_id = "prop-" + secrets.token_hex(8)
        _PROPOSALS[proposal_id] = {
            "version": version,
            "patched": patched.model_dump(mode="json"),
            "program_id": program.id,
            "project_id": project.id,
            "created": time.time(),
        }
    msg = description
    if program.availability == "application_closed_on_checked_page":
        msg += " Note: the application window was CLOSED when last checked — this is a what-if only."
    return Simulation(
        program_id=program.id, program_name=program.name, kind=program.simulation, ok=True, message=msg,
        amount=float(amt), proposal_id=proposal_id, scenario_version=version, change_description=description, deltas=deltas,
    )


def _gc() -> None:
    now = time.time()
    for k in [k for k, v in _PROPOSALS.items() if now - v["created"] > _PROPOSAL_TTL_S]:
        del _PROPOSALS[k]


class ProposalError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status


def apply_proposal(proposal_id: str, inputs: CompareRequest, user_confirmed: bool) -> CompareRequest:
    """Only called from the UI's explicit 'Apply as hypothetical' action — never by the agent."""
    if user_confirmed is not True:
        raise ProposalError(400, "Applying a what-if requires explicit user confirmation.")
    _gc()
    prop = _PROPOSALS.get(proposal_id)
    if prop is None:
        raise ProposalError(404, "Proposal not found or expired — run the simulation again.")
    if scenario_version(inputs) != prop["version"]:
        raise ProposalError(409, "The scenario changed since this simulation — run it again so the numbers match.")
    del _PROPOSALS[proposal_id]  # single use
    return CompareRequest.model_validate(prop["patched"])
