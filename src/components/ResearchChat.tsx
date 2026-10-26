"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { Guide } from "@/lib/schema";
import { addRecentResult } from "@/lib/localUser";

type Candidate = { name: string; websiteUrl: string | null; description: string };
type StageState = "pending" | "active" | "done";
type Stage = { stage: number; message: string; state: StageState };

// Mirrors STAGE_MESSAGES in src/lib/research/pipeline.ts, so the full list
// (not just "Stage N" placeholders) is visible the instant a search starts,
// before the first server event arrives.
const STAGE_MESSAGES: Record<number, string> = {
  1: "Working out which app you mean",
  2: "Finding the developer docs and review pages",
  3: "Reading scopes, requirements and review steps",
  4: "Looking for delays and rejections others hit",
  5: "Checking that the pages and steps exist",
  6: "Writing the guide in the standard format",
  7: "Checking every claim against its source",
  8: "Done: open the guide or save it",
};

const STAGE_COUNT = 8;
const INITIAL_STAGES: Stage[] = Array.from({ length: STAGE_COUNT }, (_, i) => ({
  stage: i + 1,
  message: STAGE_MESSAGES[i + 1],
  state: "pending",
}));

type Phase = "idle" | "running" | "question" | "result" | "error";

export function ResearchChat() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [stages, setStages] = useState<Stage[]>(INITIAL_STAGES);
  const [question, setQuestion] = useState<{ text: string; candidates: Candidate[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const router = useRouter();
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (phase !== "running") return;
    const t = setTimeout(() => setSlow(true), 20000);
    return () => clearTimeout(t);
  }, [phase]);

  function reset() {
    setPhase("idle");
    setStages(INITIAL_STAGES);
    setQuestion(null);
    setError(null);
  }

  async function run(body: { query: string; choice?: Candidate }) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setPhase("running");
    setStages(INITIAL_STAGES);
    setQuestion(null);
    setError(null);
    setSlow(false);

    let res: Response;
    try {
      res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      setError("Couldn't reach the research service. Try again.");
      setPhase("error");
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      setError("Couldn't read the response. Try again.");
      setPhase("error");
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const event = JSON.parse(line.slice(6));
          handleEvent(event);
        }
      }
    } catch {
      if (!controller.signal.aborted) {
        setError("Connection dropped. Try again.");
        setPhase("error");
      }
    }
  }

  function handleEvent(event: {
    type: string;
    stage?: number;
    state?: StageState;
    message?: string;
    text?: string;
    candidates?: Candidate[];
    guide?: Guide;
    code?: string;
  }) {
    if (event.type === "status" && event.stage && event.state && event.message) {
      setStages((prev) =>
        prev.map((s) => (s.stage === event.stage ? { ...s, state: event.state as StageState, message: event.message! } : s))
      );
    } else if (event.type === "question" && event.text && event.candidates) {
      setPhase("question");
      setQuestion({ text: event.text, candidates: event.candidates });
    } else if (event.type === "result" && event.guide) {
      setPhase("result");
      addRecentResult(event.guide);
      router.push(`/research/${event.guide.app.slug}`);
      setOpen(false);
    } else if (event.type === "error") {
      setPhase("error");
      setError(event.message ?? "Something went wrong.");
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    void run({ query: query.trim() });
  }

  function pickCandidate(c: Candidate) {
    void run({ query, choice: c });
  }

  function close() {
    abortRef.current?.abort();
    setOpen(false);
    setQuery("");
    reset();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-mono-label focus-ring inline-flex items-center rounded-full bg-foreground px-4 py-2 text-xs font-semibold uppercase text-background transition-opacity hover:opacity-85"
      >
        Check an app
      </button>

      {open &&
        createPortal(
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" role="presentation" onClick={close}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Check an app's OAuth approval difficulty"
            className="flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-border bg-surface shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border p-4">
              <h2 className="text-base font-semibold text-foreground">Check an app</h2>
              <button type="button" onClick={close} className="focus-ring rounded p-1 text-muted hover:text-foreground" aria-label="Close">
                &#x2715;
              </button>
            </div>

            <div className="flex-1 p-4">
              {phase === "idle" && (
                <form onSubmit={submit} className="flex flex-col gap-3">
                  <label htmlFor="research-query" className="text-sm text-muted">
                    Type an app name or its website &mdash; we&apos;ll research its OAuth app review process live.
                  </label>
                  <input
                    id="research-query"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="e.g. Calendly, Figma, asana.com"
                    className="focus-ring w-full rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={query.trim().length < 2}
                    className="font-mono-label focus-ring w-fit rounded-full bg-foreground px-4 py-2 text-xs font-semibold uppercase text-background disabled:opacity-40"
                  >
                    Research it
                  </button>
                </form>
              )}

              {(phase === "running" || phase === "question" || phase === "error") && (
                <div>
                  <p className="mb-3 flex items-center gap-2 text-sm text-muted">
                    {phase === "running" && (
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                      </span>
                    )}
                    Researching &ldquo;{query}&rdquo;&hellip;
                  </p>
                  {slow && phase === "running" && (
                    <p className="mb-3 rounded-xl border border-border bg-background p-3 text-xs text-muted">
                      Still working &mdash; a fresh app can take a couple of minutes since we read the real docs and
                      double-check every claim. If this keeps spinning, the research providers may be rate-limited
                      right now; try again shortly or browse the reviewed library below.
                    </p>
                  )}
                  <ul aria-live="polite" className="flex flex-col gap-1.5">
                    {stages.map((s) => (
                      <li key={s.stage} className="flex items-center gap-2 text-sm">
                        <span
                          aria-hidden="true"
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] ${
                            s.state === "done"
                              ? "bg-emerald-500 text-white"
                              : s.state === "active"
                                ? "animate-pulse bg-accent text-accent-foreground"
                                : "bg-background text-muted"
                          }`}
                        >
                          {s.state === "done" ? "✓" : s.stage}
                        </span>
                        <span className={s.state === "pending" ? "text-muted" : "text-foreground"}>
                          {s.message || `Stage ${s.stage}`}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {question && (
                    <div className="mt-5 border-t border-border pt-4">
                      <p className="mb-3 text-sm text-foreground">{question.text}</p>
                      <div className="flex flex-col gap-2">
                        {question.candidates.map((c, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => pickCandidate(c)}
                            className="focus-ring rounded-xl border border-border bg-background p-3 text-left text-sm hover:border-accent"
                          >
                            <span className="font-medium text-foreground">{c.name}</span>
                            <span className="block text-xs text-muted">{c.description}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {phase === "error" && error && (
                    <div className="mt-5 rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-400">
                      {error}
                      <button type="button" onClick={reset} className="focus-ring ml-2 underline">
                        Try again
                      </button>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>,
        document.body
        )}
    </>
  );
}
