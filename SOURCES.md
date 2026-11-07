# HomeForge — Sources & Citations

All sources checked **November 6–7, 2026**. **Read by team** means we downloaded the source and read the cited content ourselves. **Reference only** means the source is linked for context and no figure in the app is taken from it. Every number in the app that is not listed here is a labeled `ASSUMPTION`.

## Event materials (Claude Impact Lab: UCI × SoCal Affordable Housing)

| Source | Used for |
|---|---|
| Participant repository — https://github.com/travcjohnson/claude-impact-lab-uci | Event rules, judging criteria, submission requirements |
| Event rules for Claude — https://github.com/travcjohnson/claude-impact-lab-uci/blob/main/CLAUDE.md | Labeling, citation and no-invented-facts rules followed throughout |
| Fund It lane brief — https://github.com/travcjohnson/claude-impact-lab-uci/blob/main/lanes/3-fund-it/README.md | Problem framing ("Does it pencil, and who closes the gap?"); 30–35% housing-cost guidance |
| Fund It data sources — https://github.com/travcjohnson/claude-impact-lab-uci/blob/main/lanes/3-fund-it/data/DATA-SOURCES.md | Source inventory; guidance to model property tax as "about 1% plus local assessments" (assumption) |
| Synthetic example deal — https://github.com/travcjohnson/claude-impact-lab-uci/blob/main/lanes/3-fund-it/data/synthetic-example-deal.json | **Test fixture only** ($535K cost / $95K gap). SYNTHETIC — never shown as real |
| Fund It scenarios — https://github.com/travcjohnson/claude-impact-lab-uci/blob/main/lanes/3-fund-it/scenarios.json | Design targets: M01 (stacking sources), M02 (rate change), M03 (donor gift) |
| Judging / submission / ground rules — https://github.com/travcjohnson/claude-impact-lab-uci/tree/main/docs | Demo and repository requirements |

## Santa Ana case study — 1921 W. Washington Ave. (Habitat for Humanity of Orange County)

| Source | Facts used | Status |
|---|---|---|
| City of Santa Ana, Planning Commission **Resolution No. 2024-10** (adopted June 10, 2024) — https://publicdocs.santa-ana.org/WebLink/1/edoc/221637/Reso24-10_1921%20W.%20Washington%20Ave.pdf | Address, APN 405-101-37, Habitat OC as applicant & property owner (p.1); 3 duplexes / 6 for-sale homes, <80% AMI, 10,882 sq ft total new floor area, 15 parking spaces, TTM No. 2023-05 (p.1); farmhouse design (p.4); Habitat OC "is a non-profit housing developer" (p.4); ~0.37 acre and 3 of 6 units via State Density Bonus Law (p.5); adoption date (p.8) | Read by team |
| City of Santa Ana, Planning Commission **Resolution No. 2024-11** (adopted June 10, 2024) — https://publicdocs.santa-ana.org/WebLink/1/edoc/221638/Reso24-11_1921%20W.%20Washington%20Ave%28DBA%29.pdf | Conditional Grant Agreement: grant "in an amount up to … $2,200,000" (p.1, §1(E)); affordability covenants recorded before any disbursement, no less than 45 years (p.2) | Read by team. **Disbursed amount UNKNOWN** |
| CEQAnet, SCH #2024061058 — https://ceqanet.lci.ca.gov/2024061058 | Listed in team case study | Reference only (not opened) |
| Santa Ana FY 2023–24 Q4 Housing Division report — https://storage.googleapis.com/proudcity/santaanaca/2024/07/FY-2023-24-Q4-Housing-Division-Quarterly-Report-IM-CS-AL-JB.pdf | Listed in team case study | Reference only (not opened) |
| Habitat OC construction update — https://habitatoc.org/together-we-build-progress-in-santa-ana-construction-update/ | Listed in team case study | Reference only (not opened; current construction status UNKNOWN) |

## Finance inputs

| Source | Used for | Status |
|---|---|---|
| Freddie Mac PMMS history CSV — https://www.freddiemac.com/pmms/docs/PMMS_history.csv (landing page https://www.freddiemac.com/pmms) | 30-year fixed rate **7.18% (week of 2026-11-05)** and **7.40% (2026-10-08)** as dated rate presets | Read by team. National conventional average, not a Habitat buyer rate |
| California HCD, **2026 State Income Limits** (revised June 23, 2026) — https://www.hcd.ca.gov/sites/default/files/docs/grants-and-funding/income-limits-2026.pdf | Orange County row, household sizes 1–8 (p.11); 4-person AMI $138,600 | Read by team. Eligibility thresholds, shown for reference |
| California HCD, 2026 State HOME Income Limits (effective June 1, 2026) — https://www.hcd.ca.gov/sites/default/files/docs/grants-and-funding/2026-california-HOME-income-limits_0.pdf | Distinguished from State Income Limits; not used for figures | Reference only |
| California Health & Safety Code §50052.5 — https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=HSC&sectionNum=50052.5 | Context only. HomeForge's income × ratio model is an ASSUMPTION, **not** the statutory formula | Reference only |
| Terner Center, *Hard Construction Costs* (March 2020) — https://ternercenter.berkeley.edu/wp-content/uploads/2020/08/Hard_Construction_Costs_March_2020.pdf | Context only; 2020 data not used for the $/sq ft assumption | Reference only |

## Funding & incentive programs (AI Funding Advisor catalog)

| Source | Used for | Status |
|---|---|---|
| California BOE, **Letter to Assessors No. 2023/044** — https://www.boe.ca.gov/proptaxes/pdf/lta23044.pdf | RTC §214.15.1 nonprofit homeownership welfare exemption: 45-year recorded agreement, first-time low-income buyers, ≤5% down payment, affordable cost ≤30% of gross income; **operative for lien dates Jan 1, 2023 through Jan 1, 2027**; RTC §214.15 zero-interest-loan condition | Read by team |
| HCD CalHome Program — https://www.hcd.ca.gov/grants-and-funding/programs-active/calhome | Program description; page showed **"Application window CLOSED"** on 2026-11-07 | Read by team |
| HCD HOME Investment Partnerships Program — https://www.hcd.ca.gov/grants-and-funding/programs-active/home-investment-partnerships-program | Candidate program reference | Reference (organizer-verified page) |
| HUD Exchange, HOME — https://www.hudexchange.info/programs/home/ | Candidate program reference | Reference only |
| HUD Exchange, SHOP — https://www.hudexchange.info/programs/shop/ | Candidate program; land/infrastructure restriction | Reference only |
| CalHFA homebuyer programs (MyHome) — https://www.calhfa.ca.gov/homebuyer/programs/ | Buyer-side deferred junior loan; never counted as developer funding | Reference only |
| Team research table (Nov 7, 2026): State Density Bonus Law, SB 684 / SB 1123, local impact-fee waivers, SB 937 fee deferral, AB 130 CEQA infill exemption | Unverified leads; no savings modeled | Primary sources not yet linked |

## Assumptions (not sourced)

Household income ($100,000), housing-cost share (33%), taxes/insurance/HOA ($550/mo), buyer cash ($15,000), land ($600,000), site work ($100,000), construction ($300/sq ft), soft costs (20%), contingency (10%), financing allowance (5%), property tax while held ($30,000), raisable funding ($900,000), tax-relief estimate inputs (1.1% rate, 50% built on lien date). All are labeled `ASSUMPTION` in the app and editable.

*Prototype screening model — not legal, tax, lending, or financial advice.*
