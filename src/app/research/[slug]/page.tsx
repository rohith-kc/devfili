"use client";

import { use } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { GuidePageLayout } from "@/components/GuidePageLayout";
import { useHydrated, useRecentResults, useSavedGuides } from "@/lib/localUser";

export default function ResearchResultPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const hydrated = useHydrated();
  const recent = useRecentResults().find((r) => r.slug === slug);
  const saved = useSavedGuides().find((g) => g.slug === slug);
  const guide = recent?.guide ?? saved?.guide;

  if (guide) {
    return (
      <GuidePageLayout
        guide={guide}
        backHref="/"
        backLabel="Library"
        notice="Researched live from public pages. Not hand-reviewed: check the evidence labels."
      />
    );
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16 text-center">
        {hydrated && (
          <>
            <h1 className="text-xl font-semibold text-foreground">This research result isn&apos;t on this device</h1>
            <p className="mt-2 text-sm text-muted">Use &ldquo;Check an app&rdquo; to research it again.</p>
            <Link href="/" className="focus-ring mt-4 inline-block text-sm text-accent hover:underline">
              Back to the library
            </Link>
          </>
        )}
      </main>
    </div>
  );
}
