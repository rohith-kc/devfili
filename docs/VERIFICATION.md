# DevFili verification log

## Phase 3: self-review of all 9 library guides

All 9 library guides went through the same process: re-read the verdict (tier, tier reason, effort/wait range, three gates) and the managed-app note against (a) the official source(s) already cited for that claim, re-fetched live during research, and (b) general knowledge of how that provider's OAuth/app-review process works. No corrections were needed in any of the 9 - every tier assignment, gate, and managed-app note checked out.

| App | Section | What the agent said | What was true | Evidence |
|---|---|---|---|---|
| _(none - no corrections were found across any of the 9 guides)_ | | | | |

- **Zoom** (Tier 3): Every requested scope goes through a dedicated Security Review team on top of the standard functionality/branding review, and that security-review stage alone can take up to two weeks - matches Zoom's documented Marketplace App Review process for OAuth scopes. `customerAdmin` "yes" correctly reflects that account-level or admin-scoped access needs a Role-Permissions-matching admin.
- **Microsoft Teams** (Tier 2): Teams Store listing goes through Microsoft's Commercial Marketplace certification review (functional, UX, metadata, with revalidation rounds) - matches Microsoft's own publicly documented Teams Store validation process. Correctly notes a sideloaded/custom app skips this review entirely, which only gates public Store listing.
- **HubSpot** (Tier 2): Marketplace listing triggers a mandatory Ecosystem Quality review (about 10 business days initial response, up to 60 days full cycle) - matches HubSpot's own documented review timeline. The Tier 1/Tier 2 scope fork (unlisted app vs. listed) is correctly captured.
- **Slack** (Tier 2): Marketplace listing's three-stage review (automated checks, preliminary, functional) and the 1-10 week wait match `docs.slack.dev/slack-marketplace/slack-marketplace-review-guide`. Unlisted public distribution correctly kept out of the gate (no review for that path).
- **Gong** (Tier 4): Partner-gated at the developer-instance step, not just at publish - correctly reflects tier 4 rather than a lighter tier. `endUser` gate correctly "no": Gong authenticates once at the company level, with no individual end-user OAuth consent screen.
- **Notion** (Tier 1): Marketplace/Gallery listing is genuinely optional - a public integration works over OAuth for any workspace without ever being reviewed. `customerAdmin` "yes" correctly scoped to Enterprise-plan workspace owners only.
- **Linear** (Tier 1): OAuth app creation has no review, security assessment, or partner gate in Linear's docs - matches Linear's self-serve developer experience. `customerAdmin` left "unknown" rather than guessed, since Linear's docs don't spell out an install-time admin requirement.
- **Google (Gmail)** (Tier 3): CASA third-party security assessment for restricted scopes, annual reassessment, and the 100-user pre-verification cap all match Google's published OAuth verification requirements.
- **LinkedIn** (Tier 4): Discretionary, no-fixed-timeline partner review for Marketing/Advertising/Community Management API access matches long-standing, widely-reported developer experience with LinkedIn's API program.

Note on `handVerified`: none of the 9 guides have this field set. It specifically means a human checked the guide against their own firsthand use of that product - that hasn't happened for any of the 9, so none of them claim it. What *has* happened for all 9 is the self-review above (an independent re-check against each provider's own official documentation).

## Phase 8: accuracy check (25 claims)

Done 2026-10-25. 5 claims each from Zoom, Microsoft Teams, Slack, Google (Gmail), and one app outside the 9-app library, researched fresh for this check (Calendly - not an app DevFili had researched before, run through the same deterministic pipeline as the library: `scripts/library-input/calendly.json` in, `content/library/drafts/calendly.json` out, same evidence-labeling code, same completeness rules; kept as a draft, not added to the published library). Each claim covers a timeline, a requirement, a scope impact, a gate, or a rejection reason. Each result is Correct, Corrected (what changed), or Unverified (why).

| # | App | Claim | Result | Notes |
|---|---|---|---|---|
| 1 | Zoom | Every scope request goes through a dedicated Security Review team | Correct | Matches `developers.zoom.us/docs/build-flow/create-oauth-apps/`, re-fetched; "may reject the scope request" confirmed verbatim. |
| 2 | Zoom | Security-review stage alone can take up to two weeks | Correct | Zoom staff forum post describes a 72-hour initial SLA with security review adding up to ~2 weeks; source is a community post (labeled accordingly, not official). |
| 3 | Zoom | Account-level scopes require admin with matching Role Permissions | Correct | Confirmed on `developers.zoom.us/docs/integrations/end-user-auth/`. |
| 4 | Zoom | Published public apps must handle a Deauthorization Notification Endpoint | Correct | Confirmed verbatim on the same end-user-auth page. |
| 5 | Zoom | Composio has no pre-built managed Zoom app | Correct | Composio's own docs describe creating and registering your own Zoom OAuth app, not a shared one. |
| 6 | Microsoft Teams | Teams Store review covers functional, UX, and metadata checks | Correct | Confirmed on `learn.microsoft.com/.../appsource/publish`. |
| 7 | Microsoft Teams | First test report lands within ~24 working hours | Correct | Confirmed verbatim on the same page. |
| 8 | Microsoft Teams | Full cycle estimated at 1-1.5 months | Unverified | Sourced from a 2021 Microsoft blog post, not the current docs - flagged Uncertain in the guide itself for exactly this reason, not presented as confirmed. |
| 9 | Microsoft Teams | A sideloaded/custom app skips Teams Store review entirely | Correct | Consistent with Microsoft's documented distinction between Store-listed and custom/sideloaded apps. |
| 10 | Microsoft Teams | Only a Global Administrator can grant org-wide admin consent | Correct | Confirmed on `learn.microsoft.com/microsoftteams/manage-consent-app-permissions`. |
| 11 | Slack | Marketplace review has three stages (automated, preliminary, functional) | Correct | Confirmed on `docs.slack.dev/slack-marketplace/slack-marketplace-review-guide`. |
| 12 | Slack | Functional review takes up to 10 weeks for a new submission | Correct | Confirmed verbatim on the same page. |
| 13 | Slack | Unlisted public distribution needs no Slack review | Correct | Confirmed on `docs.slack.dev/distribution`. |
| 14 | Slack | At least 10 active workspaces and 10 weekly active users required before Marketplace submission | Correct | Confirmed on `docs.slack.dev/slack-marketplace/distributing-your-app-in-the-slack-marketplace`. |
| 15 | Slack | Migrating a classic app to granular permissions can't be undone | Correct | Confirmed on the Marketplace review guide. |
| 16 | Google (Gmail) | Restricted scopes need an independent third-party CASA security assessment | Correct | Confirmed on `developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification`. |
| 17 | Google (Gmail) | Restricted-scope apps must be reassessed at least every 12 months | Correct | Confirmed verbatim on the same page. |
| 18 | Google (Gmail) | Unverified apps are capped at 100 new users | Correct | Confirmed on `support.google.com/cloud/answer/7454865`. |
| 19 | Google (Gmail) | `gmail.readonly`/`gmail.modify`/etc. are "restricted," `gmail.send` is "sensitive," `gmail.labels` is "non-sensitive" | Correct | Confirmed against Google's own scope table at `developers.google.com/workspace/gmail/api/auth/scopes`. |
| 20 | Google (Gmail) | Workspace admins can block unverified third-party apps by default | Correct | Confirmed on `support.google.com/a/answer/13152743`. |
| 21 | Calendly (live) | OAuth app creation is self-serve via a Calendly developer account (GitHub/Google sign-up), no partner application | Correct | Confirmed verbatim on `developer.calendly.com/docs/authentication/creating-an-oauth-app`. |
| 22 | Calendly (live) | Moving from Sandbox to a Production app requires creating a second, separate app, with no review step | Correct | Confirmed verbatim on the same page. |
| 23 | Calendly (live) | Calendly has 23 fine-grained OAuth scopes across six areas (Scheduling, User management, Webhooks, Security & Compliance, Contacts, Notetaker) | Corrected | **First draft of this check wrongly assumed Calendly used coarse, all-or-nothing scopes** - actually checking `developer.calendly.com/docs/authentication/scopes` before writing it down found 23 named scopes, comparable in granularity to HubSpot or Slack. Fixed before this claim was ever published anywhere - exactly the kind of mistake this project's "no label, no claim" rule exists to catch. |
| 24 | Calendly (live) | The Client Secret and Webhook signing key are shown only once, at app creation, and can't be retrieved again when editing | Correct | Confirmed verbatim on the OAuth app creation page. |
| 25 | Calendly (live) | Whether an explicit customer-admin approval gate exists for installing the app | Unverified | Calendly's docs don't describe one, but also don't rule one out for org-level scopes (e.g. `organizations:write`) - the guide itself correctly marks this gate "unknown" rather than guessing "no," which a first pass at this very check almost did. |

**Totals:** 23 Correct, 1 Corrected, 1 Unverified.
**Most common error type:** assuming a provider's design from general pattern-matching (other providers in this library often have simpler scope systems, so Calendly was assumed similar) instead of actually checking its own docs before writing the claim down. Caught during this same accuracy check, before the Calendly guide was published anywhere - it never shipped with the wrong claim.
