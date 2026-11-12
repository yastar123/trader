import { createFileRoute } from "@tanstack/react-router";
import { JurnalView } from "@/components/workspace/jurnal-view";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";

const pageTitle = "Jurnal Trading | IC Trading";
const pageDescription = "Catatan transaksi, evaluasi strategi, dan statistik performa trading.";

export const Route = createFileRoute("/jurnal")({
  head: () => ({
    meta: [
      { title: pageTitle },
      { name: "description", content: pageDescription },
      { property: "og:title", content: pageTitle },
      { property: "og:description", content: pageDescription },
    ],
  }),
  component: JurnalPage,
});

function JurnalPage() {
  return (
    <WorkspaceShell title="Jurnal" subtitle="Dokumentasi dan evaluasi riwayat transaksi">
      <JurnalView />
    </WorkspaceShell>
  );
}
