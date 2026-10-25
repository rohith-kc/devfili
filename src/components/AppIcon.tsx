"use client";

import { useState } from "react";
import { brandColor, brandInitial, faviconUrl } from "@/lib/brand";

export function AppIcon({
  slug,
  name,
  websiteUrl,
  size = 40,
}: {
  slug: string;
  name: string;
  websiteUrl?: string | null;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const color = brandColor(slug);
  const showFavicon = websiteUrl && !failed;

  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-xl font-semibold text-white"
      style={{ backgroundColor: color, width: size, height: size, fontSize: size * 0.42 }}
    >
      {showFavicon ? (
        // eslint-disable-next-line @next/next/no-img-element -- external favicon proxy, not an optimizable local asset
        <img
          src={faviconUrl(slug, websiteUrl)}
          alt=""
          width={size * 0.62}
          height={size * 0.62}
          className="rounded-sm bg-white/90 object-contain p-0.5"
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-hidden="true">{brandInitial(name)}</span>
      )}
    </span>
  );
}
