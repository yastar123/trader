import { createFileRoute } from "@tanstack/react-router";
import { WithdrawView } from "@/components/workspace/withdraw-view";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";

const pageTitle = "Withdraw | IC Trading";
const pageDescription = "Pengajuan penarikan dana akun trading dengan verifikasi manual admin.";

export const Route = createFileRoute("/withdraw")({
  head: () => ({
    meta: [
      { title: pageTitle },
      { name: "description", content: pageDescription },
      { property: "og:title", content: pageTitle },
      { property: "og:description", content: pageDescription },
    ],
  }),
  component: WithdrawPage,
});

function WithdrawPage() {
  return (
    <WorkspaceShell title="Withdraw" subtitle="Pengajuan pencairan saldo ke rekening tujuan">
      <WithdrawView />
    </WorkspaceShell>
  );
}
