import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DevFili — OAuth approval difficulty guides",
  description: "How hard is it to get an OAuth app approved? Difficulty tier, effort, wait, and the three approval gates for 9 reviewed apps plus live research for any other.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
