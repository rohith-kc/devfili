import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { GuideHeader } from "@/components/GuideHeader";
import { GuideSections } from "@/components/GuideView";
import { HelpersRail } from "@/components/HelpersRail";
import { Verdict } from "@/components/Verdict";
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
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-6 pb-20 lg:grid-cols-[1fr_320px]">
          <article>
            <GuideHeader guide={guide} />
            <Verdict guide={guide} />
            <div className="py-8 lg:hidden">
              <HelpersRail guide={guide} />
            </div>
            <GuideSections guide={guide} />
          </article>
          <div className="hidden lg:block lg:pt-10">
            <HelpersRail guide={guide} />
          </div>
        </div>
      </main>
    </div>
  );
}
