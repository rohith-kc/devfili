import fs from "node:fs";
import path from "node:path";
import { loadEnvLocal } from "./env";
import { loadApps } from "../src/lib/research/resolve";
import { runPipeline } from "../src/lib/research/pipeline";

loadEnvLocal();

async function generateOne(slug: string): Promise<void> {
  const entry = loadApps().find((a) => a.slug === slug);
  if (!entry) {
    console.error(`FAIL  ${slug} - not in content/apps.json`);
    process.exitCode = 1;
    return;
  }

  console.log(`\n=== Generating ${entry.name} (${slug}) ===`);
  const start = Date.now();

  for await (const event of runPipeline(entry.name, { forceLive: true })) {
    if (event.type === "status") {
      console.log(`[stage ${event.stage}] ${event.state} ${event.message}`);
    } else if (event.type === "error") {
      console.error(`FAIL  ${slug} - [${event.code}] ${event.message}`);
      process.exitCode = 1;
    } else if (event.type === "question") {
      console.error(`FAIL  ${slug} - resolve was ambiguous: ${event.text}`);
      process.exitCode = 1;
    } else if (event.type === "result") {
      const draftGuide = { ...event.guide, kind: "library" as const };
      const outDir = path.join(process.cwd(), "content", "library", "drafts");
      fs.mkdirSync(outDir, { recursive: true });
      const outFile = path.join(outDir, `${slug}.json`);
      fs.writeFileSync(outFile, `${JSON.stringify(draftGuide, null, 2)}\n`);
      const seconds = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`PASS  ${slug} - wrote ${path.relative(process.cwd(), outFile)} in ${seconds}s`);
    }
  }
}

async function main() {
  const slugs = process.argv.slice(2);
  if (slugs.length === 0) {
    console.error('Usage: npm run library:generate -- <slug...>');
    process.exit(1);
  }
  for (const slug of slugs) {
    await generateOne(slug);
  }
}

main();
