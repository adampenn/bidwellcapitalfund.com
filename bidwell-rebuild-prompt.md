# Bidwell Capital Fund Website Rebuild - Prompt for New Chat

## Who I Am
I'm Adam Penn, founder of Bidwell Capital Fund and co-host of the Wealth Independence Podcast. I'm based in Northern California. Software engineering background, transitioned to real estate and investing.

## What I Need
Rebuild the Bidwell Capital Fund website (bidwellcapitalfund.com). It should feel like a natural extension of my personal site (adampenn.com) but stand on its own as a professional investment fund site.

## Design System (match adampenn.com exactly)

### Stack
- Astro static site generator (v4.16+)
- Deploy to Render as a static site (build: `npm install && npm run build`, publish: `dist`)
- No React, no heavy frameworks. Pure Astro components + vanilla CSS.

### Color Palette
- Background: `#0f0e0c` (warm charcoal)
- Secondary bg: `#171614`
- Elevated bg: `#1e1d1a`
- Text primary: `#f2efe8` (warm cream)
- Text secondary: `#a09a8e`
- Text tertiary: `#6b655a`
- Accent (copper): `#c48a5a`
- Accent hover: `#d9a474`
- Accent subtle: `rgba(196, 138, 90, 0.12)`
- Border: `rgba(242, 239, 232, 0.08)`

### Typography
- Display/headings: `DM Serif Display` (Georgia fallback)
- Body: `DM Sans` (system sans fallback)
- Body weight: 300 (light)
- Do NOT use Inter, it looks generic

### Design Patterns (shadcn/ui inspired)
- Border radius: `0.625rem` (default), `0.375rem` (sm), `0.75rem` (lg)
- Cards: dark bg (`#161513`), 1px border, `border-radius: 0.75rem`, hover lifts with `translateY(-2px)` and subtle box shadow
- Badges: pill-shaped, uppercase, small text, copper on subtle copper bg
- Section labels: tiny uppercase copper text with wide letter-spacing
- Focus rings: `2px solid rgba(196, 138, 90, 0.4)` with `2px` offset
- Staggered fade-up animations on page load (0.65s, staggered delays)
- Film grain texture overlay on body (SVG noise filter, opacity 0.022)
- Sticky nav with backdrop blur

### General Feel
- Dark, warm, editorial. Think high-end magazine, not startup landing page.
- Minimal. No clutter, no excessive CTAs, no "schedule a call" funnels.
- Professional and calm. Let the numbers and track record speak.
- No em dashes in copy. Use commas, colons, or periods instead.

## About Bidwell Capital Fund
- Investment company focused on building generational wealth through real assets
- Strategies: short-term rental funds, oil & gas working interests, debt funds
- Over $10,000,000 of investor capital raised
- Tax-advantaged structures
- Based in Northern California (Chico, CA area)
- Target investors: accredited investors, tech professionals looking for alternatives to index funds

## Suggested Pages
1. **Home** - Hero with fund name + one-liner, brief value prop, key stats, CTA to learn more
2. **About / Strategy** - Investment thesis, what we invest in, how we think about risk
3. **Track Record** - Key numbers, fund performance (whatever I can share publicly)
4. **FAQ** - Common investor questions
5. **Contact** - Simple, email-first (me@adampen.com)

## Important Notes
- This is a fund site so be mindful of SEC/regulatory language. Don't make performance promises. Use "past performance is not indicative of future results" type disclaimers where appropriate.
- Keep it simple to maintain. I want to be able to update content myself.
- No blog or newsletter signup needed.
- Link back to adampenn.com in the footer or nav.
- Make sure there's a .gitignore from the start (node_modules/, dist/, .astro/, .DS_Store).

## Tone
Direct, factual, confident but not salesy. I'm an operator who builds real things. The site should communicate trust and competence, not hype.
