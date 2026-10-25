import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <Logo />
        <p className="mt-3 max-w-2xl text-sm text-muted">
          <span className="font-medium text-foreground">&ldquo;Fili&rdquo;</span> is Greek for friend &mdash; DevFili is
          built to be the friend who already went through a provider&apos;s OAuth approval process and wrote down
          exactly what to expect, so you don&apos;t have to find out the hard way.
        </p>
        <p className="mt-3 max-w-2xl text-xs text-muted">
          Difficulty tier, effort, and wait are set by code from the evidence we collect &mdash; never guessed by a
          model. Every factual claim is labeled Tested, Sourced, or Uncertain, with its source one click away.
        </p>
      </div>
    </footer>
  );
}
