# HomeForge — Fund It

**Lane 3 · Fund it** — *Does it pencil, and who closes the gap?*
Claude Impact Lab: UCI × SoCal Affordable Housing.

For a **nonprofit finance lead** (e.g. at Habitat for Humanity OC) screening a small affordable-ownership
project: household affordability → development cost → funding stack → remaining gap,
with every number labeled as sourced, user-entered or `ASSUMPTION`.

> Prototype for early-stage screening only — not legal, financial or lending advice.

**▶ Demo video:** https://youtu.be/MY2K443PYzU

[![HomeForge demo video](https://img.youtube.com/vi/MY2K443PYzU/hqdefault.jpg)](https://youtu.be/MY2K443PYzU)

Default demo: **Habitat OC — 1921 W. Washington Ave., Santa Ana** — a real, publicly documented
six-home (three-duplex) project. Create your own projects from the project bar; the demo stays read-only.

Spec: [`HomeForge_Official_Repo_Claude_Plan.md`](HomeForge_Official_Repo_Claude_Plan.md) ·
case study: [`HomeForge_Santa_Ana_Case_Study.md`](HomeForge_Santa_Ana_Case_Study.md).

## Try it

Requires Python 3.11+ and Node 20+. **No API key needed for the core app.** The optional AI Funding Advisor uses Claude: copy `.env.example` to `.env` and set `ANTHROPIC_API_KEY`. Without a key, the advisor falls back to the backend's rule-based screen.

```bash
# Backend (repo root)
python -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000

# Frontend (second terminal, repo root)
npm --prefix frontend install
npm --prefix frontend run dev        # http://localhost:5173
```

Tests: `python -m pytest backend/tests -q` and `npm --prefix frontend run build`.

## 60-second demo (Santa Ana default)

All dollar figures are **modeled from labeled assumptions**, not Habitat's budget. No API key or internet needed.

1. **Open the app.** "Santa Ana — 1921 W. Washington Ave." loads: a real Habitat OC project, 6 homes in 3 duplexes. The chips show the **documented** facts (APN 405-101-37, city grant agreement up to $2.2M) with a link to the city resolution.
2. **Read the headline strip:** cost to build − what families pay − counted funding = **still to raise ≈ $3.18M ($529K/home)**. The city grant is modeled at **$0**, because how much has been disbursed is unknown.
3. **3D "Who pays for each home":** each house is filled green (families pay) and red (still to raise). Drag the **city grant slider** in Project settings toward $2.2M. Blue (counted grants) grows, red shrinks, and the gap falls to **≈ $976K ($163K/home)** if fully paid.
4. **Rates:** click the Freddie Mac **7.40% (week of 2026-10-08)** button, then **7.18% (latest)**. The headline shows the change vs. baseline (≈ $42K on the 6-home gap). The published rate *fell* last month.
5. **Donor question (organizer scenario M03):** in "What does a gift do?", **$25,000 ≈ 4.7% of one home's remaining gap**, roughly one home's site work. About 22 such gifts close one home's gap at the $0-grant baseline.
6. **AI Funding Advisor** (top bar): ask "Find property-tax relief for this site." Claude reads the scenario through read-only backend tools and returns source-backed leads. It finds California's nonprofit homeownership welfare exemption (RTC §214.15.1, BOE LTA 2023/044, checked 2026-11-07) and flags what's missing (recorded 45-year agreement, first-time buyers) plus a modeled conflict (33% vs the statute's 30% affordable-cost cap). **Simulate impact** → the backend removes up to the $30K *assumed* property-tax line → **Apply as hypothetical** → the KPI cards, funding tab and 3D update, with a yellow "Hypothetical branch" banner and Undo. Nothing changes until you click Apply, and nothing is ever called approved.
7. **Next 100 projects:** **+ New project** → name, city and home counts → a full model in seconds. Every input starts as a labeled ASSUMPTION until you replace it.

Honesty rules we follow on screen: documented vs. derived vs. assumption vs. unknown labels everywhere; the conditional grant is never assumed disbursed; candidate programs, loans and buyer assistance never reduce the gap; 4 and 8 homes are labeled unapproved what-ifs.

## Real vs. mocked

| Item | Status |
|---|---|
| Freddie Mac PMMS 30-yr rate: 7.18% (2026-11-05), 7.40% (2026-10-08) | **Sourced** — read from [PMMS_history.csv](https://www.freddiemac.com/pmms/docs/PMMS_history.csv), checked 2026-11-07 |
| HCD 2026 State Income Limits, Orange County row (revised 2026-06-23), AMI $138,600 | **Sourced** — [PDF](https://www.hcd.ca.gov/sites/default/files/docs/grants-and-funding/income-limits-2026.pdf) p.11, checked 2026-11-07. Shown as eligibility reference only |
| Santa Ana site: address, APN 405-101-37, ~0.37 acre, 3 duplexes / 6 homes, 10,882 sq ft total new floor area, 15 parking spaces, <80% AMI target | **Documented** — [Resolution 2024-10](https://publicdocs.santa-ana.org/WebLink/1/edoc/221637/Reso24-10_1921%20W.%20Washington%20Ave.pdf) (adopted 2024-06-10), read 2026-11-07 |
| City Inclusionary Grant **up to** $2,200,000 (conditional), 45-year affordability covenant | **Documented** — [Resolution 2024-11](https://publicdocs.santa-ana.org/WebLink/1/edoc/221638/Reso24-11_1921%20W.%20Washington%20Ave%28DBA%29.pdf). Amount disbursed is UNKNOWN; the app uses a modeled allocation you set |
| Santa Ana actual development cost, land cost, sale prices, parcel geometry | **UNKNOWN** — not guessed |
| Household income $100K, 33% housing-cost ratio, 7% default rate, $550/mo taxes/ins/HOA, $15K buyer cash | `ASSUMPTION` |
| Land, site work, $/sq ft, soft/contingency/financing rates, site capacity, subsidy cap | `ASSUMPTION` |
| Illustrative 6/8/10 concept project: $500K city grant, $300K donor pledge ("committed") | `ASSUMPTION` — hypothetical; no real award (backs the numeric test oracle) |
| CalHome, HOME, SHOP, CalHFA | Candidate programs — unconfirmed; never counted in the gap |
| Organizer synthetic one-home deal ($535K / $95K gap) | SYNTHETIC test fixture only |

Full citation list: [`SOURCES.md`](SOURCES.md). All cached sources with URLs, dates and limitations: [`backend/data/reference_sources.json`](backend/data/reference_sources.json).
The simplified `income × ratio` affordability model is **not** the HSC §50052.5 statutory formula.

## Official event references

- Participant repo: https://github.com/travcjohnson/claude-impact-lab-uci
- Fund It brief: https://github.com/travcjohnson/claude-impact-lab-uci/blob/main/lanes/3-fund-it/README.md
- Source inventory: https://github.com/travcjohnson/claude-impact-lab-uci/blob/main/lanes/3-fund-it/data/DATA-SOURCES.md
- Synthetic test deal: https://github.com/travcjohnson/claude-impact-lab-uci/blob/main/lanes/3-fund-it/data/synthetic-example-deal.json
- Scenarios: https://github.com/travcjohnson/claude-impact-lab-uci/blob/main/lanes/3-fund-it/scenarios.json
- Ground rules: https://github.com/travcjohnson/claude-impact-lab-uci/blob/main/docs/ground-rules.md
- Submission: https://github.com/travcjohnson/claude-impact-lab-uci/blob/main/docs/submission.md
