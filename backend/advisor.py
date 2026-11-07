"""Claude Funding & Incentive Advisor — tool orchestration and explanation only.

Claude never does the math and never mutates the scenario. Its tools are read-only views
over the deterministic backend (incentives.py / optimize.py), bound server-side to the
scenario in the request — Claude cannot pass scenario data, URLs, expressions or file paths.
Applying a what-if is a separate, user-confirmed UI action.

If Claude is unavailable (no key, quota, network, refusal), `run_advisor` returns the same
backend-screened candidate cards with a deterministic summary.
"""

from __future__ import annotations

import json
import os
from datetime import date
from typing import Any, Optional

from pydantic import BaseModel

from . import incentives
from .models import CompareRequest, Project
from .optimize import compare

MAX_TOOL_ROUNDS = 6

SYSTEM_PROMPT = """You are HomeForge's Funding & Incentive Advisor for preliminary affordable-homeownership project analysis in California. You are not a tax attorney, lender, grant officer, or assessor.

Only make factual program claims based on the source-backed catalog returned by your tools and the selected scenario. Use the tools for all calculations and eligibility screening; never invent eligibility, award amounts, tax savings, program-open status, rates or financial results. Every dollar figure you mention must come from a tool result.

Differentiate verified project facts, user assumptions, derived values, and unknowns. Never present a tentative source as approved. A loan is not a grant; fee deferral is not fee forgiveness; a property-tax exemption is a possible expense reduction, not a cash grant or a transferable tax credit; buyer assistance is not automatically developer revenue. LIHTC rental financing is not applicable by default to a for-sale affordable-homeownership project.

How to work (be quick — this is a hypothetical screen, not a filing): call get_current_scenario, then list_incentive_candidates, then check_candidate on the one or two best-fit leads. For any property-tax relief lead, always produce a quick figure: call estimate_tax_relief (the defaults are fine unless the scenario clearly suggests otherwise), then call simulate_opportunity with the estimate's suggested_amount_usd. Report the estimate as a rough hypothetical, state its formula and main assumptions in one sentence, and never call it a real or approved saving. For grant leads, only simulate if the user gave an amount. You cannot apply changes — tell the user they can review the simulation and click "Apply as hypothetical" themselves.

Answer in 4-8 short sentences of plain text (no markdown headings or tables). For each lead you mention, say whether it is verified, plausible, unknown, or unavailable, name at least one missing fact or disqualifier, and cite the source title and checked date from the tool result. If unsure, say unknown. Do not request or process personal information about real buyers."""


def _tool(name: str, description: str, properties: dict[str, Any], required: list[str]) -> dict[str, Any]:
    return {
        "name": name,
        "description": description,
        "strict": True,
        "input_schema": {"type": "object", "properties": properties, "required": required, "additionalProperties": False},
    }


def tool_definitions() -> list[dict[str, Any]]:
    ids = incentives.program_ids()
    return [
        _tool(
            "get_current_scenario",
            "Returns the selected project's documented facts, screening facts (with unknowns), labeled modeled inputs, and the backend-computed cost, proceeds, counted funding and remaining gap for the selected home count. Read-only.",
            {},
            [],
        ),
        _tool(
            "list_incentive_candidates",
            "Lists cached, source-backed programs relevant to California affordable homeownership, already screened against this scenario (status, mechanism, source and checked date). Read-only.",
            {"category": {"type": "string", "enum": ["all", "cost_reduction", "grant_or_loan", "restricted_grant", "buyer_assistance", "timing", "regulatory"]}},
            ["category"],
        ),
        _tool(
            "check_candidate",
            "Rule-based screen of one program against this scenario: known matches, conflicts, missing evidence, availability, source. Never an eligibility determination. Read-only.",
            {"program_id": {"type": "string", "enum": ids}},
            ["program_id"],
        ),
        _tool(
            "estimate_tax_relief",
            "Quick deterministic estimate of property-tax relief for a property-tax exemption lead: (modeled land + share of site work and construction in place on the lien date) × effective tax rate × eligible lien dates, capped at the budget's property-tax line. Defaults: effective_tax_rate 0.011 (≈1% plus local assessments, an assumption), built_share_at_lien_date 0.5, eligible_lien_dates 1 (only the 2027-01-01 lien date remains for RTC §214.15.1). Allowed ranges: rate 0.008–0.02, share 0–1, lien dates 1–5. Read-only.",
            {
                "program_id": {"type": "string", "enum": ids},
                "effective_tax_rate": {"type": "number"},
                "built_share_at_lien_date": {"type": "number"},
                "eligible_lien_dates": {"type": "integer"},
            },
            ["program_id", "effective_tax_rate", "built_share_at_lien_date", "eligible_lien_dates"],
        ),
        _tool(
            "simulate_opportunity",
            "Runs the deterministic financial engine on a COPY of the scenario with one explicitly hypothetical change (tax-cost reduction or hypothetical award) and returns before/after gaps for every home count. Does not change the scenario. Refuses unsafe cases (no tax line, double counting, amounts above the cost line, loans/deferrals as gap reductions).",
            {"program_id": {"type": "string", "enum": ids}, "amount_usd": {"type": "number"}},
            ["program_id", "amount_usd"],
        ),
    ]


class AdvisorResult(BaseModel):
    summary: str
    used_claude: bool
    model: Optional[str]
    error: Optional[str]
    candidates: list[incentives.Card]
    simulations: list[incentives.Simulation]
    tool_trace: list[str]
    disclaimer: str = incentives.DISCLAIMER


def scenario_snapshot(project: Project, inputs: CompareRequest, homes: Optional[int]) -> dict[str, Any]:
    result = compare(inputs)
    s = next((x for x in result.scenarios if x.homes == homes), result.scenarios[0])
    facts = {
        k: {"value": f.value, "status": f.status.value, "note": f.note} for k, f in project.screening_facts.items()
    }
    return {
        "project": project.name,
        "case_type": project.case_type,
        "location": project.location,
        "documented_home_count": project.documented_home_count,
        "selected_home_count": s.homes,
        "screening_facts": facts or "none recorded — all project facts UNKNOWN",
        "modeled_inputs_note": "All financial inputs are ASSUMPTIONS or user-entered unless a source is named; not Habitat's actual budget.",
        "modeled_inputs": {
            "household_income": float(inputs.household.annual_income),
            "housing_cost_ratio": float(inputs.household.housing_cost_ratio),
            "mortgage_rate": float(inputs.household.annual_mortgage_rate),
            "property_tax_carry_in_budget": float(inputs.development.property_tax_carry),
            "hypothetical_cost_reductions_applied": [r.model_dump(mode="json") for r in inputs.cost_reductions],
        },
        "backend_results_for_selected_homes": {
            "total_development_cost": float(s.total_development_cost),
            "property_tax_carry_after_reductions": float(s.property_tax_carry),
            "buyer_sale_proceeds": float(s.sale_proceeds),
            "counted_funding": float(s.counted_project_support),
            "remaining_gap": float(s.remaining_gap),
            "gap_per_home": float(s.gap_per_home),
        },
        "today": date.today().isoformat(),
    }


def _execute(name: str, args: dict[str, Any], project: Project, inputs: CompareRequest, homes: Optional[int],
             checked: list[str], sims: list[incentives.Simulation],
             estimates: dict[str, incentives.TaxReliefEstimate]) -> str:
    if name == "get_current_scenario":
        return json.dumps(scenario_snapshot(project, inputs, homes))
    if name == "list_incentive_candidates":
        cards = incentives.screen_all(project, inputs, args.get("category"))
        return json.dumps([
            {k: c.model_dump()[k] for k in ("program_id", "name", "match_status", "category", "financial_effect_type",
                                            "availability", "source_title", "source_checked_on", "source_verification")}
            for c in cards
        ])
    if name == "check_candidate":
        pid = args["program_id"]
        card = incentives.screen(incentives.get_program(pid), project, inputs)
        if pid not in checked:
            checked.append(pid)
        return card.model_dump_json()
    if name == "estimate_tax_relief":
        pid = args["program_id"]
        est = incentives.estimate_tax_relief(
            incentives.get_program(pid), inputs, homes,
            args.get("effective_tax_rate"), args.get("built_share_at_lien_date"), args.get("eligible_lien_dates"),
        )
        estimates[pid] = est
        if pid not in checked:
            checked.append(pid)
        out = est.model_dump()
        out["suggested_amount_usd"] = out.pop("suggested_amount")
        return json.dumps(out)
    if name == "simulate_opportunity":
        pid = args["program_id"]
        sim = incentives.simulate(project, inputs, pid, args.get("amount_usd"))
        sims.append(sim)
        if pid not in checked:
            checked.append(pid)
        out = sim.model_dump(exclude={"proposal_id"})  # Claude never handles apply tokens
        out["note"] = "Not applied. The user must review and click 'Apply as hypothetical'."
        return json.dumps(out)
    raise ValueError(f"unknown tool {name}")


def _fallback(project: Project, inputs: CompareRequest, message: str, reason: str) -> AdvisorResult:
    cards = incentives.screen_all(project, inputs)
    wants_tax = "tax" in message.lower()
    top = [c for c in cards if c.match_status != "unsupported"]
    if wants_tax:
        top = sorted(top, key=lambda c: c.category != "cost_reduction")
    lines = [f"Claude is unavailable ({reason}), so these are the backend's rule-based screens of the cached catalog."]
    for c in top[:2]:
        lines.append(f"{c.name}: {c.status_label}. Missing: {c.missing_information[0] if c.missing_information else 'n/a'}. "
                     f"Source: {c.source_title} (checked {c.source_checked_on}).")
    lines.append("None of these is approved or committed. Use “Simulate impact” to see a hypothetical effect computed by the backend.")
    return AdvisorResult(summary=" ".join(lines), used_claude=False, model=None, error=reason, candidates=top[:4] or cards[:4],
                         simulations=[], tool_trace=[])


def run_advisor(project: Project, inputs: CompareRequest, homes: Optional[int], message: str,
                history: Optional[list[dict[str, str]]] = None) -> AdvisorResult:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return _fallback(project, inputs, message, "no ANTHROPIC_API_KEY configured")
    try:
        import anthropic
    except ImportError:
        return _fallback(project, inputs, message, "anthropic SDK not installed")

    model = os.environ.get("ANTHROPIC_MODEL", "claude-opus-5-5")
    client = anthropic.Anthropic(api_key=api_key, timeout=90.0, max_retries=1)
    tools = tool_definitions()
    messages: list[dict[str, Any]] = []
    for turn in (history or [])[-6:]:
        if turn.get("role") in ("user", "assistant") and turn.get("content"):
            messages.append({"role": turn["role"], "content": str(turn["content"])[:4000]})
    messages.append({"role": "user", "content": message[:2000]})

    checked: list[str] = []
    sims: list[incentives.Simulation] = []
    estimates: dict[str, incentives.TaxReliefEstimate] = {}
    trace: list[str] = []
    try:
        for _ in range(MAX_TOOL_ROUNDS):
            response = client.beta.messages.create(
                model=model,
                max_tokens=8000,
                system=SYSTEM_PROMPT,
                tools=tools,
                messages=messages,
                output_config={"effort": "low"},  # quick hypothetical screen; the backend does the math
                betas=["server-side-fallback-2026-07-01"],
                fallbacks="default",
            )
            if response.stop_reason == "refusal":
                return _fallback(project, inputs, message, "the model declined this request")
            if response.stop_reason != "tool_use":
                break
            messages.append({"role": "assistant", "content": response.content})
            results = []
            for block in response.content:
                if block.type != "tool_use":
                    continue
                trace.append(block.name)
                try:
                    out = _execute(block.name, dict(block.input), project, inputs, homes, checked, sims, estimates)
                    results.append({"type": "tool_result", "tool_use_id": block.id, "content": out})
                except Exception as e:  # tool errors go back to Claude, never crash the request
                    results.append({"type": "tool_result", "tool_use_id": block.id, "content": f"Error: {e}", "is_error": True})
            messages.append({"role": "user", "content": results})
        text = "\n".join(b.text for b in response.content if b.type == "text").strip()
    except anthropic.APIStatusError as e:
        return _fallback(project, inputs, message, f"API error {e.status_code}")
    except anthropic.APIConnectionError:
        return _fallback(project, inputs, message, "could not reach the Claude API")

    cards = []
    for pid in checked:
        card = incentives.screen(incentives.get_program(pid), project, inputs)
        if pid in estimates and card.tax_estimate is not None:
            card = card.model_copy(update={"tax_estimate": estimates[pid], "suggested_amount": estimates[pid].suggested_amount})
        cards.append(card)
    if not cards:
        cards = [c for c in incentives.screen_all(project, inputs) if c.match_status != "unsupported"][:3]
    return AdvisorResult(
        summary=text or "No summary returned.",
        used_claude=True,
        model=getattr(response, "model", model),
        error=None,
        candidates=cards,
        simulations=sims,
        tool_trace=trace,
    )
