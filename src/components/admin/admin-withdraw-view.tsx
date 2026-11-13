import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, Save, Search, SlidersHorizontal, X } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  formatIdr,
  formatMoneyPair,
  formatUsd,
  USD_TO_IDR_RATE,
  type VerificationStatus,
  type WalletLimitsRecord,
  type WithdrawRequestRecord,
} from "@/components/admin/admin-types";
import { Button } from "@/components/ui/button";
import { DataPagination, usePagination } from "@/components/ui/data-pagination";
import { Input } from "@/components/ui/input";
import { useAdminCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

type StatusFilter = "Semua" | VerificationStatus;

export function AdminWithdrawView() {
  const { currency } = useAdminCurrency();
  const [withdrawals, setWithdrawals] = useState<WithdrawRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("Semua");
  const [query, setQuery] = useState("");
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [minWithdrawInput, setMinWithdrawInput] = useState("10");
  const [maxWithdrawInput, setMaxWithdrawInput] = useState("25000");
  const [savedLimits, setSavedLimits] = useState<WalletLimitsRecord>({
    minDeposit: 10,
    maxDeposit: 50000,
    minWithdraw: 10,
    maxWithdraw: 25000,
  });
  const [savingLimits, setSavingLimits] = useState(false);

  const loadWithdrawals = useCallback(async () => {
    try {
      const [wdRes, limitRes] = await Promise.all([
        fetch("/api/admin/withdrawals"),
        fetch("/api/admin/wallet-limits"),
      ]);
      if (wdRes.ok) {
        const data = (await wdRes.json()) as WithdrawRequestRecord[];
        setWithdrawals(data);
      }
      if (limitRes.ok) {
        const lim = (await limitRes.json()) as WalletLimitsRecord;
        setSavedLimits(lim);
        setMinWithdrawInput(String(lim.minWithdraw));
        setMaxWithdrawInput(String(lim.maxWithdraw));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWithdrawals();
  }, [loadWithdrawals]);

  async function handleSaveLimits(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    const minWithdraw = Number(minWithdrawInput);
    const maxWithdraw = Number(maxWithdrawInput);
    if (!Number.isFinite(minWithdraw) || minWithdraw < 1) {
      setFeedback({ type: "err", text: "Minimal withdraw harus minimal $1.00 USD." });
      return;
    }
    if (!Number.isFinite(maxWithdraw) || maxWithdraw < minWithdraw) {
      setFeedback({
        type: "err",
        text: "Maksimal withdraw harus lebih besar atau sama dengan minimal withdraw.",
      });
      return;
    }

    setSavingLimits(true);
    try {
      const res = await fetch("/api/admin/wallet-limits", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minWithdraw, maxWithdraw }),
      });
      const json = (await res.json().catch(() => null)) as
        (WalletLimitsRecord & { error?: string }) | null;
      if (!res.ok) {
        setFeedback({ type: "err", text: json?.error ?? "Gagal memperbarui batas withdraw." });
        return;
      }
      if (json) {
        setSavedLimits(json);
        setMinWithdrawInput(String(json.minWithdraw));
        setMaxWithdrawInput(String(json.maxWithdraw));
      }
      setFeedback({
        type: "ok",
        text: `Batas withdraw diperbarui: Minimal ${formatUsd(minWithdraw)} — Maksimal ${formatUsd(maxWithdraw)}.`,
      });
    } finally {
      setSavingLimits(false);
    }
  }

  async function handleVerify(id: string, decision: "approve" | "reject") {
    setBusyId(id);
    setFeedback(null);
    try {
      const note = notesById[id]?.trim();
      const res = await fetch(`/api/admin/withdrawals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note }),
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setFeedback({
          type: "err",
          text: payload?.error ?? "Gagal memproses verifikasi withdraw.",
        });
        return;
      }
      setFeedback({
        type: "ok",
        text: `Withdraw ${id} telah diverifikasi manual (${decision === "approve" ? "Disetujui & saldo dipotong" : "Ditolak"}).`,
      });
      await loadWithdrawals();
    } finally {
      setBusyId(null);
    }
  }

  const pendingCount = useMemo(
    () => withdrawals.filter((item) => item.status === "Menunggu").length,
    [withdrawals],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return withdrawals.filter((item) => {
      if (filter !== "Semua" && item.status !== filter) return false;
      if (!q) return true;
      return (
        item.id.toLowerCase().includes(q) ||
        item.userName.toLowerCase().includes(q) ||
        item.userEmail.toLowerCase().includes(q) ||
        item.accountId.toLowerCase().includes(q) ||
        item.destination.toLowerCase().includes(q)
      );
    });
  }, [withdrawals, filter, query]);

  const withdrawalsPagination = usePagination(filtered, 5);

  return (
    <AdminShell
      title="Verifikasi Withdraw"
      subtitle="Periksa tujuan transfer dan kecukupan saldo sebelum menyetujui penarikan."
      pendingWithdrawalsCount={pendingCount}
    >
      <div className="space-y-6">
        <section className="flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-end">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Verifikasi Manual Withdraw
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Permintaan penarikan diproses manual oleh admin. Menyetujui penarikan akan memotong
              saldo trader sesuai nominal pengajuan.
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

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="size-4 text-primary" />
              <h2 className="font-display text-base font-bold text-foreground">
                Pengaturan Batas Nominal Withdraw (USD & Konversi IDR)
              </h2>
            </div>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              Aktif: {formatUsd(savedLimits.minWithdraw)} (
              {formatIdr(savedLimits.minWithdraw * USD_TO_IDR_RATE)}) –{" "}
              {formatUsd(savedLimits.maxWithdraw)} (
              {formatIdr(savedLimits.maxWithdraw * USD_TO_IDR_RATE)})
            </span>
          </div>

          <form
            onSubmit={(e) => void handleSaveLimits(e)}
            className="mt-4 grid gap-4 sm:grid-cols-3 sm:items-end"
          >
            <div>
              <label
                htmlFor="admin-min-withdraw"
                className="block text-xs font-medium text-foreground"
              >
                Minimal Withdraw (USD)
              </label>
              <Input
                id="admin-min-withdraw"
                type="number"
                min={1}
                step="0.01"
                required
                value={minWithdrawInput}
                onChange={(e) => setMinWithdrawInput(e.target.value)}
                className="mt-1.5 h-10 bg-background font-mono tabular-nums"
              />
              <p className="mt-1 font-mono text-[11px] tabular-nums text-muted-foreground">
                Setara {formatIdr((Number(minWithdrawInput) || 0) * USD_TO_IDR_RATE)}
              </p>
            </div>
            <div>
              <label
                htmlFor="admin-max-withdraw"
                className="block text-xs font-medium text-foreground"
              >
                Maksimal Withdraw (USD)
              </label>
              <Input
                id="admin-max-withdraw"
                type="number"
                min={1}
                step="0.01"
                required
                value={maxWithdrawInput}
                onChange={(e) => setMaxWithdrawInput(e.target.value)}
                className="mt-1.5 h-10 bg-background font-mono tabular-nums"
              />
              <p className="mt-1 font-mono text-[11px] tabular-nums text-muted-foreground">
                Setara {formatIdr((Number(maxWithdrawInput) || 0) * USD_TO_IDR_RATE)}
              </p>
            </div>
            <div className="sm:pb-5">
              <Button
                type="submit"
                disabled={savingLimits}
                className="h-10 w-full bg-primary font-bold text-primary-foreground hover:bg-primary/90"
              >
                <Save className="mr-2 size-4" />
                {savingLimits ? "Menyimpan..." : "Simpan Batas Withdraw"}
              </Button>
            </div>
          </form>
        </section>

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
              placeholder="Cari ID, trader, atau rekening..."
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
                  <th className="px-4 py-3 font-medium">Rekening / Tujuan</th>
                  <th className="px-4 py-3 text-right font-medium">Nominal</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Verifikasi Manual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Memuat daftar permintaan withdraw...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Tidak ada permintaan withdraw yang sesuai filter.
                    </td>
                  </tr>
                ) : (
                  withdrawalsPagination.paginatedItems.map((item) => (
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
                      <td className="px-4 py-4 font-mono text-xs text-foreground">
                        {item.destination}
                      </td>
                      <td className="px-4 py-4 text-right font-mono tabular-nums text-foreground">
                        {(() => {
                          const rowPair = formatMoneyPair(item.amount, currency);
                          return (
                            <>
                              <p className="font-bold">{rowPair.primary}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {rowPair.secondary}
                              </p>
                            </>
                          );
                        })()}
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
                              placeholder="Catatan transfer (opsional)"
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
            page={withdrawalsPagination.page}
            totalPages={withdrawalsPagination.totalPages}
            totalItems={withdrawalsPagination.totalItems}
            startItem={withdrawalsPagination.startItem}
            endItem={withdrawalsPagination.endItem}
            pageSize={withdrawalsPagination.pageSize}
            onPageChange={withdrawalsPagination.setPage}
            onPageSizeChange={withdrawalsPagination.setPageSize}
            className="px-4 py-3"
          />
        </section>
      </div>
    </AdminShell>
  );
}
