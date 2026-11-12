import { createFileRoute } from "@tanstack/react-router";
import { KalenderAkademiView } from "@/components/workspace/kalender-akademi-view";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";

const pageTitle = "Kalender Akademi | IC Trading";
const pageDescription = "Kalender rilis data ekonomi dan jadwal webinar edukasi IC Trading.";

export const Route = createFileRoute("/kalender-akademi")({
  head: () => ({
    meta: [
      { title: pageTitle },
      { name: "description", content: pageDescription },
      { property: "og:title", content: pageTitle },
      { property: "og:description", content: pageDescription },
    ],
  }),
  component: KalenderAkademiPage,
});

function KalenderAkademiPage() {
  return (
    <WorkspaceShell
      title="Kalender Akademi"
      subtitle="Jadwal berita makroekonomi & sesi pembelajaran"
    >
      <KalenderAkademiView />
    </WorkspaceShell>
  );
}
