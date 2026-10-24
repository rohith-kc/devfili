# Paste this into Claude Code (from inside the devfili folder)

You are building DevFili. First read these files completely, in order: CLAUDE.md, docs/PRD.md, docs/SPEC.md, docs/PROMPTS.md, docs/BUILD_PLAN.md.

Then start Phase 0 of docs/BUILD_PLAN.md.

Rules for this session:
- I am a product manager, not a developer. Explain in plain words and give exact commands and clicks.
- Follow the first-run protocol in CLAUDE.md for keys. Ask me for the non-secret settings (base URLs, model choices). Do NOT ask me to paste secrets into this chat: create .env.local with blank secret lines and tell me which lines to fill in my editor, then run npm run check-keys.
- Work phase by phase. After each phase, run tests, lint and build, run npm run scan-secrets, commit, and give me 3 lines: what works, what to check, what is next. Do not start the next phase until I say go.
- If something in the docs is unclear, ask me one short question. Otherwise decide and log it in docs/DECISIONS.md.
- Never invent facts about providers. Everything in a guide must be labeled Tested, Sourced or Uncertain by code, as the spec says.

Settings you can assume (confirm them with me first):
- Groq base URL: https://api.groq.com/openai/v1
- Gemini: use the native Google SDK (no base URL needed). The OpenAI-compatible URL, only if needed, is https://generativelanguage.googleapis.com/v1beta/openai/
- Repo: https://github.com/rohith-kc/devfili
