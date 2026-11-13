import { createFileRoute } from "@tanstack/react-router";
import { AdminPositionsView } from "@/components/admin/admin-positions-view";

const pageTitle = "Pantauan Trading User · wmTrader Admin";
const pageDescription = "Pantau posisi trading, lot, leverage, SL, TP, dan P&L trader wmTrader.";

export const Route = createFileRoute("/admin/positions")({
  head: () => ({
    meta: [
      { title: pageTitle },
      { name: "description", content: pageDescription },
      { property: "og:title", content: pageTitle },
      { property: "og:description", content: pageDescription },
      { property: "og:type", content: "website" },
    ],
  }),
  component: AdminPositionsPage,
});

function AdminPositionsPage() {
  return <AdminPositionsView />;
}
