# Bidwell Capital Fund

Website for [bidwellcapitalfund.com](https://bidwellcapitalfund.com). Built with Astro, deployed on Render.

## Stack

- **Astro** static site generator
- **Vanilla CSS** with CSS custom properties (no frameworks)
- **Chart.js** for portfolio dashboard visualizations
- **DM Serif Display + DM Sans** typography
- **Render** static site hosting with auto-deploy

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Output goes to `dist/`.

## Deploy

Render is configured to auto-deploy on push to `main`.

- Build command: `npm install && npm run build`
- Publish directory: `dist`

## Updating Fund Data

Edit `public/pccf-data.json` to update the PCCF portfolio dashboard. The file contains a `meta` object (portfolio size, gross yield, LTV) and a `deals` array. Push to `main` and Render will rebuild automatically.

## Pages

- `/` — Home
- `/about` — Strategy and founder bio
- `/track-record` — PCCF portfolio dashboard
- `/faq` — Investor FAQ
- `/contact` — Contact info and process

## Theme

Supports light and dark mode. Defaults to dark, respects system preference, and includes a manual toggle. Theme choice is persisted in localStorage.
