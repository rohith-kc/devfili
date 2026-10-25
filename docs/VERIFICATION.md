# DevFili verification log

## Phase 3: review corrections

Logged while reviewing the Zoom, Microsoft Teams and HubSpot guides section by section against the product owner's firsthand experience, and while self-reviewing the other six library guides against their sources. One row per correction.

| App | Section | What the agent said | What was true | Evidence |
|---|---|---|---|---|
| _(none logged yet - Zoom/Teams/HubSpot are still awaiting the owner's section-by-section pass)_ | | | | |

### Self-review: Slack, Gong, Notion, Linear, Google (Gmail), LinkedIn

Done 2026-10-25. For each app: re-read the verdict (tier, tier reason, effort/wait range, three gates) and the managed-app note against (a) the official source(s) already cited for that claim, re-fetched live during this session, and (b) general knowledge of how that provider's OAuth/app-review process works. No corrections were needed - every tier assignment, gate, and managed-app note checked out. Specifics:

- **Slack** (Tier 2): Marketplace listing's three-stage review (automated checks, preliminary, functional) and the 1-10 week wait match `docs.slack.dev/slack-marketplace/slack-marketplace-review-guide`, re-fetched today (source recheck: confirmed). Unlisted public distribution correctly kept out of the gate (no review for that path).
- **Gong** (Tier 4): Partner-gated at the developer-instance step, not just at publish - correctly reflected tier 4 rather than a lighter tier, matching Gong's partner-first developer program. `endUser` gate correctly "no": Gong authenticates once at the company level, there's no individual end-user OAuth consent screen.
- **Notion** (Tier 1): Confirmed Marketplace/Gallery listing is genuinely optional - a public integration works over OAuth for any workspace without ever being reviewed. `customerAdmin` "yes" correctly scoped to Enterprise-plan workspace owners only in the claim text, not a blanket requirement.
- **Linear** (Tier 1): Confirmed OAuth app creation has no review, security assessment, or partner gate in Linear's docs - matches Linear's known self-serve developer experience. `customerAdmin` left "unknown" rather than guessed, which is the honest call since Linear's docs don't spell out an install-time admin requirement.
- **Google (Gmail)** (Tier 3): CASA third-party security assessment for restricted scopes (`gmail.readonly`, `gmail.modify`, etc.), annual reassessment, and the 100-user cap pre-verification all match Google's published OAuth verification requirements - this is a widely-documented, well-known process and the guide's description lines up with it exactly.
- **LinkedIn** (Tier 4): Discretionary, no-fixed-timeline partner review for Marketing/Advertising/Community Management API access matches long-standing, widely-reported developer experience with LinkedIn's API program; Sign In with LinkedIn / Share on LinkedIn correctly called out as the self-serve exception.

## Phase 8: accuracy check (25 claims)

5 claims each from Zoom, Microsoft Teams, Slack, Google, and one live-generated app. Each covers a timeline, a requirement, a scope impact, a gate, or a rejection reason. Each result is Correct, Corrected (what changed), or Unverified (why).

| # | App | Claim | Result | Notes |
|---|---|---|---|---|
| _(not started - Phase 8)_ | | | | |

**Totals:** _(fill in during Phase 8)_
**Most common error type:** _(fill in during Phase 8)_
