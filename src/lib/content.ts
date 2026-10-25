import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { Guide, type Guide as GuideT } from "./schema";

const AppMeta = z.object({
  slug: z.string(),
  name: z.string(),
  websiteUrl: z.string().url(),
  aliases: z.array(z.string()),
  order: z.number().int(),
});
export type AppMeta = z.infer<typeof AppMeta>;

const contentDir = path.join(process.cwd(), "content");

export function listApps(): AppMeta[] {
  const raw = fs.readFileSync(path.join(contentDir, "apps.json"), "utf8");
  return z.array(AppMeta).parse(JSON.parse(raw)).sort((a, b) => a.order - b.order);
}

export function getLibraryGuide(slug: string): GuideT | null {
  const file = path.join(contentDir, "library", `${slug}.json`);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, "utf8");
  return Guide.parse(JSON.parse(raw));
}

export function listLibraryGuides(): { app: AppMeta; guide: GuideT }[] {
  return listApps()
    .map((app) => {
      const guide = getLibraryGuide(app.slug);
      return guide ? { app, guide } : null;
    })
    .filter((x): x is { app: AppMeta; guide: GuideT } => x !== null);
}
