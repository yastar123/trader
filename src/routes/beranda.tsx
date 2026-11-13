import { createFileRoute } from "@tanstack/react-router";
import { BerandaView } from "@/components/workspace/beranda-view";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";

const pageTitle = "Beranda | wmTrader";
const pageDescription =
  "Ringkasan saldo, ekuitas, pantauan pasar, dan posisi terbuka akun wmTrader.";

export const Route = createFileRoute("/beranda")({
  head: () => ({
    meta: [
      { title: pageTitle },
      { name: "description", content: pageDescription },
      { property: "og:title", content: pageTitle },
      { property: "og:description", content: pageDescription },
    ],
  }),
  component: BerandaPage,
});

function BerandaPage() {
  return (
    <WorkspaceShell title="Beranda" subtitle="Ringkasan akun dan pergerakan pasar utama">
      <BerandaView />
    </WorkspaceShell>
  );
}
