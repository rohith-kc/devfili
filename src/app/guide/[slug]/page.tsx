import { notFound } from "next/navigation";
import { GuidePageLayout } from "@/components/GuidePageLayout";
import { listApps, getLibraryGuide } from "@/lib/content";

export function generateStaticParams() {
  return listApps().map((app) => ({ slug: app.slug }));
}

export default async function GuidePage({ params }: PageProps<"/guide/[slug]">) {
  const { slug } = await params;
  const guide = getLibraryGuide(slug);
  if (!guide) notFound();

  return <GuidePageLayout guide={guide} />;
}
