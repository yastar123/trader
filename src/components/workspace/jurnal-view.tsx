import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataPagination, usePagination } from "@/components/ui/data-pagination";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type StrategyType = "Breakout" | "Pullback" | "Scalping" | "Swing";

type JournalEntry = {
  id: string;
  date: string;
  symbol: string;
  side: "BUY" | "SELL";
  lot: number;
  entry: string;
  exit: string;
  pnl: number;
  rr: string;
  strategy: StrategyType;
  emotion: string;
  notes: string;
};

const initialEntries: JournalEntry[] = [
  {
    id: "JRN-412",
    date: "12 Nov 2026",
    symbol: "EURUSD",
    side: "BUY",
    lot: 0.5,
    entry: "1.08120",
    exit: "1.08480",
    pnl: 180.0,
    rr: "1:2.4",
    strategy: "Breakout",
    emotion: "Disiplin",
    notes: "Menembus resisten sesi London dengan volume konfirmasi. Keluar sesuai target TP.",
  },
  {
    id: "JRN-411",
    date: "11 Nov 2026",
    symbol: "XAUUSD",
    side: "BUY",
    lot: 0.2,
    entry: "2668.40",
    exit: "2681.90",
    pnl: 270.0,
    rr: "1:3.0",
    strategy: "Pullback",
    emotion: "Tenang",
    notes: "Retest area demand H1 setelah rilis data tenaga kerja AS.",
  },
  {
    id: "JRN-410",
    date: "10 Nov 2026",
    symbol: "GBPUSD",
    side: "SELL",
    lot: 0.3,
    entry: "1.29810",
    exit: "1.30040",
    pnl: -69.0,
    rr: "1:1.0",
    strategy: "Scalping",
    emotion: "Terburu-buru",
    notes: "Masuk sebelum penutupan candle M15. Perlu menunggu konfirmasi penuh.",
  },
  {
    id: "JRN-409",
    date: "08 Nov 2026",
    symbol: "USDJPY",
    side: "BUY",
    lot: 0.4,
    entry: "151.600",
    exit: "152.280",
    pnl: 178.5,
    rr: "1:2.1",
    strategy: "Swing",
    emotion: "Disiplin",
    notes: "Mengikuti tren naik harian setelah pantulan di rata-rata bergerak 20 hari.",
  },
];

export function JurnalView() {
  const [entries, setEntries] = useState<JournalEntry[]>(initialEntries);
  const [resultFilter, setResultFilter] = useState<"Semua" | "Profit" | "Loss">("Semua");
  const [strategyFilter, setStrategyFilter] = useState<"Semua" | StrategyType>("Semua");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [symbol, setSymbol] = useState("EURUSD");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [lot, setLot] = useState("0.20");
  const [entryPrice, setEntryPrice] = useState("");
  const [exitPrice, setExitPrice] = useState("");
  const [pnl, setPnl] = useState("");
  const [strategy, setStrategy] = useState<StrategyType>("Pullback");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    void fetch("/api/journal")
      .then((res) => (res.ok ? (res.json() as Promise<JournalEntry[]>) : null))
      .then((data) => {
        if (Array.isArray(data)) setEntries(data);
      })
      .catch(() => {});
  }, []);

  const stats = useMemo(() => {
    const total = entries.length;
    const wins = entries.filter((e) => e.pnl > 0);
    const losses = entries.filter((e) => e.pnl < 0);
    const netPnl = entries.reduce((acc, cur) => acc + cur.pnl, 0);
    const winRate = total > 0 ? Math.round((wins.length / total) * 100) : 0;
    const grossProfit = wins.reduce((acc, cur) => acc + cur.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((acc, cur) => acc + cur.pnl, 0));
    const profitFactor =
      grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : grossProfit > 0 ? "∞" : "0.00";
    return { total, winRate, netPnl, profitFactor };
  }, [entries]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (resultFilter === "Profit" && e.pnl <= 0) return false;
      if (resultFilter === "Loss" && e.pnl >= 0) return false;
      if (strategyFilter !== "Semua" && e.strategy !== strategyFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return e.symbol.toLowerCase().includes(q) || e.notes.toLowerCase().includes(q);
      }
      return true;
    });
  }, [entries, resultFilter, strategyFilter, search]);

  const journalPagination = usePagination(filtered, 5);

  async function handleAddEntry(e: FormEvent) {
    e.preventDefault();
    const numericPnl = Number.parseFloat(pnl) || 0;
    const numericLot = Math.max(0.01, Number.parseFloat(lot) || 0.1);
    const payload = {
      date: "12 Nov 2026",
      symbol: symbol.trim().toUpperCase() || "EURUSD",
      side,
      lot: numericLot,
      entry: entryPrice.trim() || "1.08200",
      exit: exitPrice.trim() || "1.08450",
      pnl: numericPnl,
      strategy,
      emotion: "Tercatat",
      notes: notes.trim() || "Catatan transaksi baru.",
    };

    try {
      const res = await fetch("/api/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const created = (await res.json()) as JournalEntry;
        setEntries((prev) => [created, ...prev]);
        setShowForm(false);
        setEntryPrice("");
        setExitPrice("");
        setPnl("");
        setNotes("");
        return;
      }
    } catch {
      // Fallback
    }

    const created: JournalEntry = {
      id: `JRN-${Math.floor(415 + Math.random() * 500)}`,
      ...payload,
      rr: numericPnl >= 0 ? "1:2.0" : "1:1.0",
    };
    setEntries((prev) => [created, ...prev]);
    setShowForm(false);
    setEntryPrice("");
    setExitPrice("");
    setPnl("");
    setNotes("");
  }

  function handleDelete(id: string) {
    setEntries((prev) => prev.filter((item) => item.id !== id));
    void fetch(`/api/journal/${id}`, { method: "DELETE" }).catch(() => {});
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Jurnal Trading
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Catat eksekusi, evaluasi disiplin strategi, dan ukur rasio profitabilitas
          </p>
        </div>
        <Button type="button" onClick={() => setShowForm((v) => !v)} className="gap-2 font-bold">
          <Plus className="size-4" />
          <span>{showForm ? "Tutup Formulir" : "Catat Trading"}</span>
        </Button>
      </div>

      {/* Summary Stats */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs font-medium text-muted-foreground">Total Catatan</p>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs font-medium text-muted-foreground">Win Rate</p>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-primary">
            {stats.winRate}%
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs font-medium text-muted-foreground">Profit Factor</p>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums">{stats.profitFactor}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs font-medium text-muted-foreground">Net P&L Tercatat</p>
          <p
            className={cn(
              "mt-2 font-mono text-2xl font-bold tabular-nums",
              stats.netPnl >= 0 ? "text-primary" : "text-destructive",
            )}
          >
            {stats.netPnl >= 0
              ? `+$${stats.netPnl.toFixed(2)}`
              : `-$${Math.abs(stats.netPnl).toFixed(2)}`}
          </p>
        </div>
      </section>

      {/* Add Entry Form */}
      {showForm && (
        <form
          onSubmit={handleAddEntry}
          className="space-y-4 rounded-xl border border-border bg-card p-5 sm:p-6"
        >
          <h2 className="font-display text-lg font-bold">Tambah Catatan Transaksi</h2>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <div className="space-y-1.5">
              <label htmlFor="jrn-symbol" className="text-xs font-medium">
                Instrumen
              </label>
              <Input
                id="jrn-symbol"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="jrn-side" className="text-xs font-medium">
                Arah
              </label>
              <select
                id="jrn-side"
                value={side}
                onChange={(e) => setSide(e.target.value as "BUY" | "SELL")}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="BUY">BUY</option>
                <option value="SELL">SELL</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="jrn-lot" className="text-xs font-medium">
                Lot
              </label>
              <Input
                id="jrn-lot"
                type="number"
                step="0.01"
                value={lot}
                onChange={(e) => setLot(e.target.value)}
                className="font-mono tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="jrn-entry" className="text-xs font-medium">
                Harga Masuk
              </label>
              <Input
                id="jrn-entry"
                placeholder="1.08120"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                className="font-mono tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="jrn-exit" className="text-xs font-medium">
                Harga Keluar
              </label>
              <Input
                id="jrn-exit"
                placeholder="1.08480"
                value={exitPrice}
                onChange={(e) => setExitPrice(e.target.value)}
                className="font-mono tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="jrn-pnl" className="text-xs font-medium">
                Hasil P&L (USD)
              </label>
              <Input
                id="jrn-pnl"
                type="number"
                step="0.01"
                placeholder="125.00"
                value={pnl}
                onChange={(e) => setPnl(e.target.value)}
                className="font-mono tabular-nums"
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label htmlFor="jrn-strategy" className="text-xs font-medium">
                Strategi
              </label>
              <select
                id="jrn-strategy"
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as StrategyType)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="Breakout">Breakout</option>
                <option value="Pullback">Pullback</option>
                <option value="Scalping">Scalping</option>
                <option value="Swing">Swing</option>
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor="jrn-notes" className="text-xs font-medium">
                Catatan Evaluasi & Psikologi
              </label>
              <Textarea
                id="jrn-notes"
                rows={2}
                placeholder="Alasan masuk posisi, kesesuaian rencana trading, dan pelajaran..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
              Batal
            </Button>
            <Button type="submit" className="font-bold">
              Simpan Catatan
            </Button>
          </div>
        </form>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari pasangan atau catatan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
            {(["Semua", "Profit", "Loss"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setResultFilter(r)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                  resultFilter === r
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r}
              </button>
            ))}
          </div>

          <select
            aria-label="Filter strategi"
            value={strategyFilter}
            onChange={(e) => setStrategyFilter(e.target.value as "Semua" | StrategyType)}
            className="h-9 rounded-md border border-border bg-card px-3 text-xs font-medium text-foreground"
          >
            <option value="Semua">Semua Strategi</option>
            <option value="Breakout">Breakout</option>
            <option value="Pullback">Pullback</option>
            <option value="Scalping">Scalping</option>
            <option value="Swing">Swing</option>
          </select>
        </div>
      </div>

      {/* Journal Table */}
      <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Tidak ada catatan jurnal yang cocok dengan filter Anda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="py-2.5 pr-4 font-medium">Tanggal</th>
                  <th className="py-2.5 pr-4 font-medium">Instrumen</th>
                  <th className="py-2.5 pr-4 font-medium">Strategi</th>
                  <th className="py-2.5 pr-4 text-right font-medium">Lot</th>
                  <th className="py-2.5 pr-4 text-right font-medium">Masuk / Keluar</th>
                  <th className="py-2.5 pr-4 text-right font-medium">R:R</th>
                  <th className="py-2.5 pr-4 text-right font-medium">P&L</th>
                  <th className="py-2.5 pr-4 font-medium">Catatan</th>
                  <th className="py-2.5 text-right font-medium">Hapus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {journalPagination.paginatedItems.map((item) => (
                  <tr key={item.id} className="align-top hover:bg-accent/30">
                    <td className="py-3.5 pr-4 font-mono text-xs whitespace-nowrap tabular-nums text-muted-foreground">
                      {item.date}
                    </td>
                    <td className="py-3.5 pr-4 whitespace-nowrap">
                      <span className="font-display font-bold">{item.symbol}</span>{" "}
                      <span
                        className={cn(
                          "text-xs font-bold",
                          item.side === "BUY" ? "text-primary" : "text-destructive",
                        )}
                      >
                        {item.side}
                      </span>
                    </td>
                    <td className="py-3.5 pr-4 text-xs whitespace-nowrap text-muted-foreground">
                      {item.strategy} · {item.emotion}
                    </td>
                    <td className="py-3.5 pr-4 text-right font-mono tabular-nums">
                      {item.lot.toFixed(2)}
                    </td>
                    <td className="py-3.5 pr-4 text-right font-mono text-xs whitespace-nowrap tabular-nums text-muted-foreground">
                      {item.entry} → {item.exit}
                    </td>
                    <td className="py-3.5 pr-4 text-right font-mono text-xs tabular-nums">
                      {item.rr}
                    </td>
                    <td
                      className={cn(
                        "py-3.5 pr-4 text-right font-mono font-semibold whitespace-nowrap tabular-nums",
                        item.pnl >= 0 ? "text-primary" : "text-destructive",
                      )}
                    >
                      {item.pnl >= 0
                        ? `+$${item.pnl.toFixed(2)}`
                        : `-$${Math.abs(item.pnl).toFixed(2)}`}
                    </td>
                    <td className="max-w-xs py-3.5 pr-4 text-xs leading-5 text-muted-foreground">
                      {item.notes}
                    </td>
                    <td className="py-3.5 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(item.id)}
                        aria-label={`Hapus catatan ${item.id}`}
                        className="size-8 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <DataPagination
              page={journalPagination.page}
              totalPages={journalPagination.totalPages}
              totalItems={journalPagination.totalItems}
              startItem={journalPagination.startItem}
              endItem={journalPagination.endItem}
              pageSize={journalPagination.pageSize}
              onPageChange={journalPagination.setPage}
              onPageSizeChange={journalPagination.setPageSize}
              className="mt-4"
            />
          </div>
        )}
      </section>
    </div>
  );
}
