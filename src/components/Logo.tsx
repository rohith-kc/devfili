export function Logo({ className = "", mark = true }: { className?: string; mark?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {mark && (
        <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true" className="shrink-0">
          <circle cx="13" cy="13" r="12" fill="var(--color-accent)" />
          <path
            d="M8 13.2l3.3 3.3L18.2 9.3"
            fill="none"
            stroke="var(--color-accent-foreground)"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      <span className="font-semibold tracking-tight text-[1.15rem] text-foreground">DevFili</span>
    </span>
  );
}
