import { createFileRoute } from "@tanstack/react-router";
import { TradeView } from "@/components/workspace/trade-view";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";

const pageTitle = "Riwayat Posisi | wmTrader";
const pageDescription = "Lihat riwayat posisi trading yang telah ditutup.";

export const Route = createFileRoute("/riwayat")({
  head: () => ({
    meta: [
      { title: pageTitle },
      { name: "description", content: pageDescription },
      { property: "og:title", content: pageTitle },
      { property: "og:description", content: pageDescription },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  return (
    <WorkspaceShell title="Riwayat" subtitle="Riwayat posisi yang telah ditutup">
      <TradeView mode="positions" initialTab="Ditutup" />
    </WorkspaceShell>
  );
}
