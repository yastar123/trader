import { createFileRoute } from "@tanstack/react-router";
import { AdminWithdrawView } from "@/components/admin/admin-withdraw-view";

const pageTitle = "Verifikasi Withdraw · wmTrader Admin";
const pageDescription = "Antrean verifikasi manual penarikan dana trader wmTrader.";

export const Route = createFileRoute("/admin/withdraw")({
  head: () => ({
    meta: [
      { title: pageTitle },
      { name: "description", content: pageDescription },
      { property: "og:title", content: pageTitle },
      { property: "og:description", content: pageDescription },
      { property: "og:type", content: "website" },
    ],
  }),
  component: AdminWithdrawPage,
});

function AdminWithdrawPage() {
  return <AdminWithdrawView />;
}
