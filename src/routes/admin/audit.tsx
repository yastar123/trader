import { createFileRoute } from "@tanstack/react-router";
import { AdminAuditView } from "@/components/admin/admin-audit-view";

const pageTitle = "Log Audit · wmTrader Admin";
const pageDescription = "Riwayat verifikasi dan audit operasional administrator wmTrader.";

export const Route = createFileRoute("/admin/audit")({
  head: () => ({
    meta: [
      { title: pageTitle },
      { name: "description", content: pageDescription },
      { property: "og:title", content: pageTitle },
      { property: "og:description", content: pageDescription },
      { property: "og:type", content: "website" },
    ],
  }),
  component: AdminAuditPage,
});

function AdminAuditPage() {
  return <AdminAuditView />;
}
