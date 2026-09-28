@AGENTS.md

# Hive

Comms platform for a regional manager and his Spar/TOPS store managers. Product concept lives outside the repo: `C:\Users\Support\Desktop\Hive\concept-md.md`.

- Stack: Next.js 16 (App Router) + Supabase + Tailwind v4 + Vercel. Single-tenant.
- Design tokens are in `app/globals.css` (`@theme`). Gold is a fill colour with ink text on it — never gold text on white.
- Logo paths in `components/brand/logo.tsx` are extracted from the master artwork (`Desktop/Hive/Logo.ai`); don't redraw them.
- Navigation is defined once in `lib/nav.ts`; add sections there deliberately.
- `/design` is the living design-system reference page.
- Auth: Supabase email+password. `proxy.ts` refreshes the session and sends signed-out visitors to /login; pages call `getViewer()` / `requireRegionalManager()` (lib/viewer.ts). Store manager logins are created from the Stores screen via the secret-key admin client (`lib/supabase/admin.ts`) — always role-check before using it.
- Schema lives in `supabase/migrations/`; applied by pasting into the Supabase SQL editor (no CLI link yet).
- `.env.local` holds Supabase keys and is edited by Eugene by hand — never write secrets to it or echo them.
- `NEXT_PUBLIC_*` vars on Vercel must be the "Config" type, not "Secret", or they're undefined at build time.
