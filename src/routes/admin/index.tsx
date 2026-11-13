import { createFileRoute } from "@tanstack/react-router";
import { AdminOverviewView } from "@/components/admin/admin-overview-view";

const pageTitle = "Ringkasan Admin · wmTrader";
const pageDescription = "Panel operasional administrator wmTrader.";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: pageTitle },
      { name: "description", content: pageDescription },
      { property: "og:title", content: pageTitle },
      { property: "og:description", content: pageDescription },
      { property: "og:type", content: "website" },
    ],
  }),
  component: AdminOverviewPage,
});

function AdminOverviewPage() {
  return <AdminOverviewView />;
}
