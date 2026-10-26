# DevFili technical spec

Read `docs/PRD.md` first. This file says how to build it.

## 1. Constraints that shape the design (verified Oct 2026; re-check when in doubt)
- **Vercel Hobby:** functions run at most 300 s. The research route sets `export const maxDuration = 300` and enforces its own deadline `RESEARCH_DEADLINE_SECONDS` (default 240). Nothing may continue after the response ends. No in-memory state between requests (serverless).
- **Gemini free tier:** per-model limits are not published; they appear only in the AI Studio rate-limit console and are per project. Free-tier requests may be used by Google to improve products, so send only public page content and non-sensitive text. Budget: about 3 Gemini calls per guide (2 research calls in parallel plus 1 check call).
- **Gemini key format:** AI Studio now issues keys starting `AQ.`. Some users report these return 401 `ACCESS_TOKEN_TYPE_UNSUPPORTED` on the REST/SDK endpoint. `check-keys` must detect this and recommend `PROVIDER_RESEARCH=groq` and `PROVIDER_CHECK=groq`.
- **Groq:** strict structured output (constrained decoding) works only on `openai/gpt-oss-20b` and `openai/gpt-oss-120b`; it does not work with streaming or tool use. Draft calls are therefore non-streaming. Other models use JSON-object mode plus zod validation and one retry. Groq Compound (`groq/compound`, `groq/compound-mini`) has built-in `web_search` and `visit_website`; compound-mini makes one tool call per request. Compound max output is 8,192 tokens. Compound is the research fallback.
- **Web page reading by models** cannot render JavaScript-only pages. Such sources become "Sourced, not re-checked" or the guide is marked Incomplete; never invent content.
- **Supabase free projects pause after about a week of inactivity.** Therefore library guides are static JSON in the repo and the home page and library guide pages must work with the database down. The database holds only saved guides, the research cache and rate-limit counters. Every database failure degrades gracefully (cache miss, fail-safe rate limit, "saving is temporarily unavailable").
- No Anthropic SDK or key is available. Do not add it.

## 2. Stack
Next.js (latest stable, App Router, TypeScript strict) with Tailwind CSS; `zod`; `zod-to-json-schema`; `@google/genai` (Gemini, native); `openai` (used against the Groq base URL, and - optional third fallback tier only - the OpenRouter base URL); `@supabase/supabase-js` and `@supabase/ssr`; `node-html-parser` (HTML to text for probes); `p-limit`; `vitest`; `tsx` (scripts). Deploy to Vercel Hobby. Node runtime for all route handlers (`export const runtime = 'nodejs'`, `export const dynamic = 'force-dynamic'` for research and helper routes).

## 3. Repository layout
```
CLAUDE.md
docs/{PRD.md,SPEC.md,PROMPTS.md,BUILD_PLAN.md,DECISIONS.md,VERIFICATION.md}
.env.example
content/apps.json                      # the 9 library apps, order, aliases
content/library/<slug>.json            # reviewed guides (committed)
content/library/drafts/<slug>.json     # generated, awaiting review
supabase/migrations/0001_init.sql
scripts/{check-keys.ts,research.ts,library-generate.ts,library-validate.ts,library-links.ts,scan-secrets.ts}
src/app/page.tsx                       # home
src/app/guide/[slug]/page.tsx          # library guide (static from JSON)
src/app/g/[id]/page.tsx                # saved guide (public by id)
src/app/my-guides/page.tsx
src/app/auth/callback/route.ts
src/app/api/research/route.ts          # POST, SSE
src/app/api/guides/route.ts            # GET mine, POST save
src/app/api/guides/[id]/route.ts       # GET public by id, DELETE owner
src/app/api/helpers/[helper]/route.ts  # POST
src/app/api/health/route.ts            # GET, light DB ping
src/components/*                       # Header, Logo, Hero, AppGrid, AppTile, ChatPanel, GuideView, Verdict, EvidenceBadge, OwnerTag, HelpersRail, SectionX...
src/lib/{schema.ts,tier.ts,evidence.ts,confidence.ts,completeness.ts,ranges.ts,normalize.ts}
src/lib/llm/{router.ts,gemini.ts,groq.ts,json.ts}
src/lib/research/{pipeline.ts,resolve.ts,discover.ts,probe.ts,draft.ts,check.ts,finalize.ts,cache.ts}
src/lib/safety/{ssrf.ts,secrets.ts,ratelimit.ts}
src/lib/supabase/{server.ts,browser.ts,admin.ts}
tests/**                               # vitest
```

## 4. Environment variables (`.env.example`, all server-only unless `NEXT_PUBLIC_`)
```
GEMINI_API_KEY=
GEMINI_OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/   # only for the OpenAI-compatible fallback
GEMINI_MODEL_RESEARCH=            # chosen from check-keys output, e.g. a Flash model
GEMINI_MODEL_CHECK=
GROQ_API_KEY=
GROQ_BASE_URL=https://api.groq.com/openai/v1
GROQ_MODEL_DRAFT=openai/gpt-oss-120b
GROQ_MODEL_FAST=llama-3.3-70b-versatile
GROQ_MODEL_COMPOUND=groq/compound
OPENROUTER_API_KEY=                # optional - third fallback tier, after Gemini and Groq both fail
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct
PROVIDER_RESEARCH=gemini          # gemini | groq
PROVIDER_CHECK=gemini             # gemini | groq
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # secret, server only
NEXT_PUBLIC_SITE_URL=http://localhost:3000
LIVE_RUNS_PER_GUEST_PER_DAY=5
LIVE_RUNS_PER_USER_PER_DAY=15
LIVE_RUNS_GLOBAL_PER_DAY=150
HELPER_RUNS_PER_DAY=30
RESEARCH_CACHE_DAYS=7
RESEARCH_DEADLINE_SECONDS=240
IP_HASH_SALT=                     # any long random string
```
Model IDs are examples; the user confirms real ones from `npm run check-keys`.

## 5. Database (`supabase/migrations/0001_init.sql`)
```sql
create table public.guides (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  app_slug text not null,
  app_name text not null,
  guide jsonb not null,
  created_at timestamptz not null default now()
);
create index guides_owner_idx on public.guides(owner_id, created_at desc);
alter table public.guides enable row level security;
create policy "owner reads own" on public.guides for select using (auth.uid() = owner_id);
create policy "owner inserts own" on public.guides for insert with check (auth.uid() = owner_id);
create policy "owner deletes own" on public.guides for delete using (auth.uid() = owner_id);

create table public.research_cache (
  app_key text primary key,
  guide jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.research_cache enable row level security;   -- no policies: service role only

create table public.live_runs (
  bucket text not null,        -- 'ip:<hash>' | 'user:<uuid>' | 'global' | 'helper:<hash or uuid>'
  day date not null,
  count int not null default 0,
  primary key (bucket, day)
);
alter table public.live_runs enable row level security;        -- service role only

create function public.bump_live_run(p_bucket text, p_day date) returns int
language sql security definer set search_path = public as $$
  insert into public.live_runs(bucket, day, count) values (p_bucket, p_day, 1)
  on conflict (bucket, day) do update set count = public.live_runs.count + 1
  returning count;
$$;
revoke all on function public.bump_live_run(text, date) from public, anon, authenticated;
grant execute on function public.bump_live_run(text, date) to service_role;
```
Public read of a saved guide by id goes through `GET /api/guides/[id]` using the service-role client (never expose a public select policy: it would allow listing every guide). Display name and avatar come from the auth user metadata; do not copy them into tables. Guide ids are unguessable UUIDs.

## 6. Guide schema (`src/lib/schema.ts`, zod). Models never write labels, tier, confidence or completeness.
```ts
export const Label = z.enum(['tested','sourced','uncertain']);
export const SourceType = z.enum(['official','community','vendor']);
export const Source = z.object({
  url: z.string().url(), title: z.string(), type: SourceType,
  accessedOn: z.string(),                 // YYYY-MM-DD
  publishedYear: z.number().int().nullable(),
  oldSource: z.boolean(),                 // community/vendor and older than 2 years
  recheck: z.enum(['confirmed','not_rechecked','mismatch']),   // from the probe stage
});
export const Claim = z.object({
  id: z.string(),                         // c1, c2, ...
  text: z.string(),                       // paraphrased, plain, <= 40 words
  label: Label,                           // set by evidence.ts
  sources: z.array(Source),
  testNote: z.string().nullable(),        // e.g. "Fetched <url> on 2026-10-24; page lists scope X"
  uncertainReason: z.string().nullable(),
  checked: z.enum(['supported','partial','unchecked']),        // from the check stage
});
export const Range = z.object({
  min: z.number(), max: z.number(),
  unit: z.enum(['hours','days','business_days','weeks']),
  basis: z.enum(['official','reported','estimated']),
  claimId: z.string().nullable(),
});
export const GateState = z.enum(['yes','no','unknown']);
export const Gate = z.object({ applies: GateState, who: z.string(), what: z.string(), claims: z.array(Claim) });
export const Step = z.object({
  n: z.number().int(), title: z.string(), detail: z.string(),
  owner: z.enum(['agent_did','agent_drafted','you_do']),
  effort: Range.nullable(),               // only for you_do
  linkUrl: z.string().url().nullable(),   // resolved from a finding, never typed by a model
  helper: z.enum(['checklist','scope_justification','test_plan','admin_note','pre_submission']).nullable(),
  claims: z.array(Claim),
});
export const Guide = z.object({
  schemaVersion: z.literal(1),
  app: z.object({ name: z.string(), slug: z.string(), websiteUrl: z.string().url().nullable() }),
  kind: z.enum(['library','live']),
  sample: z.boolean(),                    // true only for fixtures
  lastVerifiedOn: z.string(),
  handVerified: z.object({ by: z.string(), on: z.string() }).nullable(),
  completeness: z.object({ status: z.enum(['complete','incomplete']), thinSections: z.array(z.string()) }),
  verdict: z.object({
    tier: z.union([z.literal(1),z.literal(2),z.literal(3),z.literal(4)]).nullable(),
    tierReason: Claim,
    effort: Range.nullable(), wait: Range.nullable(),
    gates: z.object({ provider: GateState, customerAdmin: GateState, endUser: GateState }),
    gatedAccess: z.boolean(),
    confidence: z.enum(['high','medium','low']),
    scopeForks: z.array(Claim),
  }),
  managedApp: z.object({ exists: GateState, claim: Claim.nullable(), whatYouLose: z.array(Claim), whenToSwitch: z.array(Claim) }),
  howItWorks: z.object({ flow: z.array(Claim), appTypes: z.array(Claim), tokenNotes: z.array(Claim) }),
  scopes: z.array(z.object({ scope: z.string(), allows: z.string(), neededFor: z.string(),
    reviewImpact: z.enum(['none','verification','security_assessment','partner','unknown']), claim: Claim })),
  prerequisites: z.array(z.object({ item: z.string(),
    kind: z.enum(['account','business','domain','policy_page','test_account','demo_video','partner','fee','other']), claim: Claim })),
  steps: z.array(Step),
  gates: z.object({ provider: Gate, customerAdmin: Gate, endUser: Gate }),
  stuckPoints: z.array(z.object({ reason: z.string(), fix: z.string(), escalation: z.string().nullable(), claim: Claim })),
  whileYouWait: z.array(Claim), keepsComingBack: z.array(Claim), hardToUndo: z.array(Claim),
  derived: z.object({ unverifiedClaimIds: z.array(z.string()), sources: z.array(Source) }),
  tile: z.object({ tier: z.number().nullable(), effort: Range.nullable(), wait: Range.nullable(),
    gated: z.boolean(), customerAdmin: GateState }),
});
```
**LLM-facing draft schemas** are separate, flat, every field required, `nullable` instead of optional, `additionalProperties: false` (so Groq strict mode accepts them). Claims in drafts are `DClaim = { text: string, findingIds: string[] }`. Models cite ONLY finding IDs (and probe IDs) given in the prompt; they never output URLs, labels, tiers or confidence.
```ts
const DClaim = z.object({ text: z.string(), findingIds: z.array(z.string()), probeIds: z.array(z.string()) });
const Fact = z.object({ value: z.boolean().nullable(), claim: DClaim.nullable() });
export const DraftCore = z.object({
  facts: z.object({ partnerGated: Fact, securityAssessment: Fact, reviewRequired: Fact,
                    customerAdminLikely: Fact, userCapBeforeApproval: Fact }),
  tierReason: DClaim,
  wait: z.object({ min: z.number(), max: z.number(), unit: z.enum(['hours','days','business_days','weeks']), claim: DClaim }).nullable(),
  scopeForks: z.array(DClaim),
  managedApp: z.object({ exists: z.enum(['yes','no','unknown']), claim: DClaim.nullable(), whatYouLose: z.array(DClaim), whenToSwitch: z.array(DClaim) }),
  howItWorks: z.object({ flow: z.array(DClaim), appTypes: z.array(DClaim), tokenNotes: z.array(DClaim) }),
  scopes: z.array(z.object({ scope: z.string(), allows: z.string(), neededFor: z.string(),
    reviewImpact: z.enum(['none','verification','security_assessment','partner','unknown']), claim: DClaim })),
  prerequisites: z.array(z.object({ item: z.string(), kind: z.enum(['account','business','domain','policy_page','test_account','demo_video','partner','fee','other']), claim: DClaim })),
});
export const DraftPath = z.object({
  steps: z.array(z.object({ title: z.string(), detail: z.string(), owner: z.enum(['agent_did','agent_drafted','you_do']),
    effortHours: z.object({ min: z.number(), max: z.number() }).nullable(),
    linkFindingId: z.string().nullable(), helper: z.enum(['checklist','scope_justification','test_plan','admin_note','pre_submission']).nullable(),
    claims: z.array(DClaim) })),
  gates: z.object({ provider: DGate, customerAdmin: DGate, endUser: DGate }),   // DGate = {applies, who, what, claims: DClaim[]}
  stuckPoints: z.array(z.object({ reason: z.string(), fix: z.string(), escalation: z.string().nullable(), claim: DClaim })),
  whileYouWait: z.array(DClaim), keepsComingBack: z.array(DClaim), hardToUndo: z.array(DClaim),
});
```

## 7. Deterministic logic (all in `src/lib`, all unit tested; this is what makes the product trustworthy)
**evidence.ts** `labelClaim(dclaim, findings, probes) -> {label, sources, testNote, uncertainReason}`:
1. Resolve `findingIds`/`probeIds`; drop unknown IDs (hallucinated IDs).
2. `tested` if any cited probe passed (probe = our server re-opened a page and every `mustContain` term was present). Never `tested` for wait/effort ranges or any timeline.
3. else `sourced` if at least one valid finding remains. Each Source gets `recheck`: `confirmed` (the finding's excerpt was found in the page text we fetched), `not_rechecked` (page unreadable: JavaScript-only, blocked, timeout), `mismatch` (page readable but fragment absent). If ALL sources are `mismatch` or the URL returned 404 -> `uncertain` with reason "quoted fragment not found at source" or "source could not be opened".
4. else `uncertain` with reason "no supporting source".
5. If the check stage says `unsupported` or `conflict` -> `uncertain` with the checker's reason. `partial` keeps the label and sets `checked: 'partial'`.
6. `oldSource` = type is community or vendor and `publishedYear` is at least 2 years before today.

**tier.ts** `computeTier(facts) -> {tier: 1|2|3|4|null, reasonKey}`, first match wins: `partnerGated.value === true` -> 4; `securityAssessment.value === true` -> 3; `reviewRequired.value === true` -> 2; all three values explicitly `false` -> 1; otherwise `null` (Unknown, reason "no review information found"). A fact with value `false` whose claim is Uncertain still gives its tier but forces confidence to Low. Customer admin is not part of the tier: `gates.customerAdmin` comes from `facts.customerAdminLikely` (`true` -> yes, `false` -> no, `null` -> unknown). `gatedAccess = tier === 4`.

**ranges.ts** `effort` = sum of `effortHours` over `you_do` steps (min and max), unit hours; display as days when over 16 hours (8-hour day). `wait` unit stays as given. `basis` per range: `official` if the cited claim has an official source and is not Uncertain; `reported` if only community/vendor sources; `estimated` if no source (then the claim is Uncertain). `formatRange` examples: "2-4 hours", "1-3 weeks", "7-10 business days". Never output a single combined effort+wait number.

**confidence.ts**: `high` if tier is non-null, all tier-fact claims are not Uncertain, and the wait range basis is `official`; `low` if tier is null, or wait basis is `estimated`, or any tier-fact claim is Uncertain, or the only sources are community older than 2 years; otherwise `medium`.

**completeness.ts**: Complete only if tier non-null, scopes >= 1, prerequisites >= 1, steps >= 3 and every step has an owner, all three gates present, stuckPoints >= 2, and each of these sections has at least one non-Uncertain claim. Else Incomplete with `thinSections` listing section names.

**finalize.ts** builds the full `Guide` from `DraftCore` + `DraftPath` + findings + probes + check results: assigns claim IDs `c1..`, labels, derives `derived.unverifiedClaimIds` and de-duplicated `derived.sources`, computes tier, ranges, confidence, completeness, `tile`, sets `lastVerifiedOn = today`, validates with `Guide.parse`. Step `linkUrl` resolves from `linkFindingId` only.

## 8. Research pipeline (`src/lib/research/pipeline.ts`)
Deadline: `RESEARCH_DEADLINE_SECONDS` from request start; each stage gets a budget (resolve 10 s, discover 70 s, probe 20 s, draft 45 s, check 55 s, finalize 5 s). Emit SSE `status` events as stages start and finish. Several stages may be active at once.

0. **Resolve** (`resolve.ts`): normalize the query (trim, lower-case; if a URL, take the hostname without `www`). If it matches a library slug or alias in `content/apps.json` -> return `{type:'library', slug}` (no model call). Else call Groq FAST (JSON-object mode, zod-validated) with the Resolve prompt: `{status:'ok'|'ambiguous'|'not_found', app:{name,slug,websiteUrl}|null, candidates:[{name,websiteUrl,description}], note}`. `ambiguous` -> emit SSE `question` with candidates and end the stream; the client re-submits `{query, choice}`. Then check `research_cache` for `app.slug` newer than `RESEARCH_CACHE_DAYS` -> emit `result` with `cached:true`.
1. **Limits**: only for non-cached runs, bump counters (see section 11). On exceed -> `error: rate_limited`.
2. **Discover** (`discover.ts`), two Gemini calls IN PARALLEL with `googleSearch` and `urlContext` tools: R1 "official" (docs, registration, scopes, review, prerequisites, customer admin, recurring, managed app) and R2 "community" (real timelines, rejections, admin-consent problems, escalation). Output is JSON in the reply text (tools and constrained JSON do not combine reliably): parse the first fenced ```json block or first top-level object, validate with zod `Findings`, on parse failure do ONE repair call on Groq FAST. A `Finding` = `{topic, statement (paraphrase, <= 40 words), sourceUrl, sourceTitle, sourceType, publishedYear|null, excerpt (<= 20 words, exact fragment from the page), checkable: {url, mustContain: string[]}|null}`. After both calls, reassign IDs `F1..Fn`, de-duplicate by URL+statement, cap at 60. Fallback if `PROVIDER_RESEARCH=groq` or Gemini fails twice: Groq `GROQ_MODEL_COMPOUND` with the same prompts and its built-in web tools, same parsing.
3. **Probe** (`probe.ts`): for each distinct `sourceUrl` (cap 15) and each `checkable` (cap 10): fetch with the SSRF guard, 8 s timeout, max 1.5 MB, at most 3 redirects, identify as `DevFiliBot/1.0`; convert HTML to text; normalize whitespace, case and punctuation; record `{id:'P1..', url, status, readable (text length >= 500), excerptFound, mustContainAll}`. `Source.recheck`: `confirmed` if excerpt found, `mismatch` if readable and not found, `not_rechecked` if unreadable/blocked/timeout. A probe "passes" (enables Tested) only if the page is readable and every `mustContain` term is present.
4. **Draft** (`draft.ts`): two Groq calls IN PARALLEL on `GROQ_MODEL_DRAFT`, non-streaming: DraftCore and DraftPath. Use `response_format: json_schema` with `strict: true` when the model is `openai/gpt-oss-20b|120b`; otherwise JSON-object mode, zod validation, one retry. Inputs: app, findings (id, topic, statement, sourceType, publishedYear, recheck) and probes. If output is truncated or invalid after retry, fail the stage with `provider_busy`/`internal`.
5. **Pre-finalize**: run `finalize` to get labels, tier, ranges, confidence, completeness.
6. **Check** (`check.ts`): ONE Gemini call (second call only if more than 10 distinct URLs) with `urlContext`: the claims (prioritize wait/effort, tier facts, gates, scopes, then others; cap 40) each with its source URLs; reply `[{claimId, verdict:'supported'|'partial'|'unsupported'|'conflict', reason}]`. Apply per section 7 rule 5, then re-run finalize. If the check provider is unavailable, run a weaker check on Groq FAST using stored excerpts only and set every non-tested claim's `checked` to `partial`. If the deadline is reached, skip the check, cap every non-tested claim at `uncertain` with reason "not checked in time", and mark the guide Incomplete.
7. **Present**: emit `result {guide, cached:false, researchedAt}`, write `research_cache` (best effort), end with `done`.

**Provider routing** (`src/lib/llm/router.ts`): tasks `resolve -> groq FAST`, `discover -> PROVIDER_RESEARCH`, `draft -> groq DRAFT`, `check -> PROVIDER_CHECK`, `helper -> groq FAST`. On 429/5xx/timeout: retry once after 1-2 s jittered backoff, then fall back (gemini <-> groq equivalents; draft falls back to Gemini with JSON mode). **OpenRouter third tier** (`src/lib/llm/openrouter.ts` and `chain.ts`, optional - only used when `OPENROUTER_API_KEY` is set; a last fallback by default, but the first choice for every stage when it is the only configured key or `PRIMARY_PROVIDER=openrouter` is set - the one-key mode for reviewers. `OPENROUTER_BASE_URL` may be any OpenAI-compatible endpoint; `:online` search is used only on openrouter.ai unless `OPENROUTER_WEB_SEARCH=on`): `resolve`, `discover` (via `:online` model suffix, OpenRouter's web-search plugin - the equivalent of Groq's `browser_search`), and `check` each fall back to OpenRouter once Gemini and Groq have both failed for that call. Only when every configured tier failed -> SSE `error: provider_busy`. Log provider, model, stage, duration, token counts if returned; never keys, never full prompts. (Added 2026-10-25 after Groq's `browser_search` repeatedly exhausted its own daily token budget in a single research run - see `docs/DECISIONS.md`.)

## 9. SSRF guard (`src/lib/safety/ssrf.ts`) for every server-side fetch of a model-supplied URL
Allow only `http:` and `https:`; resolve DNS and block loopback, private (10/8, 172.16/12, 192.168/16), link-local (169.254/16, includes cloud metadata), CGNAT (100.64/10), IPv6 loopback/ULA/link-local, and `localhost`/`.internal`/`.local` hosts; re-check after every redirect; no credentials in URL; cap ports to 80/443. Unit test with hostile URLs.

## 10. Helper endpoints (`POST /api/helpers/[helper]`)
Body `{guide, inputs}` (validate guide with `Guide`, inputs max 4,000 chars). Reject inputs that look like secrets (`src/lib/safety/secrets.ts`: patterns such as `AQ\.[A-Za-z0-9_-]{20,}`, `AIza[0-9A-Za-z_-]{20,}`, `gsk_[A-Za-z0-9]{20,}`, `sk-[A-Za-z0-9]{20,}`, `ghp_[A-Za-z0-9]{20,}`, `xox[abp]-`, JWT `eyJ[A-Za-z0-9_-]{10,}\.`, `-----BEGIN .* PRIVATE KEY-----`, and "password:"-style lines) with HTTP 400 "That looks like a secret; remove it". `checklist` and `pre_submission` are pure code (no endpoint call needed client-side). `scope_justification`, `test_plan`, `admin_note` call Groq FAST with the prompts in `docs/PROMPTS.md`, using only guide facts (claim text plus label) and the user's inputs. Response `{draft: markdown, factsUsed: string[]}`. Every draft is shown with "Draft: review before use". Inputs and drafts are never stored or logged. `admin_note` is disabled in the UI when `gates.customerAdmin.applies === 'no'`. Rate limit `HELPER_RUNS_PER_DAY` per user or IP.

## 11. API, streaming, auth, limits
**`POST /api/research`** body `{query: string, choice?: {name, websiteUrl}}` -> `text/event-stream`. Events: `status {stage:1-8, key, state:'active'|'done', message}`; `question {text, candidates[]}`; `result {guide, cached, researchedAt}`; `error {code:'invalid_input'|'not_found'|'no_oauth'|'rate_limited'|'provider_busy'|'timeout'|'internal', message}`; `done {}`. Send a comment heartbeat (`: ping`) every 15 s. Client parses SSE from a `fetch` ReadableStream (EventSource is GET-only). Input: 2-200 chars, trimmed.
**`POST /api/guides`** (auth) body `{guide}` -> validate with `Guide`, force `kind:'live'`, insert with `owner_id = auth.uid()` -> `{id, url:'/g/<id>'}`. **`GET /api/guides`** (auth) -> mine, newest first. **`GET /api/guides/[id]`** public via service role (404 JSON if missing). **`DELETE /api/guides/[id]`** (auth, owner only via RLS).
**Auth:** Supabase Auth, GitHub provider only. `signInWithOAuth({provider:'github', options:{redirectTo: NEXT_PUBLIC_SITE_URL + '/auth/callback'}})`; callback exchanges the code for a session (`@supabase/ssr` cookies). Do not request repo scopes; request nothing beyond what Supabase's GitHub provider needs for identity, store nothing from GitHub except what Supabase keeps in the auth user (id, display name, avatar), read no email, keep no GitHub tokens. Header shows name and avatar and a link to My guides.
**Rate limits** (non-cached live runs only): guests by `ip:<sha256(ip + IP_HASH_SALT)>` (`LIVE_RUNS_PER_GUEST_PER_DAY`), signed-in by `user:<uuid>` (`LIVE_RUNS_PER_USER_PER_DAY`), plus `global` (`LIVE_RUNS_GLOBAL_PER_DAY`). Counters via `bump_live_run` with the service-role client; day = UTC date. If the database is unreachable, allow at most 2 runs per instance per hour from memory (fail safe), and never block library pages.
**Cache:** `research_cache` keyed by normalized app slug, TTL `RESEARCH_CACHE_DAYS`. A cached result shows "Researched on <date>". Library apps never trigger research.

## 12. Frontend spec
Pages: `/` home; `/guide/[slug]` (library, statically generated from `content/library/*.json`, works with DB down); `/g/[id]` saved guide (server-fetched via `GET /api/guides/[id]` logic; clear not-found page); `/my-guides` (redirects guests to sign-in prompt).
Components: **Header** (Logo, chat button, Sign in or name+avatar menu with My guides and Sign out), **Hero** (one-line "what you can do" plus three short points: size it, prepare it, share it; proposed copy, easy to edit in one file), **AppGrid/AppTile** (3 columns on laptop, 1 column on phone; tile = name, tier badge with plain name e.g. "Tier 2 Reviewed", effort and wait strings, flags Gated and Customer admin, Hand-verified badge), **ChatPanel** (slide-over from top right; input; stage list with states pending/active/done; clarifying-question buttons; result card with "Open guide" and "Save to my guides"; error states; guests who click Save are prompted to sign in), **GuideView** (renders the 15 sections in order; section 2 Verdict card shows tier, reason, effort and wait as two separate figures with basis chips, gate flags, confidence, completeness flag), **EvidenceBadge** (icon plus text: Tested check, Sourced link, Uncertain question mark with dashed outline; click or focus opens a popover with source type, title, link, access date, age, "old source" mark, re-checked state, test note or uncertain reason), **OwnerTag** (Agent did / Agent drafted / You do with icons), **HelpersRail** (sticky on laptop; below the verdict on phone; five helpers; panels with form, result, Copy button, the draft banner), **ChecklistHelper** and **PreSubmissionHelper** (tick boxes in React state, "N remaining", copy as text).
Visual: clean, light, generous spacing; one accent blue; system font stack; no gradients or shadows beyond one subtle card shadow; the Logo is an inline SVG of two overlapping circles plus the "DevFili" wordmark.
Accessibility: semantic headings per section, focus rings, labels not conveyed by colour alone, popovers keyboard-operable (Esc closes), SSE status list in an `aria-live="polite"` region, contrast at least 4.5:1.
Sample marking: any fixture guide renders a visible "Sample" banner (`sample: true`).

## 13. Library content workflow
`content/apps.json`: array of `{slug,name,websiteUrl,aliases[],order}` for the nine apps in tile order (zoom, slack, gong, hubspot, notion, linear, microsoft-teams, google-gmail, linkedin). `npm run library:generate -- <slug...>` runs the same pipeline from a script (no SSE) and writes `content/library/drafts/<slug>.json`. A person reviews; approved files move to `content/library/<slug>.json` with `kind:'library'`, `handVerified` set when the owner has reviewed (Zoom, Microsoft Teams, HubSpot). `library:validate` parses every file with `Guide`, runs the completeness and labeling checks (tests T3/T4 rules), and fails on unlabeled claims or missing sections. `library:links` HEAD/GET checks every source URL and writes a report. Corrections made during review are logged in `docs/VERIFICATION.md` (what the agent said, what was true, source).

## 14. Scripts
`check-keys` (loads `.env.local`, never prints keys): for Groq: list models, tiny completion, strict `json_schema` call on `GROQ_MODEL_DRAFT`; for Gemini: list models, tiny generation, a `googleSearch` tool call, a `urlContext` call; for OpenRouter, only if `OPENROUTER_API_KEY` is set (otherwise reports it as optional and passes): a tiny completion plus a `:online` web-search call on `OPENROUTER_MODEL`; for Supabase when configured: reachability and auth settings. Print PASS/FAIL per check with next steps. Detect Gemini 401 `ACCESS_TOKEN_TYPE_UNSUPPORTED` and print the AQ-key explanation and the `PROVIDER_*=groq` fallback. List available model IDs so the user can choose. `scan-secrets` greps tracked and staged files for the secret patterns in section 10 plus `service_role` and `.env` contents; exit non-zero on a hit. `research -- "<app>"` runs the pipeline and prints stages, then the guide JSON and a human summary.

## 15. Security checklist
Keys server-only; `.env*` gitignored; render all guide text as text (no `dangerouslySetInnerHTML`); outbound links get `rel="noopener noreferrer nofollow"` and show the domain; zod on every boundary; SSRF guard; secret-pattern guard on helper inputs; fetched web text wrapped in delimiters and labeled untrusted in every prompt; no model tool can act on an account; service-role client only in server code; logs contain no secrets, no helper inputs; response size caps; basic security headers via `next.config`.

## 16. Test plan (vitest) and manual checks
Unit: `tier` (all branches including Unknown), `evidence` (hallucinated IDs, mismatch, not_rechecked, tested), `confidence`, `completeness`, `ranges` (effort sum, day conversion, formatRange), `ssrf` (hostile URLs), `secrets` (patterns), `json` extraction/repair, `schema` against the sample fixture, `finalize` against recorded fixtures. Manual: product tests T1-T14 in `docs/PRD.md`, run with the fixture and then with real guides.
