import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

// These two files document or implement the patterns below and would
// otherwise match their own pattern text.
const ALLOWLIST = new Set(["scripts/scan-secrets.ts", "docs/SPEC.md"]);

const PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: "Gemini AQ-format key", re: /AQ\.[A-Za-z0-9_-]{20,}/ },
  { name: "Gemini AIza-format key", re: /AIza[0-9A-Za-z_-]{20,}/ },
  { name: "Groq key", re: /gsk_[A-Za-z0-9]{20,}/ },
  { name: "OpenAI-style key", re: /sk-[A-Za-z0-9]{20,}/ },
  { name: "GitHub token", re: /ghp_[A-Za-z0-9]{20,}/ },
  { name: "Slack token", re: /xox[abp]-/ },
  { name: "JWT", re: /eyJ[A-Za-z0-9_-]{10,}\./ },
  { name: "private key block", re: /-----BEGIN [^-]*PRIVATE KEY-----/ },
  { name: "password assignment", re: /\bpassword[ \t]*[:=][ \t]*\S+/i },
  { name: "Supabase service role assignment", re: /SUPABASE_SERVICE_ROLE_KEY[ \t]*=[ \t]*\S+/ },
];

function run(cmd: string): string {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: "utf8" });
  } catch {
    return "";
  }
}

function listCandidateFiles(): string[] {
  const tracked = run("git ls-files");
  const staged = run("git diff --cached --name-only --diff-filter=ACM");
  const set = new Set<string>();
  for (const f of [...tracked.split("\n"), ...staged.split("\n")]) {
    const trimmed = f.trim();
    if (trimmed) set.add(trimmed.replace(/\\/g, "/"));
  }
  return [...set];
}

function isBinary(buf: Buffer): boolean {
  const len = Math.min(buf.length, 8000);
  for (let i = 0; i < len; i++) {
    if (buf[i] === 0) return true;
  }
  return false;
}

function main() {
  const files = listCandidateFiles();
  let failed = false;

  for (const file of files) {
    const base = path.basename(file);
    if (/^\.env/.test(base) && base !== ".env.example") {
      console.error(`FAIL  ${file} - a .env file is tracked or staged; only .env.example may be committed`);
      failed = true;
      continue;
    }
    if (ALLOWLIST.has(file)) continue;

    const fullPath = path.join(ROOT, file);
    if (!fs.existsSync(fullPath)) continue;
    let buf: Buffer;
    try {
      buf = fs.readFileSync(fullPath);
    } catch {
      continue;
    }
    if (isBinary(buf)) continue;
    const text = buf.toString("utf8");

    for (const { name, re } of PATTERNS) {
      if (re.test(text)) {
        console.error(`FAIL  ${file} - looks like a ${name} (value not printed here)`);
        failed = true;
      }
    }
  }

  if (failed) {
    console.error("\nscan-secrets found possible secrets. Remove them, rotate any real key that was ever pasted into chat or committed, then run this again.");
    process.exit(1);
  }
  console.log(`PASS  scanned ${files.length} tracked/staged files, no secret patterns found`);
}

main();
