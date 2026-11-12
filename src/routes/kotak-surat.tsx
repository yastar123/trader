import { createFileRoute } from "@tanstack/react-router";
import { KotakSuratView } from "@/components/workspace/kotak-surat-view";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";

const pageTitle = "Kotak Surat | IC Trading";
const pageDescription = "Pesan masuk, peringatan pasar, dan korespondensi dukungan IC Trading.";

export const Route = createFileRoute("/kotak-surat")({
  head: () => ({
    meta: [
      { title: pageTitle },
      { name: "description", content: pageDescription },
      { property: "og:title", content: pageTitle },
      { property: "og:description", content: pageDescription },
    ],
  }),
  component: KotakSuratPage,
});

function KotakSuratPage() {
  return (
    <WorkspaceShell title="Kotak Surat" subtitle="Notifikasi sistem & pesan dukungan">
      <KotakSuratView />
    </WorkspaceShell>
  );
}
