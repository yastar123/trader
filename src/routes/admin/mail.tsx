import { createFileRoute } from "@tanstack/react-router";
import { AdminMailView } from "@/components/admin/admin-mail-view";

const pageTitle = "Kotak Surat · wmTrader Admin";
const pageDescription = "Kirim surat dan pemberitahuan kepada pengguna wmTrader.";

export const Route = createFileRoute("/admin/mail")({
  head: () => ({
    meta: [
      { title: pageTitle },
      { name: "description", content: pageDescription },
      { property: "og:title", content: pageTitle },
      { property: "og:description", content: pageDescription },
      { property: "og:type", content: "website" },
    ],
  }),
  component: AdminMailPage,
});

function AdminMailPage() {
  return <AdminMailView />;
}
