"use client";

import Link from "next/link";
import { Header } from "@/components/Header";
import { AppIcon } from "@/components/AppIcon";
import { removeSavedGuide, useHydrated, useSavedGuides, useUsername } from "@/lib/localUser";

export default function MyGuidesPage() {
  const hydrated = useHydrated();
  const name = useUsername();
  const guides = useSavedGuides();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">My guides</h1>
        <p className="mt-1 text-sm text-muted">
          Saved in this browser only &mdash; from live research via &ldquo;Check an app.&rdquo;
        </p>

        {!hydrated ? null : !name ? (
          <p className="mt-8 rounded-2xl border border-dashed border-border p-6 text-sm text-muted">
            Open Profile (top right) and enter your name to see your saved guides here.
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
                  <Link href={`/saved/${g.slug}`} className="focus-ring flex flex-1 items-center gap-3 text-left">
                    <AppIcon slug={g.slug} name={g.name} websiteUrl={g.guide.app.websiteUrl} />
                    <span>
                      <span className="block font-medium text-foreground">{g.name}</span>
                      <span className="block text-xs text-muted">
                        Saved {new Date(g.savedAt).toLocaleDateString()}
                      </span>
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => removeSavedGuide(g.slug)}
                    className="font-mono-label focus-ring shrink-0 text-xs uppercase text-muted hover:text-rose-600"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
