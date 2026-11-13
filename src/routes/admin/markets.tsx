import { createFileRoute } from "@tanstack/react-router";
import { AdminMarketsView } from "@/components/admin/admin-markets-view";

const pageTitle = "Instrumen & Arah Pasar · wmTrader Admin";
const pageDescription = "Kelola instrumen coin, emas, oil, dan forex di platform wmTrader.";

export const Route = createFileRoute("/admin/markets")({
  head: () => ({
    meta: [
      { title: pageTitle },
      { name: "description", content: pageDescription },
      { property: "og:title", content: pageTitle },
      { property: "og:description", content: pageDescription },
      { property: "og:type", content: "website" },
    ],
  }),
  component: AdminMarketsPage,
});

function AdminMarketsPage() {
  return <AdminMarketsView />;
}
