"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getUsername, setUsername, clearUsername } from "@/lib/localUser";

export function UserMenu() {
  const [name, setName] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from localStorage, which React can't read during render without a hydration mismatch
    setName(getUsername());
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    setUsername(trimmed);
    setName(trimmed);
    setOpen(false);
    setDraft("");
  }

  function signOut() {
    clearUsername();
    setName(null);
  }

  if (name) {
    return (
      <span className="flex items-center gap-3 text-sm">
        <Link href="/my-guides" className="focus-ring rounded text-muted hover:text-foreground">
          My guides
        </Link>
        <span className="font-medium text-foreground">{name}</span>
        <button type="button" onClick={signOut} className="focus-ring text-xs text-muted hover:text-foreground">
          Sign out
        </button>
      </span>
    );
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="focus-ring rounded text-sm font-medium text-muted hover:text-foreground"
      >
        Sign in
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-64 rounded-xl border border-border bg-surface p-4 shadow-lg">
          <form onSubmit={submit} className="flex flex-col gap-2">
            <label htmlFor="username-input" className="text-xs text-muted">
              Just a name &mdash; no password. Stored on this device only, to label your saved guides.
            </label>
            <input
              id="username-input"
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="e.g. Rohith"
              className="focus-ring rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="font-mono-label focus-ring mt-1 w-fit rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold uppercase text-background disabled:opacity-50"
            >
              Continue
            </button>
          </form>
        </div>
      )}
    </span>
  );
}
