import { useMemo, useSyncExternalStore } from "react";
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

const CHANGE_EVENT = "devfili:local-change";

function notify(): void {
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

const noopSubscribe = () => () => {};

/** False during server render and first hydration pass, true afterwards. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export function useUsername(): string | null {
  return useSyncExternalStore(subscribe, () => getUsername(), () => null);
}

export function useSavedGuides(): SavedGuide[] {
  const raw = useSyncExternalStore(
    subscribe,
    () => (typeof window === "undefined" ? null : safeGet(SAVED_GUIDES_KEY)),
    () => null
  );
  return useMemo(() => parseSaved(raw), [raw]);
}

function parseSaved(raw: string | null): SavedGuide[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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
  notify();
}

export function clearUsername(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(USERNAME_KEY);
  } catch {
    // ignore
  }
  notify();
}

export function getSavedGuides(): SavedGuide[] {
  if (typeof window === "undefined") return [];
  return parseSaved(safeGet(SAVED_GUIDES_KEY));
}

const DEVICE_KEY = "devfili:device-id";

/** Random id for this browser; saved guides in the database are keyed by it. */
export function getDeviceId(): string | null {
  if (typeof window === "undefined") return null;
  let id = safeGet(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    safeSet(DEVICE_KEY, id);
  }
  return id;
}

/** Best-effort: the browser copy stays the source of truth if the database is down. */
function pushToServer(method: "POST" | "DELETE", guide: Guide | null, slug?: string): void {
  const deviceId = getDeviceId();
  if (!deviceId) return;
  const request =
    method === "POST"
      ? fetch("/api/saved", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId, guide }),
        })
      : fetch(`/api/saved?device=${deviceId}&slug=${encodeURIComponent(slug ?? "")}`, { method: "DELETE" });
  request.catch(() => {});
}

/** Merges the database copy into this browser's list (union by slug, newest first). */
export async function syncSavedFromServer(): Promise<void> {
  const deviceId = getDeviceId();
  if (!deviceId) return;
  try {
    const res = await fetch(`/api/saved?device=${deviceId}`);
    if (!res.ok) return;
    const body = (await res.json()) as { saved: SavedGuide[] };
    const local = getSavedGuides();
    const localSlugs = new Set(local.map((g) => g.slug));
    const remoteSlugs = new Set(body.saved.map((g) => g.slug));
    const merged = [...local, ...body.saved.filter((g) => !localSlugs.has(g.slug))]
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
      .slice(0, 25);
    safeSet(SAVED_GUIDES_KEY, JSON.stringify(merged));
    notify();
    for (const g of local) if (!remoteSlugs.has(g.slug)) pushToServer("POST", g.guide);
  } catch {
    // offline or database unavailable: keep the local list
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
  notify();
  pushToServer("POST", guide);
}

export function removeSavedGuide(slug: string): void {
  if (typeof window === "undefined") return;
  const next = getSavedGuides().filter((g) => g.slug !== slug);
  safeSet(SAVED_GUIDES_KEY, JSON.stringify(next));
  notify();
  pushToServer("DELETE", null, slug);
}

export function isGuideSaved(slug: string): boolean {
  return getSavedGuides().some((g) => g.slug === slug);
}
