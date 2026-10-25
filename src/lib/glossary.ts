export const TIER_EXPLAIN: Record<1 | 2 | 3 | 4, string> = {
  1: "Self-serve. You register an app and start using it - no review, no waiting on the provider.",
  2: "The provider reviews your app before other people can install it - checking it works and asking for only the access it needs.",
  3: "Same review as Tier 2, plus a separate security check of every permission (scope) you're asking for.",
  4: "Gated. The provider decides, at its own discretion, whether to let you build at all - there's often no guaranteed way in and no fixed timeline.",
};

export const GATED_EXPLAIN =
  "This app's access is restricted beyond a normal review - for example, you may need to apply as a partner, or approval may be given at the provider's discretion rather than against a fixed checklist.";

export const CUSTOMER_ADMIN_EXPLAIN =
  "Whoever installs your app at a customer's company needs to be (or get sign-off from) an admin on that company's account - not just any employee can click \"install.\"";

export const OWNER_EXPLAIN: Record<"agent_did" | "agent_drafted" | "you_do", string> = {
  agent_did: "Already done by our research - nothing for you to do for this step.",
  agent_drafted: "We've written a starting draft for this (like a scope justification or test plan) that you review and send.",
  you_do: "You have to do this yourself - it needs your account, your code, or your judgment call.",
};
