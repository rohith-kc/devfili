import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { LibraryBrowser } from "@/components/LibraryBrowser";
import { listLibraryGuides } from "@/lib/content";

export default function Home() {
  const items = listLibraryGuides();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <Header />
      <main className="flex-1">
        <Hero />
        <LibraryBrowser items={items} />
      </main>
    </div>
  );
}
