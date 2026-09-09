# Project Context for Claude

## Repository
Bidwell Capital Fund website (bidwellcapitalfund.com). Astro static site, dark/warm editorial design.

## Current Task: Oil Well Timeline Tool
Branch: `claude/oil-well-timeline-tool-6sjeh`

Building an internal tool at `/rcr-timeline` for modeling Oklahoma oil well development timelines (Rush Creek Resources). The tool is:
- Password-protected, not linked in site nav
- Standalone page (no site Layout component)
- Located at `src/pages/rcr-timeline.astro`

### What's been built so far
- Auth screen with access code
- Project inputs: start date, drilling mode (sequential/overlapped), well count, rig count, custom well names
- Scenario presets
- Per-well timeline modeling with phases (permitting, drilling, completion, facilities, production)
- Weather delay model based on Tulsa, OK NOAA data
- Gantt chart visualization with consolidated view
- PDF export
- Cashflow/distribution timing and tax deduction modeling (IDC, TDC)
- Config save/load and session caching
- Per-well permitting and facilities (not project-wide)

### Next steps / pending work
- User has a proforma Excel spreadsheet ("Oil Fund 6") with real well data (Newby 27-7, Amarada East #1, etc.) that needs to be incorporated into the tool
- The spreadsheet has not been provided yet. User was going to share it via screenshots or by adding it to the repo
- Goal is to align the timeline tool's assumptions with the actual proforma numbers

## Tech Stack
- Astro v4.16+ static site
- No React or heavy frameworks, pure Astro + vanilla CSS/JS
- Deploy to Render (build: `npm install && npm run build`, publish: `dist`)
- Design: DM Serif Display + DM Sans fonts, copper accent (#c48a5a), dark bg (#0f0e0c)

## Writing Style
- **No em-dashes.** Do not use `—` or `&mdash;` in page copy, marketing text, or headings. It reads as AI-generated. Prefer commas, colons, periods, parentheses, or rewording. En-dashes (`–`) are fine for numeric ranges like `65–85%`.
- Keep prose tight and operator-voiced. Short sentences. Avoid hedging clauses.
- Disclaimers should be plain and direct, not padded with qualifiers.

## Key Files
- `src/pages/rcr-timeline.astro` - The oil timeline tool (large single file)
- `src/pages/index.astro` - Homepage
- `src/layouts/Layout.astro` - Site layout
- `src/styles/global.css` - Global styles
- `bidwell-rebuild-prompt.md` - Full design system reference

## Asset Management Portal (/portfolio)
- Access-code-gated standalone page (same pattern as /rcr-timeline), not linked in nav.
- `src/pages/portfolio.astro` — tabs per property, KPI tiles, NOI vs pro forma chart, rent-by-unit arrow chart, monthly-update archive.
- Data: `src/data/owners/portfolio.json` (property index), `<id>.json` (snapshot), `<id>-updates.json` (email archive). The property's Asset Mgmt Google Sheet is the source of truth — regenerate snapshots with `scripts/owners/update_cherry.py` (requires gog CLI), never edit numbers by hand.
- Access code is a constant near the top of the inline script in portfolio.astro.
- Monthly flow: update sheet → run script → edit `highlights` in the JSON → append new update email to `<id>-updates.json` → commit + push.

## Chico Avenue Portfolio investor page (/chico-avenue)
- Access-code-gated standalone page (same pattern as /rcr-timeline and /portfolio), not linked in nav, noindex. Rule 506(b): never link it publicly or list it in the sitemap.
- `src/pages/chico-avenue.astro`: lever panel + results (KPIs, distribution chart, year-by-year table, sources and uses), business plan, property cards, terms, documents. Access code is compared as a SHA-256 hash (`ACCESS_HASH` in the inline script); generate a new hash with `node -e "console.log(require('crypto').createHash('sha256').update('newcode').digest('hex'))"`.
- `public/chico-avenue/model.js`: the pro forma engine, a port of the two live per-building underwriting sheets (1017 Esplanade `1owZNekEJAvd6DCWbHcKJWqHsENhY_1t_TuTitNRPGYo`, Royal Arms `1Z8noS75eqEjsNks9dOA7ge_uyP07UPBFUYECOC9NILE`, "Pro Forma" tabs). At the underwriting assumptions it reproduces each sheet's 10-year LP IRR, distributions, refi proceeds and sale analysis to the dollar. Two sheet conventions matter: property taxes grow 2% (Prop 13), and amortizing payments are sized over amortization months minus interest-only months.
- When the sheets change, re-pull the inputs into `PROPERTIES` in model.js and re-run the tie-out (`node` against the file; see the git history for the check script). Do not hand-edit numbers in the page copy without updating the engine.
- Assets: `public/chico-avenue/` holds the two photos and the investor deck PDF (Adam's call to host it; it is reachable by URL, like an unlisted Drive link). Offering documents themselves stay in the invportal, never in `public/`.
- Engine is stricter than the sheets off base (DSCR-tested refis, loan maturity/reset, capital calls, no refi in the sale year); see the header comment in model.js. Base case must keep tying to Supplement No. 1 ($233,658 per $100K, 12.56% blended IRR) after any change.
