import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { AppGrid } from "@/components/AppGrid";
import { listLibraryGuides } from "@/lib/content";

export default function Home() {
  const items = listLibraryGuides();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <Header />
      <main className="flex-1">
        <Hero />
        <AppGrid items={items} />
      </main>
    </div>
  );
}
