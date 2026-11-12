import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Eye, X } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  formatUsd,
  type AdminOverviewResponse,
  type DepositRequestRecord,
} from "@/components/admin/admin-types";
import { Button } from "@/components/ui/button";
import { DataPagination, usePagination } from "@/components/ui/data-pagination";

export function AdminOverviewView() {
  const [data, setData] = useState<AdminOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [previewProof, setPreviewProof] = useState<DepositRequestRecord | null>(null);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const loadOverview = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/overview");
      if (res.ok) {
        const json = (await res.json()) as AdminOverviewResponse;
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  async function handleQuickVerify(
    kind: "deposits" | "withdrawals",
    id: string,
    decision: "approve" | "reject",
  ) {
    setBusyId(id);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/${kind}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setFeedback({ type: "err", text: payload?.error ?? "Gagal memproses verifikasi." });
        return;
      }
      setFeedback({
        type: "ok",
        text: `Permintaan ${id} berhasil ${decision === "approve" ? "disetujui" : "ditolak"}.`,
      });
      await loadOverview();
    } finally {
      setBusyId(null);
    }
  }

  const stats = data?.stats;
  const pendingDepositPagination = usePagination(data?.pendingDeposits ?? [], 3);
  const pendingWithdrawPagination = usePagination(data?.pendingWithdrawals ?? [], 3);
  const recentAuditPagination = usePagination(data?.recentAudit ?? [], 4);

  return (
    <AdminShell
      title="Ringkasan Operasional"
      subtitle="Pantauan antrean verifikasi manual deposit, withdraw, dan aktivitas akun."
      pendingDepositsCount={stats?.pendingDepositsCount}
      pendingWithdrawalsCount={stats?.pendingWithdrawalsCount}
    >
      <div className="space-y-8">
        <section className="flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Kontrol Verifikasi Manual
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Ringkasan Operasional Admin
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to="/admin/markets"
              className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-card px-4 text-sm font-medium whitespace-nowrap text-foreground transition-colors hover:bg-accent"
            >
              Instrumen & Arah
            </Link>
            <Link
              to="/admin/positions"
              className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-card px-4 text-sm font-medium whitespace-nowrap text-foreground transition-colors hover:bg-accent"
            >
              Pantauan Trading
            </Link>
            <Link
              to="/admin/deposit"
              className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-card px-4 text-sm font-medium whitespace-nowrap text-foreground transition-colors hover:bg-accent"
            >
              Kelola Deposit
            </Link>
            <Link
              to="/admin/withdraw"
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-bold whitespace-nowrap text-primary-foreground transition-opacity hover:opacity-90"
            >
              Kelola Withdraw
            </Link>
          </div>
        </section>

        {feedback && (
          <div
            role="status"
            className={
              feedback.type === "ok"
                ? "rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary"
                : "rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            }
          >
            {feedback.text}
          </div>
        )}

        {/* 4-Column KPI Strip */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-medium text-muted-foreground">Deposit Menunggu</p>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-foreground">
              {loading ? "—" : (stats?.pendingDepositsCount ?? 0)}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">Memerlukan verifikasi manual</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-medium text-muted-foreground">Withdraw Menunggu</p>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-foreground">
              {loading ? "—" : (stats?.pendingWithdrawalsCount ?? 0)}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">Menunggu persetujuan transfer</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-medium text-muted-foreground">Total Deposit Disetujui</p>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-primary">
              {loading ? "—" : formatUsd(stats?.approvedDepositTotal ?? 0)}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Withdraw disetujui:{" "}
              <span className="font-mono tabular-nums">
                {loading ? "—" : formatUsd(stats?.approvedWithdrawTotal ?? 0)}
              </span>
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-medium text-muted-foreground">Pengguna Aktif</p>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-foreground">
              {loading ? "—" : `${stats?.activeUsersCount ?? 0} / ${stats?.totalUsersCount ?? 0}`}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">Akun trader terdaftar</p>
          </div>
        </section>

        {/* Pending Queues */}
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <h2 className="font-display text-lg font-bold">Antrean Deposit Masuk</h2>
                <p className="text-xs text-muted-foreground">
                  Saldo trader dikreditkan setelah Anda klik Setujui.
                </p>
              </div>
              <Link
                to="/admin/deposit"
                className="inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap text-primary hover:underline"
              >
                Semua
                <ArrowRight className="size-3.5" />
              </Link>
            </div>

            <div className="mt-4 divide-y divide-border">
              {!data?.pendingDeposits.length ? (
                <p className="py-6 text-sm text-muted-foreground">
                  Tidak ada permintaan deposit yang menunggu verifikasi.
                </p>
              ) : (
                pendingDepositPagination.paginatedItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col justify-between gap-3 py-3.5 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-semibold text-muted-foreground">
                        {item.id} · {item.accountId}
                      </p>
                      <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
                        {item.userName} ·{" "}
                        <span className="font-mono tabular-nums text-primary">
                          {formatUsd(item.amount)}
                        </span>
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {item.method} · Ref {item.reference}
                      </p>
                      {item.proofImage && (
                        <button
                          type="button"
                          onClick={() => setPreviewProof(item)}
                          className="mt-1.5 inline-flex items-center gap-1.5 rounded border border-border bg-background px-2 py-0.5 text-[11px] font-semibold text-primary hover:border-primary"
                        >
                          <Eye className="size-3" />
                          Lihat Bukti Transfer
                        </button>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={busyId === item.id}
                        onClick={() => void handleQuickVerify("deposits", item.id, "approve")}
                        className="h-8 bg-primary px-3 text-xs font-bold text-primary-foreground hover:bg-primary/90"
                      >
                        <Check className="mr-1 size-3.5" />
                        Setujui
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busyId === item.id}
                        onClick={() => void handleQuickVerify("deposits", item.id, "reject")}
                        className="h-8 border-border px-3 text-xs text-destructive hover:bg-destructive/10"
                      >
                        <X className="mr-1 size-3.5" />
                        Tolak
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <DataPagination
              page={pendingDepositPagination.page}
              totalPages={pendingDepositPagination.totalPages}
              totalItems={pendingDepositPagination.totalItems}
              startItem={pendingDepositPagination.startItem}
              endItem={pendingDepositPagination.endItem}
              pageSize={pendingDepositPagination.pageSize}
              onPageChange={pendingDepositPagination.setPage}
              compact
              className="mt-2"
            />
          </div>

          <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <h2 className="font-display text-lg font-bold">Antrean Withdraw Masuk</h2>
                <p className="text-xs text-muted-foreground">
                  Saldo trader dipotong otomatis saat penarikan disetujui.
                </p>
              </div>
              <Link
                to="/admin/withdraw"
                className="inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap text-primary hover:underline"
              >
                Semua
                <ArrowRight className="size-3.5" />
              </Link>
            </div>

            <div className="mt-4 divide-y divide-border">
              {!data?.pendingWithdrawals.length ? (
                <p className="py-6 text-sm text-muted-foreground">
                  Tidak ada permintaan withdraw yang menunggu verifikasi.
                </p>
              ) : (
                pendingWithdrawPagination.paginatedItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col justify-between gap-3 py-3.5 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-semibold text-muted-foreground">
                        {item.id} · {item.accountId}
                      </p>
                      <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
                        {item.userName} ·{" "}
                        <span className="font-mono tabular-nums text-foreground">
                          {formatUsd(item.amount)}
                        </span>
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {item.destination}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={busyId === item.id}
                        onClick={() => void handleQuickVerify("withdrawals", item.id, "approve")}
                        className="h-8 bg-primary px-3 text-xs font-bold text-primary-foreground hover:bg-primary/90"
                      >
                        <Check className="mr-1 size-3.5" />
                        Setujui
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busyId === item.id}
                        onClick={() => void handleQuickVerify("withdrawals", item.id, "reject")}
                        className="h-8 border-border px-3 text-xs text-destructive hover:bg-destructive/10"
                      >
                        <X className="mr-1 size-3.5" />
                        Tolak
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <DataPagination
              page={pendingWithdrawPagination.page}
              totalPages={pendingWithdrawPagination.totalPages}
              totalItems={pendingWithdrawPagination.totalItems}
              startItem={pendingWithdrawPagination.startItem}
              endItem={pendingWithdrawPagination.endItem}
              pageSize={pendingWithdrawPagination.pageSize}
              onPageChange={pendingWithdrawPagination.setPage}
              compact
              className="mt-2"
            />
          </div>
        </section>

        {/* Recent Audit Log */}
        <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
            <h2 className="font-display text-lg font-bold">Aktivitas Audit Terbaru</h2>
            <Link
              to="/admin/audit"
              className="inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap text-primary hover:underline"
            >
              Lihat Semua Log
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="py-2.5 pr-4 font-medium">Waktu</th>
                  <th className="py-2.5 pr-4 font-medium">Aksi</th>
                  <th className="py-2.5 pr-4 font-medium">Target</th>
                  <th className="py-2.5 font-medium">Rincian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {recentAuditPagination.paginatedItems.map((log) => (
                  <tr key={log.id} className="hover:bg-accent/30">
                    <td className="py-3 pr-4 font-mono text-xs whitespace-nowrap tabular-nums text-muted-foreground">
                      {log.timestamp}
                    </td>
                    <td className="py-3 pr-4 font-medium whitespace-nowrap text-foreground">
                      {log.action}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs whitespace-nowrap text-primary">
                      {log.target}
                    </td>
                    <td className="py-3 text-xs text-muted-foreground">{log.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <DataPagination
              page={recentAuditPagination.page}
              totalPages={recentAuditPagination.totalPages}
              totalItems={recentAuditPagination.totalItems}
              startItem={recentAuditPagination.startItem}
              endItem={recentAuditPagination.endItem}
              pageSize={recentAuditPagination.pageSize}
              onPageChange={recentAuditPagination.setPage}
              onPageSizeChange={recentAuditPagination.setPageSize}
              pageSizeOptions={[4, 8, 12]}
              className="mt-4"
            />
          </div>
        </section>
      </div>

      {previewProof && previewProof.proofImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Bukti transfer ${previewProof.id}`}
          onClick={() => setPreviewProof(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-xl border border-border bg-card p-5 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
              <div>
                <p className="font-mono text-xs font-bold text-primary">
                  {previewProof.id} · {previewProof.accountId}
                </p>
                <h2 className="mt-0.5 font-display text-base font-bold text-foreground">
                  {previewProof.userName} · {formatUsd(previewProof.amount)}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {previewProof.method} · Ref {previewProof.reference}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewProof(null)}
                aria-label="Tutup modal"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-4 overflow-hidden rounded-lg border border-border bg-background">
              <img
                src={previewProof.proofImage}
                alt={`Bukti transfer ${previewProof.id}`}
                className="max-h-[60dvh] w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
