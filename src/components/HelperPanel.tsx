"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Guide, HelperKind } from "@/lib/schema";

type Field = { key: string; label: string; placeholder: string };

export function HelperPanel({
  id,
  helper,
  title,
  description,
  fields,
  guide,
  disabledReason,
}: {
  id: string;
  helper: Exclude<HelperKind, "checklist" | "pre_submission">;
  title: string;
  description: string;
  fields: Field[];
  guide: Guide;
  disabledReason?: string;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const formId = useId();

  // A step link to this helper changes the URL hash (even to the same-page
  // anchor); react to that external event rather than reading it once
  // synchronously, which both avoids a hydration mismatch and keeps the
  // handler safely inside the event callback, not the effect body.
  useEffect(() => {
    function onHashChange() {
      if (window.location.hash === `#${id}`) setOpen(true);
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/helpers/${helper}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guide, inputs: values }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.message ?? "Couldn't draft this right now.");
      } else {
        setDraft(body.draft);
      }
    } catch {
      setError("Couldn't reach the draft service.");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  }

  if (disabledReason) {
    return (
      <div id={id} className="scroll-mt-24 rounded-xl border border-dashed border-border p-4 text-sm text-muted">
        <p className="font-medium text-foreground">{title}</p>
        <p className="mt-1">{disabledReason}</p>
      </div>
    );
  }

  return (
    <div id={id} className="scroll-mt-24 rounded-xl border border-border p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={formId}
        className="focus-ring flex w-full items-center justify-between text-left"
      >
        <span>
          <span className="block text-sm font-medium text-foreground">{title}</span>
          <span className="block text-xs text-muted">{description}</span>
        </span>
        <span aria-hidden="true" className="text-muted">
          {open ? "−" : "+"}
        </span>
      </button>

      {open && (
        <div id={formId} className="mt-3">
          <form onSubmit={submit} className="flex flex-col gap-2">
            {fields.map((f) => (
              <label key={f.key} className="flex flex-col gap-1 text-xs text-muted">
                {f.label}
                <input
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="focus-ring rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted"
                />
              </label>
            ))}
            <button
              type="submit"
              disabled={loading}
              className="font-mono-label focus-ring mt-1 w-fit rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold uppercase text-background disabled:opacity-50"
            >
              {loading ? "Drafting…" : draft ? "Draft again" : "Draft it"}
            </button>
            {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
          </form>
        </div>
      )}

      {draft &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
            role="presentation"
            onClick={() => setDraft(null)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`${title} draft`}
              className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border p-5">
                <div>
                  <h3 className="text-base font-semibold text-foreground">{title}</h3>
                  <p className="font-mono-label mt-1 inline-block rounded-full border border-dashed border-amber-400 px-2 py-0.5 text-[10px] uppercase text-amber-700 dark:border-amber-600 dark:text-amber-400">
                    Draft: review before use
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDraft(null)}
                  className="focus-ring rounded p-1 text-muted hover:text-foreground"
                  aria-label="Close"
                >
                  &#x2715;
                </button>
              </div>

              <div className="draft-markdown overflow-y-auto p-6 text-sm leading-relaxed text-foreground">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{draft}</ReactMarkdown>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-border p-4">
                <button
                  type="button"
                  onClick={() => setDraft(null)}
                  className="font-mono-label focus-ring text-xs uppercase text-muted hover:text-foreground"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={copy}
                  className="font-mono-label focus-ring rounded-full border border-border px-4 py-2 text-xs font-semibold uppercase text-foreground transition-opacity hover:opacity-80"
                >
                  {copied ? "Copied ✓" : "Copy"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
