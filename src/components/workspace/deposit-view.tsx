import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowDownToLine,
  ArrowRight,
  CheckCircle2,
  Clock,
  Eye,
  ImagePlus,
  Trash2,
  X,
} from "lucide-react";
import type { DepositRequestRecord } from "@/components/admin/admin-types";
import { Button } from "@/components/ui/button";
import { DataPagination, usePagination } from "@/components/ui/data-pagination";
import { Input } from "@/components/ui/input";
import { saveDemoSession, useDemoSession } from "@/lib/fe-session";
import { readImageFileAsDataUrl } from "@/lib/image-upload";
import { cn } from "@/lib/utils";

type DepositMethod = {
  id: string;
  label: string;
  accountInfo: string;
  accountHolder: string;
  eta: string;
  fee: string;
};

const DEPOSIT_METHODS: DepositMethod[] = [
  {
    id: "bca",
    label: "Transfer Bank BCA",
    accountInfo: "5210-8842-9012",
    accountHolder: "PT IC Trading Nusantara",
    eta: "5–15 menit setelah verifikasi admin",
    fee: "Gratis (0%)",
  },
  {
    id: "mandiri",
    label: "Transfer Bank Mandiri",
    accountInfo: "137-000-9921-440",
    accountHolder: "PT IC Trading Nusantara",
    eta: "5–15 menit setelah verifikasi admin",
    fee: "Gratis (0%)",
  },
  {
    id: "bni",
    label: "Transfer Bank BNI",
    accountInfo: "044-8192-3301",
    accountHolder: "PT IC Trading Nusantara",
    eta: "10–20 menit setelah verifikasi admin",
    fee: "Gratis (0%)",
  },
  {
    id: "usdt",
    label: "USDT (TRC20)",
    accountInfo: "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE",
    accountHolder: "Dompet Kustodian TRC20",
    eta: "Konfirmasi jaringan + verifikasi admin",
    fee: "Biaya jaringan sesuai pengirim",
  },
];

const PRESET_AMOUNTS = [100, 250, 500, 1000, 2500];

export function DepositView() {
  const { session } = useDemoSession();
  const [balance, setBalance] = useState<number>(session.balance ?? 24510);
  const [deposits, setDeposits] = useState<DepositRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const depositPagination = usePagination(deposits, 5);

  const [selectedMethodId, setSelectedMethodId] = useState<string>("bca");
  const [amountInput, setAmountInput] = useState<string>("500");
  const [referenceInput, setReferenceInput] = useState<string>("");
  const [proofImage, setProofImage] = useState<string>("");
  const [proofFileName, setProofFileName] = useState<string>("");
  const [previewDeposit, setPreviewDeposit] = useState<DepositRequestRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const activeMethod = useMemo(
    () => DEPOSIT_METHODS.find((m) => m.id === selectedMethodId) ?? DEPOSIT_METHODS[0]!,
    [selectedMethodId],
  );

  const loadWallet = useCallback(async () => {
    try {
      const res = await fetch("/api/wallet/transactions");
      if (res.ok) {
        const json = (await res.json()) as {
          balance: number;
          deposits: DepositRequestRecord[];
        };
        setBalance(json.balance);
        setDeposits(json.deposits);
        saveDemoSession({ balance: json.balance });
      }
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
    const amount = Number(amountInput);
    if (!Number.isFinite(amount) || amount < 10) {
      setFeedback({ type: "err", text: "Nominal deposit minimal $10.00 USD." });
      return;
    }
    if (!proofImage) {
      setFeedback({
        type: "err",
        text: "Mohon unggah foto atau screenshot bukti transfer terlebih dahulu.",
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/wallet/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          method: activeMethod.label,
          reference: referenceInput.trim(),
          proofImage,
          proofFileName,
        }),
      });
      const json = (await res.json().catch(() => null)) as { id?: string; error?: string } | null;
      if (!res.ok) {
        setFeedback({ type: "err", text: json?.error ?? "Gagal mengirim permintaan deposit." });
        return;
      }
      setReferenceInput("");
      setProofImage("");
      setProofFileName("");
      setFeedback({
        type: "ok",
        text: `Pengajuan deposit ${json?.id ?? ""} senilai $${amount.toLocaleString("en-US", {
          minimumFractionDigits: 2,
        })} beserta bukti transfer berhasil dicatat dengan status Menunggu Verifikasi Admin.`,
      });
      await loadWallet();
    } finally {
      setSubmitting(false);
    }
  }

  const pendingTotal = useMemo(
    () => deposits.filter((d) => d.status === "Menunggu").reduce((acc, cur) => acc + cur.amount, 0),
    [deposits],
  );

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
            Kirim dana ke rekening tujuan berikut lalu unggah nomor referensi agar diverifikasi oleh
            admin.
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
            $
            {balance.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Tipe akun: {session.accountType} ({session.currency})
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs font-medium text-muted-foreground">Deposit Menunggu Verifikasi</p>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-amber-400">
            $
            {pendingTotal.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Otomatis masuk ke saldo setelah disetujui admin
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs font-medium text-muted-foreground">Total Pengajuan Tercatat</p>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-primary">
            {deposits.length}
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Minimal deposit $10.00 per transaksi
          </p>
        </div>
      </section>

      {/* Deposit Form + Method Details */}
      <section className="grid gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-border bg-card p-5 sm:p-6 lg:col-span-7">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <h2 className="font-display text-lg font-bold">Formulir Pengajuan Deposit</h2>
            <span className="font-mono text-xs text-muted-foreground">Verifikasi Manual</span>
          </div>

          <form className="mt-5 space-y-5" onSubmit={(e) => void handleSubmit(e)}>
            <div>
              <p className="text-xs font-medium text-foreground">1. Pilih Metode Pembayaran</p>
              <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
                {DEPOSIT_METHODS.map((method) => {
                  const selected = method.id === activeMethod.id;
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
                      <p className="mt-0.5 text-xs text-muted-foreground">{method.fee}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="deposit-amount" className="text-xs font-medium text-foreground">
                  2. Nominal Deposit (USD)
                </label>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  Min $10.00
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {PRESET_AMOUNTS.map((preset) => (
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
                id="deposit-amount"
                type="number"
                min={10}
                step="0.01"
                required
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="mt-2.5 h-11 bg-background font-mono text-base font-semibold tabular-nums"
              />
            </div>

            <div>
              <label htmlFor="deposit-ref" className="block text-xs font-medium text-foreground">
                3. Nomor Referensi / Kode Bukti Transfer
              </label>
              <Input
                id="deposit-ref"
                required
                value={referenceInput}
                onChange={(e) => setReferenceInput(e.target.value)}
                placeholder="Contoh: BCA-REF-8840129 atau Hash TX"
                className="mt-2 h-11 bg-background font-mono text-sm"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Admin akan mencocokkan nomor referensi dan bukti gambar sebelum saldo dikreditkan.
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
              disabled={submitting}
              className="h-11 w-full bg-primary text-sm font-bold text-primary-foreground hover:bg-primary/90"
            >
              <ArrowDownToLine className="mr-2 size-4" />
              {submitting ? "Mengirim Pengajuan..." : "Kirim Konfirmasi Deposit"}
            </Button>
          </form>
        </div>

        <aside className="space-y-6 lg:col-span-5">
          <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <h2 className="font-display text-lg font-bold">Instruksi Transfer Tujuan</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Gunakan rincian di bawah untuk metode{" "}
              <strong className="text-foreground">{activeMethod.label}</strong>.
            </p>

            <dl className="mt-5 divide-y divide-border text-sm">
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-muted-foreground">Metode</dt>
                <dd className="text-right font-semibold text-foreground">{activeMethod.label}</dd>
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
                <dt className="text-muted-foreground">Biaya Layanan</dt>
                <dd className="text-right font-medium text-foreground">{activeMethod.fee}</dd>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <dt className="text-muted-foreground">Estimasi Proses</dt>
                <dd className="text-right text-xs text-muted-foreground">{activeMethod.eta}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="text-xs leading-5 text-muted-foreground">
                <p className="font-semibold text-foreground">Alur Verifikasi Manual</p>
                <p className="mt-1">
                  Setelah Anda mengirim konfirmasi, permintaan masuk ke antrean{" "}
                  <strong className="text-foreground">Verifikasi Deposit Admin</strong>. Saldo akun
                  akan bertambah otomatis begitu admin menyetujui mutasi Anda.
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
                <th className="py-2.5 pr-4 text-right font-medium">Nominal</th>
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
                depositPagination.paginatedItems.map((item) => (
                  <tr key={item.id} className="hover:bg-accent/25">
                    <td className="py-3 pr-4 whitespace-nowrap">
                      <p className="font-mono text-xs font-bold text-foreground">{item.id}</p>
                      <p className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                        {item.submittedAt}
                      </p>
                    </td>
                    <td className="py-3 pr-4 font-medium text-foreground">{item.method}</td>
                    <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">
                      {item.reference}
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
                      {item.adminNote ?? "Menunggu pemeriksaan mutasi admin"}
                    </td>
                  </tr>
                ))
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
                  {previewDeposit.method} · Ref {previewDeposit.reference}
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
              Berkas: {previewDeposit.proofFileName ?? "bukti-transfer.png"} · Nominal $
              {previewDeposit.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
