# Stalwise

Horse business management app for stables, studs and trading yards. Built first for Kimco Stables & Stud, then offered to other yards as a subscription product.

## Stack

- **App:** Expo SDK 58 (React Native, Expo Router, TypeScript) for iPhone, Android and web
- **Backend:** Supabase (Postgres, Auth, Storage), project in London
- **Offline sync:** PowerSync (planned)
- **Builds and testing:** Expo EAS and Apple TestFlight

## Running it

```bash
npm install
npx expo start
```

Supabase settings are in `.env` (public values only; row-level security protects the data).

## Project layout

- `src/app/` – screens (Expo Router)
- `src/components/` – shared UI in the Stalwise royal blue and gold
- `src/lib/` – Supabase client, formatting, uploads
- `src/providers/` – signed-in user and current business
- `supabase/migrations/` – database schema, security rules and calculations
- `src/types/database.ts` – generated database types

## Status

Phase 1 in progress: sign-in, business setup with logo, horses, stalls and invoice list are built. Next: costs, photos, invoicing, offline sync.
