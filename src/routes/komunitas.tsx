import { createFileRoute } from "@tanstack/react-router";
import { KomunitasView } from "@/components/workspace/komunitas-view";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";

const pageTitle = "Komunitas | IC Trading";
const pageDescription = "Forum diskusi, ide analisis teknikal, dan sentimen trader IC Trading.";

export const Route = createFileRoute("/komunitas")({
  head: () => ({
    meta: [
      { title: pageTitle },
      { name: "description", content: pageDescription },
      { property: "og:title", content: pageTitle },
      { property: "og:description", content: pageDescription },
    ],
  }),
  component: KomunitasPage,
});

function KomunitasPage() {
  return (
    <WorkspaceShell title="Komunitas" subtitle="Diskusi analisis pasar dan sentimen trader">
      <KomunitasView />
    </WorkspaceShell>
  );
}
