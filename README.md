# DevFili

**How hard is it to get your OAuth app approved?**

DevFili tells a developer, before they write a line of integration code, how hard it will be to get an OAuth app approved for a given provider: a difficulty tier, two separate numbers (your own effort vs. the wait on the provider), the prerequisites, the three approval gates (provider review, customer admin, end user), and who does each step &mdash; the research agent or the developer. It ships 9 in-depth, hand-reviewed or source-checked guides (Zoom, Slack, Gong, HubSpot, Notion, Linear, Microsoft Teams, Google/Gmail, LinkedIn), plus live research for any other OAuth app.

"Fili" is Greek for friend &mdash; the idea is the friend who already went through a provider's approval process and wrote down exactly what to expect.

**Live:** https://devfili.vercel.app/
**Source:** https://github.com/rohith-kc/devfili

## What's actually working right now

- **The 9 library guides** &mdash; browse, search, and filter by tier/gated on the home page; every guide page shows the verdict, scopes, steps, the three gates, and evidence you can click through to the real source.
- **Live research** ("Check an app") &mdash; type any other app name and it researches, drafts, and fact-checks a guide live, streaming progress as it goes.
- **Two code-only helpers** (checklist, pre-submission check) &mdash; tick boxes, "N remaining," copy as text.
- **Three AI-drafted helpers** (scope justification, reviewer test plan, customer admin note) &mdash; each pulls only from that guide's own cited facts, always shown with a "Draft: review before use" banner, never auto-sent anywhere.
- **Evidence labeling is never the model's call.** Every factual claim is labeled Tested, Sourced, or Uncertain by deterministic code (`src/lib/evidence.ts`) based on whether an automated check could independently re-confirm it &mdash; the model only ever proposes facts and cites which finding/source they came from.

## Not built yet

- **Sign-in and "My guides."** There's no GitHub sign-in, so a live-researched guide can't be saved or shared by link &mdash; "Save to my guides" is visibly present but disabled on purpose, not faked.
- **A formal 25-claim accuracy spot-check** across Zoom/Teams/Slack/Google plus one live-generated app (see [Verification](#verification) below for what *has* been done).
- Zoom, Microsoft Teams, and HubSpot still await the product owner's own section-by-section review against firsthand experience (the other 6 library guides *have* been self-reviewed against their official sources &mdash; see `docs/VERIFICATION.md`).

## How the research agent works

Three model providers, used for different jobs, with code &mdash; never a model &mdash; deciding anything that matters for trust:

| Stage | Primary | Falls back to | Then to |
|---|---|---|---|
| Resolve (which app do you mean?) | Groq (fast) | OpenRouter | &mdash; |
| Discover (find docs, scopes, review process) | Gemini (web search + page reading) | Groq (built-in web search) | OpenRouter (web search) |
| Draft (write the guide) | Groq (structured output) | Gemini (JSON mode) | OpenRouter (JSON mode) |
| Check (fact-check every claim against its source) | Gemini (reads the live page) | Groq (excerpts only) | OpenRouter (excerpts only) |

OpenRouter is entirely optional &mdash; leave `OPENROUTER_API_KEY` blank and every stage still works with just Gemini and Groq, exactly as it did before that key was added. Every provider call has a timeout, so a slow or rate-limited provider fails fast enough for the next one to take over rather than hanging silently.

The model is never allowed to decide: a difficulty tier, a confidence level, whether a guide is complete, or whether a claim is Tested/Sourced/Uncertain. Those are all computed by plain TypeScript (`src/lib/tier.ts`, `confidence.ts`, `completeness.ts`, `evidence.ts`) from facts and findings the model proposed and cited &mdash; see `docs/SPEC.md` section 7 for the full logic.

## Setup (running it yourself)

```bash
git clone https://github.com/rohith-kc/devfili.git
cd devfili
npm install
cp .env.example .env.local
```

Open `.env.local` in your editor and paste in your own keys (see [Environment variables](#environment-variables) below) &mdash; never commit this file, and never paste a key into a chat or an issue.

```bash
npm run check-keys    # confirms each key works, never prints the values
npm run dev            # http://localhost:3000
```

Other useful commands:

```bash
npm test                        # unit tests (vitest)
npm run lint                    # eslint
npm run build                   # production build
npm run scan-secrets            # greps tracked/staged files for secret patterns
npm run library:validate        # checks every library guide JSON is well-formed
npm run library:links           # checks every source URL in the library still resolves
```

## Environment variables

Names only &mdash; get the actual values from each provider's own dashboard, paste them into `.env.local` yourself. Full list with defaults in `.env.example`.

- `GEMINI_API_KEY` &mdash; Google AI Studio
- `GROQ_API_KEY` &mdash; console.groq.com
- `OPENROUTER_API_KEY` &mdash; optional third fallback tier, openrouter.ai
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` &mdash; used for research-result caching and daily rate limits (both degrade gracefully, with a conservative in-memory fallback, if the database is unreachable)
- `IP_HASH_SALT` &mdash; any long random string, used to hash guest IPs for rate limiting (never stores a raw IP)
- Everything else (model IDs, daily limits, cache TTL) has a documented default in `.env.example`

## Deploying

This project targets **Vercel's Hobby (free) tier** &mdash; it was built around Vercel's 300-second serverless function limit specifically (`src/app/api/research/route.ts` sets `maxDuration = 300`). Netlify's free tier caps function execution well under what live research needs, so it isn't a good fit here without changes.

1. Push your latest commit to GitHub (already done if you're reading this from the repo).
2. Go to [vercel.com](https://vercel.com), sign in with GitHub, click **Add New &rarr; Project**, and import this repository.
3. Before the first deploy, open **Environment Variables** and add every variable listed above (same names as `.env.example`), pasting the same values you have in your local `.env.local`.
4. Click **Deploy**. Vercel builds it with `npm run build` automatically.
5. Once it's live, copy the `https://<something>.vercel.app` URL Vercel gives you, set it as `NEXT_PUBLIC_SITE_URL` in the same Environment Variables screen, and redeploy (Vercel's **Deployments** tab &rarr; **Redeploy** on the latest one) so that variable takes effect.
6. Share that URL. That's the "working link" people can open directly &mdash; no local setup needed on their end.

## Key decisions

The full, dated log of every non-obvious call made while building this (with the reasoning) is in `docs/DECISIONS.md`. A few that matter most for understanding how it behaves:

- **Evidence labels, tier, confidence, and completeness are always code-computed**, never asserted by a model &mdash; this is the whole trust model of the product (see `CLAUDE.md`'s hard rules).
- **Groq's old `groq/compound` model was retired mid-project**; its web-search replacement is the `browser_search` built-in tool on a `gpt-oss` model.
- **OpenRouter was added as a genuine third fallback tier** (not a Groq replacement) after Groq's own web-search tool was found to be able to burn 50&ndash;70% of its entire daily token budget in a single research run, and that budget turned out to be a rolling 24-hour window rather than a fixed daily reset.
- **No real provider logos are shown anywhere in the UI.** Several providers (Slack, LinkedIn, Microsoft) no longer permit third-party redistribution of their logo files at all, so every app gets the same colour-plus-initial treatment and its own live favicon (proxied, never bundled) for consistency and to avoid trademark risk.

## Limitations (stated plainly, as the project itself asks every guide to do)

- DevFili never creates a real provider app, so it has never seen a real approval end-to-end &mdash; every timeline and requirement is a report from documentation or other developers, not a direct measurement.
- "Tested" means a public page or documented step was independently re-checked by code at research time &mdash; never that someone completed the actual approval flow.
- Only the 9 library apps have an in-depth, reviewed guide; every other app is researched live and has not been human-reviewed.
- This is research to help you plan, not legal or compliance advice.
- Provider rules change; every guide shows the date it was last verified.

## Verification

See `docs/VERIFICATION.md` for the full log. As of this writing: the 6 library guides without firsthand developer experience behind them (Slack, Gong, Notion, Linear, Google/Gmail, LinkedIn) have been self-reviewed against their own official sources with no corrections needed; Zoom, Microsoft Teams, and HubSpot are drafted and link-checked but still await the product owner's own section-by-section read against real experience with those three; the formal 25-claim spot-check across multiple apps has not yet been run.
