import Link from "next/link";
import { Logo } from "./Logo";

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="focus-ring rounded">
          <Logo />
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-6">
          <Link href="/#library" className="focus-ring rounded text-sm font-medium text-muted hover:text-foreground">
            Library
          </Link>
          <Link
            href="/#library"
            className="font-mono-label focus-ring inline-flex items-center rounded-full bg-foreground px-4 py-2 text-xs font-semibold uppercase text-background transition-opacity hover:opacity-85"
          >
            Check an app
          </Link>
        </nav>
      </div>
    </header>
  );
}
