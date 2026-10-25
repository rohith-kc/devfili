"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { AppIcon } from "@/components/AppIcon";
import { GuideView } from "@/components/GuideView";
import { getUsername, getSavedGuides, removeSavedGuide, type SavedGuide } from "@/lib/localUser";

export default function MyGuidesPage() {
  const [name, setName] = useState<string | null | undefined>(undefined);
  const [guides, setGuides] = useState<SavedGuide[]>([]);
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from localStorage, which React can't read during render without a hydration mismatch
    setName(getUsername());
    setGuides(getSavedGuides());
  }, []);

  function remove(slug: string) {
    removeSavedGuide(slug);
    setGuides(getSavedGuides());
    if (openSlug === slug) setOpenSlug(null);
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">My guides</h1>
        <p className="mt-1 text-sm text-muted">
          Saved on this device only (name-only sign-in, no account) &mdash; from live research via &ldquo;Check an
          app.&rdquo;
        </p>

        {name === undefined ? null : name === null ? (
          <p className="mt-8 rounded-2xl border border-dashed border-border p-6 text-sm text-muted">
            Sign in with just a name (top right) to see your saved guides here.
          </p>
        ) : guides.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-dashed border-border p-6 text-sm text-muted">
            Nothing saved yet. Use &ldquo;Check an app&rdquo; to research one live, then &ldquo;Save to my
            guides.&rdquo;
          </p>
        ) : (
          <ul className="mt-8 flex flex-col gap-3">
            {guides.map((g) => (
              <li key={g.slug} className="rounded-2xl border border-border bg-surface">
                <div className="flex items-center justify-between gap-3 p-4">
                  <button
                    type="button"
                    onClick={() => setOpenSlug(openSlug === g.slug ? null : g.slug)}
                    className="focus-ring flex flex-1 items-center gap-3 text-left"
                  >
                    <AppIcon slug={g.slug} name={g.name} websiteUrl={g.guide.app.websiteUrl} />
                    <span>
                      <span className="block font-medium text-foreground">{g.name}</span>
                      <span className="block text-xs text-muted">
                        Saved {new Date(g.savedAt).toLocaleDateString()}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(g.slug)}
                    className="font-mono-label focus-ring shrink-0 text-xs uppercase text-muted hover:text-rose-600"
                  >
                    Remove
                  </button>
                </div>
                {openSlug === g.slug && (
                  <div className="border-t border-border">
                    <GuideView guide={g.guide} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
