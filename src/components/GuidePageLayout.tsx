import Link from "next/link";
import type { Guide } from "@/lib/schema";
import { Header } from "./Header";
import { GuideHeader } from "./GuideHeader";
import { GuideSections } from "./GuideView";
import { HelpersRail } from "./HelpersRail";
import { Verdict } from "./Verdict";

const JUMPS = [
  { href: "#scopes", label: "Scopes" },
  { href: "#steps", label: "Steps" },
  { href: "#gate-provider", label: "Gates" },
  { href: "#stuck-points", label: "Stuck points" },
  { href: "#sources", label: "Sources" },
];

export function GuidePageLayout({ guide, backHref = "/#library", backLabel = "Library" }: { guide: Guide; backHref?: string; backLabel?: string }) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <Header />

      <div className="relative overflow-hidden border-b border-border bg-gradient-to-b from-accent/[0.08] to-transparent">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-6 pb-8 pt-6">
          <Link href={backHref} className="focus-ring inline-flex items-center gap-1 rounded text-sm text-muted hover:text-foreground">
            <span aria-hidden="true">&larr;</span> {backLabel}
          </Link>
          <GuideHeader guide={guide} />
          <div className="mt-6">
            <Verdict guide={guide} />
          </div>
        </div>
      </div>

      <nav
        aria-label="On this page"
        className="sticky top-[69px] z-20 border-b border-border bg-background/85 backdrop-blur"
      >
        <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-6 py-2.5">
          {JUMPS.map((j) => (
            <a
              key={j.href}
              href={j.href}
              className="focus-ring shrink-0 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted hover:border-accent hover:text-foreground"
            >
              {j.label}
            </a>
          ))}
        </div>
      </nav>

      <main className="flex-1">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-6 px-6 py-8 pb-20 lg:grid-cols-[minmax(0,1fr)_360px]">
          <article className="order-2 flex min-w-0 flex-col gap-5 lg:order-1">
            <GuideSections guide={guide} />
          </article>
          <div className="order-1 lg:order-2">
            <HelpersRail guide={guide} />
          </div>
        </div>
      </main>
    </div>
  );
}
