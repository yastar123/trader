import { createFileRoute } from "@tanstack/react-router";
import { TentangView } from "@/components/workspace/tentang-view";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";

const pageTitle = "Tentang | IC Trading";
const pageDescription =
  "Informasi perusahaan, infrastruktur eksekusi, kepatuhan, dan kontak IC Trading.";

export const Route = createFileRoute("/tentang")({
  head: () => ({
    meta: [
      { title: pageTitle },
      { name: "description", content: pageDescription },
      { property: "og:title", content: pageTitle },
      { property: "og:description", content: pageDescription },
    ],
  }),
  component: TentangPage,
});

function TentangPage() {
  return (
    <WorkspaceShell title="Tentang" subtitle="Profil perusahaan, infrastruktur, dan kepatuhan">
      <TentangView />
    </WorkspaceShell>
  );
}
