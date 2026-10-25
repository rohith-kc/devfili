"use client";

import type { ReactNode } from "react";
import { useHydrated, useUsername } from "@/lib/localUser";
import { Welcome } from "./Welcome";

export function HomeGate({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  const name = useUsername();

  if (!hydrated) return <div className="min-h-screen bg-foreground" aria-hidden="true" />;
  if (!name) return <Welcome />;
  return <>{children}</>;
}
