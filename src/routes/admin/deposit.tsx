import { createFileRoute } from "@tanstack/react-router";
import { AdminDepositView } from "@/components/admin/admin-deposit-view";

const pageTitle = "Verifikasi Deposit · wmTrader Admin";
const pageDescription = "Antrean verifikasi manual deposit trader wmTrader.";

export const Route = createFileRoute("/admin/deposit")({
  head: () => ({
    meta: [
      { title: pageTitle },
      { name: "description", content: pageDescription },
      { property: "og:title", content: pageTitle },
      { property: "og:description", content: pageDescription },
      { property: "og:type", content: "website" },
    ],
  }),
  component: AdminDepositPage,
});

function AdminDepositPage() {
  return <AdminDepositView />;
}
