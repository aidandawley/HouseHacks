# HomeForge — Real Orange County Case Study

**Flagship demo:** Habitat for Humanity of Orange County — 1921 W. Washington Avenue, Santa Ana, California  
**Hackathon lane:** Fund It — *Does it pencil, and who closes the gap?*  
**Prepared:** November 7, 2026  
**Intended reader:** Claude Code / the HomeForge engineering team

> **Core rule:** This is a real site and a real Habitat OC housing development, **not a public full-project financial dataset**. Use verified project facts as the demo anchor. Label every other number `ASSUMPTION`, `DERIVED`, or `UNKNOWN`, and display source links in the application.

## 1. Why this site

The City of Santa Ana publicly documents a **six-home Habitat for Humanity project on an approximately 0.37-acre parcel**. Its three-duplex layout gives us a concrete, meaningful 3D scene, and a separately documented **conditional city grant of up to $2.2 million** makes it particularly relevant to the **Fund It** lane.

**Demo story:** "This is a real Habitat OC development in Santa Ana. We load the documented six-home concept, estimate the income-constrained sale proceeds and modeled development expenses, and show how financing assumptions change the remaining funding gap."

HomeForge is **an exploratory financial decision-support prototype**, not a representation of Habitat's actual internal pro forma, a zoning approval engine, or legal/financial/lending advice.

## 2. Verified case-study facts

| Field | Value | Evidence / status |
|---|---|---|
| Project name | Habitat for Humanity — Washington Avenue | City of Santa Ana resolutions |
| Address | **1921 W. Washington Avenue, Santa Ana, CA** | City Resolution 2024-10 |
| Assessor parcel number | **405-101-37** | City Resolution 2024-10 |
| Developer / applicant | **Habitat for Humanity of Orange County** | City Resolution 2024-10 |
| Site area | **Approximately 0.37 acre** | Resolution 2024-10, page 5 |
| Documented development concept | **Three duplex buildings, six for-sale homes** | Resolution 2024-10, page 1 |
| Total new floor area | **10,882 sq. ft.** across the proposed development | Resolution 2024-10, page 1. **Not** the site footprint or necessarily the sum of sellable interior areas. |
| On-site parking | **15 spaces** | Resolution 2024-10, page 1 |
| Income target | Homes proposed for lower-income households at **less than 80% of area median income (AMI)** | Resolution 2024-10, page 1 |
| Design character | Farmhouse-style duplex concept | Resolution 2024-10, page 4 |
| Planning action | Tentative Tract Map **TTM 2023-05**, approved as conditioned by Planning Commission Resolution **2024-10** | Resolution 2024-10 |
| Special density treatment | Density bonus and related concessions / waivers | Resolutions 2024-10 and 2024-11 |
| Public funding | **Conditional Inclusionary Grant up to $2,200,000** from the City of Santa Ana | Resolution 2024-11, page 1, Section 1(E). **Do not equate approved maximum with cash disbursed.** |
| Affordability covenant | Resolution references a **45-year** affordability restriction | Resolution 2024-11, page 2 |
| State project record | CEQA Notice of Exemption, **SCH #2024061058**, posted June 25, 2024 | California CEQAnet |

### Key primary sources

1. **City of Santa Ana — Planning Commission Resolution No. 2024-10** (project description, parcel, units, floor area, parking, 0.37 acre):  
   https://publicdocs.santa-ana.org/WebLink/1/edoc/221637/Reso24-10_1921%20W.%20Washington%20Ave.pdf
2. **City of Santa Ana — Planning Commission Resolution No. 2024-11** (conditional $2.2 million Inclusionary Grant, density bonus, affordability restrictions):  
   https://publicdocs.santa-ana.org/WebLink/1/edoc/221638/Reso24-11_1921%20W.%20Washington%20Ave%28DBA%29.pdf
3. **California CEQAnet — Habitat for Humanity: 6 Units** (state environmental project record):  
   https://ceqanet.lci.ca.gov/2024061058
4. **City of Santa Ana — FY 2023–24 Q4 housing report** (Habitat project and $2.2m inclusionary-funds entry):  
   https://storage.googleapis.com/proudcity/santaanaca/2024/07/FY-2023-24-Q4-Housing-Division-Quarterly-Report-IM-CS-AL-JB.pdf
5. **Habitat OC — Construction update** (project-specific construction progress; check dated post before describing current status):  
   https://habitatoc.org/together-we-build-progress-in-santa-ana-construction-update/
6. **City project page** (additional imagery / plan references may exist, but access can be blocked):  
   https://www.santa-ana.org/habitat-for-humanity-washington-avenue-project/

> **Site-plan caveat:** The resolutions confirm the three-duplex arrangement, but they are not a machine-readable survey or a complete architectural model. **Do not invent exact parcel boundary coordinates, building footprints, setbacks, roof heights, or building spacing.** If a usable official site-plan image can be downloaded and checked, use it as a visual guide. Otherwise build a **schematic / not-to-scale** 3D massing model labeled accordingly.

## 3. The product experience for this case

### Screen 1 — Load real case

- Default to **"Santa Ana — 1921 W. Washington Ave."**.
- Display address, parcel ID, 0.37-acre approximate area, and **3 duplexes / 6 homes**.
- Show a **Sources** panel with direct links to the city resolutions.
- Mark every item `DOCUMENTED`, `ASSUMPTION`, `DERIVED`, or `UNKNOWN`.
- Include the disclaimer: `Conceptual financial model. Not a verified site design, legal determination, lending quote, or the developer's actual budget.`

### Screen 2 — Render baseline 3D scene

**P0 3D requirements**

- React Three Fiber / Three.js scene with **three simplified duplex structures**, representing **six housing units**.
- Basic parcel outline and optional schematic parking; visually indicate *15 on-site spaces* only if practical, without implying surveyed placement.
- Orbit controls, home-unit hover/selection, and smooth camera movement.
- Units can be highlighted by cost share, estimated buyer proceeds, or modeled remaining gap. These are **visualizations of derived/assumed data**, not factual per-unit budgets.
- Label scene **"Conceptual 3D visualization — not to scale"** unless exact geometry is independently verified.

**Do not make a full GIS/zoning engine in P0.** No requirement to support any other address. Showing 8 or 10 homes on this parcel is **not verified buildable** and must be a hypothetical design comparison, not an approved layout.

### Screen 3 — Financial engine

1. **Household affordability**
   - Select a hypothetical household size and Orange County 2026 income bracket.
   - Use the correct dated **California HCD 2026 income-limits table** for the chosen program, not an unlabelled generic AMI number.
   - Apply a labeled housing-expense share, property tax, insurance, HOA, mortgage rate, term, and down-payment assumptions.
   - Mortgage principal is derived from available principal-and-interest payment using standard amortization.
   - This is an **illustrative conventional-financing scenario**; Habitat buyers may use different mortgage structures.
2. **Development costs**
   - Use a **documented 10,882 sq. ft. total new floor-area baseline**, while clearly specifying whether the cost multiplier uses gross floor area or another area definition.
   - Add adjustable land, hard construction, soft costs, financing/carrying, and contingency.
   - Actual acquisition cost and complete construction budget are **UNKNOWN** unless supported by independently verified documents.
3. **Funding stack**
   - Show the city's **up-to-$2.2M conditional grant** as `DOCUMENTED CONDITIONAL AWARD — NOT VERIFIED DISBURSED`.
   - Let the user set a **modeled available amount** separately, with an explicit assumption label; never default the full $2.2M to cash already received.
   - Separate **committed/verified**, **conditional/approved**, **hypothetical**, and **potential program** sources.
   - Do not double count buyer-assistance loans as developer grants. Track debts/repayment and program restrictions separately.
4. **Funding gap**
   - `remaining_gap = total_development_cost - modeled_buyer_sale_proceeds - modeled_available_project_funding - other_eligible_project_income`.
   - Explain the scenario's assumptions and show **subsidy required per home**, total gap, and sensitivity to mortgage rates and construction cost.

### Screen 4 — Scenario comparison

- Start with the **documented six-unit** configuration.
- **P0:** Change cost/sq. ft., income tier, financing rate, or *modeled available* grant/donor amounts and update charts + 3D highlights immediately.
- **P1:** Compare a **hypothetical four-unit** alternative, with recalculated costs and sales proceeds; clearly mark it `UNAPPROVED CONCEPT / NOT ZONING-VALIDATED`.
- **P2:** Explore 8/10 units only as a future alternative when zoning and design analysis can support it.
- **P1:** Claude can explain tradeoffs and identify potentially applicable programs with URLs. It **cannot invent amounts, approvals, eligibility, or dates** and does not perform the financial arithmetic.

## 4. Suggested structured data seed

Use a versioned JSON file such as `backend/data/santa_ana_washington.json`:

```json
{
  "id": "santa-ana-1921-w-washington",
  "name": "Habitat OC — Washington Avenue",
  "address": "1921 W. Washington Avenue, Santa Ana, CA",
  "apn": "405-101-37",
  "site_acres_approx": 0.37,
  "buildings": 3,
  "building_type": "duplex",
  "housing_units": 6,
  "proposed_total_new_floor_area_sqft": 10882,
  "parking_spaces": 15,
  "income_target": "below 80% AMI",
  "city_conditional_grant_max_usd": 2200000,
  "city_conditional_grant_status": "documented conditional agreement; disbursement unknown",
  "documented_source_urls": [
    "https://publicdocs.santa-ana.org/WebLink/1/edoc/221637/Reso24-10_1921%20W.%20Washington%20Ave.pdf",
    "https://publicdocs.santa-ana.org/WebLink/1/edoc/221638/Reso24-11_1921%20W.%20Washington%20Ave%28DBA%29.pdf"
  ],
  "parcel_geometry": null,
  "actual_total_development_cost": null,
  "actual_buyer_sale_proceeds": null,
  "actual_grant_disbursements": null,
  "visualization_status": "schematic_not_to_scale"
}
```

**Never populate `null` facts by guessing.** Keep modeled values in a **separate `scenario_assumptions` object**. A modeled or estimated value is not an update to the verified case-study record.

## 5. Relevant data sources for financial assumptions

- **California HCD 2026 State Income Limits (revised June 23, 2026):**  
  https://www.hcd.ca.gov/sites/default/files/docs/grants-and-funding/income-limits-2026.pdf
- **California HCD 2026 State HOME Income Limits (different table; effective June 1, 2026):**  
  https://www.hcd.ca.gov/sites/default/files/docs/grants-and-funding/2026-california-HOME-income-limits_0.pdf
- **Freddie Mac mortgage rates and historic CSV:**  
  https://www.freddiemac.com/pmms  
  https://www.freddiemac.com/pmms/docs/PMMS_history.csv
- **HCD CalHome program:**  
  https://www.hcd.ca.gov/grants-and-funding/programs-active/calhome
- **Official hackathon Fund It source catalog:**  
  https://github.com/travcjohnson/claude-impact-lab-uci/blob/main/lanes/3-fund-it/data/DATA-SOURCES.md
- **Official hackathon Claude instructions:**  
  https://github.com/travcjohnson/claude-impact-lab-uci/blob/main/CLAUDE.md

**Use dates and source metadata in the UI.** The current app should use cached/reviewed public data, not repeated scraping or guessed financial inputs.

## 6. Exactly what is real vs. modeled

| REAL / DOCUMENTED | NOT AVAILABLE AS VERIFIED FULL FINANCIAL DATA |
|---|---|
| Real Santa Ana address and APN | Complete Habitat construction budget |
| Approximately 0.37-acre lot | Current total land-and-site acquisition costs |
| Documented three-duplex / six-home proposal | Actual final home sales prices and buyer mortgages |
| Proposed 10,882 sq. ft. of new floor area | Full capital stack and every disbursement |
| 15 planned parking spaces | Real funding gap for this specific development |
| Up to $2.2m conditional city grant | Survey-grade parcel footprint/building coordinates |
| 2026 HCD income-limit / Freddie Mac source references | Guaranteed grant eligibility or program availability |

**Never state that this real project has a $1.2M or $1.5M gap without evidence.** Those numbers were **hypothetical examples in our earlier brainstorming**, not a published Washington Avenue funding gap. The organizers' `$535k cost / $95k gap` example is also **synthetic and unrelated to this parcel**.

## 7. P0 implementation checklist for Claude Code

- [ ] Seed one versioned project record with the verified facts above.
- [ ] Render a three-duplex / six-home conceptual 3D scene with a clear schematic label.
- [ ] Render source links and status labels for every factual numeric field.
- [ ] Build deterministic affordability, total-cost, funding-stack, and gap calculations.
- [ ] Support a scenario-specific city funding amount from `$0` to `$2.2M`, explicitly labeled an **assumed allocation of a conditional award**; keep actual disbursement unknown.
- [ ] Show sensitivity to mortgage rates, cost/sq. ft., and donor/project-funding assumptions.
- [ ] Keep the 3D view synchronized with the same backend scenario JSON used by the finance dashboard.
- [ ] Distinguish real baseline facts from assumptions in the UI and README.
- [ ] Include backend unit tests and one test using the **official synthetic deal**, without mixing its numbers into the Santa Ana case study.

**P1 only after the full P0 demo works:** Claude explanation panel, verified funding-program discovery, polished animation, optional alternate conceptual designs.

## 8. Recommended 60–90 second demonstration

1. **Open the real case**: "1921 W. Washington Avenue, Santa Ana — a publicly documented Habitat OC development of six homes across three duplexes."
2. **Show the 3D scene and city sources**: point to the parcel ID, six planned homes, and official resolution link. Mention that the scene is conceptual.
3. **Show the financial stack**: "The City documented a conditional grant of up to $2.2 million. We do **not** know its actual disbursements or Habitat's full budget, so the other amounts here are labeled assumptions."
4. **Move a financing assumption**: change the mortgage rate or construction cost; the deterministic backend recalculates the affordability limit and projected funding gap. Show the result changing immediately.
5. **Close**: "HomeForge lets nonprofit developers communicate how project choices, affordability constraints, and conditional funding affect financial feasibility — without hiding uncertain inputs."

## 9. Integrity checks

- The real development is **six homes**, not eight or ten. Any extra units require explicit hypothetical labeling.
- **10,882 square feet is proposed *total new floor area***; do not substitute this for parcel area, survey footprint or per-unit living area.
- **$2.2 million is the conditional grant ceiling in the cited record**, not the project's cost, a verified cash balance, or a verified gap.
- Actual 2026 project construction or sale status should be described only using a separately checked, dated source; do not infer completion from historical target dates.
- If the detailed site plan cannot be retrieved, do not claim the 3D geometry precisely matches the approved site plan.

---

**Summary for Claude Code:** Build the Santa Ana site as a source-grounded **real-world six-home demo baseline**, surrounded by transparent, editable financial scenarios. The core engine computes the results; the 3D display illustrates them; Claude only explains sourced tradeoffs. Prioritize accuracy and a working live demo over full architectural realism.
