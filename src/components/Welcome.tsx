"use client";

import { useState } from "react";
import { Logo } from "./Logo";
import { setUsername } from "@/lib/localUser";

const POINTS = [
  {
    title: "Know the difficulty before you build",
    body: "A clear tier, plus two separate numbers: your own effort and the provider's approval wait.",
  },
  {
    title: "See every gate and who does what",
    body: "Provider review, customer admin and end user, with each step marked as done for you, drafted for you, or yours.",
  },
  {
    title: "Evidence you can check",
    body: "Every claim is labelled Tested, Sourced or Uncertain. Nothing is guessed, and unknown stays unknown.",
  },
];

export function Welcome() {
  const [draft, setDraft] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setUsername(draft);
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-foreground px-6 py-16 text-background">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <div className="relative w-full max-w-2xl">
        <div className="mb-8 flex justify-center">
          <Logo className="[&>span:last-child]:text-background" />
        </div>
        <h1 className="text-center text-4xl font-semibold tracking-tight sm:text-5xl">
          Know how hard your OAuth app approval will be, <span className="text-accent">before you build</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-center text-base text-background/70">
          &ldquo;Fili&rdquo; is Greek for friend. DevFili is the friend who already went through a provider&apos;s
          approval process and wrote down exactly what to expect.
        </p>

        <ul className="mt-10 grid gap-4 sm:grid-cols-3">
          {POINTS.map((p) => (
            <li key={p.title} className="rounded-2xl border border-background/15 bg-background/5 p-4">
              <p className="text-sm font-semibold">{p.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-background/65">{p.body}</p>
            </li>
          ))}
        </ul>

        <form onSubmit={submit} className="mx-auto mt-10 flex max-w-md flex-col gap-3">
          <label htmlFor="welcome-name" className="text-sm font-medium">
            What should we call you?
          </label>
          <input
            id="welcome-name"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Your name"
            maxLength={40}
            className="focus-ring rounded-full border border-background/20 bg-background/10 px-5 py-3 text-sm text-background placeholder:text-background/50"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="font-mono-label focus-ring rounded-full bg-background px-5 py-3 text-xs font-semibold uppercase text-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Continue to the library
          </button>
          <p className="text-center text-xs text-background/50">
            No password, no account. Your name is saved only in this browser, to label the guides you save.
          </p>
        </form>
      </div>
    </div>
  );
}
