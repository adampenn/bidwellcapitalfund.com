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

## Property asset-management pages (/cherry-20, one per property)
- Access-code-gated standalone pages (same pattern as /rcr-timeline), not linked in nav, noindex. One page per property; 946 Cherry St lives at `/cherry-20`. `/portfolio` is a redirect to `/cherry-20` for links in past investor emails.
- `src/components/PropertyPortal.astro` holds the layout, charts and auth gate: KPI tiles, NOI vs pro forma chart, rent-by-unit arrow chart, optional rehab gallery, value & equity bar, monthly-update archive.
- Each property page (e.g. `src/pages/cherry-20.astro`) is a thin wrapper that passes `property` (`src/data/owners/<id>.json`), `updates` (`<id>-updates.json`) and `accessCode`. To add a property: create its two JSON files and a new page file.
- The property's Asset Mgmt Google Sheet is the source of truth. **Cherry publishes itself**: `scripts/owners/cherry-site-sync/SiteSync.js` runs daily in the sheet's bound Apps Script. It syncs QuickBooks through last month, waits for the month to be closed out in the sheet, rebuilds `946-cherry.json` (generated summary, KPI notes and highlights), appends new "Bidwell Cherry 20 - ... Update" emails to the archive, runs sanity checks, and squash-merges an `auto/cherry-*` PR. If a check fails it emails Adam and publishes nothing. See that folder's README for the checks and install steps. Do not hand-edit numbers in the JSON; fix the sheet. `scripts/owners/update_cherry.py` is the older manual path.
- Rent-roll unit types: `turned`, `bump`, `pending` (unchanged since acquisition), `vacant` (shows the last rent).

## Oil Fund VI investor page (/oil-fund-6)
- Same gated, noindex, unlinked pattern as /cherry-20 (access code `rushcreek`, passed as a prop). `src/components/FundPortal.astro` is the oil-fund version of PropertyPortal: KPI tiles (fund-share figures, not 8/8ths), barrels by well with a fund-share/whole-well toggle and realized price vs the $60 underwriting price, email-style revenue/expenses/net income chart plus net income by well, distributions per $100K, well-by-well table, monthly-update archive.
- Source of truth is the "Oil Fund 6 - Production Tracker" sheet (`1a5vWpLdHWhDMkYSDKbD7GkNNtA8eGP2C6KZzzkLCcOM`: Well Info, Chart Feed, Well P&L, Distributions tabs). `scripts/owners/update_oil_fund_6.py` rebuilds `src/data/owners/oil-fund-6.json`. Production is cut off at the month paid by the latest distribution (distribution month minus two), so the page never shows oil investors haven't been paid on.
- Hand-edited fields the script carries over: `summary`, `highlights`, `production.note`, `distributions.note`, and each well's `group` / `status` (copy these from the "Well-by-Well Status" list in the latest letter). Do not hand-edit numbers.
- Monthly flow: after the sheet has the new Rush Creek payment and the distribution is booked, run the script, update the hand-edited fields from the new Kit letter, then archive the letter with `--archive <gmail message id>` (the real 1st-of-month send from team@bidwellcapitalfund.com, not the Kit preview). The archiver works from the email's HTML, strips Kit chrome and tracking, drops pre-filled Google Form links, and copies images at full resolution into `public/oil-fund-6/updates/` (click any archive image for the full-screen zoom viewer).

## Chico Avenue Portfolio investor page (/chico-avenue)
- Access-code-gated standalone page (same pattern as /rcr-timeline and /cherry-20), not linked in nav, noindex. Rule 506(b): never link it publicly or list it in the sitemap.
- `src/pages/chico-avenue.astro`: lever panel + results (KPIs, distribution chart, year-by-year table, sources and uses), business plan, property cards, terms, documents. Access code is compared as a SHA-256 hash (`ACCESS_HASH` in the inline script); generate a new hash with `node -e "console.log(require('crypto').createHash('sha256').update('newcode').digest('hex'))"`.
- `public/chico-avenue/model.js`: the pro forma engine, a port of the two live per-building underwriting sheets (1017 Esplanade `1owZNekEJAvd6DCWbHcKJWqHsENhY_1t_TuTitNRPGYo`, Royal Arms `1Z8noS75eqEjsNks9dOA7ge_uyP07UPBFUYECOC9NILE`, "Pro Forma" tabs). At the underwriting assumptions it reproduces each sheet's 10-year LP IRR, distributions, refi proceeds and sale analysis to the dollar. Two sheet conventions matter: property taxes grow 2% (Prop 13), and amortizing payments are sized over amortization months minus interest-only months.
- When the sheets change, re-pull the inputs into `PROPERTIES` in model.js and re-run the tie-out (`node` against the file; see the git history for the check script). Do not hand-edit numbers in the page copy without updating the engine.
- Assets: `public/chico-avenue/` holds the two photos and the investor deck PDF (Adam's call to host it; it is reachable by URL, like an unlisted Drive link). Offering documents themselves stay in the invportal, never in `public/`.
- Engine is stricter than the sheets off base (DSCR-tested refis, loan maturity/reset, capital calls, no refi in the sale year); see the header comment in model.js. Base case must keep tying to the live sheets at a 10-year hold after any change (as of 9/28/26, both rates locked (FSB 6.8%, Chase 6.73%): sheets 12.45% blended, 2.33x, $2,230,331 equity; Supplement No. 1 still shows the pre-lock 12.6%/$233,658 and gets a rider at the next doc pass). Page defaults to a 5-year hold (Adam 9/12); the 10-year tie is reached via the hold lever. The `adu` lever (unit 25 at Royal Arms, +$40K, $1,100 from year 2) is upside only and must stay OFF in the base case and out of the offering docs until permitted.
