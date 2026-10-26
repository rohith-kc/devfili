# DevFili

**How hard is it to get your OAuth app approved?**

DevFili tells a developer, before they write a line of integration code, how hard it will be to get an OAuth app approved for a given provider: a difficulty tier, two separate numbers (your own effort vs. the wait on the provider), the prerequisites, the three approval gates (provider review, customer admin, end user), and who does each step &mdash; the research agent or the developer. It ships 9 in-depth, hand-reviewed or source-checked guides (Zoom, Slack, Gong, HubSpot, Notion, Linear, Microsoft Teams, Google/Gmail, LinkedIn), plus live research for any other OAuth app.

"Fili" is Greek for friend &mdash; the idea is the friend who already went through a provider's approval process and wrote down exactly what to expect.

**Live:** https://devfili.vercel.app/
**Source:** https://github.com/rohith-kc/devfili

## What's actually working right now

- **The 9 library guides** &mdash; browse, search, and filter by tier/gated on the home page; every guide page shows the verdict, scopes, steps, the three gates, and evidence you can click through to the real source.
- **Live research** ("Check an app") &mdash; type any other app name and it researches, drafts, and fact-checks a guide live, streaming progress as it goes.
- **Name-only sign-in and "My guides."** No password, no server account &mdash; just a name, stored in your browser's `localStorage` (`src/lib/localUser.ts`), used to label guides you save on that device. The first visit shows a welcome screen explaining what DevFili is for and asks for your name, then drops you into the library. A **Profile** button in the header opens a side panel with your name and saved guides (research an app live, click "Save to my guides"); `/my-guides` shows them in full. Every guide tile and guide page has a **Save for later** button. Saves are kept in the browser and also copied to a `saved_guides` table in Supabase (run `supabase/migrations/0002_saved_guides.sql` once in the Supabase SQL editor), keyed by a random per-browser id, since there are no passwords.
- **Two code-only helpers** (checklist, pre-submission check) &mdash; tick boxes, "N remaining," copy as text.
- **Three AI-drafted helpers** (scope justification, reviewer test plan, customer admin note) &mdash; each pulls only from that guide's own cited facts, always shown with a "Draft: review before use" banner, never auto-sent anywhere.
- **Evidence labeling is never the model's call.** Every factual claim is labeled Tested, Sourced, or Uncertain by deterministic code (`src/lib/evidence.ts`) based on whether an automated check could independently re-confirm it &mdash; the model only ever proposes facts and cites which finding/source they came from.

## Not built yet

- **A real account system.** The sign-in above is deliberately minimal (a name, not a login) &mdash; it labels guides per-browser, not per-person, and there's no way to see your saved guides from a different device. A real account (and the ability to share a saved guide by link) is the natural next step if this needed to scale past a single take-home reviewer.

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

## How to test this project

There are three ways, from quickest to most thorough.

### Option 1: use the live site (nothing to install)

Open https://devfili.vercel.app/, type a name, and you are in the library.

- The 9 library guides, saving guides for later, and the Profile panel always work.
- "Check an app" (live research) and the three drafting helpers call AI providers using the author's **free-tier keys**. Each visitor gets 5 fresh live researches per day, the whole site gets 150, and a provider may occasionally be rate-limited. If you see "busy" or "rate-limited", try again later or use Option 2.
- Apps someone has already researched in the last 7 days load instantly and do not count against the limit.

### Option 2: run it on your own computer with your own keys (about 10 minutes)

You need **Node.js 20 or newer** (check with `node -v`), **git**, and **one** of these:

- **Easiest: a single OpenRouter key** (https://openrouter.ai/keys). OpenRouter is one account that can run almost any model, including **Claude, GPT and Gemini**, and it adds web search for you. Put the key in `OPENROUTER_API_KEY`, set `OPENROUTER_MODEL` to any model ID from https://openrouter.ai/models, and leave the Gemini and Groq keys blank. DevFili then runs every stage on that model.
- **Or free keys:** a Gemini key (https://aistudio.google.com/apikey) and a Groq key (https://console.groq.com/keys). An OpenRouter key is then an optional extra fallback.
- **Or your own gateway:** any OpenAI-compatible endpoint. Put its key in `OPENROUTER_API_KEY`, its URL in `OPENROUTER_BASE_URL`, its model in `OPENROUTER_MODEL`, and set `OPENROUTER_WEB_SEARCH=off`. Everything works, but live research then has no web search, so expect thinner results.

Research quality and speed depend on the model: a strong model gives clearly better guides than the small default.

1. Download the code and install it:

```bash
git clone https://github.com/rohith-kc/devfili.git
cd devfili
npm install
```

2. Create your settings file from the template (Mac/Linux, then Windows):

```bash
cp .env.example .env.local
```

```powershell
copy .env.example .env.local
```

3. Open `.env.local` in any text editor and paste your key(s) after the matching names, then save (for the one-key option, set `OPENROUTER_API_KEY=` and `OPENROUTER_MODEL=`). Leave everything else as it is. (`.env.local` is git-ignored, so your keys are never uploaded.)
4. Check the keys work. It prints PASS or FAIL for each provider and never shows a key:

```bash
npm run check-keys
```

5. Start the app and open http://localhost:3000:

```bash
npm run dev
```

6. Try it: enter a name, open a library guide (for example Slack), click **Save for later**, open **Profile**, then click **Check an app** and type an app such as Miro. The finished research opens as a full guide page.

**Using stronger models or more credits:** the models are just settings in `.env.local`. Change `OPENROUTER_MODEL`, `GEMINI_MODEL_RESEARCH`, `GEMINI_MODEL_CHECK`, `GROQ_MODEL_DRAFT` or `GROQ_MODEL_FAST` to any model your account can use (`npm run check-keys` lists the Gemini ones). To make OpenRouter the first choice even when other keys are set, add `PRIMARY_PROVIDER=openrouter`. To allow more tests per day, raise `LIVE_RUNS_PER_GUEST_PER_DAY` and `LIVE_RUNS_GLOBAL_PER_DAY`.

**Without Supabase:** leave the three `SUPABASE` settings blank and everything still works. Research results are not cached between restarts, daily limits are counted in memory, and saved guides stay in your browser only.

**With Supabase (optional, full setup):** create a free project at https://supabase.com, copy its project URL and service role key into `.env.local`, then in the Supabase **SQL Editor** run the three files in `supabase/migrations` in order (`0001_init.sql`, `0002_saved_guides.sql`, `0003_visitors.sql`). This turns on result caching, shared daily limits, saving guides to the database, and a `visitors` table of who entered a name.

**If something goes wrong**
- *"busy" or "rate-limited" on research:* a provider's free quota is used up. Wait, or use different keys or models.
- *`npm run check-keys` shows FAIL:* the key is wrong or has no access to that model. Re-copy it, and make sure there are no spaces or quotes around it.
- *Port 3000 already in use:* run `npm run dev -- -p 3001` and open http://localhost:3001.

### Option 3: deploy your own copy to Vercel

See [Deploying](#deploying) below. Import the repository into your own Vercel account and add the same settings as environment variables.

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

See `docs/VERIFICATION.md` for the full log. All 9 library guides have been self-reviewed against their own official sources (the verdict, every gate, and the managed-app note re-checked against each provider's real documentation) &mdash; no corrections were needed in any of the 9. The Phase 8 25-claim accuracy check is also done: 5 claims each from Zoom, Microsoft Teams, Slack, and Google/Gmail, plus 5 from a 10th app (Calendly) researched fresh and live for this check and run through the real pipeline. Result: 23 Correct, 1 Corrected (a wrong assumption about Calendly's scopes, caught and fixed before it was ever published &mdash; the project's own "no label, no claim" rule working as intended), 1 Unverified (a gate the source docs genuinely don't specify, correctly left "unknown" rather than guessed).

None of the 9 guides have `handVerified` set &mdash; that field specifically means a human checked the guide against their own firsthand use of the product, and that hasn't happened for any of them yet. What has happened is the independent self-review above.
