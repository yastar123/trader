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

const pageTitle = "wmTrader | Platform Trading Forex & CFD";
const pageDescription =
  "wmTrader menghadirkan akses ke berbagai pasar, informasi platform, dan fitur trading Forex & CFD.";

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
