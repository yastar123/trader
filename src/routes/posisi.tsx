import { createFileRoute } from "@tanstack/react-router";
import { TradeView } from "@/components/workspace/trade-view";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";

const pageTitle = "Posisi | wmTrader";
const pageDescription = "Pantau posisi terbuka, order tertunda, dan riwayat trading.";

export const Route = createFileRoute("/posisi")({
  head: () => ({
    meta: [
      { title: pageTitle },
      { name: "description", content: pageDescription },
      { property: "og:title", content: pageTitle },
      { property: "og:description", content: pageDescription },
    ],
  }),
  component: PositionsPage,
});

function PositionsPage() {
  return (
    <WorkspaceShell title="Posisi" subtitle="Posisi terbuka dan order tertunda">
      <TradeView mode="positions" initialTab="Terbuka" />
    </WorkspaceShell>
  );
}
