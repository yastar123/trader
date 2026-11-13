import { createFileRoute } from "@tanstack/react-router";
import { DepositView } from "@/components/workspace/deposit-view";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";

const pageTitle = "Deposit | wmTrader";
const pageDescription = "Pengajuan deposit dana akun wmTrader dengan verifikasi manual admin.";

export const Route = createFileRoute("/deposit")({
  head: () => ({
    meta: [
      { title: pageTitle },
      { name: "description", content: pageDescription },
      { property: "og:title", content: pageTitle },
      { property: "og:description", content: pageDescription },
    ],
  }),
  component: DepositPage,
});

function DepositPage() {
  return (
    <WorkspaceShell title="Deposit" subtitle="Pengajuan tambah saldo & konfirmasi transfer">
      <DepositView />
    </WorkspaceShell>
  );
}
