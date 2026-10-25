export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width="28" height="20" viewBox="0 0 28 20" aria-hidden="true" className="shrink-0">
        <circle cx="10" cy="10" r="8" fill="none" stroke="var(--color-accent)" strokeWidth="2" />
        <circle cx="18" cy="10" r="8" fill="none" stroke="var(--color-accent)" strokeWidth="2" opacity="0.55" />
      </svg>
      <span className="font-semibold tracking-tight text-[1.05rem] text-foreground">DevFili</span>
    </span>
  );
}
