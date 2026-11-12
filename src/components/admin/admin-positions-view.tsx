import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { formatUsd, type AdminPositionRecord } from "@/components/admin/admin-types";
import { Button } from "@/components/ui/button";
import { DataPagination, usePagination } from "@/components/ui/data-pagination";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PositionStatusFilter = "Semua" | "Terbuka" | "Tertunda" | "Ditutup";

export function AdminPositionsView() {
  const [positions, setPositions] = useState<AdminPositionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<PositionStatusFilter>("Semua");
  const [symbolFilter, setSymbolFilter] = useState("Semua");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadPositions = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/positions");
      if (res.ok) {
        const data = (await res.json()) as AdminPositionRecord[];
        setPositions(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPositions();
    const timer = window.setInterval(() => {
      void loadPositions();
    }, 1200);
    return () => window.clearInterval(timer);
  }, [loadPositions]);

  async function handleForceClose(pos: AdminPositionRecord) {
    setBusyId(pos.id);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/positions/${pos.id}/close`, { method: "PATCH" });
      if (res.ok) {
        setFeedback(
          `Posisi ${pos.id} milik ${pos.userName} (${pos.symbol}) telah ${pos.status === "Terbuka" ? "ditutup paksa" : "dibatalkan"}.`,
        );
        await loadPositions();
      }
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
    const totalLots = open.reduce((acc, cur) => acc + cur.lot, 0);
    const totalFloating = open.reduce((acc, cur) => acc + cur.livePnl, 0);
    const activeTraders = new Set(open.map((p) => p.accountId)).size;
    return {
      openCount: open.length,
      pendingCount: pending.length,
      totalLots,
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
            className="rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary"
          >
            {feedback}
          </div>
        )}

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
            <p className="text-xs font-medium text-muted-foreground">Total Lot Aktif</p>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-foreground">
              {summary.totalLots.toFixed(2)} Lot
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">Gabungan seluruh posisi terbuka</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-medium text-muted-foreground">Total P&L Mengambang Klien</p>
            <p
              className={cn(
                "mt-2 font-mono text-2xl font-bold tabular-nums",
                summary.totalFloating >= 0 ? "text-primary" : "text-destructive",
              )}
            >
              {summary.totalFloating >= 0 ? "+" : "-"}
              {formatUsd(Math.abs(summary.totalFloating))}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">Tersinkronisasi tick pasar</p>
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
                  <th className="px-4 py-3 text-right font-medium">Lot & Lev</th>
                  <th className="px-4 py-3 text-right font-medium">Masuk / Kini</th>
                  <th className="px-4 py-3 text-right font-medium">SL / TP</th>
                  <th className="px-4 py-3 text-right font-medium">P&L Live</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {loading ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 py-8 text-center text-sm text-muted-foreground"
                    >
                      Memuat posisi trading pengguna...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 py-8 text-center text-sm text-muted-foreground"
                    >
                      Tidak ada posisi trading yang cocok.
                    </td>
                  </tr>
                ) : (
                  positionsPagination.paginatedItems.map((pos) => (
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
                        <p className="font-semibold text-foreground">{pos.lot.toFixed(2)} lot</p>
                        <p className="text-[11px] text-muted-foreground">1:{pos.leverage}</p>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-xs tabular-nums whitespace-nowrap">
                        <p className="text-muted-foreground">{pos.entry.toFixed(pos.decimals)}</p>
                        <p className="font-semibold text-foreground">
                          {pos.status === "Ditutup" ? "—" : pos.currentPrice.toFixed(pos.decimals)}
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
                        {pos.livePnl >= 0
                          ? `+$${pos.livePnl.toFixed(2)}`
                          : `-$${Math.abs(pos.livePnl).toFixed(2)}`}
                      </td>
                      <td className="px-4 py-3.5">
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
                      </td>
                      <td className="px-4 py-3.5 text-right">
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
                      </td>
                    </tr>
                  ))
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
