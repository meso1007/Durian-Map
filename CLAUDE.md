# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Durian-Map** is a B2B lead generation tool that finds businesses (restaurants, salons, etc.) in a specified area, then filters results to surface those with weak or no web presence — making them potential leads for web/marketing services.

## Development Commands

All commands use **Bun** as the package manager and runtime.

### Backend (Hono.js on port 8080)
```bash
cd backend
bun install
bun run dev   # Hot-reload dev server
```

### Frontend (Next.js on port 3000)
```bash
cd frontend
bun install
bun run dev     # Dev server
bun run build   # Production build
bun run lint    # ESLint
```

There are no automated tests currently.

## Architecture

### Request Flow
1. User submits area + business category in the frontend
2. Frontend POSTs to `backend /api/search?area=...&keyword=...`
3. Backend calls **Google Places API v1** (Text Search) with `X-Goog-Api-Key` auth
4. Backend filters results using `determineWebsiteStatus()` — discards businesses with real websites, flags SNS-only and no-website leads
5. Frontend renders filtered leads; user can save them to **localStorage**

### Backend (`backend/src/index.ts`)
Single-file Hono app. Key logic:
- `determineWebsiteStatus()` — classifies a `websiteUri` as `"real_website"`, `"sns_only"`, or `"none"`. The SNS blocklist includes: Instagram, Tabelog, Facebook, Twitter/X, HotPepper, LINE, Beauty HotPepper.
- Only places with status `sns_only` or `none` are returned to the frontend.
- Google API key lives in `backend/.env` as `GOOGLE_API_KEY` (gitignored).

### Frontend (`frontend/src/app/page.tsx`)
Single-file Next.js page component. Key patterns:
- All UI state via React `useState`/`useEffect` — no external state library
- Two tabs: **Search** (live results) and **Saved Leads** (from localStorage)
- `LeadCard` is an inline subcomponent within `page.tsx`
- Styling: Tailwind CSS v4 (zinc/gray palette)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun |
| Backend | Hono v4 (TypeScript) |
| Frontend | Next.js 16 / React 19 |
| Styling | Tailwind CSS v4 |
| External API | Google Places API v1 |
| Persistence | Browser localStorage only (no database) |

## Key Constraints

- The project is an **early MVP** — keep changes minimal and targeted.
- No database: all persistence is client-side localStorage.
- Backend and frontend are **separate processes** — run both concurrently during development.
- The Google Places API request fetches only these fields: `places.id`, `displayName`, `formattedAddress`, `primaryType`, `websiteUri`.
