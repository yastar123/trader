import { createFileRoute } from "@tanstack/react-router";
import { TradeView } from "@/components/workspace/trade-view";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";

const pageTitle = "Trade | IC Trading";
const pageDescription = "Terminal trading interaktif untuk eksekusi order dan pemantauan posisi.";

export const Route = createFileRoute("/trade")({
  head: () => ({
    meta: [
      { title: pageTitle },
      { name: "description", content: pageDescription },
      { property: "og:title", content: pageTitle },
      { property: "og:description", content: pageDescription },
    ],
  }),
  component: TradePage,
});

function TradePage() {
  return (
    <WorkspaceShell title="Trade" subtitle="Terminal eksekusi pasar & manajemen posisi">
      <TradeView />
    </WorkspaceShell>
  );
}
