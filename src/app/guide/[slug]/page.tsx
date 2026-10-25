import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { GuideView } from "@/components/GuideView";
import { listApps, getLibraryGuide } from "@/lib/content";

export function generateStaticParams() {
  return listApps().map((app) => ({ slug: app.slug }));
}

export default async function GuidePage({ params }: PageProps<"/guide/[slug]">) {
  const { slug } = await params;
  const guide = getLibraryGuide(slug);
  if (!guide) notFound();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <Header />
      <main className="flex-1">
        <GuideView guide={guide} />
      </main>
    </div>
  );
}
