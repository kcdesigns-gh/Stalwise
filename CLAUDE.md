# Stalwise — notes for Claude

Read `AGENTS.md` too (Expo's own rules for this SDK). This file covers the project itself.

## What this is
Horse business management app (stables, studs, trading yards). Built first for Kimco Stables & Stud, then sold as a multi-business SaaS. Owner: Karel (South African; write in South African English, "colour", "organise", rands as R 1 250,00, dates day/month/year).

## Stack
- Expo SDK 58, Expo Router (routes in `src/app/`), TypeScript strict, native tabs (`expo-router/native-tabs`).
- Supabase project `mncdudqpngabgokgwdwy` (London). Schema lives in `supabase/migrations/`; generated types in `src/types/database.ts`.
- Offline sync with PowerSync is planned, not built yet.

## Rules
- Every tenant table has `business_id`; row-level security does the access control. Roles: manager, trainer, groom, casual. Money (costs, prices, invoices, profit, owners) is Manager-only.
- Child rows use composite foreign keys `(x_id, business_id)` so cross-business links are impossible.
- New tables: create them in a migration and call `private.tenant_table(table, read_roles, write_roles, delete_roles)`.
- Never hard-code South African settings; currency, tax name and rate come from `businesses`.
- Look: fixed royal blue (#12285F / #1D3F9E) and gold (#D4AF37), Manrope font. Tokens in `src/constants/theme.ts`, shared components in `src/components/ui.tsx`.
- Don't add features Karel hasn't confirmed. The blueprint doc "Stalwise Blueprint v2" is the reference.
- Before finishing: `npx tsc --noEmit` and `npx eslint src`. `npx expo lint`/`expo install` need `EXPO_OFFLINE=1` in the cloud workspace.
