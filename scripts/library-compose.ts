// Composes a library guide from hand-authored research (findings + a
// DraftCore/DraftPath-shaped draft) instead of a live Groq/Gemini call.
// Still runs every claim through the exact same deterministic pipeline code
// (probeFindings for real server-side source verification, then
// finalizeGuide for labeling/tier/ranges/confidence/completeness) - only the
// discover+draft steps are done by hand instead of by an LLM call.
//
// Usage: npm run library:compose -- <slug>
// Reads scripts/library-input/<slug>.json: { app, findings, core, path }

import fs from "node:fs";
import path from "node:path";
import { DraftCore, DraftPath, Finding } from "../src/lib/schema";
import { z } from "zod";
import { mapFindingsToCheckableProbeId, probeFindings } from "../src/lib/research/probe";
import { finalizeGuide } from "../src/lib/research/finalize";

/** Walks the hand-authored core/path and, for every DClaim-shaped object,
 * adds the probe id for any cited finding that has a passing checkable -
 * so authoring a claim only needs findingIds; probeIds (for Tested
 * eligibility) are wired automatically rather than predicted by hand. */
function autoWireProbeIds(node: unknown, findingToProbeId: Map<string, string>): void {
  if (Array.isArray(node)) {
    for (const item of node) autoWireProbeIds(item, findingToProbeId);
    return;
  }
  if (node && typeof node === "object") {
    const rec = node as Record<string, unknown>;
    if (Array.isArray(rec.findingIds) && Array.isArray(rec.probeIds)) {
      const probeIds = new Set(rec.probeIds as string[]);
      for (const fid of rec.findingIds as string[]) {
        const pid = findingToProbeId.get(fid);
        if (pid) probeIds.add(pid);
      }
      rec.probeIds = [...probeIds];
    }
    for (const v of Object.values(rec)) autoWireProbeIds(v, findingToProbeId);
  }
}

const InputFile = z.object({
  app: z.object({ name: z.string(), slug: z.string(), websiteUrl: z.string().url().nullable() }),
  findings: z.array(Finding),
  core: DraftCore,
  path: DraftPath,
});

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error("Usage: npm run library:compose -- <slug>");
    process.exit(1);
  }

  const inputFile = path.join(process.cwd(), "scripts", "library-input", `${slug}.json`);
  const raw = JSON.parse(fs.readFileSync(inputFile, "utf8"));
  const parsed = InputFile.safeParse(raw);
  if (!parsed.success) {
    console.error(`FAIL  ${slug} - input failed schema validation:\n${parsed.error.message}`);
    process.exit(1);
  }
  const { app, findings, core, path: draftPath } = parsed.data;

  console.log(`Probing ${findings.length} findings' sources for ${app.name}...`);
  const probes = await probeFindings(findings);
  const passed = probes.filter((p) => p.readable && p.mustContainAll);
  console.log(`${probes.filter((p) => p.readable).length}/${probes.length} probes readable, ${passed.length} passed (eligible for Tested).`);
  if (passed.length > 0) {
    console.log("Passed probes (cite these ids in a claim's probeIds to make it eligible for Tested):");
    for (const p of passed) console.log(`  ${p.id}  ${p.url}`);
  }
  const mismatched = probes.filter((p) => p.readable && !p.excerptFound && !p.mustContainAll);
  if (mismatched.length > 0) {
    console.log("Readable but excerpt/mustContain not found (source text doesn't literally match - fix the excerpt and re-run):");
    for (const p of mismatched) console.log(`  ${p.id}  ${p.url}`);
  }

  const findingToProbeId = mapFindingsToCheckableProbeId(findings);
  autoWireProbeIds(core, findingToProbeId);
  autoWireProbeIds(draftPath, findingToProbeId);

  const today = new Date().toISOString().slice(0, 10);
  const guide = finalizeGuide({ app, kind: "library", today, core, path: draftPath, findings, probes });

  const outDir = path.join(process.cwd(), "content", "library", "drafts");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${slug}.json`);
  fs.writeFileSync(outFile, `${JSON.stringify(guide, null, 2)}\n`);

  console.log(`PASS  ${slug} - tier ${guide.verdict.tier ?? "Unknown"}, ${guide.completeness.status}, wrote ${path.relative(process.cwd(), outFile)}`);
  if (guide.completeness.status === "incomplete") {
    console.log(`  thin sections: ${guide.completeness.thinSections.join(", ")}`);
  }
}

main();
