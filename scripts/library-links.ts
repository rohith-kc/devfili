import fs from "node:fs";
import path from "node:path";
import { Guide } from "../src/lib/schema";
import { safeFetch } from "../src/lib/safety/ssrf";

const LIBRARY_DIR = path.join(process.cwd(), "content", "library");

function listLibraryFiles(): string[] {
  return fs.readdirSync(LIBRARY_DIR).filter((f) => f.endsWith(".json"));
}

async function main() {
  const files = listLibraryFiles();
  const lines: string[] = ["# Library source link check", "", `Generated ${new Date().toISOString()}`, ""];
  let anyBroken = false;
  let totalChecked = 0;

  for (const file of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(LIBRARY_DIR, file), "utf8"));
    const parsed = Guide.safeParse(raw);
    if (!parsed.success) {
      lines.push(`## ${file}`, "", "SKIPPED - schema invalid", "");
      continue;
    }
    const guide = parsed.data;
    lines.push(`## ${guide.app.name} (${file})`, "");

    for (const source of guide.derived.sources) {
      totalChecked += 1;
      const result = await safeFetch(source.url, { timeoutMs: 8000 });
      const status = result.status;
      const ok = result.ok && status !== null && status >= 200 && status < 400;
      if (!ok) anyBroken = true;
      lines.push(`- [${ok ? "OK" : "BROKEN"}] ${source.url} (status ${status ?? "n/a"}${result.error ? `, ${result.error}` : ""})`);
    }
    lines.push("");
  }

  const outFile = path.join(process.cwd(), "docs", "LINKS_REPORT.md");
  fs.writeFileSync(outFile, lines.join("\n"));
  console.log(`Checked ${totalChecked} source URLs across ${files.length} files.`);
  console.log(`Wrote ${path.relative(process.cwd(), outFile)}`);
  if (anyBroken) console.log("Some links are broken - see the report.");
}

main();
