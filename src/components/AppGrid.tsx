import type { AppMeta } from "@/lib/content";
import type { Guide } from "@/lib/schema";
import { AppTile } from "./AppTile";

export function AppGrid({ items }: { items: { app: AppMeta; guide: Guide }[] }) {
  return (
    <section id="apps" className="mx-auto max-w-5xl px-6 pb-16">
      <h2 className="mb-4 text-lg font-semibold text-foreground">Reviewed guides</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(({ app, guide }) => (
          <AppTile key={app.slug} app={app} guide={guide} />
        ))}
      </div>
    </section>
  );
}
