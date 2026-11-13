import { createFileRoute } from "@tanstack/react-router";
import { AdminCalendarView } from "@/components/admin/admin-calendar-view";

const pageTitle = "Kalender · wmTrader Admin";
const pageDescription = "Terbitkan informasi kalender ekonomi dan akademi untuk pengguna wmTrader.";

export const Route = createFileRoute("/admin/calendar")({
  head: () => ({
    meta: [
      { title: pageTitle },
      { name: "description", content: pageDescription },
      { property: "og:title", content: pageTitle },
      { property: "og:description", content: pageDescription },
      { property: "og:type", content: "website" },
    ],
  }),
  component: AdminCalendarPage,
});

function AdminCalendarPage() {
  return <AdminCalendarView />;
}
