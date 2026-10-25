import type { Guide } from "@/lib/schema";
import { AppIcon } from "./AppIcon";
import { SaveButton } from "./SaveButton";

export function GuideHeader({ guide, hideSave = false }: { guide: Guide; hideSave?: boolean }) {
  return (
    <header className="pt-8 pb-2">
      {guide.sample && (
        <span className="mb-3 inline-block rounded-full border border-dashed border-amber-400 px-2 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-600 dark:text-amber-400">
          Sample
        </span>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <AppIcon slug={guide.app.slug} name={guide.app.name} websiteUrl={guide.app.websiteUrl} size={52} />
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">{guide.app.name}</h1>
            <p className="mt-0.5 text-sm text-muted">
              OAuth approval guide &middot; last verified {guide.lastVerifiedOn}
              {guide.handVerified && ` · Hand-verified by ${guide.handVerified.by} on ${guide.handVerified.on}`}
            </p>
          </div>
        </div>
        {!hideSave && <SaveButton guide={guide} />}
      </div>
    </header>
  );
}
