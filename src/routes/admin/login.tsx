import { createFileRoute } from "@tanstack/react-router";
import { AdminLoginView } from "@/components/admin/admin-login-view";

const pageTitle = "Masuk Admin · wmTrader";
const pageDescription = "Halaman masuk administrator wmTrader.";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [
      { title: pageTitle },
      { name: "description", content: pageDescription },
      { property: "og:title", content: pageTitle },
      { property: "og:description", content: pageDescription },
      { property: "og:type", content: "website" },
    ],
  }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  return <AdminLoginView />;
}
