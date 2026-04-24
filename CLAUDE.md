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
