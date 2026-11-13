# Stalwise — notes for Claude

Read `AGENTS.md` too (Expo's own rules for this SDK). This file covers the project itself.

## What this is
Horse business management app (stables, studs, trading yards). Built first for Kimco Stables & Stud, then sold as a multi-business SaaS. Owner: Karel (South African; write in South African English, "colour", "organise", rands as R 1 250,00, dates day/month/year).

## Stack
- Expo SDK 58, Expo Router (routes in `src/app/`), TypeScript strict, native tabs (`expo-router/native-tabs`).
- Supabase project `mncdudqpngabgokgwdwy` (London). Schema lives in `supabase/migrations/`; generated types in `src/types/database.ts`.
- Edge Functions (`supabase/functions/`) are for the one thing RLS can't do client-side: anything needing the service-role key (e.g. deleting an auth user). Deploy with the Supabase MCP tool, not the CLI. `tsconfig.json`/`eslint.config.js` exclude this folder — it's Deno, not the app.
- Offline sync with PowerSync is planned, not built yet.

## Rules
- Every tenant table has `business_id`; row-level security does the access control. Roles: manager, trainer, groom, casual. Money (costs, prices, invoices, profit, owners) is Manager-only.
- Child rows use composite foreign keys `(x_id, business_id)` so cross-business links are impossible.
- New tables: create them in a migration and call `private.tenant_table(table, read_roles, write_roles, delete_roles)`.
- Never hard-code South African settings; currency, tax name and rate come from `businesses`.
- Look: royal blue (#12285F / #1D3F9E) and gold (#D4AF37), Manrope font, in a light and a dark ("glass") version. Tokens in `src/constants/theme.ts`, shared components in `src/components/ui.tsx`. Never write a colour straight into a screen: use a `Colors` name, chosen by what the colour is for (`heading` for text on a card, `onChrome` for text on a header band, `link` for tappable text, `onGold` for text on gold). On web the names are CSS variables, so the look switches live; on iPhone and Android it is picked at start-up (`src/lib/theme-mode.ts`).
- Don't add features Karel hasn't confirmed. The blueprint doc "Stalwise Blueprint v2" is the reference.
- Before finishing: `npx tsc --noEmit` and `npx eslint src`. `npx expo lint`/`expo install` need `EXPO_OFFLINE=1` in the cloud workspace.
