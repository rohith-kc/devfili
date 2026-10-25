import Link from "next/link";
import { Logo } from "./Logo";

export function Header() {
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="focus-ring rounded">
          <Logo />
        </Link>
        <nav aria-label="Primary">
          <Link
            href="/#apps"
            className="focus-ring rounded text-sm font-medium text-zinc-600 hover:text-foreground dark:text-zinc-400"
          >
            Library
          </Link>
        </nav>
      </div>
    </header>
  );
}
