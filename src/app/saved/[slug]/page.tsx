"use client";

import { use } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { GuidePageLayout } from "@/components/GuidePageLayout";
import { useHydrated, useSavedGuides } from "@/lib/localUser";

export default function SavedGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const hydrated = useHydrated();
  const saved = useSavedGuides().find((g) => g.slug === slug);

  if (saved) return <GuidePageLayout guide={saved.guide} backHref="/my-guides" backLabel="My guides" />;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16 text-center">
        {hydrated && (
          <>
            <h1 className="text-xl font-semibold text-foreground">That guide isn&apos;t saved on this device</h1>
            <p className="mt-2 text-sm text-muted">
              Saved guides live in this browser. Research the app with &ldquo;Check an app&rdquo; and save it again.
            </p>
            <Link href="/my-guides" className="focus-ring mt-4 inline-block text-sm text-accent hover:underline">
              Back to My guides
            </Link>
          </>
        )}
      </main>
    </div>
  );
}
