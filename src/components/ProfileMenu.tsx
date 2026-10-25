"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AppIcon } from "./AppIcon";
import {
  clearUsername,
  removeSavedGuide,
  setUsername,
  useHydrated,
  useSavedGuides,
  useUsername,
} from "@/lib/localUser";

export function ProfileMenu() {
  const hydrated = useHydrated();
  const name = useUsername();
  const guides = useSavedGuides();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setUsername(draft);
    setDraft("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="focus-ring inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:border-accent"
      >
        <span
          aria-hidden="true"
          className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-accent-foreground"
        >
          {hydrated && name ? name.charAt(0).toUpperCase() : "?"}
        </span>
        Profile
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex justify-end bg-black/40" role="presentation" onClick={() => setOpen(false)}>
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Your profile"
              className="flex h-full w-full max-w-sm flex-col overflow-y-auto border-l border-border bg-surface shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border p-4">
                <h2 className="text-base font-semibold text-foreground">Profile</h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="focus-ring rounded p-1 text-muted hover:text-foreground"
                  aria-label="Close"
                >
                  &#x2715;
                </button>
              </div>

              <div className="flex-1 p-4">
                {name ? (
                  <>
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-base font-semibold text-accent-foreground"
                      >
                        {name.charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{name}</p>
                        <p className="text-xs text-muted">Saved in this browser only</p>
                      </div>
                    </div>

                    <h3 className="mt-6 text-sm font-semibold text-foreground">Saved guides</h3>
                    {guides.length === 0 ? (
                      <p className="mt-2 rounded-xl border border-dashed border-border p-4 text-sm text-muted">
                        Nothing saved yet. Use &ldquo;Check an app&rdquo; to research one live, then save it.
                      </p>
                    ) : (
                      <ul className="mt-2 flex flex-col gap-2">
                        {guides.map((g) => (
                          <li key={g.slug} className="flex items-center gap-3 rounded-xl border border-border p-3">
                            <AppIcon slug={g.slug} name={g.name} websiteUrl={g.guide.app.websiteUrl} />
                            <span className="min-w-0 flex-1">
                              <Link
                                href="/my-guides"
                                onClick={() => setOpen(false)}
                                className="focus-ring block truncate text-sm font-medium text-foreground hover:underline"
                              >
                                {g.name}
                              </Link>
                              <span className="block text-xs text-muted">
                                Saved {new Date(g.savedAt).toLocaleDateString()}
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() => removeSavedGuide(g.slug)}
                              className="font-mono-label focus-ring text-xs uppercase text-muted hover:text-rose-600"
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <form onSubmit={saveName} className="flex flex-col gap-2">
                    <label htmlFor="profile-name" className="text-sm text-foreground">
                      What should we call you?
                    </label>
                    <input
                      id="profile-name"
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="Your name"
                      maxLength={40}
                      className="focus-ring rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted"
                    />
                    <button
                      type="submit"
                      disabled={!draft.trim()}
                      className="font-mono-label focus-ring w-fit rounded-full bg-foreground px-4 py-2 text-xs font-semibold uppercase text-background disabled:opacity-50"
                    >
                      Save
                    </button>
                    <p className="text-xs text-muted">No password. Stored in this browser only.</p>
                  </form>
                )}
              </div>

              {name && (
                <div className="flex items-center justify-between border-t border-border p-4">
                  <Link
                    href="/my-guides"
                    onClick={() => setOpen(false)}
                    className="focus-ring text-sm text-accent hover:underline"
                  >
                    Open full view
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      clearUsername();
                      setOpen(false);
                    }}
                    className="font-mono-label focus-ring text-xs uppercase text-muted hover:text-foreground"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
