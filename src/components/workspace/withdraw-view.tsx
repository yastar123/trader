import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUpFromLine, CheckCircle2, ShieldAlert } from "lucide-react";
import type { WithdrawRequestRecord } from "@/components/admin/admin-types";
import { Button } from "@/components/ui/button";
import { DataPagination, usePagination } from "@/components/ui/data-pagination";
import { Input } from "@/components/ui/input";
import { saveDemoSession, useDemoSession } from "@/lib/fe-session";
import { cn } from "@/lib/utils";

const BANK_CHANNELS = [
  { id: "bca", label: "Bank BCA" },
  { id: "mandiri", label: "Bank Mandiri" },
  { id: "bni", label: "Bank BNI" },
  { id: "usdt", label: "Dompet USDT (TRC20)" },
];

const PRESET_WITHDRAW = [100, 250, 500, 1000];

export function WithdrawView() {
  const { session } = useDemoSession();
  const [balance, setBalance] = useState<number>(session.balance ?? 24510);
  const [withdrawals, setWithdrawals] = useState<WithdrawRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const withdrawPagination = usePagination(withdrawals, 5);

  const [channel, setChannel] = useState("Bank BCA");
  const [accountNumber, setAccountNumber] = useState("5210948120");
  const [amountInput, setAmountInput] = useState("250");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const loadWallet = useCallback(async () => {
    try {
      const res = await fetch("/api/wallet/transactions");
      if (res.ok) {
        const json = (await res.json()) as {
          balance: number;
          withdrawals: WithdrawRequestRecord[];
        };
        setBalance(json.balance);
        setWithdrawals(json.withdrawals);
        saveDemoSession({ balance: json.balance });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWallet();
  }, [loadWallet]);

  const pendingTotal = useMemo(
    () =>
      withdrawals.filter((w) => w.status === "Menunggu").reduce((acc, cur) => acc + cur.amount, 0),
    [withdrawals],
  );

  const availableForWithdraw = Math.max(0, balance - pendingTotal);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    const amount = Number(amountInput);
    if (!Number.isFinite(amount) || amount < 10) {
      setFeedback({ type: "err", text: "Nominal penarikan minimal $10.00 USD." });
      return;
    }
    if (amount > balance) {
      setFeedback({
        type: "err",
        text: "Nominal penarikan melebihi saldo akun Anda saat ini.",
      });
      return;
    }
    if (!accountNumber.trim()) {
      setFeedback({ type: "err", text: "Nomor rekening atau alamat dompet wajib diisi." });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          destination: `${channel} · ${accountNumber.trim()}`,
        }),
      });
      const json = (await res.json().catch(() => null)) as { id?: string; error?: string } | null;
      if (!res.ok) {
        setFeedback({ type: "err", text: json?.error ?? "Gagal mengajukan penarikan dana." });
        return;
      }
      setFeedback({
        type: "ok",
        text: `Permintaan withdraw ${json?.id ?? ""} senilai $${amount.toLocaleString("en-US", {
          minimumFractionDigits: 2,
        })} dikirim dan menunggu verifikasi manual oleh admin.`,
      });
      await loadWallet();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Penarikan Dana · {session.accountId}
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Withdraw Saldo Akun
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ajukan pencairan dana ke rekening bank atau dompet terdaftar atas nama{" "}
            <strong className="text-foreground">{session.name}</strong>.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/deposit"
            className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-card px-4 text-sm font-medium whitespace-nowrap text-foreground transition-colors hover:bg-accent"
          >
            Halaman Deposit
          </Link>
          <Link
            to="/trade"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-bold whitespace-nowrap text-primary-foreground transition-opacity hover:opacity-90"
          >
            Terminal Trade
          </Link>
        </div>
      </section>

      {/* Summary KPI Strip */}
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs font-medium text-muted-foreground">Saldo Akun Saat Ini</p>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-foreground">
            $
            {balance.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Terpotong otomatis saat penarikan disetujui admin
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs font-medium text-muted-foreground">Sedang Dalam Antrean Withdraw</p>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-amber-400">
            $
            {pendingTotal.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">Menunggu verifikasi manual admin</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs font-medium text-muted-foreground">Batas Tersedia untuk Ditarik</p>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-primary">
            $
            {availableForWithdraw.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">Minimal penarikan $10.00 USD</p>
        </div>
      </section>

      {/* Withdraw Form + Policy Notice */}
      <section className="grid gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-border bg-card p-5 sm:p-6 lg:col-span-7">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <h2 className="font-display text-lg font-bold">Formulir Penarikan Dana</h2>
            <span className="font-mono text-xs text-muted-foreground">Verifikasi Manual</span>
          </div>

          <form className="mt-5 space-y-5" onSubmit={(e) => void handleSubmit(e)}>
            <div>
              <p className="text-xs font-medium text-foreground">1. Pilih Tujuan Pencairan</p>
              <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
                {BANK_CHANNELS.map((item) => {
                  const active = channel === item.label;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setChannel(item.label)}
                      className={cn(
                        "rounded-lg border px-3.5 py-2.5 text-left text-sm font-semibold transition-colors",
                        active
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-background text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label
                htmlFor="withdraw-account"
                className="block text-xs font-medium text-foreground"
              >
                2. Nomor Rekening / Alamat Dompet Tujuan
              </label>
              <Input
                id="withdraw-account"
                required
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="Masukkan nomor rekening atau alamat TRC20"
                className="mt-2 h-11 bg-background font-mono text-sm"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="withdraw-amount" className="text-xs font-medium text-foreground">
                  3. Nominal Penarikan (USD)
                </label>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  Maks ${balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {PRESET_WITHDRAW.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAmountInput(String(preset))}
                    className={cn(
                      "rounded-md border px-3 py-1.5 font-mono text-xs font-semibold tabular-nums transition-colors",
                      Number(amountInput) === preset
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground hover:text-foreground",
                    )}
                  >
                    ${preset.toLocaleString("en-US")}
                  </button>
                ))}
              </div>
              <Input
                id="withdraw-amount"
                type="number"
                min={10}
                step="0.01"
                required
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="mt-2.5 h-11 bg-background font-mono text-base font-semibold tabular-nums"
              />
            </div>

            {feedback && (
              <div
                role="status"
                className={cn(
                  "flex items-start gap-2.5 rounded-lg border px-4 py-3 text-xs font-medium",
                  feedback.type === "ok"
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-destructive/40 bg-destructive/10 text-destructive",
                )}
              >
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                <span>{feedback.text}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={submitting}
              className="h-11 w-full bg-primary text-sm font-bold text-primary-foreground hover:bg-primary/90"
            >
              <ArrowUpFromLine className="mr-2 size-4" />
              {submitting ? "Mengajukan Penarikan..." : "Ajukan Permintaan Withdraw"}
            </Button>
          </form>
        </div>

        <aside className="space-y-6 lg:col-span-5">
          <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <h2 className="font-display text-lg font-bold">Ringkasan Penarikan</h2>
            <dl className="mt-4 divide-y divide-border text-sm">
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-muted-foreground">Pemilik Rekening</dt>
                <dd className="text-right font-semibold text-foreground">{session.name}</dd>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-muted-foreground">Tujuan</dt>
                <dd className="text-right font-mono text-xs font-semibold text-foreground">
                  {channel} · {accountNumber || "-"}
                </dd>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-muted-foreground">Biaya Penarikan</dt>
                <dd className="text-right font-medium text-primary">$0.00 (Gratis)</dd>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-muted-foreground">Estimasi Diterima</dt>
                <dd className="text-right font-mono font-bold tabular-nums text-foreground">
                  $
                  {(Number(amountInput) > 0 ? Number(amountInput) : 0).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="text-xs leading-5 text-muted-foreground">
                <p className="font-semibold text-foreground">Verifikasi Keamanan Penarikan</p>
                <p className="mt-1">
                  Setiap pengajuan withdraw diperiksa secara manual oleh tim admin untuk memastikan
                  kecocokan rekening dan kecukupan margin bebas sebelum dana ditransfer.
                </p>
                <Link
                  to="/deposit"
                  className="mt-3 inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                >
                  Ingin menambah saldo? Buka halaman Deposit
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </aside>
      </section>

      {/* Withdraw History Table */}
      <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div>
            <h2 className="font-display text-lg font-bold">Riwayat Penarikan Dana Anda</h2>
            <p className="text-xs text-muted-foreground">
              Menampilkan seluruh pengajuan withdraw akun {session.accountId} beserta catatan admin.
            </p>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs text-muted-foreground">
              <tr>
                <th className="py-2.5 pr-4 font-medium">ID & Waktu</th>
                <th className="py-2.5 pr-4 font-medium">Rekening Tujuan</th>
                <th className="py-2.5 pr-4 text-right font-medium">Nominal</th>
                <th className="py-2.5 pr-4 font-medium">Status</th>
                <th className="py-2.5 font-medium">Catatan Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    Memuat riwayat withdraw...
                  </td>
                </tr>
              ) : withdrawals.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    Belum ada pengajuan penarikan dana.
                  </td>
                </tr>
              ) : (
                withdrawPagination.paginatedItems.map((item) => (
                  <tr key={item.id} className="hover:bg-accent/25">
                    <td className="py-3 pr-4 whitespace-nowrap">
                      <p className="font-mono text-xs font-bold text-foreground">{item.id}</p>
                      <p className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                        {item.submittedAt}
                      </p>
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-foreground">
                      {item.destination}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono font-semibold tabular-nums text-foreground">
                      ${item.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={cn(
                          "inline-block rounded-md border px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
                          item.status === "Disetujui" &&
                            "border-primary/40 bg-primary/10 text-primary",
                          item.status === "Menunggu" &&
                            "border-amber-500/40 bg-amber-500/10 text-amber-400",
                          item.status === "Ditolak" &&
                            "border-destructive/40 bg-destructive/10 text-destructive",
                        )}
                      >
                        {item.status === "Menunggu" ? "Menunggu Verifikasi" : item.status}
                      </span>
                    </td>
                    <td className="py-3 text-xs text-muted-foreground">
                      {item.adminNote ?? "Menunggu persetujuan transfer admin"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <DataPagination
          page={withdrawPagination.page}
          totalPages={withdrawPagination.totalPages}
          totalItems={withdrawPagination.totalItems}
          startItem={withdrawPagination.startItem}
          endItem={withdrawPagination.endItem}
          pageSize={withdrawPagination.pageSize}
          onPageChange={withdrawPagination.setPage}
          onPageSizeChange={withdrawPagination.setPageSize}
          className="mt-4"
        />
      </section>
    </div>
  );
}
