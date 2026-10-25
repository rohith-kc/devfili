// Per-app brand colour used for the monogram tile. A colour is a fact, not a
// trademarked asset - we don't render any provider's actual logomark here
// (several, including Slack, LinkedIn and Microsoft, no longer let
// third-party libraries redistribute their logo files at all), so every app
// gets the same simple colour + initial treatment for visual consistency.
export const BRAND_COLOR: Record<string, string> = {
  zoom: "#0B5CFF",
  slack: "#611F69",
  gong: "#7C3AED",
  hubspot: "#FF7A59",
  notion: "#000000",
  linear: "#5E6AD2",
  "microsoft-teams": "#5059C9",
  "google-gmail": "#EA4335",
  linkedin: "#0A66C2",
};

export function brandColor(slug: string): string {
  return BRAND_COLOR[slug] ?? "#52525b";
}

export function brandInitial(name: string): string {
  const letter = name.replace(/[^A-Za-z]/, "").charAt(0);
  return (letter || name.charAt(0)).toUpperCase();
}
