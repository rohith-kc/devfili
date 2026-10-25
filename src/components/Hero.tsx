export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border bg-foreground text-background">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <div className="relative mx-auto max-w-6xl px-6 py-20 text-center sm:py-28">
        <span className="font-mono-label inline-block rounded-full border border-background/20 px-3 py-1 text-xs uppercase tracking-wide text-background/70">
          9 apps reviewed &middot; live research for the rest
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
          Get your OAuth app approved <span className="text-accent">swiftly</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-background/70 sm:text-lg">
          Difficulty tier, your time, the wait, and the three approval gates &mdash; for Zoom, Slack, HubSpot, and
          six more, with evidence you can check yourself.
        </p>
      </div>
    </section>
  );
}
