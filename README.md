# Dharani Stationeries PWA

A React Progressive Web App that preserves the exact UI design from `dharani_stationeries_ui.html` and stores bills in Supabase.

## Features

- Pixel-perfect recreation of the provided mobile UI
- Landing screen with today's sales and today's bills
- New bill flow with item suggestions and price entry
- Supabase-backed bill persistence
- PWA support with manifest and service worker registration

## Setup

1. Copy `.env.example` to `.env`
2. Add your Supabase project URL and anonymous key:

```ini
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

3. Install dependencies:

```bash
npm install
```

4. Run the app:

```bash
npm run dev
```

5. Open the development URL shown in the terminal.

## Supabase schema

Create a table named `bills` with these columns:

- `id` — type `bigint`, primary key, identity
- `created_at` — type `timestamp with time zone`, default `now()`
- `items` — type `text[]`
- `items_text` — type `text`
- `total` — type `numeric`

Allow publicly readable inserts if you want to keep the client-only flow working.

## Build

```bash
npm run build
```

## Notes

- The app is served as a PWA and registers a basic service worker.
- The visual design is preserved from the original HTML/CSS file.
