@AGENTS.md

# openbudgets.be

Harmonises Belgian federal and regional (Flanders, Wallonia, Brussels) expenditure into 17 COFOG categories, presented in EN / FR / NL / DE.

## Architecture

- **Next.js 16, App Router.** Pages: `app/page.tsx` (homepage), `app/dashboard`, `app/data` (Data Explorer). Read `node_modules/next/dist/docs/` before using any Next API (see AGENTS.md).
- **Shell:** `app/layout.tsx` wraps every page in `LanguageProvider` (`components/LanguageContext.tsx`, EN/FR/NL/DE, persisted to localStorage) and `SiteHeader`.
- **Backend: Firestore.** Seeded by `scripts/seed.js` from `data/Belgium_Combined_Expenditure_20252026.csv` and `data/Belgium_Population.csv` only — no invented figures. Server access goes through `lib/firebaseAdmin.ts` (local: `GOOGLE_APPLICATION_CREDENTIALS`; Vercel: inline `FIREBASE_SERVICE_ACCOUNT`).
- **`GET /api/expenditure`** (`region`, `year`): payment-basis totals per region/department with `per_capita_eur` and an `incomplete` flag for departments with data gaps.
- **`POST /api/ask`** (Data Explorer), pipeline in `lib/explorer/`: matcher → validator → fetch → execute → absence → narrative.
  - Stages 1–5 are deterministic. Absence classification uses `lib/competence.ts` (constitutional / blended / structural / unexplained).
  - Narrative (`lib/explorer/narrative.ts`) is a best-effort Gemini layer: prose only, never invents figures or explains absences; returns null on failure or without `GEMINI_API_KEY`.
  - Matcher tests: `npx tsx lib/explorer/matcher.test.ts`.
- **`POST /api/contact`** (`/contact` page): validates the form, saves to the Firestore `contact_messages` collection, then emails it to the owner via `lib/contactMail.ts` (Resend HTTP API, plain `fetch`, Reply-To = visitor). Env vars: `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, optional `CONTACT_FROM_EMAIL` (defaults to Resend's test sender `onboarding@resend.dev`); without the first two, messages are only saved.
- Shared helpers: `lib/slugify.ts` (also used by the seed script), `lib/safeAmount.ts`.

## Commands

- `npm run dev` — dev server
- `npm run build` — production build
- `npm run lint` — ESLint
- `npm run seed` — reseed Firestore from the CSVs in `data/`

## Rules

- Never revert, delete, or rewrite existing working code unless explicitly asked.
- Never read, print, or commit `.env.local` or the `*firebase-adminsdk*.json` service-account file.
- Run `npm run build` and confirm it passes before saying a change is done.
- Deploys happen by pushing to `main` on GitHub → Vercel.
