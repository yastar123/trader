import { createFileRoute } from "@tanstack/react-router";
import { Hero } from "@/components/landing/hero";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import {
  AutomationSection,
  GoldSection,
  MarketsSection,
  PlatformsSection,
  RawSection,
  StrengthSection,
} from "@/components/landing/sections";

const pageTitle = "IC | Trading Edge Anda — Online Forex & CFD Trading";
const pageDescription =
  "Halaman broker trading: spread mulai 0.0 pip, akses ke berbagai pasar, dan informasi platform trading.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: pageTitle },
      { name: "description", content: pageDescription },
      { property: "og:title", content: pageTitle },
      { property: "og:description", content: pageDescription },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main>
        <Hero />
        <RawSection />
        <StrengthSection />
        <PlatformsSection />
        <MarketsSection />
        <GoldSection />
        <AutomationSection />
      </main>
      <SiteFooter />
    </div>
  );
}
