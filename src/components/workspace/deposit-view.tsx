import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  Eye,
  ImagePlus,
  Trash2,
  X,
} from "lucide-react";
import {
  formatIdr,
  formatUsd,
  USD_TO_IDR_RATE,
  type DepositMethodRecord,
  type DepositRequestRecord,
  type WalletLimitsRecord,
} from "@/components/admin/admin-types";
import { Button } from "@/components/ui/button";
import { DataPagination, usePagination } from "@/components/ui/data-pagination";
import { Input } from "@/components/ui/input";
import { formatMoneyPair, type DisplayCurrency } from "@/lib/currency";
import { saveDemoSession, useDemoSession } from "@/lib/fe-session";
import { readImageFileAsDataUrl } from "@/lib/image-upload";
import { cn } from "@/lib/utils";

export function DepositView() {
  const { session } = useDemoSession();
  const [balance, setBalance] = useState<number>(session.balance ?? 0);
  const [deposits, setDeposits] = useState<DepositRequestRecord[]>([]);
  const [depositMethods, setDepositMethods] = useState<DepositMethodRecord[]>([]);
  const [idrPerUsd, setIdrPerUsd] = useState<number>(USD_TO_IDR_RATE);
  const [limits, setLimits] = useState<WalletLimitsRecord>({
    minDeposit: 10,
    maxDeposit: 50000,
    minWithdraw: 10,
    maxWithdraw: 25000,
  });
  const [loading, setLoading] = useState(true);
  const depositPagination = usePagination(deposits, 5);

  const [selectedMethodId, setSelectedMethodId] = useState<string>("");
  const [amountIdrInput, setAmountIdrInput] = useState<string>("");
  const [referenceInput, setReferenceInput] = useState<string>("");
  const [proofImage, setProofImage] = useState<string>("");
  const [proofFileName, setProofFileName] = useState<string>("");
  const [previewDeposit, setPreviewDeposit] = useState<DepositRequestRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const activeMethod = useMemo(
    () => depositMethods.find((m) => m.id === selectedMethodId),
    [depositMethods, selectedMethodId],
  );

  const minIdr = Math.round(limits.minDeposit * idrPerUsd);
  const maxIdr = Math.round(limits.maxDeposit * idrPerUsd);
  const parsedAmountIdr = Number(amountIdrInput);
  const convertedUsd =
    Number.isFinite(parsedAmountIdr) && parsedAmountIdr > 0
      ? Number((parsedAmountIdr / idrPerUsd).toFixed(2))
      : 0;

  const loadWallet = useCallback(async () => {
    try {
      const res = await fetch("/api/wallet/transactions");
      if (res.ok) {
        const json = (await res.json()) as {
          balance: number;
          deposits: DepositRequestRecord[];
          limits?: WalletLimitsRecord;
          depositMethods?: DepositMethodRecord[];
          idrPerUsd?: number;
        };
        setBalance(json.balance);
        setDeposits(json.deposits);
        if (json.limits) setLimits(json.limits);
        if (typeof json.idrPerUsd === "number" && json.idrPerUsd > 0) {
          setIdrPerUsd(json.idrPerUsd);
        }
        if (Array.isArray(json.depositMethods)) {
          setDepositMethods(json.depositMethods);
          setSelectedMethodId((prev) =>
            json.depositMethods!.some((m) => m.id === prev)
              ? prev
              : (json.depositMethods![0]?.id ?? ""),
          );
        }
        saveDemoSession({ balance: json.balance });
      } else {
        setFeedback({ type: "err", text: "Gagal memuat data deposit." });
      }
    } catch (error) {
      setFeedback({
        type: "err",
        text: error instanceof Error ? error.message : "Gagal memuat data deposit.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWallet();
  }, [loadWallet]);

  async function handleProofFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setFeedback(null);
    try {
      const dataUrl = await readImageFileAsDataUrl(file);
      setProofImage(dataUrl);
      setProofFileName(file.name);
    } catch (err) {
      setFeedback({
        type: "err",
        text: err instanceof Error ? err.message : "Gagal memproses file gambar bukti transfer.",
      });
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    const amountIdr = Math.round(Number(amountIdrInput));
    const amountUsd = Number((amountIdr / idrPerUsd).toFixed(2));
    if (!Number.isFinite(amountIdr) || amountUsd < limits.minDeposit) {
      setFeedback({
        type: "err",
        text: `Nominal deposit minimal ${formatIdr(minIdr)} (${formatUsd(limits.minDeposit)}).`,
      });
      return;
    }
    if (amountUsd > limits.maxDeposit) {
      setFeedback({
        type: "err",
        text: `Nominal deposit maksimal ${formatIdr(maxIdr)} (${formatUsd(limits.maxDeposit)}) per transaksi.`,
      });
      return;
    }
    if (!proofImage) {
      setFeedback({
        type: "err",
        text: "Mohon unggah foto atau screenshot bukti transfer terlebih dahulu.",
      });
      return;
    }
    if (!activeMethod) {
      setFeedback({ type: "err", text: "Metode deposit belum dikonfigurasi oleh admin." });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/wallet/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountIdr,
          method: activeMethod.label,
          reference: referenceInput.trim(),
          proofImage,
          proofFileName,
        }),
      });
      const json = (await res.json().catch(() => null)) as
        (DepositRequestRecord & { error?: string }) | null;
      if (!res.ok) {
        setFeedback({ type: "err", text: json?.error ?? "Gagal mengirim permintaan deposit." });
        return;
      }
      setReferenceInput("");
      setProofImage("");
      setProofFileName("");
      setFeedback({
        type: "ok",
        text: `Pengajuan deposit ${json?.id ?? ""} senilai ${formatIdr(amountIdr)} (dikonversi menjadi ${formatUsd(
          json?.amount ?? amountUsd,
        )}) berhasil dicatat dengan status Menunggu Verifikasi Admin.`,
      });
      await loadWallet();
    } catch (error) {
      setFeedback({
        type: "err",
        text: error instanceof Error ? error.message : "Gagal mengirim permintaan deposit.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const pendingTotal = useMemo(
    () => deposits.filter((d) => d.status === "Menunggu").reduce((acc, cur) => acc + cur.amount, 0),
    [deposits],
  );
  const displayCurrency: DisplayCurrency = session.currency === "IDR" ? "IDR" : "USD";
  const balancePair = formatMoneyPair(balance, displayCurrency, { rate: idrPerUsd });
  const pendingPair = formatMoneyPair(pendingTotal, displayCurrency, { rate: idrPerUsd });

  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Pendanaan Akun · {session.accountId}
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Deposit Dana Trading
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Transfer dalam Rupiah (IDR) lalu konversi otomatis ke saldo USD dengan kurs tetap 1 USD
            = {formatIdr(idrPerUsd)}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/withdraw"
            className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-card px-4 text-sm font-medium whitespace-nowrap text-foreground transition-colors hover:bg-accent"
          >
            Halaman Withdraw
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
            {balancePair.primary}
          </p>
          <p className="mt-1 font-mono text-xs tabular-nums text-primary">
            ≈ {balancePair.secondary}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Tipe akun: {session.accountType}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs font-medium text-muted-foreground">Deposit Menunggu Verifikasi</p>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-amber-400">
            {pendingPair.primary}
          </p>
          <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">
            ≈ {pendingPair.secondary}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Otomatis masuk ke saldo setelah disetujui admin
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs font-medium text-muted-foreground">Kurs & Batas Transaksi</p>
          <p className="mt-2 font-mono text-xl font-bold tabular-nums text-primary">
            1 USD = {formatIdr(idrPerUsd)}
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Min {formatIdr(minIdr)} ({formatUsd(limits.minDeposit)}) · Maks {formatIdr(maxIdr)}
          </p>
        </div>
      </section>

      {/* Deposit Form + Method Details:
          Mobile (< lg): Instructions Aside appears ABOVE Form (order-1 vs order-2)
          Desktop (lg+): Form Left (lg:order-1 lg:col-span-7), Instructions Aside Right (lg:order-2 lg:col-span-5) */}
      <section className="grid gap-6 lg:grid-cols-12">
        <aside className="order-1 space-y-6 lg:order-2 lg:col-span-5">
          <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <h2 className="font-display text-lg font-bold">Instruksi Transfer Tujuan</h2>
            {activeMethod ? (
              <>
                <p className="mt-1 text-xs text-muted-foreground">
                  Gunakan rincian di bawah untuk metode{" "}
                  <strong className="text-foreground">{activeMethod.label}</strong>.
                </p>
                <dl className="mt-5 divide-y divide-border text-sm">
                  <div className="flex justify-between gap-4 py-3">
                    <dt className="text-muted-foreground">Metode</dt>
                    <dd className="text-right font-semibold text-foreground">
                      {activeMethod.label}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 py-3">
                    <dt className="text-muted-foreground">Nomor Rekening / Tujuan</dt>
                    <dd className="text-right font-mono text-xs font-bold text-primary sm:text-sm">
                      {activeMethod.accountInfo}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 py-3">
                    <dt className="text-muted-foreground">Nama Penerima</dt>
                    <dd className="text-right font-medium text-foreground">
                      {activeMethod.accountHolder}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 py-3">
                    <dt className="text-muted-foreground">Estimasi Proses</dt>
                    <dd className="text-right text-xs text-muted-foreground">{activeMethod.eta}</dd>
                  </div>
                </dl>
              </>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                Belum ada metode pembayaran aktif. Hubungi admin untuk konfigurasi.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="text-xs leading-5 text-muted-foreground">
                <p className="font-semibold text-foreground">Alur Verifikasi Manual</p>
                <p className="mt-1">
                  Setelah Anda mengirim konfirmasi, permintaan masuk ke antrean{" "}
                  <strong className="text-foreground">Verifikasi Deposit Admin</strong>. Saldo akun
                  USD akan bertambah otomatis sesuai hasil konversi (1 USD = {formatIdr(idrPerUsd)})
                  begitu admin menyetujui mutasi Anda.
                </p>
                <Link
                  to="/withdraw"
                  className="mt-3 inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                >
                  Butuh tarik dana? Buka halaman Withdraw
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </aside>

        <div className="order-2 rounded-xl border border-border bg-card p-5 sm:p-6 lg:order-1 lg:col-span-7">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <h2 className="font-display text-lg font-bold">Formulir Pengajuan Deposit</h2>
            <span className="font-mono text-xs text-muted-foreground">Verifikasi Manual</span>
          </div>

          <form className="mt-5 space-y-5" onSubmit={(e) => void handleSubmit(e)}>
            <div>
              <p className="text-xs font-medium text-foreground">1. Pilih Metode Pembayaran</p>
              <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
                {depositMethods.map((method) => {
                  const selected = method.id === activeMethod?.id;
                  return (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setSelectedMethodId(method.id)}
                      className={cn(
                        "rounded-lg border px-3.5 py-3 text-left transition-colors",
                        selected
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-background text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <p className="text-sm font-semibold text-foreground">{method.label}</p>
                    </button>
                  );
                })}
              </div>
              {depositMethods.length === 0 && (
                <p className="mt-2 rounded-md border border-border p-3 text-xs text-muted-foreground">
                  Metode pembayaran belum tersedia. Pengajuan deposit tidak dapat dilakukan.
                </p>
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="deposit-amount" className="text-xs font-medium text-foreground">
                  2. Nominal Deposit (Rupiah / IDR)
                </label>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  Minimal {formatIdr(minIdr)} ({formatUsd(limits.minDeposit)})
                </span>
              </div>
              <Input
                id="deposit-amount"
                type="number"
                min={minIdr}
                max={maxIdr}
                step="1000"
                required
                value={amountIdrInput}
                onChange={(e) => setAmountIdrInput(e.target.value)}
                className="mt-2 h-11 bg-background font-mono text-base font-semibold tabular-nums"
              />

              <div className="mt-2.5 flex flex-col justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3.5 py-2.5 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ArrowRightLeft className="size-3.5 shrink-0 text-primary" />
                  <span>
                    Kurs Konversi:{" "}
                    <strong className="font-mono text-foreground">
                      1 USD = {formatIdr(idrPerUsd)}
                    </strong>
                  </span>
                </div>
                <div className="font-mono text-sm font-bold tabular-nums text-primary">
                  Estimasi Saldo: {formatUsd(convertedUsd)} USD
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="deposit-ref" className="block text-xs font-medium text-foreground">
                3. Nomor Referensi / Kode Bukti Transfer (Opsional)
              </label>
              <Input
                id="deposit-ref"
                value={referenceInput}
                onChange={(e) => setReferenceInput(e.target.value)}
                placeholder="Contoh: BNI-REF-8840129 atau Hash TX"
                className="mt-2 h-11 bg-background font-mono text-sm"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Opsional. Admin memverifikasi bukti transfer; wmTrader tidak memotong biaya atau
                pajak dari saldo deposit.
              </p>
            </div>

            <div>
              <label htmlFor="deposit-proof" className="block text-xs font-medium text-foreground">
                4. Unggah Bukti Transfer (Gambar / Screenshot)
              </label>

              {!proofImage ? (
                <label
                  htmlFor="deposit-proof"
                  className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background/70 px-4 py-6 text-center transition-colors hover:border-primary/60 hover:bg-accent/30"
                >
                  <ImagePlus className="size-6 text-primary" />
                  <p className="mt-2 text-xs font-semibold text-foreground">
                    Pilih atau tempel screenshot bukti transfer
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Format PNG, JPG, JPEG, atau WebP (maks. 6 MB)
                  </p>
                </label>
              ) : (
                <div className="mt-2 rounded-xl border border-border bg-background p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        src={proofImage}
                        alt="Pratinjau bukti transfer"
                        className="h-16 w-24 rounded-md border border-border object-cover"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-foreground">
                          {proofFileName || "bukti-transfer.png"}
                        </p>
                        <p className="mt-0.5 text-[11px] text-primary">
                          Gambar bukti transfer siap dikirim ke admin
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor="deposit-proof"
                        className="inline-flex h-8 cursor-pointer items-center rounded-md border border-border bg-card px-2.5 text-xs font-medium text-foreground hover:bg-accent"
                      >
                        Ganti Gambar
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setProofImage("");
                          setProofFileName("");
                        }}
                        aria-label="Hapus bukti transfer"
                        className="inline-flex h-8 items-center rounded-md border border-border bg-card px-2 text-xs text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <input
                id="deposit-proof"
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={(e) => void handleProofFileChange(e)}
                className="sr-only"
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
              disabled={submitting || !activeMethod || loading}
              className="h-11 w-full bg-primary text-sm font-bold text-primary-foreground hover:bg-primary/90"
            >
              <ArrowDownToLine className="mr-2 size-4" />
              {submitting
                ? "Mengirim Pengajuan..."
                : `Kirim Konfirmasi Deposit (${formatUsd(convertedUsd)})`}
            </Button>
          </form>
        </div>
      </section>

      {/* Deposit History Table */}
      <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div>
            <h2 className="font-display text-lg font-bold">Riwayat Pengajuan Deposit Anda</h2>
            <p className="text-xs text-muted-foreground">
              Memantau status verifikasi dari setiap pengajuan deposit akun {session.accountId}.
            </p>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs text-muted-foreground">
              <tr>
                <th className="py-2.5 pr-4 font-medium">ID & Waktu</th>
                <th className="py-2.5 pr-4 font-medium">Metode</th>
                <th className="py-2.5 pr-4 font-medium">Referensi</th>
                <th className="py-2.5 pr-4 font-medium">Bukti Transfer</th>
                <th className="py-2.5 pr-4 text-right font-medium">Nominal (IDR → USD)</th>
                <th className="py-2.5 pr-4 font-medium">Status</th>
                <th className="py-2.5 font-medium">Catatan Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    Memuat riwayat deposit...
                  </td>
                </tr>
              ) : deposits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                    Belum ada pengajuan deposit. Gunakan formulir di atas untuk memulai.
                  </td>
                </tr>
              ) : (
                depositPagination.paginatedItems.map((item) => {
                  const idrAmount = item.amountIdr ?? Math.round(item.amount * idrPerUsd);
                  return (
                    <tr key={item.id} className="hover:bg-accent/25">
                      <td className="py-3 pr-4 whitespace-nowrap">
                        <p className="font-mono text-xs font-bold text-foreground">{item.id}</p>
                        <p className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                          {item.submittedAt}
                        </p>
                      </td>
                      <td className="py-3 pr-4 font-medium text-foreground">{item.method}</td>
                      <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">
                        {item.reference || "—"}
                      </td>
                      <td className="py-3 pr-4">
                        {item.proofImage ? (
                          <button
                            type="button"
                            onClick={() => setPreviewDeposit(item)}
                            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
                          >
                            <img
                              src={item.proofImage}
                              alt={`Bukti ${item.id}`}
                              className="h-6 w-9 rounded object-cover"
                            />
                            <Eye className="size-3.5" />
                            <span className="whitespace-nowrap">Lihat</span>
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-right font-mono tabular-nums">
                        <p className="font-semibold text-foreground">
                          {displayCurrency === "IDR"
                            ? formatIdr(idrAmount)
                            : formatUsd(item.amount)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {displayCurrency === "IDR"
                            ? formatUsd(item.amount)
                            : formatIdr(idrAmount)}
                        </p>
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
                        {item.adminNote ?? "Menunggu pemeriksaan mutasi admin"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <DataPagination
          page={depositPagination.page}
          totalPages={depositPagination.totalPages}
          totalItems={depositPagination.totalItems}
          startItem={depositPagination.startItem}
          endItem={depositPagination.endItem}
          pageSize={depositPagination.pageSize}
          onPageChange={depositPagination.setPage}
          onPageSizeChange={depositPagination.setPageSize}
          className="mt-4"
        />
      </section>

      {previewDeposit && previewDeposit.proofImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Bukti transfer ${previewDeposit.id}`}
          onClick={() => setPreviewDeposit(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-xl border border-border bg-card p-5 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <p className="font-mono text-xs font-bold text-primary">{previewDeposit.id}</p>
                <p className="text-sm font-semibold text-foreground">
                  {previewDeposit.method}
                  {previewDeposit.reference ? ` · Ref ${previewDeposit.reference}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDeposit(null)}
                aria-label="Tutup pratinjau"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-4 overflow-hidden rounded-lg border border-border bg-background">
              <img
                src={previewDeposit.proofImage}
                alt={`Bukti transfer ${previewDeposit.id}`}
                className="max-h-[65dvh] w-full object-contain"
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Berkas: {previewDeposit.proofFileName ?? "bukti-transfer.png"} · Transfer{" "}
              {formatIdr(previewDeposit.amountIdr ?? previewDeposit.amount * idrPerUsd)} (
              {formatUsd(previewDeposit.amount)})
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
