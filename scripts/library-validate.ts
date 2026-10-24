import fs from "node:fs";
import path from "node:path";
import { Guide } from "../src/lib/schema";
import { computeCompleteness } from "../src/lib/completeness";

const LIBRARY_DIR = path.join(process.cwd(), "content", "library");

function listLibraryFiles(): string[] {
  return fs.readdirSync(LIBRARY_DIR).filter((f) => f.endsWith(".json"));
}

function main() {
  const files = listLibraryFiles();
  if (files.length === 0) {
    console.error("No files in content/library/. Nothing to validate.");
    process.exit(1);
  }

  let failed = false;

  for (const file of files) {
    const full = path.join(LIBRARY_DIR, file);
    const raw = JSON.parse(fs.readFileSync(full, "utf8"));
    const parsed = Guide.safeParse(raw);
    if (!parsed.success) {
      console.error(`FAIL  ${file} - schema invalid: ${parsed.error.message}`);
      failed = true;
      continue;
    }
    const guide = parsed.data;

    if (guide.kind !== "library") {
      console.error(`FAIL  ${file} - kind must be "library", got "${guide.kind}"`);
      failed = true;
      continue;
    }
    if (guide.sample) {
      console.error(`FAIL  ${file} - sample must be false for a real library guide`);
      failed = true;
      continue;
    }

    // Re-derive completeness (T3/T4: all 15 sections present, every step
    // tagged, every claim labeled - the last is enforced by Guide itself)
    // and fail if the stored value has drifted from what the facts support
    // (for example after a hand edit during review).
    const recomputed = computeCompleteness({
      tier: guide.verdict.tier,
      scopes: guide.scopes,
      prerequisites: guide.prerequisites,
      steps: guide.steps,
      gates: guide.gates,
      stuckPoints: guide.stuckPoints,
    });
    const matches =
      recomputed.status === guide.completeness.status &&
      recomputed.thinSections.join("|") === guide.completeness.thinSections.join("|");
    if (!matches) {
      console.error(
        `FAIL  ${file} - stored completeness does not match the guide's own facts: stored=${JSON.stringify(guide.completeness)} recomputed=${JSON.stringify(recomputed)}`
      );
      failed = true;
      continue;
    }

    console.log(
      `PASS  ${file} - ${guide.app.name}: tier ${guide.verdict.tier ?? "Unknown"}, ${guide.completeness.status}${guide.handVerified ? `, hand-verified by ${guide.handVerified.by} on ${guide.handVerified.on}` : ""}`
    );
  }

  if (failed) {
    console.error("\nlibrary:validate found problems. Fix them and run again.");
    process.exit(1);
  }
  console.log(`\nAll ${files.length} library files pass.`);
}

main();
