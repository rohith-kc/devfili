import { loadEnvLocal } from "./env";
import { runPipeline } from "../src/lib/research/pipeline";
import { formatRange } from "../src/lib/ranges";
import type { Guide } from "../src/lib/schema";

loadEnvLocal();

function humanSummary(guide: Guide): string {
  const lines: string[] = [];
  lines.push(`${guide.app.name} (${guide.app.slug})`);
  lines.push(`Tier: ${guide.verdict.tier ?? "Unknown"}`);
  lines.push(`Reason: ${guide.verdict.tierReason.text} [${guide.verdict.tierReason.label}]`);
  lines.push(`Effort: ${guide.verdict.effort ? formatRange(guide.verdict.effort) : "unknown"}`);
  lines.push(`Wait: ${guide.verdict.wait ? formatRange(guide.verdict.wait) : "unknown"}`);
  lines.push(
    `Gates: provider=${guide.verdict.gates.provider} customerAdmin=${guide.verdict.gates.customerAdmin} endUser=${guide.verdict.gates.endUser}`
  );
  lines.push(`Confidence: ${guide.verdict.confidence}`);
  lines.push(`Completeness: ${guide.completeness.status}${guide.completeness.thinSections.length ? ` (thin: ${guide.completeness.thinSections.join(", ")})` : ""}`);
  lines.push(`Scopes: ${guide.scopes.length}, Prerequisites: ${guide.prerequisites.length}, Steps: ${guide.steps.length}, Stuck points: ${guide.stuckPoints.length}`);
  lines.push(`Sources: ${guide.derived.sources.length} (${guide.derived.unverifiedClaimIds.length} claims could not be verified)`);
  return lines.join("\n");
}

async function main() {
  const query = process.argv.slice(2).join(" ").trim();
  if (!query) {
    console.error('Usage: npm run research -- "<app name or url>"');
    process.exit(1);
  }

  const start = Date.now();
  for await (const event of runPipeline(query)) {
    switch (event.type) {
      case "status":
        console.log(`[stage ${event.stage}] ${event.state === "active" ? "..." : "done"} ${event.message}`);
        break;
      case "question":
        console.log(`\nAmbiguous: ${event.text}`);
        for (const c of event.candidates) {
          console.log(`  - ${c.name}${c.websiteUrl ? ` (${c.websiteUrl})` : ""}: ${c.description}`);
        }
        break;
      case "error":
        console.error(`\nError [${event.code}]: ${event.message}`);
        process.exitCode = 1;
        break;
      case "result": {
        const seconds = ((Date.now() - start) / 1000).toFixed(1);
        console.log(`\nDone in ${seconds}s (cached: ${event.cached})\n`);
        console.log(humanSummary(event.guide));
        console.log("\n--- full guide JSON ---");
        console.log(JSON.stringify(event.guide, null, 2));
        break;
      }
      case "done":
        break;
    }
  }
}

main();
