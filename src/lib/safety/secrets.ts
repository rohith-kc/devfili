const SECRET_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "Gemini AQ-format key", re: /AQ\.[A-Za-z0-9_-]{20,}/ },
  { name: "Gemini AIza-format key", re: /AIza[0-9A-Za-z_-]{20,}/ },
  { name: "Groq key", re: /gsk_[A-Za-z0-9]{20,}/ },
  { name: "OpenAI-style key", re: /sk-[A-Za-z0-9]{20,}/ },
  { name: "GitHub token", re: /ghp_[A-Za-z0-9]{20,}/ },
  { name: "Slack token", re: /xox[abp]-/ },
  { name: "JWT", re: /eyJ[A-Za-z0-9_-]{10,}\./ },
  { name: "private key block", re: /-----BEGIN [^-]*PRIVATE KEY-----/ },
  { name: "password assignment", re: /\bpassword\s*[:=]\s*\S+/i },
];

/** Rejects helper input that looks like it contains a secret - API keys,
 * tokens, private key blocks, or a "password: ..." style line. */
export function looksLikeSecret(input: string): boolean {
  return SECRET_PATTERNS.some((p) => p.re.test(input));
}
