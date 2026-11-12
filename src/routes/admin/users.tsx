import { createFileRoute } from "@tanstack/react-router";
import { AdminUsersView } from "@/components/admin/admin-users-view";

const pageTitle = "Pengguna · IC Admin";
const pageDescription = "Manajemen pengguna dan verifikasi KYC IC Trading.";

export const Route = createFileRoute("/admin/users")({
  head: () => ({
    meta: [
      { title: pageTitle },
      { name: "description", content: pageDescription },
      { property: "og:title", content: pageTitle },
      { property: "og:description", content: pageDescription },
      { property: "og:type", content: "website" },
    ],
  }),
  component: AdminUsersPage,
});

function AdminUsersPage() {
  return <AdminUsersView />;
}
