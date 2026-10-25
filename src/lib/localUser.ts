import type { Guide } from "./schema";

// A deliberately simple, name-only "sign-in": no password, no server account.
// Everything lives in this browser's localStorage, so it's per-device, not
// per-person - good enough to label "my guides" without building real auth.

const USERNAME_KEY = "devfili:username";
const SAVED_GUIDES_KEY = "devfili:saved-guides";

export interface SavedGuide {
  slug: string;
  name: string;
  savedAt: string;
  guide: Guide;
}

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function getUsername(): string | null {
  if (typeof window === "undefined") return null;
  return safeGet(USERNAME_KEY);
}

export function setUsername(name: string): void {
  if (typeof window === "undefined") return;
  safeSet(USERNAME_KEY, name.trim().slice(0, 40));
}

export function clearUsername(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(USERNAME_KEY);
  } catch {
    // ignore
  }
}

export function getSavedGuides(): SavedGuide[] {
  if (typeof window === "undefined") return [];
  const raw = safeGet(SAVED_GUIDES_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveGuide(guide: Guide): void {
  if (typeof window === "undefined") return;
  const existing = getSavedGuides().filter((g) => g.slug !== guide.app.slug);
  const next: SavedGuide[] = [
    { slug: guide.app.slug, name: guide.app.name, savedAt: new Date().toISOString(), guide },
    ...existing,
  ].slice(0, 25);
  safeSet(SAVED_GUIDES_KEY, JSON.stringify(next));
}

export function removeSavedGuide(slug: string): void {
  if (typeof window === "undefined") return;
  const next = getSavedGuides().filter((g) => g.slug !== slug);
  safeSet(SAVED_GUIDES_KEY, JSON.stringify(next));
}

export function isGuideSaved(slug: string): boolean {
  return getSavedGuides().some((g) => g.slug === slug);
}
