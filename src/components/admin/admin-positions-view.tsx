import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Lock, Search, SlidersHorizontal, X } from "lucide-react";
import { AdminDeleteAction } from "@/components/admin/admin-delete-action";
import { AdminShell } from "@/components/admin/admin-shell";
import type { AdminPositionRecord, TradingRulesRecord } from "@/components/admin/admin-types";
import { Button } from "@/components/ui/button";
import { DataPagination, usePagination } from "@/components/ui/data-pagination";
import { Input } from "@/components/ui/input";
import { formatMoneyPair, USD_TO_IDR_RATE, formatIdr, useAdminCurrency } from "@/lib/currency";
import {
  DEFAULT_TRADING_RULES,
  formatHoldCountdown,
  formatMinCloseDuration,
  resolvePositionStakeUsd,
  resolveTargetProfitUsd,
} from "@/lib/trading";
import { cn } from "@/lib/utils";

type PositionStatusFilter = "Semua" | "Terbuka" | "Tertunda" | "Ditutup";

export function AdminPositionsView() {
  const { currency } = useAdminCurrency();
  const [positions, setPositions] = useState<AdminPositionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<PositionStatusFilter>("Semua");
  const [symbolFilter, setSymbolFilter] = useState("Semua");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const [rules, setRules] = useState<TradingRulesRecord>(DEFAULT_TRADING_RULES);
  const [maxDailyInput, setMaxDailyInput] = useState("5");
  const [durationInput, setDurationInput] = useState("5");
  const [durationUnit, setDurationUnit] = useState<"minutes" | "hours">("minutes");
  const [defaultProfitInput, setDefaultProfitInput] = useState("10");
  const [savingRules, setSavingRules] = useState(false);

  const [profitDrafts, setProfitDrafts] = useState<Record<string, string>>({});
  const [savingProfitId, setSavingProfitId] = useState<string | null>(null);

  const loadRules = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/trading-rules");
      if (res.ok) {
        const data = (await res.json()) as TradingRulesRecord;
        setRules(data);
        setMaxDailyInput(String(data.maxDailyPositions));
        setDefaultProfitInput(String(data.defaultProfitPercent ?? 10));
        if (data.minCloseMinutes >= 60 && data.minCloseMinutes % 60 === 0) {
          setDurationUnit("hours");
          setDurationInput(String(data.minCloseMinutes / 60));
        } else {
          setDurationUnit("minutes");
          setDurationInput(String(data.minCloseMinutes));
        }
      }
    } catch {
      // Ignore transient error
    }
  }, []);

  const loadPositions = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/positions");
      if (res.ok) {
        const data = (await res.json()) as AdminPositionRecord[];
        setPositions(data);
        setProfitDrafts((prev) => {
          const next = { ...prev };
          for (const p of data) {
            if (!(p.id in next)) {
              const target = resolveTargetProfitUsd(p, rules.defaultProfitPercent ?? 10);
              next[p.id] = target.toFixed(2);
            }
          }
          return next;
        });
      }
    } finally {
      setLoading(false);
    }
  }, [rules.defaultProfitPercent]);

  useEffect(() => {
    void loadRules();
    void loadPositions();
    const timer = window.setInterval(() => {
      void loadPositions();
    }, 1200);
    const clockTimer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(clockTimer);
    };
  }, [loadRules, loadPositions]);

  async function handleSaveRules(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    const maxDaily = Math.round(Number(maxDailyInput));
    const rawDuration = Number(durationInput);
    const minCloseMinutes =
      durationUnit === "hours" ? Math.round(rawDuration * 60) : Math.round(rawDuration);
    const defaultProfitPercent = Number(defaultProfitInput);

    if (!Number.isFinite(maxDaily) || maxDaily < 1) {
      setFeedback({
        type: "err",
        text: "Maksimal open posisi harian minimal 1 kali per hari.",
      });
      return;
    }
    if (!Number.isFinite(minCloseMinutes) || minCloseMinutes < 1) {
      setFeedback({
        type: "err",
        text: "Minimal waktu tutup posisi harus minimal 1 menit.",
      });
      return;
    }
    if (!Number.isFinite(defaultProfitPercent) || defaultProfitPercent < 0.1) {
      setFeedback({
        type: "err",
        text: "Persentase keuntungan default minimal 0.1%.",
      });
      return;
    }

    setSavingRules(true);
    try {
      const res = await fetch("/api/admin/trading-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxDailyPositions: maxDaily,
          minCloseMinutes,
          defaultProfitPercent,
        }),
      });
      const json = (await res.json().catch(() => null)) as
        (TradingRulesRecord & { error?: string }) | null;
      if (!res.ok) {
        setFeedback({
          type: "err",
          text: json?.error ?? "Gagal memperbarui aturan trading global.",
        });
        return;
      }
      if (json) setRules(json);
      setFeedback({
        type: "ok",
        text: `Aturan trading diperbarui: Maks ${maxDaily} open posisi/hari · Minimal tahan ${formatMinCloseDuration(minCloseMinutes)} · Default keuntungan ${defaultProfitPercent}%.`,
      });
      await loadPositions();
    } finally {
      setSavingRules(false);
    }
  }

  async function handleSavePositionProfit(pos: AdminPositionRecord) {
    setFeedback(null);
    const draftStr = profitDrafts[pos.id] ?? "";
    const profitUsd = Number(draftStr);
    if (!Number.isFinite(profitUsd) || profitUsd < 0.5) {
      setFeedback({
        type: "err",
        text: `Nominal keuntungan untuk ${pos.id} minimal $0.50 USD.`,
      });
      return;
    }

    setSavingProfitId(pos.id);
    try {
      const res = await fetch(`/api/admin/positions/${pos.id}/profit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profitUsd }),
      });
      const json = (await res.json().catch(() => null)) as
        (AdminPositionRecord & { error?: string }) | null;
      if (!res.ok) {
        setFeedback({
          type: "err",
          text: json?.error ?? `Gagal mengatur keuntungan posisi ${pos.id}.`,
        });
        return;
      }
      setProfitDrafts((prev) => ({
        ...prev,
        [pos.id]: Number(profitUsd.toFixed(2)).toFixed(2),
      }));
      setFeedback({
        type: "ok",
        text: `Target keuntungan ${pos.id} (${pos.userName} · ${pos.symbol}) ditetapkan $${profitUsd.toFixed(2)} (${formatIdr(profitUsd * USD_TO_IDR_RATE)}). Akan otomatis masuk saldo saat waktu tahan selesai.`,
      });
      await loadPositions();
    } finally {
      setSavingProfitId(null);
    }
  }

  async function handleForceClose(pos: AdminPositionRecord) {
    setBusyId(pos.id);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/positions/${pos.id}/close`, { method: "PATCH" });
      if (res.ok) {
        setFeedback({
          type: "ok",
          text: `Posisi ${pos.id} milik ${pos.userName} (${pos.symbol}) telah ${pos.status === "Terbuka" ? "ditutup paksa" : "dibatalkan"}.`,
        });
        await loadPositions();
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeletePosition(pos: AdminPositionRecord): Promise<boolean> {
    setBusyId(pos.id);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/positions/${encodeURIComponent(pos.id)}`, {
        method: "DELETE",
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setFeedback({
          type: "err",
          text: payload?.error ?? `Gagal menghapus posisi ${pos.id}.`,
        });
        return false;
      }

      setPositions((current) => current.filter((position) => position.id !== pos.id));
      setFeedback({ type: "ok", text: `Posisi ${pos.id} berhasil dihapus.` });
      try {
        await loadPositions();
      } catch {
        setFeedback({
          type: "err",
          text: `Posisi ${pos.id} sudah dihapus, tetapi daftar gagal dimuat ulang.`,
        });
      }
      return true;
    } catch (error) {
      setFeedback({
        type: "err",
        text: error instanceof Error ? error.message : `Gagal menghapus posisi ${pos.id}.`,
      });
      return false;
    } finally {
      setBusyId(null);
    }
  }

  const availableSymbols = useMemo(() => {
    const set = new Set(positions.map((p) => p.symbol));
    return ["Semua", ...Array.from(set)];
  }, [positions]);

  const summary = useMemo(() => {
    const open = positions.filter((p) => p.status === "Terbuka");
    const pending = positions.filter((p) => p.status === "Tertunda");
    const totalStakeUsd = open.reduce((acc, cur) => acc + resolvePositionStakeUsd(cur), 0);
    const totalFloating = open.reduce((acc, cur) => acc + cur.livePnl, 0);
    const activeTraders = new Set(open.map((p) => p.accountId)).size;
    return {
      openCount: open.length,
      pendingCount: pending.length,
      totalStakeUsd,
      totalFloating,
      activeTraders,
    };
  }, [positions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return positions.filter((pos) => {
      if (statusFilter !== "Semua" && pos.status !== statusFilter) return false;
      if (symbolFilter !== "Semua" && pos.symbol !== symbolFilter) return false;
      if (!q) return true;
      return (
        pos.id.toLowerCase().includes(q) ||
        pos.userName.toLowerCase().includes(q) ||
        pos.accountId.toLowerCase().includes(q) ||
        pos.symbol.toLowerCase().includes(q)
      );
    });
  }, [positions, statusFilter, symbolFilter, query]);

  const positionsPagination = usePagination(filtered, 5);

  return (
    <AdminShell
      title="Pantauan Trading"
      subtitle="Memantau seluruh posisi aktif, lot, leverage, SL/TP, dan P&L semua trader."
    >
      <div className="space-y-6">
        <section className="flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Pemantauan Eksposur Klien
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Pantauan Trading Semua User
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Menampilkan instrumen yang sedang diperdagangkan setiap user beserta arah, volume lot,
              leverage, SL, TP, dan P&L langsung.
            </p>
          </div>
          <div className="font-mono text-xs tabular-nums text-muted-foreground">
            Trader Aktif: <span className="font-bold text-primary">{summary.activeTraders}</span>
          </div>
        </section>

        {feedback && (
          <div
            role="status"
            className={cn(
              "rounded-lg border px-4 py-3 text-sm",
              feedback.type === "ok"
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-destructive/40 bg-destructive/10 text-destructive",
            )}
          >
            {feedback.text}
          </div>
        )}

        {/* Pengaturan Aturan Trading Semua User */}
        <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-2 border-b border-border pb-4 sm:flex-row sm:items-center">
            <div className="flex items-start gap-2.5">
              <SlidersHorizontal className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <h2 className="font-display text-base font-bold">Aturan Trading Semua User</h2>
                <p className="text-xs text-muted-foreground">
                  Atur batas maksimal open posisi harian serta waktu minimal tutup posisi setelah
                  entry.
                </p>
              </div>
            </div>
            <div className="font-mono text-xs text-primary">
              Aktif: Maks {rules.maxDailyPositions} open/hari · Min tahan{" "}
              {formatMinCloseDuration(rules.minCloseMinutes)} · Default profit{" "}
              {rules.defaultProfitPercent ?? 10}%
            </div>
          </div>

          <form
            onSubmit={(e) => void handleSaveRules(e)}
            className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:items-end"
          >
            <div>
              <label
                htmlFor="max-daily-positions"
                className="block text-xs font-medium text-foreground"
              >
                Maksimal Open Posisi / Hari (Semua User)
              </label>
              <Input
                id="max-daily-positions"
                type="number"
                min={1}
                max={500}
                step={1}
                required
                value={maxDailyInput}
                onChange={(e) => setMaxDailyInput(e.target.value)}
                className="mt-1.5 h-10 bg-background font-mono tabular-nums"
              />
            </div>

            <div>
              <label
                htmlFor="min-close-duration"
                className="block text-xs font-medium text-foreground"
              >
                Minimal Waktu Tutup (Tutup Otomatis)
              </label>
              <div className="mt-1.5 flex gap-2">
                <Input
                  id="min-close-duration"
                  type="number"
                  min={1}
                  max={durationUnit === "hours" ? 168 : 10080}
                  step={durationUnit === "hours" ? "0.5" : "1"}
                  required
                  value={durationInput}
                  onChange={(e) => setDurationInput(e.target.value)}
                  className="h-10 bg-background font-mono tabular-nums"
                />
                <select
                  aria-label="Satuan waktu tutup posisi"
                  value={durationUnit}
                  onChange={(e) =>
                    setDurationUnit(e.target.value === "hours" ? "hours" : "minutes")
                  }
                  className="h-10 rounded-md border border-input bg-background px-3 text-xs font-semibold text-foreground"
                >
                  <option value="minutes">Menit</option>
                  <option value="hours">Jam</option>
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="default-profit-percent"
                className="block text-xs font-medium text-foreground"
              >
                Default Keuntungan User (%) — Khusus Admin
              </label>
              <Input
                id="default-profit-percent"
                type="number"
                min={0.1}
                max={1000}
                step="0.5"
                required
                value={defaultProfitInput}
                onChange={(e) => setDefaultProfitInput(e.target.value)}
                className="mt-1.5 h-10 bg-background font-mono tabular-nums"
              />
            </div>

            <div>
              <Button
                type="submit"
                disabled={savingRules}
                className="h-10 w-full bg-primary font-bold text-primary-foreground hover:bg-primary/90"
              >
                {savingRules ? "Menyimpan..." : "Simpan Aturan Trading"}
              </Button>
            </div>
          </form>
        </section>

        {/* 4-Column Summary Strip */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-medium text-muted-foreground">Posisi Terbuka</p>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-foreground">
              {summary.openCount}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {summary.pendingCount} order limit tertunda
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-medium text-muted-foreground">Total Nominal Aktif</p>
            {(() => {
              const stakePair = formatMoneyPair(summary.totalStakeUsd, currency);
              return (
                <>
                  <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-foreground">
                    {stakePair.primary}
                  </p>
                  <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">
                    ≈ {stakePair.secondary}
                  </p>
                </>
              );
            })()}
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-medium text-muted-foreground">Total P&L Mengambang Klien</p>
            {(() => {
              const totalPair = formatMoneyPair(summary.totalFloating, currency, { signed: true });
              return (
                <>
                  <p
                    className={cn(
                      "mt-2 font-mono text-2xl font-bold tabular-nums",
                      summary.totalFloating >= 0 ? "text-primary" : "text-destructive",
                    )}
                  >
                    {totalPair.primary}
                  </p>
                  <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">
                    ≈ {totalPair.secondary}
                  </p>
                </>
              );
            })()}
            <p className="mt-1 text-xs text-muted-foreground">Tersinkronisasi tick pasar</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-medium text-muted-foreground">Total Order Tercatat</p>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-foreground">
              {positions.length}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">Terbuka, tertunda, dan ditutup</p>
          </div>
        </section>

        {/* Filters */}
        <section className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
              {(["Semua", "Terbuka", "Tertunda", "Ditutup"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setStatusFilter(tab)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors",
                    statusFilter === tab
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            <select
              aria-label="Filter simbol instrumen"
              value={symbolFilter}
              onChange={(e) => setSymbolFilter(e.target.value)}
              className="h-9 rounded-md border border-border bg-card px-3 font-mono text-xs font-semibold text-foreground"
            >
              {availableSymbols.map((sym) => (
                <option key={sym} value={sym}>
                  {sym === "Semua" ? "Semua Instrumen" : sym}
                </option>
              ))}
            </select>
          </div>

          <div className="relative w-full lg:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari trader, ID akun, atau simbol..."
              className="h-10 bg-card pl-9 text-sm"
            />
          </div>
        </section>

        {/* Live Multi-User Positions Table */}
        <section className="rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Order & Waktu</th>
                  <th className="px-4 py-3 font-medium">Trader & Akun</th>
                  <th className="px-4 py-3 font-medium">Instrumen</th>
                  <th className="px-4 py-3 font-medium">Arah</th>
                  <th className="px-4 py-3 text-right font-medium">Nominal & Lev</th>
                  <th className="px-4 py-3 text-right font-medium">Masuk / Kini</th>
                  <th className="px-4 py-3 text-right font-medium">SL / TP</th>
                  <th className="px-4 py-3 text-right font-medium">P&L Live</th>
                  <th className="px-4 py-3 font-medium">Atur Profit User (USD)</th>
                  <th className="px-4 py-3 font-medium">Status / Auto-Close</th>
                  <th className="px-4 py-3 text-right font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {loading ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-4 py-8 text-center text-sm text-muted-foreground"
                    >
                      Memuat posisi trading pengguna...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-4 py-8 text-center text-sm text-muted-foreground"
                    >
                      Tidak ada posisi trading yang cocok.
                    </td>
                  </tr>
                ) : (
                  positionsPagination.paginatedItems.map((pos) => {
                    const stakePair = formatMoneyPair(resolvePositionStakeUsd(pos), currency);
                    const lockInfo =
                      pos.status === "Terbuka"
                        ? formatHoldCountdown(pos.unlockAtMs, nowMs)
                        : { locked: false, remainingMs: 0, label: "" };

                    return (
                      <tr key={pos.id} className="align-middle hover:bg-accent/25">
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <p className="font-mono text-xs font-bold text-foreground">{pos.id}</p>
                          <p className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                            {pos.type} · {pos.openedAt}
                          </p>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <p className="font-semibold text-foreground">{pos.userName}</p>
                          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                            {pos.accountId}
                          </p>
                        </td>
                        <td className="px-4 py-3.5 font-display font-bold text-foreground">
                          {pos.symbol}
                        </td>
                        <td
                          className={cn(
                            "px-4 py-3.5 text-xs font-bold",
                            pos.side === "BUY" ? "text-primary" : "text-destructive",
                          )}
                        >
                          {pos.side}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono tabular-nums whitespace-nowrap">
                          <p className="font-semibold text-foreground">{stakePair.primary}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {stakePair.secondary} · 1:{pos.leverage}
                          </p>
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono text-xs tabular-nums whitespace-nowrap">
                          <p className="text-muted-foreground">{pos.entry.toFixed(pos.decimals)}</p>
                          <p className="font-semibold text-foreground">
                            {pos.status === "Ditutup"
                              ? "—"
                              : pos.currentPrice.toFixed(pos.decimals)}
                          </p>
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono text-xs tabular-nums whitespace-nowrap text-muted-foreground">
                          {pos.sl} / {pos.tp}
                        </td>
                        <td
                          className={cn(
                            "px-4 py-3.5 text-right font-mono font-bold tabular-nums whitespace-nowrap",
                            pos.livePnl >= 0 ? "text-primary" : "text-destructive",
                          )}
                        >
                          {(() => {
                            const pnlPair = formatMoneyPair(pos.livePnl, currency, {
                              signed: true,
                            });
                            return (
                              <>
                                <p>{pnlPair.primary}</p>
                                <p className="text-[11px] font-normal text-muted-foreground">
                                  {pnlPair.secondary}
                                </p>
                              </>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3.5">
                          {pos.status !== "Ditutup" ? (
                            (() => {
                              const currentDraft =
                                profitDrafts[pos.id] ??
                                resolveTargetProfitUsd(
                                  pos,
                                  rules.defaultProfitPercent ?? 10,
                                ).toFixed(2);
                              const parsedDraft = Number(currentDraft);
                              return (
                                <div className="min-w-[175px] space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    <Input
                                      aria-label={`Atur keuntungan ${pos.id}`}
                                      type="number"
                                      min={0.5}
                                      step="0.5"
                                      value={currentDraft}
                                      onChange={(e) =>
                                        setProfitDrafts((prev) => ({
                                          ...prev,
                                          [pos.id]: e.target.value,
                                        }))
                                      }
                                      className="h-8 w-24 bg-background px-2 font-mono text-xs tabular-nums"
                                    />
                                    <Button
                                      type="button"
                                      size="sm"
                                      disabled={savingProfitId === pos.id}
                                      onClick={() => void handleSavePositionProfit(pos)}
                                      className="h-8 bg-primary px-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90"
                                    >
                                      {savingProfitId === pos.id ? "..." : "Simpan"}
                                    </Button>
                                  </div>
                                  <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
                                    ≈{" "}
                                    {formatIdr(
                                      (Number.isFinite(parsedDraft) && parsedDraft > 0
                                        ? parsedDraft
                                        : 0) * USD_TO_IDR_RATE,
                                    )}
                                  </p>
                                </div>
                              );
                            })()
                          ) : (
                            <div className="font-mono text-xs tabular-nums text-muted-foreground">
                              Terealisasi{" "}
                              <span className="font-semibold text-primary">
                                +${Math.abs(pos.pnl).toFixed(2)}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col items-start gap-1">
                            <span
                              className={cn(
                                "inline-block rounded-md border px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
                                pos.status === "Terbuka" &&
                                  "border-primary/40 bg-primary/10 text-primary",
                                pos.status === "Tertunda" &&
                                  "border-amber-500/40 bg-amber-500/10 text-amber-400",
                                pos.status === "Ditutup" &&
                                  "border-border bg-background text-muted-foreground",
                              )}
                            >
                              {pos.status}
                            </span>
                            {pos.status === "Terbuka" && lockInfo.locked && (
                              <span className="inline-flex items-center gap-1 font-mono text-[11px] text-amber-400">
                                <Lock className="size-3" />
                                Auto-close {lockInfo.label}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            {pos.status !== "Ditutup" ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={busyId === pos.id}
                                onClick={() => void handleForceClose(pos)}
                                className="h-8 gap-1 text-xs text-muted-foreground hover:text-destructive"
                              >
                                <X className="size-3.5" />
                                <span>{pos.status === "Terbuka" ? "Tutup" : "Batal"}</span>
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">Selesai</span>
                            )}
                            <AdminDeleteAction
                              itemLabel={`posisi ${pos.id}`}
                              disabled={busyId === pos.id || savingProfitId === pos.id}
                              onDelete={() => handleDeletePosition(pos)}
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
            page={positionsPagination.page}
            totalPages={positionsPagination.totalPages}
            totalItems={positionsPagination.totalItems}
            startItem={positionsPagination.startItem}
            endItem={positionsPagination.endItem}
            pageSize={positionsPagination.pageSize}
            onPageChange={positionsPagination.setPage}
            onPageSizeChange={positionsPagination.setPageSize}
            className="px-4 py-3"
          />
        </section>
      </div>
    </AdminShell>
  );
}
