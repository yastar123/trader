import { createFileRoute } from "@tanstack/react-router";
import { PengaturanView } from "@/components/workspace/pengaturan-view";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";

const pageTitle = "Pengaturan | IC Trading";
const pageDescription = "Pengaturan profil, preferensi eksekusi trading, keamanan, dan notifikasi.";

export const Route = createFileRoute("/pengaturan")({
  head: () => ({
    meta: [
      { title: pageTitle },
      { name: "description", content: pageDescription },
      { property: "og:title", content: pageTitle },
      { property: "og:description", content: pageDescription },
    ],
  }),
  component: PengaturanPage,
});

function PengaturanPage() {
  return (
    <WorkspaceShell
      title="Pengaturan"
      subtitle="Konfigurasi profil, keamanan, dan preferensi order"
    >
      <PengaturanView />
    </WorkspaceShell>
  );
}
