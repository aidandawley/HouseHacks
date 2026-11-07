# HomeForge — Fund It

**Lane 3 · Fund it** — *Does it pencil, and who closes the gap?*
Claude Impact Lab: UCI × SoCal Affordable Housing.

For a **nonprofit finance lead** (e.g. at Habitat for Humanity OC) screening a small 6/8/10-home
ownership concept: household affordability → development cost → funding stack → remaining gap,
with every number labeled as sourced, user-entered or `ASSUMPTION`.

> Prototype for early-stage screening only — not legal, financial or lending advice.

Spec: [`HomeForge_Official_Repo_Claude_Plan.md`](HomeForge_Official_Repo_Claude_Plan.md).

## Try it

Requires Python 3.11+ and Node 20+.

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

## Real vs. mocked

| Item | Status |
|---|---|
| Freddie Mac PMMS 30-yr rate: 7.18% (2026-11-05), 7.40% (2026-10-08) | **Sourced** — read from [PMMS_history.csv](https://www.freddiemac.com/pmms/docs/PMMS_history.csv), checked 2026-11-07 |
| HCD 2026 State Income Limits, Orange County row (revised 2026-06-23), AMI $138,600 | **Sourced** — [PDF](https://www.hcd.ca.gov/sites/default/files/docs/grants-and-funding/income-limits-2026.pdf) p.11, checked 2026-11-07. Shown as eligibility reference only |
| Household income $100K, 33% housing-cost ratio, 7% default rate, $550/mo taxes/ins/HOA, $15K buyer cash | `ASSUMPTION` |
| Land, site work, $/sq ft, soft/contingency/financing rates, site capacity, subsidy cap | `ASSUMPTION` |
| $500K city grant, $300K donor pledge ("committed") | `ASSUMPTION` — hypothetical; no real award |
| CalHome, HOME, SHOP, CalHFA | Candidate programs — unconfirmed; never counted in the gap |
| Organizer synthetic one-home deal ($535K / $95K gap) | SYNTHETIC test fixture only |

All cached sources with URLs, dates and limitations: [`backend/data/reference_sources.json`](backend/data/reference_sources.json).
The simplified `income × ratio` affordability model is **not** the HSC §50052.5 statutory formula.

## Official event references

- Participant repo: https://github.com/travcjohnson/claude-impact-lab-uci
- Fund It brief: https://github.com/travcjohnson/claude-impact-lab-uci/blob/main/lanes/3-fund-it/README.md
- Source inventory: https://github.com/travcjohnson/claude-impact-lab-uci/blob/main/lanes/3-fund-it/data/DATA-SOURCES.md
- Synthetic test deal: https://github.com/travcjohnson/claude-impact-lab-uci/blob/main/lanes/3-fund-it/data/synthetic-example-deal.json
- Scenarios: https://github.com/travcjohnson/claude-impact-lab-uci/blob/main/lanes/3-fund-it/scenarios.json
- Ground rules: https://github.com/travcjohnson/claude-impact-lab-uci/blob/main/docs/ground-rules.md
- Submission: https://github.com/travcjohnson/claude-impact-lab-uci/blob/main/docs/submission.md
