import { brandColor, brandInitial } from "@/lib/brand";

export function AppIcon({ slug, name, size = 40 }: { slug: string; name: string; size?: number }) {
  const color = brandColor(slug);
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-xl font-semibold text-white"
      style={{ backgroundColor: color, width: size, height: size, fontSize: size * 0.42 }}
    >
      {brandInitial(name)}
    </span>
  );
}
