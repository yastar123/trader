import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Check,
  Eye,
  Landmark,
  Pencil,
  Plus,
  Save,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { AdminDeleteAction } from "@/components/admin/admin-delete-action";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  formatIdr,
  formatUsd,
  USD_TO_IDR_RATE,
  type DepositMethodRecord,
  type DepositRequestRecord,
  type VerificationStatus,
  type WalletLimitsRecord,
} from "@/components/admin/admin-types";
import { Button } from "@/components/ui/button";
import { DataPagination, usePagination } from "@/components/ui/data-pagination";
import { Input } from "@/components/ui/input";
import { useAdminCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

type StatusFilter = "Semua" | VerificationStatus;

type MethodFormState = {
  label: string;
  accountInfo: string;
  accountHolder: string;
  fee: string;
  eta: string;
  enabled: boolean;
};

const EMPTY_METHOD_FORM: MethodFormState = {
  label: "",
  accountInfo: "",
  accountHolder: "wmTrader",
  fee: "Gratis (0%)",
  eta: "5–15 menit setelah verifikasi admin",
  enabled: true,
};

export function AdminDepositView() {
  const { currency } = useAdminCurrency();
  const [deposits, setDeposits] = useState<DepositRequestRecord[]>([]);
  const [methods, setMethods] = useState<DepositMethodRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("Semua");
  const [query, setQuery] = useState("");
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<DepositRequestRecord | null>(null);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [minDepositInput, setMinDepositInput] = useState("10");
  const [maxDepositInput, setMaxDepositInput] = useState("50000");
  const [savedLimits, setSavedLimits] = useState<WalletLimitsRecord>({
    minDeposit: 10,
    maxDeposit: 50000,
    minWithdraw: 10,
    maxWithdraw: 25000,
  });
  const [savingLimits, setSavingLimits] = useState(false);

  const [editingMethodId, setEditingMethodId] = useState<string | null>(null);
  const [methodForm, setMethodForm] = useState<MethodFormState>(EMPTY_METHOD_FORM);
  const [savingMethod, setSavingMethod] = useState(false);
  const [busyMethodId, setBusyMethodId] = useState<string | null>(null);

  const loadDeposits = useCallback(async () => {
    try {
      const [depRes, limitRes, methodRes] = await Promise.all([
        fetch("/api/admin/deposits"),
        fetch("/api/admin/wallet-limits"),
        fetch("/api/admin/deposit-methods"),
      ]);
      if (depRes.ok) {
        const data = (await depRes.json()) as DepositRequestRecord[];
        setDeposits(data);
      }
      if (limitRes.ok) {
        const lim = (await limitRes.json()) as WalletLimitsRecord;
        setSavedLimits(lim);
        setMinDepositInput(String(lim.minDeposit));
        setMaxDepositInput(String(lim.maxDeposit));
      }
      if (methodRes.ok) {
        const methodData = (await methodRes.json()) as DepositMethodRecord[];
        setMethods(methodData);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDeposits();
  }, [loadDeposits]);

  async function handleSaveLimits(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    const minDeposit = Number(minDepositInput);
    const maxDeposit = Number(maxDepositInput);
    if (!Number.isFinite(minDeposit) || minDeposit < 1) {
      setFeedback({ type: "err", text: "Minimal deposit harus minimal $1.00 USD." });
      return;
    }
    if (!Number.isFinite(maxDeposit) || maxDeposit < minDeposit) {
      setFeedback({
        type: "err",
        text: "Maksimal deposit harus lebih besar atau sama dengan minimal deposit.",
      });
      return;
    }

    setSavingLimits(true);
    try {
      const res = await fetch("/api/admin/wallet-limits", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minDeposit, maxDeposit }),
      });
      const json = (await res.json().catch(() => null)) as
        (WalletLimitsRecord & { error?: string }) | null;
      if (!res.ok) {
        setFeedback({ type: "err", text: json?.error ?? "Gagal memperbarui batas deposit." });
        return;
      }
      if (json) {
        setSavedLimits(json);
        setMinDepositInput(String(json.minDeposit));
        setMaxDepositInput(String(json.maxDeposit));
      }
      setFeedback({
        type: "ok",
        text: `Batas deposit diperbarui: Minimal ${formatUsd(minDeposit)} (${formatIdr(
          minDeposit * USD_TO_IDR_RATE,
        )}) — Maksimal ${formatUsd(maxDeposit)} (${formatIdr(maxDeposit * USD_TO_IDR_RATE)}).`,
      });
    } finally {
      setSavingLimits(false);
    }
  }

  function startEditMethod(method: DepositMethodRecord) {
    setEditingMethodId(method.id);
    setMethodForm({
      label: method.label,
      accountInfo: method.accountInfo,
      accountHolder: method.accountHolder,
      fee: method.fee,
      eta: method.eta,
      enabled: method.enabled,
    });
    setFeedback(null);
  }

  function cancelEditMethod() {
    setEditingMethodId(null);
    setMethodForm(EMPTY_METHOD_FORM);
  }

  async function handleSaveMethod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    if (
      !methodForm.label.trim() ||
      !methodForm.accountInfo.trim() ||
      !methodForm.accountHolder.trim()
    ) {
      setFeedback({
        type: "err",
        text: "Metode, Nomor Rekening / Tujuan, dan Nama Penerima wajib diisi.",
      });
      return;
    }

    setSavingMethod(true);
    try {
      const isEdit = Boolean(editingMethodId);
      const endpoint = isEdit
        ? `/api/admin/deposit-methods/${editingMethodId}`
        : "/api/admin/deposit-methods";
      const res = await fetch(endpoint, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(methodForm),
      });
      const json = (await res.json().catch(() => null)) as
        (DepositMethodRecord & { error?: string }) | null;
      if (!res.ok) {
        setFeedback({ type: "err", text: json?.error ?? "Gagal menyimpan metode deposit." });
        return;
      }
      setFeedback({
        type: "ok",
        text: isEdit
          ? `Metode deposit "${json?.label ?? methodForm.label}" berhasil diperbarui.`
          : `Metode deposit baru "${json?.label ?? methodForm.label}" berhasil ditambahkan.`,
      });
      setEditingMethodId(null);
      setMethodForm(EMPTY_METHOD_FORM);
      await loadDeposits();
    } finally {
      setSavingMethod(false);
    }
  }

  async function handleToggleMethod(method: DepositMethodRecord) {
    setBusyMethodId(method.id);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/deposit-methods/${method.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !method.enabled }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setFeedback({ type: "err", text: json?.error ?? "Gagal mengubah status metode." });
        return;
      }
      setFeedback({
        type: "ok",
        text: `Metode "${method.label}" kini ${!method.enabled ? "Aktif" : "Nonaktif"} di halaman deposit user.`,
      });
      await loadDeposits();
    } finally {
      setBusyMethodId(null);
    }
  }

  async function handleDeleteMethod(method: DepositMethodRecord) {
    setBusyMethodId(method.id);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/deposit-methods/${method.id}`, {
        method: "DELETE",
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setFeedback({ type: "err", text: json?.error ?? "Gagal menghapus metode deposit." });
        return;
      }
      if (editingMethodId === method.id) {
        cancelEditMethod();
      }
      setFeedback({
        type: "ok",
        text: `Metode "${method.label}" berhasil dihapus.`,
      });
      await loadDeposits();
    } finally {
      setBusyMethodId(null);
    }
  }

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

  async function handleDeleteDeposit(item: DepositRequestRecord): Promise<boolean> {
    setBusyId(item.id);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/deposits/${encodeURIComponent(item.id)}`, {
        method: "DELETE",
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setFeedback({
          type: "err",
          text: payload?.error ?? `Gagal menghapus deposit ${item.id}.`,
        });
        return false;
      }

      setDeposits((current) => current.filter((deposit) => deposit.id !== item.id));
      if (previewItem?.id === item.id) setPreviewItem(null);
      setFeedback({
        type: "ok",
        text: `Deposit ${item.id} dihapus. Saldo akun tidak berubah.`,
      });
      try {
        await loadDeposits();
      } catch {
        setFeedback({
          type: "err",
          text: `Deposit ${item.id} sudah dihapus, tetapi daftar gagal dimuat ulang.`,
        });
      }
      return true;
    } catch (error) {
      setFeedback({
        type: "err",
        text: error instanceof Error ? error.message : `Gagal menghapus deposit ${item.id}.`,
      });
      return false;
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

  const methodsPagination = usePagination(methods, 5);
  const depositsPagination = usePagination(filtered, 5);

  return (
    <AdminShell
      title="Verifikasi Deposit"
      subtitle="Kelola metode transfer tujuan, batas nominal, dan konfirmasi kredit saldo trader."
      pendingDepositsCount={pendingCount}
    >
      <div className="space-y-6">
        <section className="flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-end">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Verifikasi Manual & Metode Deposit
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Atur instruksi rekening tujuan, kurs konversi 1 USD = Rp 17.000, batas
              minimal/maksimal, dan verifikasi mutasi deposit trader.
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

        {/* Limits Settings */}
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="size-4 text-primary" />
              <h2 className="font-display text-base font-bold text-foreground">
                Pengaturan Batas Nominal Deposit (USD & Konversi IDR)
              </h2>
            </div>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              Aktif: {formatUsd(savedLimits.minDeposit)} (
              {formatIdr(savedLimits.minDeposit * USD_TO_IDR_RATE)}) –{" "}
              {formatUsd(savedLimits.maxDeposit)} (
              {formatIdr(savedLimits.maxDeposit * USD_TO_IDR_RATE)})
            </span>
          </div>

          <form
            onSubmit={(e) => void handleSaveLimits(e)}
            className="mt-4 grid gap-4 sm:grid-cols-3 sm:items-end"
          >
            <div>
              <label
                htmlFor="admin-min-deposit"
                className="block text-xs font-medium text-foreground"
              >
                Minimal Deposit (USD)
              </label>
              <Input
                id="admin-min-deposit"
                type="number"
                min={1}
                step="0.01"
                required
                value={minDepositInput}
                onChange={(e) => setMinDepositInput(e.target.value)}
                className="mt-1.5 h-10 bg-background font-mono tabular-nums"
              />
              <p className="mt-1 font-mono text-[11px] tabular-nums text-muted-foreground">
                Setara {formatIdr((Number(minDepositInput) || 0) * USD_TO_IDR_RATE)}
              </p>
            </div>
            <div>
              <label
                htmlFor="admin-max-deposit"
                className="block text-xs font-medium text-foreground"
              >
                Maksimal Deposit (USD)
              </label>
              <Input
                id="admin-max-deposit"
                type="number"
                min={1}
                step="0.01"
                required
                value={maxDepositInput}
                onChange={(e) => setMaxDepositInput(e.target.value)}
                className="mt-1.5 h-10 bg-background font-mono tabular-nums"
              />
              <p className="mt-1 font-mono text-[11px] tabular-nums text-muted-foreground">
                Setara {formatIdr((Number(maxDepositInput) || 0) * USD_TO_IDR_RATE)}
              </p>
            </div>
            <div className="sm:pb-5">
              <Button
                type="submit"
                disabled={savingLimits}
                className="h-10 w-full bg-primary font-bold text-primary-foreground hover:bg-primary/90"
              >
                <Save className="mr-2 size-4" />
                {savingLimits ? "Menyimpan..." : "Simpan Batas Deposit"}
              </Button>
            </div>
          </form>
        </section>

        {/* CRUD Payment Methods & Transfer Instructions */}
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Landmark className="size-4 text-primary" />
              <div>
                <h2 className="font-display text-base font-bold text-foreground">
                  Kelola Metode Pembayaran & Instruksi Transfer Tujuan
                </h2>
                <p className="text-xs text-muted-foreground">
                  Data di bawah tampil langsung di pilihan metode pembayaran & kotak Instruksi
                  Transfer Tujuan pada halaman Deposit trader.
                </p>
              </div>
            </div>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              Total Metode: <strong className="text-foreground">{methods.length}</strong>
            </span>
          </div>

          <form
            onSubmit={(e) => void handleSaveMethod(e)}
            className="mt-4 grid gap-3 rounded-lg border border-border bg-background/60 p-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <div>
              <label htmlFor="method-label" className="block text-xs font-medium text-foreground">
                Metode Pembayaran
              </label>
              <Input
                id="method-label"
                required
                value={methodForm.label}
                onChange={(e) => setMethodForm((prev) => ({ ...prev, label: e.target.value }))}
                placeholder="Mis. Transfer Bank BNI"
                className="mt-1 h-9 bg-background text-sm"
              />
            </div>
            <div>
              <label htmlFor="method-account" className="block text-xs font-medium text-foreground">
                Nomor Rekening / Tujuan
              </label>
              <Input
                id="method-account"
                required
                value={methodForm.accountInfo}
                onChange={(e) =>
                  setMethodForm((prev) => ({ ...prev, accountInfo: e.target.value }))
                }
                placeholder="Nomor rekening atau alamat wallet"
                className="mt-1 h-9 bg-background font-mono text-sm"
              />
            </div>
            <div>
              <label htmlFor="method-holder" className="block text-xs font-medium text-foreground">
                Nama Penerima
              </label>
              <Input
                id="method-holder"
                required
                value={methodForm.accountHolder}
                onChange={(e) =>
                  setMethodForm((prev) => ({ ...prev, accountHolder: e.target.value }))
                }
                placeholder="wmTrader"
                className="mt-1 h-9 bg-background text-sm"
              />
            </div>
            <div>
              <label htmlFor="method-fee" className="block text-xs font-medium text-foreground">
                Biaya Layanan
              </label>
              <Input
                id="method-fee"
                required
                value={methodForm.fee}
                onChange={(e) => setMethodForm((prev) => ({ ...prev, fee: e.target.value }))}
                placeholder="Gratis (0%)"
                className="mt-1 h-9 bg-background text-sm"
              />
            </div>
            <div>
              <label htmlFor="method-eta" className="block text-xs font-medium text-foreground">
                Estimasi Proses
              </label>
              <Input
                id="method-eta"
                required
                value={methodForm.eta}
                onChange={(e) => setMethodForm((prev) => ({ ...prev, eta: e.target.value }))}
                placeholder="10–20 menit setelah verifikasi admin"
                className="mt-1 h-9 bg-background text-sm"
              />
            </div>
            <div className="flex flex-col justify-between gap-2">
              <label className="flex items-center gap-2 pt-1 text-xs font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={methodForm.enabled}
                  onChange={(e) =>
                    setMethodForm((prev) => ({ ...prev, enabled: e.target.checked }))
                  }
                  className="size-4 accent-primary"
                />
                <span>Tampilkan metode ini untuk trader</span>
              </label>
              <div className="flex items-center gap-2">
                <Button
                  type="submit"
                  disabled={savingMethod}
                  className="h-9 flex-1 bg-primary text-xs font-bold text-primary-foreground hover:bg-primary/90"
                >
                  {editingMethodId ? (
                    <>
                      <Save className="mr-1.5 size-3.5" />
                      {savingMethod ? "Menyimpan..." : "Simpan Perubahan"}
                    </>
                  ) : (
                    <>
                      <Plus className="mr-1.5 size-3.5" />
                      {savingMethod ? "Menambah..." : "Tambah Metode"}
                    </>
                  )}
                </Button>
                {editingMethodId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={cancelEditMethod}
                    className="h-9 border-border px-3 text-xs"
                  >
                    Batal
                  </Button>
                )}
              </div>
            </div>
          </form>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="py-2.5 pr-4 font-medium">Metode</th>
                  <th className="py-2.5 pr-4 font-medium">Nomor Rekening / Tujuan</th>
                  <th className="py-2.5 pr-4 font-medium">Nama Penerima</th>
                  <th className="py-2.5 pr-4 font-medium">Biaya & Estimasi</th>
                  <th className="py-2.5 pr-4 font-medium">Status</th>
                  <th className="py-2.5 text-right font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {methods.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-xs text-muted-foreground">
                      Belum ada metode pembayaran deposit.
                    </td>
                  </tr>
                ) : (
                  methodsPagination.paginatedItems.map((m) => (
                    <tr key={m.id} className="hover:bg-accent/25">
                      <td className="py-3 pr-4 font-semibold text-foreground">{m.label}</td>
                      <td className="py-3 pr-4 font-mono text-xs font-bold text-primary">
                        {m.accountInfo}
                      </td>
                      <td className="py-3 pr-4 text-xs text-foreground">{m.accountHolder}</td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground">
                        <p className="font-medium text-foreground">{m.fee}</p>
                        <p>{m.eta}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <button
                          type="button"
                          disabled={busyMethodId === m.id}
                          onClick={() => void handleToggleMethod(m)}
                          className={cn(
                            "rounded-md border px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-colors",
                            m.enabled
                              ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                              : "border-border bg-background text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {m.enabled ? "Aktif" : "Nonaktif"}
                        </button>
                      </td>
                      <td className="py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => startEditMethod(m)}
                            className="h-8 border-border px-2.5 text-xs"
                          >
                            <Pencil className="mr-1 size-3" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busyMethodId === m.id || methods.length <= 1}
                            onClick={() => void handleDeleteMethod(m)}
                            className="h-8 border-border px-2.5 text-xs text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="mr-1 size-3" />
                            Hapus
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <DataPagination
            page={methodsPagination.page}
            totalPages={methodsPagination.totalPages}
            totalItems={methodsPagination.totalItems}
            startItem={methodsPagination.startItem}
            endItem={methodsPagination.endItem}
            pageSize={methodsPagination.pageSize}
            onPageChange={methodsPagination.setPage}
            onPageSizeChange={methodsPagination.setPageSize}
            className="mt-3"
          />
        </section>

        {/* Deposit Verification Queue */}
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
                  <th className="px-4 py-3 text-right font-medium">Nominal (IDR → USD)</th>
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
                  depositsPagination.paginatedItems.map((item) => {
                    const idrAmount = item.amountIdr ?? Math.round(item.amount * USD_TO_IDR_RATE);
                    return (
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
                            Ref: {item.reference || "—"}
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
                        <td className="px-4 py-4 text-right font-mono tabular-nums">
                          <p className="font-bold text-foreground">
                            {currency === "IDR" ? formatIdr(idrAmount) : formatUsd(item.amount)}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {currency === "IDR" ? formatUsd(item.amount) : formatIdr(idrAmount)}
                          </p>
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
                          <div className="mt-2">
                            <AdminDeleteAction
                              itemLabel={`deposit ${item.id}`}
                              disabled={busyId === item.id}
                              onDelete={() => handleDeleteDeposit(item)}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })
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
                  Bukti Transfer — {previewItem.userName} (
                  {formatIdr(previewItem.amountIdr ?? previewItem.amount * USD_TO_IDR_RATE)} →{" "}
                  {formatUsd(previewItem.amount)})
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
