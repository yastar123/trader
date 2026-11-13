import { createFileRoute } from "@tanstack/react-router";
import { ChartView } from "@/components/workspace/chart-view";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";

const pageTitle = "Chart | wmTrader";
const pageDescription = "Pantau grafik harga dan kuotasi live instrumen pasar wmTrader.";

export const Route = createFileRoute("/chart")({
  head: () => ({
    meta: [
      { title: pageTitle },
      { name: "description", content: pageDescription },
      { property: "og:title", content: pageTitle },
      { property: "og:description", content: pageDescription },
    ],
  }),
  component: ChartPage,
});

function ChartPage() {
  return (
    <WorkspaceShell title="Chart" fullWidth>
      <ChartView />
    </WorkspaceShell>
  );
}
