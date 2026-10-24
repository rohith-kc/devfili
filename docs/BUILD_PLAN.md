# DevFili build plan

Work phase by phase. Do not start a phase until the previous gate is met. After each phase: run `npm test`, `npm run lint`, `npm run build`, `npm run scan-secrets`, commit, then tell the user in 3 lines: what works, what to check, what is next. The repo is https://github.com/rohith-kc/devfili.

## What only the user can do (give exact clicks, one item at a time, when needed)
| When | User action |
|---|---|
| Phase 0 | Create new Gemini (Google AI Studio) and Groq keys if the old ones were shared in chat; paste them into `.env.local` themselves |
| Phase 0 | Create a free Supabase project; copy Project URL, anon key, service-role key into `.env.local` |
| Phase 0 or 5 | Create a GitHub OAuth app and paste its client ID and secret into the Supabase dashboard (Auth, Providers, GitHub), not into chat |
| Phase 0 | Pick model IDs from the `check-keys` list |
| Phase 3 | Review the Zoom, Microsoft Teams and HubSpot guides section by section (matches, missing, wrong, out of date) |
| Phase 8 | Create a Vercel account, import the GitHub repo, enter env vars in the Vercel dashboard |

## Phase 0: Setup and keys
1. Scaffold Next.js (App Router, TypeScript, Tailwind) in the existing repo folder; add dependencies from SPEC section 2; add npm scripts from CLAUDE.md; place `docs/*`, `CLAUDE.md`, `.env.example` (already provided). Ensure `.gitignore` ignores `.env*` except `.env.example`.
2. Run the first-run protocol in CLAUDE.md: ask for the non-secret settings, create `.env.local`, tell the user which lines to fill, never read secrets back.
3. Write `scripts/check-keys.ts` and `scripts/scan-secrets.ts` (SPEC section 14). Run `npm run check-keys` and walk the user through any FAIL. Decide with the user, and record in `docs/DECISIONS.md`, whether research and check run on Gemini or fall back to Groq (`PROVIDER_RESEARCH`, `PROVIDER_CHECK`), and which model IDs to use.
4. Supabase: write `supabase/migrations/0001_init.sql` (SPEC section 5) and tell the user to paste it into Supabase SQL editor and run it. Walk through the GitHub OAuth app: GitHub, Settings, Developer settings, OAuth Apps, New; Homepage URL = site URL; Authorization callback URL = `https://<project-ref>.supabase.co/auth/v1/callback`; paste client ID and secret in Supabase Auth, Providers, GitHub; add `http://localhost:3000/auth/callback` and the production URL to Supabase Auth URL configuration redirect URLs.
Gate: `check-keys` passes for every provider you will use (or a documented fallback is chosen), the migration ran, `npm run dev` shows a blank home page, secrets scan clean, first commit pushed.

## Phase 1: Schema and deterministic logic
Implement `schema.ts`, `tier.ts`, `evidence.ts`, `confidence.ts`, `completeness.ts`, `ranges.ts`, `normalize.ts` and their unit tests (SPEC sections 6 and 7). Create `tests/fixtures/sample-guide.json`: a full 15-section guide with `sample: true`, clearly fictional content using a made-up app name ("Sample App"), exercising every label, owner tag and gate state.
Gate: tests pass; the fixture validates; all `tier` branches (including Unknown) covered.

## Phase 2: Research pipeline
Implement `llm/*`, `safety/ssrf.ts`, and `research/*` (SPEC section 8), the prompts from `docs/PROMPTS.md`, and `npm run research -- "<app>"`. Add SSE streaming route `POST /api/research` with limits and cache (SPEC section 11).
Gate: complete guides for Linear, Zoom and one unfamiliar app (for example Calendly) from the CLI; every claim has a label; SSRF tests pass; a deliberately broken URL gives Uncertain, not an invented source; stage timings logged; one full run finishes under `RESEARCH_DEADLINE_SECONDS`.

## Phase 3: Library
Create `content/apps.json`; implement `library:generate`, `library:validate`, `library:links`. Generate drafts for all 9 apps. Then run the review loop with the user for Zoom, Microsoft Teams and HubSpot: print each guide section by section in plain language, ask the user to mark each section matches / missing / wrong / out of date, apply their corrections, set `handVerified`, and log every correction in `docs/VERIFICATION.md` (what the agent said, what was true, evidence). Any pattern of misses becomes a new instruction in the research prompts (for example hidden steps like a review call or a test environment built for reviewers). Review the other 6 yourself against their sources.
Gate: 9 files in `content/library/` pass `library:validate`; links report reviewed; VERIFICATION.md has the corrections.

## Phase 4: UI
Build Header, Logo (SVG mark), Hero, AppGrid/AppTile, GuideView with the 15 sections, EvidenceBadge, OwnerTag, HelpersRail with the two code helpers (checklist, pre-submission), ChatPanel with SSE stages and clarifying question, responsive layouts, accessibility (SPEC section 12). Library guide pages are static from JSON. Use the sample fixture while building.
Gate: tests T1, T2, T3, T4, T5, T12 pass on real library guides; verdict visible without scrolling on phone width.

## Phase 5: Sign-in, saving, My guides
Supabase clients, GitHub sign-in, `/auth/callback`, save, My guides, delete with confirmation, public `/g/[id]` (SPEC sections 5 and 11).
Gate: T8, T13, T14 pass (use a private window for T8).

## Phase 6: LLM helpers
Scope justification, reviewer test plan, customer admin note with the secrets guard (SPEC section 10, PROMPTS P6). Panels, copy buttons, draft banner, disabled states.
Gate: T9 passes; hostile inputs rejected; nothing stored or logged.

## Phase 7: Hardening
Rate limits and cache verified with real counters; graceful database-down behaviour (library pages and home still work with Supabase unreachable); failure modes T6, T7, T10; prompt-injection test T11 using a local test page; security headers; `/api/health`; optional `.github/workflows/keepalive.yml` that calls `/api/health` every 3 days (the site URL goes in a repo variable, no secrets).
Gate: T6, T7, T10, T11 pass.

## Phase 8: Verification, README, deploy
1. Accuracy check: 25 claims (5 each from Zoom, Teams, Slack, Google and one live-generated app) checked against real sources; fill the table in `docs/VERIFICATION.md` (Correct / Corrected / Unverified) and compute totals and the most common error type.
2. Unfamiliar-app run on the 10 apps in PRD section 12; record results.
3. Write the root `README.md`: what it is, setup steps, env vars (names only), key decisions, limitations (use the PRD section 13 statements), verification table summary, how the agent split works (Gemini reads, Groq drafts, code decides labels and tier).
4. Deploy: guide the user through Vercel (import repo, add env vars in the dashboard, set production site URL, update Supabase redirect URLs and the GitHub OAuth app callback if needed). Run T1-T14 on the production URL.
5. Before making the repo public: run `scan-secrets` over the full git history (`git log -p` grep), confirm no `.env*` committed, remind the user to rotate any key ever pasted in chat. Confirm Supabase project is not paused.
Gate: production link works, README done, secrets history clean.

## If time runs short, cut in this order
Should helpers and stretch items first; then fewer library apps (keep Zoom, Teams, Google, LinkedIn, Linear); never cut evidence labels, the deterministic logic, or the verification table.
