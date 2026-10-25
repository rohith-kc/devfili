import type { Guide } from "@/lib/schema";
import { AppIcon } from "./AppIcon";

export function GuideHeader({ guide }: { guide: Guide }) {
  return (
    <header className="pt-10 pb-6">
      {guide.sample && (
        <span className="mb-3 inline-block rounded-full border border-dashed border-amber-400 px-2 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-600 dark:text-amber-400">
          Sample
        </span>
      )}
      <div className="flex items-center gap-3">
        <AppIcon slug={guide.app.slug} name={guide.app.name} websiteUrl={guide.app.websiteUrl} size={44} />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{guide.app.name}</h1>
          <p className="text-sm text-muted">
            Last verified {guide.lastVerifiedOn}
            {guide.handVerified && ` · Hand-verified by ${guide.handVerified.by} on ${guide.handVerified.on}`}
          </p>
        </div>
      </div>
    </header>
  );
}
