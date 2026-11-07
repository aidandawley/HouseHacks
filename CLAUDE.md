# CLAUDE.md — HomeForge

Spec: `HomeForge_Official_Repo_Claude_Plan.md` (implementation contract; follow its P0 order and test oracle).
Event reference repo: https://github.com/travcjohnson/claude-impact-lab-uci (Lane 3 · Fund it).
Hackathon window 10:00 AM–2:30 PM; submission due 2:30 PM on public `main`.

## Event rules (from the organizers' CLAUDE.md — do not bend)

- **Never invent** a statute, number, fee, address, parcel fact, income limit, rate or program amount. If a source does not say, the answer is "unknown".
- **Label assumptions** as `ASSUMPTION` in code, UI and README, with what they are based on.
- **Cite sources** with URL, section/page and date checked. Cached values live in `backend/data/reference_sources.json`; only `team_verified` records may carry values.
- **No personal information** about any real buyer, tenant or applicant. Test households are made up.
- **No scraping at volume.** Download once, cache, cite. No live fetches per slider move.
- **No secrets in git.** Keys only in `.env` (ignored); `.env.example` lists names only.
- **Prototype only / not advice.** UI must say it is a prototype, not legal, financial or lending advice.
- When sources disagree or look stale, show it; don't pick silently.

## Projects

- Default demo: **Santa Ana — 1921 W. Washington Ave.** (`backend/data/projects/santa-ana-1921-w-washington.json`), a real Habitat OC 6-home / 3-duplex site. Spec: `HomeForge_Santa_Ana_Case_Study.md`.
- Site facts are `DOCUMENTED` (City of Santa Ana Resolutions 2024-10 / 2024-11, PDF pages cited), `DERIVED`, `ASSUMPTION` or `UNKNOWN` (value null — never guess). Modeled inputs live in household/development/funding, never in `site.facts`.
- The $2.2M city grant is a **conditional ceiling**: `status=conditional`, `documented_max=2200000`, `amount` = modeled allocation (default $0). Never default it to the full ceiling.
- Projects with `documented_home_count` (Santa Ana: 6) use `analysis_mode=documented_configuration`: the analysis reports that configuration's gap and treats other counts as what-ifs (no "best fit"). Projects without it use max-homes-under-cap.
- Seed projects (`backend/data/projects/`) are read-only. User projects are JSON files in `backend/data/user_projects/` (gitignored). The illustrative 6/8/10 concept seed backs the plan's numeric test oracle.

## Project rules

- Finance math is deterministic Python `Decimal` in `backend/`; the frontend and any LLM never compute totals.
- Only `status in {committed, conditional}` AND `instrument in {development_grant, donation}` rows reduce the gap (conditional rows at their *modeled* `amount`, labeled as an assumed allocation). `potential` programs, loans and buyer assistance never do.
- `backend/tests/fixtures/official_synthetic_example_deal.json` is SYNTHETIC — tests only, never shown as real.
- Don't mix State, State HOME and HUD income tables. §50052.5 is context; our 30–35% ratio model is an ASSUMPTION, not statutory compliance.

## Commands

```bash
source .venv/bin/activate
python -m pytest backend/tests -q
uvicorn backend.main:app --reload --port 8000
npm --prefix frontend run dev     # http://localhost:5173
npm --prefix frontend run build
```
