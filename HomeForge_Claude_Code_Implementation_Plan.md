# HomeForge — Claude Code Implementation Plan (Fund It Brief-Aligned)

> **Purpose:** Paste this Markdown file into the repository root and give it to Claude Code. It is an **implementation contract** for a five-hour Habitat for Humanity Orange County / Claude Impact Lab hackathon, not a brainstorming document.
>
> **Challenge lane:** **Fund It — “Does it pencil, and who closes the gap?”** The organizers explicitly ask: **“Every project has a gap. What makes it smaller, or makes the money that closes it easier to find?”**
>
> **The rule from the organizers:** **“Label every assumed number. If you made it up, say so.”** Follow this rule everywhere, including the demo.

## Copy/paste kickoff prompt for Claude Code

```text
Read HomeForge_Claude_Code_Implementation_Plan.md fully, then inspect the existing repository.
Build the P0 MVP in the order specified, using the exact stack, data shapes, math,
and acceptance tests in the plan. Do not invent official program figures or pretend
hypothetical financing is committed. Write working code, not just explanations.

Prioritize a running end-to-end vertical slice: React UI -> FastAPI -> affordability,
development costs, and funding stack -> scenario comparison -> 3D scene.
Keep the app runnable after each milestone. Run tests/builds and report actual results.
Do not add P1/P2 or spend time on elaborate 3D effects until all P0 checks pass.
If something is unclear, pick the simplest defensible implementation and note the
assumption instead of blocking on design questions. Preserve existing work.
```

---

## 0. Product definition

**HomeForge** is an interactive, **3D early-stage financial screening tool** for nonprofit affordable-homeownership developers. It helps a **Habitat OC development director or nonprofit finance lead** estimate how many affordable homes a conceptual project could support, **what eligible households could afford to pay**, **how much the development might cost**, and **what part of the gap remains after modeled committed funding**.

Secondary users: city housing analysts, nonprofit partners, donors, and funding collaborators.

### One-sentence pitch

> **HomeForge connects household affordability to development costs and a transparent funding stack, so affordable-housing teams can compare project configurations and see exactly what financing gap is left.**

### User decision the product supports

A nonprofit staff member is evaluating one potential small development and asks:

1. What might a qualifying household afford, given a modeled income and financing terms?
2. If we deliver **6, 8, or 10** homes, what are the approximate development costs and sale proceeds?
3. How much financing is assumed committed, which sources are only possibilities, and **what gap remains**?
4. Under our assumed additional-subsidy cap, which configuration is the strongest candidate for deeper feasibility review?

### What the MVP is NOT

Not a real Habitat budget, lender commitment, grant award, architectural plan, zoning validation, parcel appraisal, tax-credit analysis, or eligibility determination. The 3D visualization is **conceptual massing**, not a buildable or permitted site plan. The financial output is **scenario screening**, not underwriting. These distinctions must remain visible.

### What changed from the earlier HomeForge plan

- **P0 now derives a home-price ceiling from household income and mortgage assumptions.** It no longer uses a free-floating assumed sale-price field as its default model.
- **P0 now has a small funding-stack builder.** It differentiates **assumed committed development support** from **potential/unverified programs** and from **buyer assistance or repayable debt**.
- **P0 labels every figure by provenance**: public source, user input, or illustrative default.
- **P0 retains an attractive but simple 3D housing scene and deterministic scenario comparison.** A basic optimizer is included only after the financial workflow works.
- **P1 is Claude-powered funding explanations/program discovery** (with grounded citations), plus better visuals and optional imported official income limits.

---

## 1. Non-negotiable agent rules

1. **Ship working P0 before P1.** An attractive 3D scene with incorrect finances is not a success.
2. **Financial computations are deterministic Python code, not AI guesses.** Claude is never the calculator or eligibility authority.
3. **One source of truth for demo defaults:** `backend/data/case_study.json`; frontend reads it via API.
4. **Every numeric input carries a visible source/assumption label.** An official *reference* does not magically verify a demo number.
5. **Never present a funding candidate as awarded or committed.** If the demo assumes $500K from a city and $300K from donors, label both **illustrative assumed commitments**, not real funding.
6. **Only qualifying modeled development cash reduces the development funding gap.** Do **not** subtract buyer down-payment assistance a second time, or treat a repayable construction loan as a grant.
7. **Keep secrets server-side.** Never commit API keys or put them in frontend variables.
8. **No feature creep:** no database, accounts, auth, GIS, real zoning engine, automated grant applications, live listings, CAD import, or financing-market search in P0.
9. **Build in vertical slices** and run tests after each. Inspect the repo before scaffolding, avoid overwriting good work.
10. **When blocked, downgrade gracefully** (simpler 3D geometry, no AI, honest illustrative case) rather than fake functionality.

---

## 2. Scope and priority — implementation order

| Order | Priority | Feature | Acceptance criterion |
|---|---|---|---|
| 1 | **P0** | React + FastAPI skeleton | UI can load a JSON case study and submit an analysis request |
| 2 | **P0** | Household affordability engine | Annual income -> monthly payment cap -> mortgage principal -> per-home price ceiling; exact test passes |
| 3 | **P0** | Development-cost + gap engine | All 6/8/10 scenarios calculated from code; exact test fixture passes |
| 4 | **P0** | Basic funding stack | Two editable assumed-committed rows; potential funding visibly excluded from gap |
| 5 | **P0** | Provenance labels | Every input clearly `Illustrative`, `User-entered`, or `Verified source`; no false claims |
| 6 | **P0** | Interactive 3D | Selecting 6/8/10 renders precisely that many procedural homes |
| 7 | **P0** | Compare and recommend | Compare all scenarios and select highest count within **modeled** subsidy cap and assumed site capacity |
| 8 | **P0** | Stable demo | Reset, changing income, editing stack, changing cap, and 3D all work twice in a row |
| 9 | **P1** | Claude explanation | Explains only backend-calculated results and documented references; offline fallback |
| 10 | **P1** | Funding-program reference matching | Curated CalHome/HOME/CalHFA descriptions, links, restrictions; never guarantee eligibility |
| 11 | **P1** | UI polish / optional official 2026 income-limit presets | Only after tests and a runnable P0 are complete |
| — | **P2** | Real parcel GIS/zoning; portfolios; grant application drafting; mortgage underwriting | Do **not** build during the hackathon |

**Time-pressure rule:** If hour 3 arrives with P0 incomplete, freeze ambition. Finish reliable calculations, source labels, a simple stack and low-poly 3D before doing AI or animation polish.

---

## 3. Technical architecture

**Use these defaults unless the existing repo has a working equivalent:**

- Frontend: **Vite + React + TypeScript**, CSS (Tailwind only if already present).
- Interactive 3D: **Three.js + `@react-three/fiber` + `@react-three/drei`**.
- Backend: **Python 3.11+ + FastAPI + Pydantic + Uvicorn**.
- Deterministic money math: Python `Decimal` (money rounded **half-up to cents**, not early in intermediate calculations).
- Tests: `pytest`, FastAPI `TestClient`, frontend build.
- Data store: one checked-in JSON file, **no DB**.
- Optional P1 AI: official Anthropic Python SDK in backend only.

```text
homeforge/
├── HomeForge_Claude_Code_Implementation_Plan.md
├── README.md
├── .gitignore
├── .env.example                  # P1 only: ANTHROPIC_API_KEY=, ANTHROPIC_MODEL=
├── backend/
│   ├── __init__.py
│   ├── requirements.txt
│   ├── main.py                   # GET /api/case-study, POST /api/compare, P1 /api/explain
│   ├── models.py                 # Pydantic contracts and validations
│   ├── affordability.py          # Pure mortgage/affordability calculations
│   ├── finance.py                # Pure project cost and funding gap calculations
│   ├── optimize.py               # Pure comparison / scenario selection
│   ├── provenance.py             # Source and assumption labels
│   ├── explain.py                # P1; optional, must never block P0
│   ├── data/
│   │   └── case_study.json       # Single default fixture, all provenance
│   └── tests/
│       ├── test_affordability.py
│       ├── test_finance.py
│       ├── test_funding_stack.py
│       ├── test_optimize.py
│       └── test_api.py
└── frontend/
    ├── package.json
    ├── index.html
    ├── .env.example              # VITE_API_BASE_URL=http://localhost:8000
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── api.ts
        ├── types.ts
        ├── styles.css
        └── components/
            ├── HousingScene.tsx
            ├── HouseholdControls.tsx
            ├── DevelopmentControls.tsx
            ├── FundingStack.tsx
            ├── FinancialSummary.tsx
            ├── ScenarioComparison.tsx
            ├── ProvenancePanel.tsx
            └── AiExplanation.tsx   # P1
```

### Minimal local setup

```bash
# From repository root; inspect existing files before scaffolding.
python -m venv .venv
source .venv/bin/activate
pip install fastapi 'uvicorn[standard]' pydantic pytest httpx
pip freeze > backend/requirements.txt

# Only if no frontend exists:
npm create vite@latest frontend -- --template react-ts
npm --prefix frontend install
npm --prefix frontend install three @react-three/fiber @react-three/drei
npm --prefix frontend install -D @types/three

# Terminal A (root, venv active)
uvicorn backend.main:app --reload --port 8000

# Terminal B (root)
npm --prefix frontend run dev
```

CORS origins: `http://localhost:5173` and `http://127.0.0.1:5173`. Do not require the Claude key. Gitignore `.venv`, `node_modules`, `.env`, `.pytest_cache`.

---

## 4. Demo case study: deliberately honest assumptions

The organizers supplied these **starter data** sources:

- **California HCD 2026 Orange County income limits** (slide says June 23 revision): https://www.hcd.ca.gov/grants-and-funding/income-limits
- **Freddie Mac mortgage-rate survey**: https://www.freddiemac.com/pmms
- **CalHome funding program**: https://www.hcd.ca.gov/grants-and-funding/programs-active/calhome-program
- **CalHFA buyer down-payment program information**: https://www.calhfa.ca.gov/homebuyer/programs/myhome.htm
- A public Orange County housing development of **4–12 homes** as case-study context.

**Important:** These are **reference URLs to validate in the browser** before treating any contents or rates as sourced. The application must not silently copy unverified income-limit tables or assume any program applies. The starter slide itself is a source for the *challenge direction*, not evidence that a particular buyer qualifies or a development has been funded.

Use a **conceptual Santa Ana/Orange County 6/8/10-home scenario** unless a teammate verifies an official housing report and records which *specific* case-study facts it supports. A public project reference may ground location or documented home count, but **not the invented construction costs, buyer income, or subsidy stack**. Keep `case_type: "illustrative"` until verified source metadata is added.

### `backend/data/case_study.json` — P0 default fixture

```json
{
  "id": "homeforge-oc-illustrative-v2",
  "name": "Orange County affordable-homeownership concept",
  "location": "Santa Ana, California",
  "case_type": "illustrative",
  "candidate_home_counts": [6, 8, 10],
  "verified_facts": {},
  "sources": [],
  "reference_links": [
    {"title": "HCD income limits", "url": "https://www.hcd.ca.gov/grants-and-funding/income-limits", "usage": "reference_only"},
    {"title": "Freddie Mac mortgage survey", "url": "https://www.freddiemac.com/pmms", "usage": "reference_only"},
    {"title": "CalHome program", "url": "https://www.hcd.ca.gov/grants-and-funding/programs-active/calhome-program", "usage": "reference_only"},
    {"title": "CalHFA MyHome", "url": "https://www.calhfa.ca.gov/homebuyer/programs/myhome.htm", "usage": "reference_only"}
  ],
  "household": {
    "annual_income": 100000,
    "household_size": 4,
    "housing_cost_ratio": 0.33,
    "annual_mortgage_rate": 0.07,
    "mortgage_term_years": 30,
    "other_housing_costs_monthly": 550,
    "buyer_cash_down_payment": 15000
  },
  "development": {
    "land_cost": 600000,
    "site_work_cost": 100000,
    "gross_sqft_per_home": 1100,
    "hard_cost_per_sqft": 300,
    "soft_cost_rate": 0.20,
    "contingency_rate": 0.10,
    "financing_rate": 0.05,
    "illustrative_site_capacity": 10,
    "additional_subsidy_budget": 900000
  },
  "funding_sources": [
    {
      "id": "demo-city",
      "name": "Illustrative city development grant",
      "amount": 500000,
      "status": "committed",
      "instrument": "development_grant",
      "basis": "illustrative_assumption",
      "source": null
    },
    {
      "id": "demo-donor",
      "name": "Illustrative pledged donations",
      "amount": 300000,
      "status": "committed",
      "instrument": "donation",
      "basis": "illustrative_assumption",
      "source": null
    },
    {
      "id": "calhome-reference",
      "name": "CalHome — explore program rules",
      "amount": null,
      "status": "potential",
      "instrument": "development_grant",
      "basis": "reference_only",
      "source": null
    }
  ],
  "notes": "Every dollar and ratio in this scenario is illustrative, including the modeled 'committed' funding rows. No real funding awards are implied."
}
```

The demo defaults **must be labeled `Illustrative assumption` in the UI**, even though the `status` of the first two funding rows is `committed`: that status only means **assumed committed within the simulated scenario**. Never describe these as actual city/donor commitments.

`household_size` is metadata for a later official HCD-limit lookup; **do not imply that $100,000 is a published 2026 HCD threshold**. The 7% mortgage rate is also an **illustrative default** until verified against the rate and date of a Freddie Mac publication.

If verified public metadata is added later, record `{title, publisher, url, publication_date, page_or_section, fact_supported}` for each fact. Source-backed numbers must link to a specific source. **Never infer the missing amount of a project's funding gap from one published grant.**

---

## 5. Financial logic — exact definitions

### A. Household affordability (P0)

From annual household income, estimate the **maximum monthly housing budget** and maximum home price under a simplified **30-year mortgage**. Housing costs include principal + interest + estimated taxes/insurance/HOA (modeled as a **fixed monthly estimate**, not full tax underwriting).

```text
MONTHLY_HOUSING_BUDGET = annual_income × housing_cost_ratio / 12
MONTHLY_PI_AVAILABLE = MONTHLY_HOUSING_BUDGET − other_housing_costs_monthly
MONTHLY_RATE = annual_mortgage_rate / 12
N_MONTHS = mortgage_term_years × 12

If MONTHLY_PI_AVAILABLE <= 0:
    AFFORDABILITY_VALID = false
    mortgage_principal = 0
    affordable_sale_price_per_home = 0
Otherwise if MONTHLY_RATE == 0:
    mortgage_principal = MONTHLY_PI_AVAILABLE × N_MONTHS
Otherwise:
    mortgage_principal = MONTHLY_PI_AVAILABLE ×
        [1 − (1 + MONTHLY_RATE)^(-N_MONTHS)] / MONTHLY_RATE

AFFORDABLE_SALE_PRICE_PER_HOME = mortgage_principal + buyer_cash_down_payment
```

Money results round **half-up to two decimals** at the explicitly defined final output points. **For the comparison, round `affordable_sale_price_per_home` once to cents before multiplying by number of homes**, to make frontend/backend totals consistent.

**Simplifications to label:** 33% of household income is a **scenario assumption**, not necessarily Habitat's actual ratio or lending standard. Assumes one modeled household income profile for every home; a real project serves households with different incomes and financing terms. No debt-to-income stress test, PMI, amortization schedule, variable rate, buyer closing costs, resale restrictions, household assets, or real property-tax calculation in P0.

**Critical funding-accounting rule:** `buyer_cash_down_payment` is part of the **home sale price paid to the developer**, not an additional project subsidy. Do not add buyer cash again elsewhere in the developer's stack.

### B. Development costs (P0)

Reuse the earlier project's transparent, simple cost formula:

```text
HARD = homes × gross_sqft_per_home × hard_cost_per_sqft
SOFT = HARD × soft_cost_rate
CONTINGENCY = (HARD + site_work_cost) × contingency_rate
FINANCING = (land_cost + site_work_cost + HARD + SOFT) × financing_rate

TDC = land_cost + site_work_cost + HARD + SOFT + CONTINGENCY + FINANCING
SALE_PROCEEDS = homes × AFFORDABLE_SALE_PRICE_PER_HOME
```

The `financing_rate` is a coarse illustrative carrying-cost allowance, **not an actual APR or loan model**. Note that linear costs per home omit realistic economies of scale, different designs, and land-specific constraints.

### C. Funding stack and gap (P0)

A funding source has **both** a `status` and an `instrument`:

- `status`: `committed` or `potential` (in this demo, even a `committed` row can be **assumed**, not real).
- `instrument`: `development_grant`, `donation`, `repayable_loan`, `buyer_assistance`.
- `basis`: `illustrative_assumption`, `user_entered`, `reference_only`, or `verified_public_source`.

**Only count** rows satisfying **all** of these:

```text
status == "committed"
instrument in {"development_grant", "donation"}
amount is non-null and >= 0
```

This is **non-repayable developer support** in the simplified model. Other instruments stay visible for context but do **not** automatically reduce an economic subsidy gap. A construction loan addresses timing/liquidity and requires repayment; buyer assistance helps the buyer finance their purchase and is not automatically a second developer grant.

```text
COUNTED_PROJECT_SUPPORT = sum(qualifying committed funding rows)
RAW_GAP = TDC − SALE_PROCEEDS − COUNTED_PROJECT_SUPPORT
REMAINING_GAP = max(0, RAW_GAP)
GAP_PER_HOME = REMAINING_GAP / homes
ADDITIONAL_BUDGET_HEADROOM = additional_subsidy_budget − REMAINING_GAP
WITHIN_SUBSIDY_CAP = REMAINING_GAP <= additional_subsidy_budget
WITHIN_CAPACITY = homes <= illustrative_site_capacity
ELIGIBLE_FOR_MODELED_RECOMMENDATION = WITHIN_SUBSIDY_CAP and WITHIN_CAPACITY
```

**Very important:** The `additional_subsidy_budget` is a **budget constraint**, not funding already secured. Do **not** subtract it from `RAW_GAP`. Likewise, do not subtract `potential` CalHome or other programs until actual verified terms/eligibility and modeled commitment explicitly justify doing so. Don't count money from CalHFA down-payment programs both within buyer purchasing power and as project subsidy.

**Simplified financing limitation:** We do not model loan proceeds, interest amortization or draw schedules, matching requirements, subsidy layering restrictions, or program-specific eligibility in P0. Display those as known limitations.

---

## 6. Exact numeric test oracle — P0 (do not modify without updating tests)

All inputs below come from the **illustrative JSON fixture in section 4**. The numbers are **not** real Habitat data.

### Affordability oracle

| Calculation | Exact expected result |
|---|---:|
| Monthly housing budget: $100,000 × 0.33 / 12 | **$2,750.00** |
| Other monthly housing costs | **$550.00** |
| Monthly principal/interest available | **$2,200.00** |
| Annual mortgage rate | **7.00% (illustrative)** |
| Term | **360 months** |
| Estimated mortgage principal | **$330,676.65** |
| Buyer cash down payment | **$15,000.00** |
| **Affordable sale-price ceiling per home** | **$345,676.65** |

Use the standard mortgage present-value formula with precise intermediate Decimal math. Final monetary outputs round to cents with `ROUND_HALF_UP`.

### Scenario oracle

| Homes | TDC | Sale proceeds | Counted assumed support | Remaining gap | Fits $900K cap? |
|---:|---:|---:|---:|---:|---|
| 6 | $3,437,800.00 | $2,074,059.90 | $800,000.00 | **$563,740.10** | Yes |
| **8** | **$4,335,400.00** | **$2,765,413.20** | **$800,000.00** | **$769,986.80** | **Yes — recommended** |
| 10 | $5,233,000.00 | $3,456,766.50 | $800,000.00 | **$976,233.50** | No |

**Demo turning point:** Increase `additional_subsidy_budget` from **$900,000 to $1,000,000**. The selected recommendation must change from **8 homes to 10 homes**. TDC, sale proceeds, and remaining gap **must not change** from this action.

### Two essential interactive demonstrations

1. **Increase annual income:** the calculated affordable price and sale proceeds go **up**; remaining gap goes **down** (all else equal). Label this as a financing scenario, **not** permission to charge buyers more than relevant program rules allow.
2. **Mark an assumed $300K donor row as `potential` instead of `committed`:** counted support drops by **$300K** and remaining gap rises by **$300K** in every scenario (where no surplus floor interferes). The UI must make the distinction visible.

### Edge cases

- `annual_mortgage_rate == 0`: use zero-interest branch.
- Monthly nonmortgage costs >= monthly housing budget: zero estimated sale-price ceiling, clear infeasibility warning; no negative mortgage.
- If `RAW_GAP < 0`, report remaining need as zero and show modeled surplus separately if useful.
- A `potential` funding row, no matter its amount, does not reduce the gap.
- Repayable loans and buyer assistance rows do not reduce the simplified **development subsidy gap**.
- `buyer_cash_down_payment` affects the modeled sale-price ceiling **once**; do not add it again.
- An increase in subsidy cap affects recommendation **only**, not the underlying gap.
- When no scenario fits cap, show `recommended_home_count: null`, a clear reason, and the smallest additional need among capacity-eligible options.
- Validate negative income, negative funding, invalid housing ratio/rate, zero term, empty/duplicate scenario list, invalid enum, and overcapacity appropriately.

---

## 7. API contract — keep this stable across backend/frontend

### `GET /api/case-study` — P0

Returns the JSON in section 4 (including `reference_links`, provenance and the demo defaults).

### `POST /api/compare` — P0 (primary endpoint)

**Request example** (all numbers are raw JSON numbers, not currency strings):

```json
{
  "candidate_home_counts": [6, 8, 10],
  "household": {
    "annual_income": 100000,
    "household_size": 4,
    "housing_cost_ratio": 0.33,
    "annual_mortgage_rate": 0.07,
    "mortgage_term_years": 30,
    "other_housing_costs_monthly": 550,
    "buyer_cash_down_payment": 15000
  },
  "development": {
    "land_cost": 600000,
    "site_work_cost": 100000,
    "gross_sqft_per_home": 1100,
    "hard_cost_per_sqft": 300,
    "soft_cost_rate": 0.20,
    "contingency_rate": 0.10,
    "financing_rate": 0.05,
    "illustrative_site_capacity": 10,
    "additional_subsidy_budget": 900000
  },
  "funding_sources": [
    {"id": "demo-city", "name": "Illustrative city development grant", "amount": 500000, "status": "committed", "instrument": "development_grant", "basis": "illustrative_assumption", "source": null},
    {"id": "demo-donor", "name": "Illustrative pledged donations", "amount": 300000, "status": "committed", "instrument": "donation", "basis": "illustrative_assumption", "source": null},
    {"id": "calhome-reference", "name": "CalHome — explore program rules", "amount": null, "status": "potential", "instrument": "development_grant", "basis": "reference_only", "source": null}
  ]
}
```

**Response example** (abbreviated: full implementation returns all 3 scenarios):

```json
{
  "affordability": {
    "monthly_housing_budget": 2750,
    "monthly_principal_interest_available": 2200,
    "mortgage_principal": 330676.65,
    "affordable_sale_price_per_home": 345676.65,
    "affordability_valid": true
  },
  "funding": {
    "counted_project_support": 800000,
    "potential_uncommitted_amount": 0,
    "excluded_instruments": [],
    "has_illustrative_commitments": true
  },
  "scenarios": [
    {
      "homes": 8,
      "hard_cost": 2640000,
      "soft_cost": 528000,
      "contingency": 274000,
      "financing_cost": 193400,
      "total_development_cost": 4335400,
      "sale_proceeds": 2765413.20,
      "counted_project_support": 800000,
      "raw_gap": 769986.80,
      "remaining_gap": 769986.80,
      "gap_per_home": 96248.35,
      "additional_budget_headroom": 130013.20,
      "within_subsidy_cap": true,
      "within_capacity": true,
      "eligible": true
    }
  ],
  "recommended_home_count": 8,
  "recommendation_reason": "8 homes is the largest tested configuration within the assumed extra-subsidy cap and illustrative capacity.",
  "minimum_needed_if_none_fit": null,
  "case_type": "illustrative",
  "warnings": ["Costs, buyer income, funding commitments, site capacity and mortgage inputs are scenario assumptions; not verified Habitat project data."]
}
```

**Contract rules:**

- Response `scenarios` must actually include **all** candidate home counts, ascending as requested; one object above is merely illustrative.
- JSON numeric money fields are **rounded to cents**. The frontend formats them with `Intl.NumberFormat`, but never computes finance totals locally.
- The frontend gets the current selected scenario from `scenarios`; don't add a second route for financial analysis.
- Validate with Pydantic. `candidate_home_counts` must be non-empty, unique, positive ints. Ratios/rates valid, monetary inputs nonnegative, term positive. If `basis == verified_public_source`, require populated source metadata with a usable URL and fact support.
- Use clear API `422` validation messages and a frontend error state.
- Both `committed` and `potential` can be displayed, but **only counted project support reduces the gap**.

### `POST /api/explain` — P1 only

Given backend-computed analysis and trusted source metadata, produce a short narrative of the key tradeoff. Must never be needed for the core UI. Fallback deterministically when API is unavailable.

---

## 8. Deterministic comparison and recommendation — P0, after finance works

Use simple enumeration, not an LLM or an optimization library.

```python
# Pseudocode; actual implementation should use typed validated models.
affordability = calculate_affordability(request.household)
counted_support = sum_qualifying_development_support(request.funding_sources)
scenarios = [
    analyze_development(n, request.development, affordability.affordable_sale_price_per_home, counted_support)
    for n in request.candidate_home_counts
]
eligible = [s for s in scenarios if s.within_capacity and s.within_subsidy_cap]
best = max(eligible, key=lambda s: s.homes) if eligible else None
```

The objective is **maximum modeled affordable homes under the additional-subsidy cap**. This is **not** a recommendation to approve development or a claim that the physical site supports that count. If no configuration is eligible, show how much subsidy the least-demanding capacity-feasible configuration would require. Display all ineligible options with explanations.

The MVP optimizes **one project configuration**, **not** a portfolio of unrelated parcels. Avoid a multi-project knapsack solver.

---

## 9. Frontend: the actual experience judges will see

### Desktop-first layout

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ HOMEFORGE  |  FUND IT  |  Scenario-based feasibility   [Reset demo]         │
├──────────────────────┬─────────────────────────────┬────────────────────────┤
│ AFFORDABILITY         │    3D CONCEPT VIEW          │   FINANCIAL SUMMARY    │
│ Income / household    │                             │   Affordable price     │
│ 30–35% ratio          │   6 / 8 / 10 model homes   │   Total development    │
│ Mortgage rate         │   Updates with scenario     │   Sale proceeds        │
│ Non-PI monthly costs  │                             │   Assumed committed $  │
│ Buyer cash            │    CONCEPTUAL ONLY          │   Remaining gap        │
├──────────────────────┼─────────────────────────────┴────────────────────────┤
│ DEVELOPMENT           │ FUNDING STACK                                        │
│ Home count / costs    │ Assumed committed grants/donations     [edit]         │
│ Subsidy budget cap    │ Potential / unverified programs        [excluded]     │
├──────────────────────┴──────────────────────────────────────────────────────┤
│ COMPARE 6 vs 8 vs 10  |  [Find best configuration]                           │
│ SOURCES & ASSUMPTIONS  |  P1: CLAUDE EXPLANATION                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### P0 controls and behaviors

1. **Household affordability:** Annual income slider + number input (default $100K); housing-cost ratio (default 33%); mortgage rate (default 7%, labeled illustrative); other monthly housing costs ($550). Keep advanced buyer cash/term available, default $15K/30 years.
2. **Development:** Select 6/8/10; hard cost/sq ft slider (default $300); additional subsidy cap slider (default $900K, includes $1M); expandable land/site/soft/contingency assumptions.
3. **Funding stack:** Two rows by default (illustrative city grant $500K + illustrative donor pledge $300K). Allow **editing amount** and **toggling committed vs potential** for each row. Show the potential CalHome reference as **not included** in calculations. Adding arbitrary rows is nice-to-have if time remains.
4. **Financial summary:** Affordable sale-price ceiling; monthly payment; TDC; proceeds; **counted assumed support**; remaining gap; gap/home; eligibility; no dollar amount without a provenance label/tool tip.
5. **Scenarios:** Table 6 vs 8 vs 10, with remaining gap and green/red eligibility. **Find best** selects the backend's recommended home count and updates scene. If none fit, report why.
6. **3D:** Low-poly houses on a stylized plane, exactly N structures. Label **“Conceptual model — no zoning/site verification.”** Fixed isometric camera, tasteful materials, stable shadows. No fetched assets required.
7. **Reset demo:** Restore fixture, select 8 homes, refresh analysis; must work without page reload and twice consecutively.
8. **Source panel:** Explicitly explain which figures come from user-entered or illustrative inputs vs verified public records. Show HCD/Freddie Mac/CalHome/CalHFA as **reference sources**, not verification of the chosen demo values.
9. **Errors:** Loading and fetch failures must not silently show stale figures as new. Debounce inputs and ignore out-of-order requests. If API fails, show a banner and keep the last *labeled* results rather than fabricating calculations.

### 3D guidance

- Use React Three Fiber `Canvas`, an orthographic/isometric camera and `ambientLight` + `directionalLight`.
- Procedural house component: simple box walls, pitched roof with basic primitives, small door/window. Stable layout based on index (e.g., 5 per row).
- `homes` is derived from the currently selected **backend-returned scenario**; do not make a separate financial engine in the scene.
- Make units appear/disappear cleanly. Avoid shader experiments, imported models, real parcel footprints, and any geometry claiming legal buildability.
- The **3D view supports communication of a financial choice**, not engineering correctness. Animate only after exact calculations work.

---

## 10. P1: Claude features that add value without becoming a wrapper

Build only after P0 works and tests pass.

### A. Scenario tradeoff explanation

Pass Claude the **backend computed** affordability metrics, the 6/8/10 scenario results, source metadata, and explicitly labeled assumptions. Ask for 3–5 sentences comparing the recommended configuration to the next larger one.

**System constraints** (adapt as code-level prompt):

```text
You explain PRECOMPUTED affordable-housing screening scenarios.
Never calculate or invent a funding amount, program award, income limit, zoning
allowance, or official policy. Distinguish user inputs and hypothetical funding
from verifiable sourced facts. A potential funding program is not committed cash.
A buyer assistance loan is not automatically a developer grant. Explain the
biggest numerical tradeoff and the remaining gap in 3–5 sentences, with
cited source links only when supplied by the backend. Do not claim approval.
```

### B. Curated program-reference panel (optional P1)

Start with organizer-recommended **CalHome, CalHFA down-payment programs, and HOME**. Display **what question to check next**, e.g. applicant eligibility, recipient type, eligible uses, funding availability, geography, and restrictions. Use a tiny curated set of source-backed reference metadata. AI can explain differences; **do not turn a possible program into a counted funding source** or claim it can stack with another program without verified rules.

### C. Live official income-limit presets (optional P1)

Only after a teammate verifies the **actual 2026 HCD Orange County table and household-size/category mapping**, add selectable income-limit presets with specific citations and effective dates. **Never guess AMI figures** or label the $100K demo income as the HCD limit. The app works without these presets.

### Failure behavior

Missing `ANTHROPIC_API_KEY`, unavailable model, quota issues, or malformed response -> use a simple deterministic fallback such as “8 homes fits the modeled cap; 10 exceeds it by $76,233.50” calculated by backend code. Never block sliders, saving the stack, or comparison.

---

## 11. Automated tests Claude Code must implement and run

### Affordability (`test_affordability.py`)

- Default monthly cap exactly **$2,750**, PI **$2,200**, rounded mortgage principal **$330,676.65**, price **$345,676.65**.
- Higher annual income -> higher ceiling and proceeds, with otherwise fixed assumptions.
- Higher mortgage rate -> lower mortgage principal for same monthly PI allowance.
- Zero interest handled correctly.
- Nonmortgage monthly costs at/above budget yield a clear `affordability_valid=false` and zero modeled price ceiling.
- Buyer down payment counted **once**, not both as home sale proceeds and developer funding.

### Development (`test_finance.py`)

- 8-home TDC **$4,335,400**, sale proceeds **$2,765,413.20**, gap **$769,986.80**, gap/home **$96,248.35**.
- 6/8/10 full oracle in section 6.
- Raising hard cost raises total cost and gap.
- Raising only the extra subsidy budget does **not** change cost, proceeds, or gap.
- Negative raw gap produces zero remaining need.

### Funding accounting (`test_funding_stack.py`)

- Two illustrative committed developer rows = **$800,000** counted in the default model, **not represented as real secured support**.
- Change donor row to `potential` -> counted support **$500,000**, gap increases **$300,000**.
- A potential $1M row never reduces the gap.
- A committed repayable construction loan never reduces the economic grant gap in this simplified model.
- A buyer down-payment assistance row never reduces development gap independently.

### Recommendation and API (`test_optimize.py`, `test_api.py`)

- Default recommendation is **8**; at $1M subsidy cap recommendation becomes **10** with identical project gaps.
- If budget is too low for all, recommendation `null` with lowest funding need among capacity-eligible candidates.
- If site capacity is less than 6, no candidates are recommended.
- Invalid annual income, ratios, negative cost, duplicate counts, malformed source rows -> HTTP 422.
- `GET /api/case-study` includes JSON fixture, provenance and reference links.
- `POST /api/compare` returns **all three** scenarios and numerically correct results.

### Frontend checks

- Build: `npm --prefix frontend run build`.
- Manual browser demo: income changes price/gap; 6/8/10 show matching house count; toggling a funding row to potential updates gap; cap $900K -> best 8; $1M -> best 10; Reset twice.
- Every example figure has an **illustrative/user-entered/source** label. CalHome is not shown as awarded funding.
- P0 still runs with no Claude key or internet access for 3D assets.

Run from repository root:

```bash
source .venv/bin/activate
python -m pytest backend/tests -q
npm --prefix frontend run build
```

Do not claim tests passed unless actually executed and successful.

---

## 12. Five-hour execution plan and team split

**Suggested owners if three people:** **A** = backend calculations/API/tests; **B** = frontend/3D; **C** = public-source research, provenance/funding UI, end-to-end verification/demo. With two people: A owns backend, B owns frontend, both share research and pitch.

| Time | Backend / data | Frontend / integration | Exit gate |
|---|---|---|---|
| **0:00–0:30** | Scaffold; load JSON; Pydantic models; API request contract | Layout shell; fetch defaults; install R3F | Servers run; JSON loads |
| **0:30–1:20** | Affordability formula + exact tests | Income controls, price KPI, API wiring | Income -> **backend price** works |
| **1:20–2:10** | TDC, funding rows, gap, 6/8/10 compare + tests | TDC/gap cards, funding stack editor | Funding toggle -> **correct gap change** |
| **2:10–2:50** | Recommendation + edge cases | 3D houses + scenario selector + reset | End-to-end **P0 demo** working |
| **2:50–3:40** | Regression tests, validation, source review | Sources panel, compare table, responsive errors | **P0 frozen**; tests + build pass |
| **3:40–4:20** | **Only if P0 stable:** Claude explanations / verified program references | Modest visual polish and scene transitions | AI optional; P0 still independent |
| **4:20–5:00** | No new features; fix bugs; README; demo backup | Rehearse 90-second pitch twice | Reliable judge demo |

### Stop/cut rules

- **Affordability or funding stack not functioning?** Don't work on Claude prompts or shaders.
- **3D rendering bug?** Show simple procedural boxes; count must still be accurate.
- **Cannot verify HCD income-limit figures?** Use the illustrative income input and a citation to the general source only as reference; no fabricated table.
- **No real project budget?** Keep a publicly contextualized but **illustrative** scenario, plainly labeled.
- **Final hour:** Stop feature work. Test, stabilize, document, and rehearse.

---

## 13. The judge demo — 90 seconds

1. **Show the user:** “This is for an affordable-housing nonprofit finance lead deciding which small development concept deserves further study.”
2. **Show buyer affordability:** “Our scenario assumes a $100K household income, 33% housing cost ratio, and a 7% mortgage rate. That yields an estimated $345,676.65 price ceiling per home. These are editable assumptions, not Habitat-approved terms.”
3. **Show the 8-home 3D concept:** “The backend estimates $4.335M total cost and $2.765M in home sale proceeds.”
4. **Open funding stack:** “We have $800K of **hypothetically committed** grant/donor support, leaving a **$769,986.80** gap. The potential CalHome reference is **not** treated as awarded cash.”
5. **Compare 10 homes:** “Ten homes would require about **$976,233.50** more funding, above our modeled $900K extra-subsidy cap. Our deterministic selector chooses eight.”
6. **Move cap to $1M:** Click **Find best**, and the 3D scene adds the ninth and tenth houses. “The project's underlying gap didn't change; only the extra funding budget we can tolerate changed.”
7. **Show impact and trust:** “We make the funding and affordability tradeoffs visible and **label every assumed number**. Real program documentation can be layered in, but we don't claim approvals or secured grants.”

**Backup demo:** Keep a screen recording of this exact sequence and a static screenshot of the default state. Do not rely on live internet, Anthropic API availability, or online 3D assets to present.

---

## 14. Final P0 acceptance checklist

- [ ] App opens and calls backend successfully; defaults load from `case_study.json`.
- [ ] Annual income -> mortgage -> **price ceiling** calculation is real backend code.
- [ ] 8-home scenario matches **$4,335,400 TDC**, **$2,765,413.20 sales**, **$769,986.80 gap**.
- [ ] Funding stack shows **assumed** committed vs **potential** support distinctly.
- [ ] Funding-status toggle changes the gap correctly; potential grants, loans and buyer assistance are not miscounted.
- [ ] All 6/8/10 scenarios are rendered and change the **exact count** of 3D houses.
- [ ] Budget $900K -> recommendation 8; budget $1M -> recommendation 10, no financial gap mutation.
- [ ] Inputs, income, source panels and fixed demo rows clearly display **assumptions vs verified facts**.
- [ ] A reference link never implies a program was awarded or an income figure was sourced.
- [ ] Reset Demo works twice; UI handles API errors; backend tests pass; frontend build passes.
- [ ] App works without Anthropic key. Financial results never come from an LLM.
- [ ] The team can explain **who uses it, how it helps Fund It, how the gap is calculated, and what is still assumed**.

---

## 15. Claude Code progress reporting

After every implementation milestone, report briefly:

1. **Implemented:** concrete files and functionality.
2. **Verified:** exact tests/build commands and results.
3. **Missing P0:** outstanding blocking items, before mentioning P1.
4. **Next:** the single highest-priority action.

**Final instruction:** Build a credible **affordability -> cost -> funding stack -> gap -> 3D decision** experience. The goal isn't merely to show that Claude can write a frontend; it's to give Habitat's finance and development teams a transparent way to reason about **what makes affordable housing pencil out and which money could close the gap**.
