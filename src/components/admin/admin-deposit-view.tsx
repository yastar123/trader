import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Eye, Search, X } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  formatUsd,
  type DepositRequestRecord,
  type VerificationStatus,
} from "@/components/admin/admin-types";
import { Button } from "@/components/ui/button";
import { DataPagination, usePagination } from "@/components/ui/data-pagination";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type StatusFilter = "Semua" | VerificationStatus;

export function AdminDepositView() {
  const [deposits, setDeposits] = useState<DepositRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("Semua");
  const [query, setQuery] = useState("");
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<DepositRequestRecord | null>(null);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const loadDeposits = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/deposits");
      if (res.ok) {
        const data = (await res.json()) as DepositRequestRecord[];
        setDeposits(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDeposits();
  }, [loadDeposits]);

  async function handleVerify(id: string, decision: "approve" | "reject") {
    setBusyId(id);
    setFeedback(null);
    try {
      const note = notesById[id]?.trim();
      const res = await fetch(`/api/admin/deposits/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note }),
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setFeedback({ type: "err", text: payload?.error ?? "Gagal memproses verifikasi deposit." });
        return;
      }
      setFeedback({
        type: "ok",
        text: `Deposit ${id} telah diverifikasi manual (${decision === "approve" ? "Disetujui & saldo dikreditkan" : "Ditolak"}).`,
      });
      await loadDeposits();
    } finally {
      setBusyId(null);
    }
  }

  const pendingCount = useMemo(
    () => deposits.filter((item) => item.status === "Menunggu").length,
    [deposits],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return deposits.filter((item) => {
      if (filter !== "Semua" && item.status !== filter) return false;
      if (!q) return true;
      return (
        item.id.toLowerCase().includes(q) ||
        item.userName.toLowerCase().includes(q) ||
        item.userEmail.toLowerCase().includes(q) ||
        item.accountId.toLowerCase().includes(q) ||
        item.reference.toLowerCase().includes(q) ||
        item.method.toLowerCase().includes(q)
      );
    });
  }, [deposits, filter, query]);

  const depositsPagination = usePagination(filtered, 5);

  return (
    <AdminShell
      title="Verifikasi Deposit"
      subtitle="Periksa referensi transfer dan konfirmasi kredit saldo trader secara manual."
      pendingDepositsCount={pendingCount}
    >
      <div className="space-y-6">
        <section className="flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-end">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Verifikasi Manual Deposit
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Setiap pengajuan deposit berstatus Menunggu hingga admin menyetujui atau menolak
              berdasarkan mutasi masuk.
            </p>
          </div>
          <div className="font-mono text-xs tabular-nums text-muted-foreground">
            Menunggu Verifikasi: <span className="font-bold text-primary">{pendingCount}</span>
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

        <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-card p-1">
            {(["Semua", "Menunggu", "Disetujui", "Ditolak"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors",
                  filter === tab
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari ID, trader, atau referensi..."
              className="h-10 bg-card pl-9 text-sm"
            />
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">ID & Waktu</th>
                  <th className="px-4 py-3 font-medium">Trader & Akun</th>
                  <th className="px-4 py-3 font-medium">Metode & Referensi</th>
                  <th className="px-4 py-3 font-medium">Bukti Transfer</th>
                  <th className="px-4 py-3 text-right font-medium">Nominal</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Verifikasi Manual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Memuat daftar permintaan deposit...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Tidak ada permintaan deposit yang sesuai filter.
                    </td>
                  </tr>
                ) : (
                  depositsPagination.paginatedItems.map((item) => (
                    <tr key={item.id} className="align-top hover:bg-accent/25">
                      <td className="px-4 py-4">
                        <p className="font-mono text-xs font-bold text-foreground">{item.id}</p>
                        <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">
                          {item.submittedAt}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-semibold text-foreground">{item.userName}</p>
                        <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                          {item.accountId} · {item.userEmail}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-medium text-foreground">{item.method}</p>
                        <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                          Ref: {item.reference}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        {item.proofImage ? (
                          <button
                            type="button"
                            onClick={() => setPreviewItem(item)}
                            className="group flex flex-col items-start gap-1.5 rounded-lg border border-border bg-background p-1.5 text-left transition-colors hover:border-primary"
                          >
                            <img
                              src={item.proofImage}
                              alt={`Bukti transfer ${item.id}`}
                              className="h-12 w-20 rounded object-cover"
                            />
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
                              <Eye className="size-3" />
                              Lihat Bukti
                            </span>
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Tidak ada gambar</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right font-mono font-bold tabular-nums text-foreground">
                        {formatUsd(item.amount)}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={cn(
                            "inline-block rounded-md border px-2 py-1 text-xs font-semibold whitespace-nowrap",
                            item.status === "Disetujui" &&
                              "border-primary/40 bg-primary/10 text-primary",
                            item.status === "Menunggu" &&
                              "border-amber-500/40 bg-amber-500/10 text-amber-400",
                            item.status === "Ditolak" &&
                              "border-destructive/40 bg-destructive/10 text-destructive",
                          )}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        {item.status === "Menunggu" ? (
                          <div className="flex min-w-60 flex-col gap-2">
                            <Input
                              value={notesById[item.id] ?? ""}
                              onChange={(e) =>
                                setNotesById((prev) => ({ ...prev, [item.id]: e.target.value }))
                              }
                              placeholder="Catatan verifikasi (opsional)"
                              className="h-8 bg-background text-xs"
                            />
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                disabled={busyId === item.id}
                                onClick={() => void handleVerify(item.id, "approve")}
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
                                onClick={() => void handleVerify(item.id, "reject")}
                                className="h-8 border-border px-3 text-xs text-destructive hover:bg-destructive/10"
                              >
                                <X className="mr-1 size-3.5" />
                                Tolak
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="max-w-xs text-xs text-muted-foreground">
                            <p className="text-foreground">{item.adminNote ?? "Diverifikasi"}</p>
                            <p className="mt-1 font-mono text-[11px] tabular-nums">
                              {item.reviewedBy} · {item.reviewedAt}
                            </p>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <DataPagination
            page={depositsPagination.page}
            totalPages={depositsPagination.totalPages}
            totalItems={depositsPagination.totalItems}
            startItem={depositsPagination.startItem}
            endItem={depositsPagination.endItem}
            pageSize={depositsPagination.pageSize}
            onPageChange={depositsPagination.setPage}
            onPageSizeChange={depositsPagination.setPageSize}
            className="px-4 py-3"
          />
        </section>
      </div>

      {previewItem && previewItem.proofImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Pemeriksaan bukti transfer ${previewItem.id}`}
          onClick={() => setPreviewItem(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl rounded-xl border border-border bg-card p-5 shadow-xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border pb-3">
              <div>
                <p className="font-mono text-xs font-bold text-primary">
                  {previewItem.id} · {previewItem.accountId}
                </p>
                <h2 className="mt-0.5 font-display text-lg font-bold text-foreground">
                  Bukti Transfer — {previewItem.userName} ({formatUsd(previewItem.amount)})
                </h2>
                <p className="text-xs text-muted-foreground">
                  {previewItem.method} · Ref: {previewItem.reference} ·{" "}
                  {previewItem.proofFileName ?? "bukti-transfer.png"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                aria-label="Tutup modal bukti transfer"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 overflow-hidden rounded-lg border border-border bg-background">
              <img
                src={previewItem.proofImage}
                alt={`Bukti transfer ${previewItem.id}`}
                className="max-h-[60dvh] w-full object-contain"
              />
            </div>

            {previewItem.status === "Menunggu" && (
              <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busyId === previewItem.id}
                  onClick={() => {
                    const id = previewItem.id;
                    setPreviewItem(null);
                    void handleVerify(id, "reject");
                  }}
                  className="border-border text-destructive hover:bg-destructive/10"
                >
                  <X className="mr-1.5 size-4" />
                  Tolak Deposit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={busyId === previewItem.id}
                  onClick={() => {
                    const id = previewItem.id;
                    setPreviewItem(null);
                    void handleVerify(id, "approve");
                  }}
                  className="bg-primary font-bold text-primary-foreground hover:bg-primary/90"
                >
                  <Check className="mr-1.5 size-4" />
                  Setujui & Kreditkan Saldo
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </AdminShell>
  );
}
