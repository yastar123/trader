import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowDownRight, ArrowUpRight, Minus, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import type {
  MarketCategory,
  MarketInstrumentRecord,
  TrendBias,
} from "@/components/admin/admin-types";
import { Button } from "@/components/ui/button";
import { DataPagination, usePagination } from "@/components/ui/data-pagination";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const CATEGORIES: MarketCategory[] = [
  "Forex",
  "Logam Mulia",
  "Energi / Oil",
  "Kripto / Coin",
  "Indeks",
];

const QUICK_TEMPLATES: Array<{
  symbol: string;
  name: string;
  category: MarketCategory;
  basePrice: number;
  spreadValue: number;
  pipSize: number;
  tickStep: number;
  decimals: number;
  contractSize: number;
}> = [
  {
    symbol: "ETHUSD",
    name: "Ethereum / Dolar AS",
    category: "Kripto / Coin",
    basePrice: 3180.5,
    spreadValue: 2.5,
    pipSize: 0.1,
    tickStep: 2.8,
    decimals: 2,
    contractSize: 1,
  },
  {
    symbol: "SOLUSD",
    name: "Solana / Dolar AS",
    category: "Kripto / Coin",
    basePrice: 214.8,
    spreadValue: 0.35,
    pipSize: 0.01,
    tickStep: 0.25,
    decimals: 2,
    contractSize: 10,
  },
  {
    symbol: "XAGUSD",
    name: "Perak / Dolar AS (Silver)",
    category: "Logam Mulia",
    basePrice: 31.42,
    spreadValue: 0.03,
    pipSize: 0.01,
    tickStep: 0.025,
    decimals: 2,
    contractSize: 5000,
  },
  {
    symbol: "UKOIL",
    name: "Minyak Brent (UK Oil)",
    category: "Energi / Oil",
    basePrice: 75.6,
    spreadValue: 0.04,
    pipSize: 0.01,
    tickStep: 0.06,
    decimals: 2,
    contractSize: 1000,
  },
  {
    symbol: "US500",
    name: "Indeks S&P 500",
    category: "Indeks",
    basePrice: 5982.5,
    spreadValue: 0.5,
    pipSize: 0.1,
    tickStep: 1.5,
    decimals: 2,
    contractSize: 1,
  },
];

export function AdminMarketsView() {
  const [markets, setMarkets] = useState<MarketInstrumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"Semua" | MarketCategory>("Semua");
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Create form state
  const [showForm, setShowForm] = useState(false);
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<MarketCategory>("Kripto / Coin");
  const [basePrice, setBasePrice] = useState("3180.50");
  const [spreadValue, setSpreadValue] = useState("2.50");
  const [pipSize, setPipSize] = useState("0.1");
  const [tickStep, setTickStep] = useState("2.8");
  const [decimals, setDecimals] = useState("2");
  const [contractSize, setContractSize] = useState("1");
  const [trendBias, setTrendBias] = useState<TrendBias>("Naik");
  const [submitting, setSubmitting] = useState(false);

  // Edit state
  const [editingSymbol, setEditingSymbol] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editSpread, setEditSpread] = useState("");

  const loadMarkets = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/markets");
      if (res.ok) {
        const data = (await res.json()) as MarketInstrumentRecord[];
        setMarkets(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMarkets();
    const timer = window.setInterval(() => {
      void loadMarkets();
    }, 1200);
    return () => window.clearInterval(timer);
  }, [loadMarkets]);

  function applyTemplate(tpl: (typeof QUICK_TEMPLATES)[number]) {
    setShowForm(true);
    setSymbol(tpl.symbol);
    setName(tpl.name);
    setCategory(tpl.category);
    setBasePrice(String(tpl.basePrice));
    setSpreadValue(String(tpl.spreadValue));
    setPipSize(String(tpl.pipSize));
    setTickStep(String(tpl.tickStep));
    setDecimals(String(tpl.decimals));
    setContractSize(String(tpl.contractSize));
    setTrendBias("Netral");
  }

  async function handleCreateMarket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/markets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          name,
          category,
          basePrice: Number(basePrice),
          spreadValue: Number(spreadValue),
          pipSize: Number(pipSize),
          tickStep: Number(tickStep),
          decimals: Number(decimals),
          contractSize: Number(contractSize),
          trendBias,
          trendStrength: 2,
          enabled: true,
        }),
      });
      const json = (await res.json().catch(() => null)) as
        (MarketInstrumentRecord & { error?: string }) | null;
      if (!res.ok) {
        setFeedback({ type: "err", text: json?.error ?? "Gagal menambahkan instrumen." });
        return;
      }
      setFeedback({
        type: "ok",
        text: `Instrumen ${json?.symbol ?? symbol} berhasil ditambahkan dan langsung tersedia di terminal trader.`,
      });
      setSymbol("");
      setName("");
      setShowForm(false);
      await loadMarkets();
    } finally {
      setSubmitting(false);
    }
  }

  async function patchMarket(
    targetSymbol: string,
    patch: Record<string, unknown>,
    successMsg?: string,
  ) {
    setFeedback(null);
    const res = await fetch(`/api/admin/markets/${targetSymbol}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const json = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      setFeedback({ type: "err", text: json?.error ?? "Gagal memperbarui instrumen." });
      return;
    }
    if (successMsg) setFeedback({ type: "ok", text: successMsg });
    await loadMarkets();
  }

  async function handleDeleteMarket(targetSymbol: string) {
    setFeedback(null);
    const res = await fetch(`/api/admin/markets/${targetSymbol}`, { method: "DELETE" });
    if (res.ok) {
      setFeedback({ type: "ok", text: `Instrumen ${targetSymbol} telah dihapus.` });
      await loadMarkets();
    }
  }

  function startEdit(item: MarketInstrumentRecord) {
    setEditingSymbol(item.symbol);
    setEditName(item.name);
    setEditPrice(String(item.bid));
    setEditSpread(String(item.spreadValue));
  }

  async function saveEdit(targetSymbol: string) {
    await patchMarket(
      targetSymbol,
      {
        name: editName.trim(),
        bid: Number(editPrice),
        spreadValue: Number(editSpread),
      },
      `Detail instrumen ${targetSymbol} diperbarui.`,
    );
    setEditingSymbol(null);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return markets.filter((item) => {
      if (categoryFilter !== "Semua" && item.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        item.symbol.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [markets, categoryFilter, query]);

  const marketsPagination = usePagination(filtered, 5);

  return (
    <AdminShell
      title="Instrumen & Arah Pasar"
      subtitle="CRUD koin, emas, oil, forex serta kontrol arah pergerakan chart trader."
    >
      <div className="space-y-6">
        <section className="flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Manajemen Pasar Real-Time
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Instrumen Trading & Arah Chart
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Tambahkan aset (Crypto/Coin, Gold, Oil, Forex) dan atur kecenderungan arah pergerakan
              chart (Naik, Netral, atau Turun) yang langsung terlihat oleh user.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => setShowForm((prev) => !prev)}
            className="h-10 bg-primary px-4 text-sm font-bold text-primary-foreground hover:bg-primary/90"
          >
            {showForm ? (
              <>
                <X className="mr-1.5 size-4" />
                Tutup Formulir
              </>
            ) : (
              <>
                <Plus className="mr-1.5 size-4" />
                Tambah Instrumen
              </>
            )}
          </Button>
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

        {/* Quick Templates + Create Form */}
        {showForm && (
          <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <h2 className="font-display text-lg font-bold">Tambah Instrumen Baru</h2>
                <p className="text-xs text-muted-foreground">
                  Pilih template cepat di kanan atau isi spesifikasi instrumen secara manual.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.symbol}
                    type="button"
                    onClick={() => applyTemplate(tpl)}
                    className="rounded-md border border-border bg-background px-2.5 py-1 font-mono text-xs font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
                  >
                    + {tpl.symbol}
                  </button>
                ))}
              </div>
            </div>

            <form
              className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
              onSubmit={(e) => void handleCreateMarket(e)}
            >
              <div>
                <label htmlFor="mkt-symbol" className="block text-xs font-medium text-foreground">
                  Simbol
                </label>
                <Input
                  id="mkt-symbol"
                  required
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  placeholder="ETHUSD / USOIL / XAGUSD"
                  className="mt-1.5 h-10 bg-background font-mono uppercase"
                />
              </div>
              <div>
                <label htmlFor="mkt-name" className="block text-xs font-medium text-foreground">
                  Nama Instrumen
                </label>
                <Input
                  id="mkt-name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ethereum / Dolar AS"
                  className="mt-1.5 h-10 bg-background"
                />
              </div>
              <div>
                <label htmlFor="mkt-cat" className="block text-xs font-medium text-foreground">
                  Kategori
                </label>
                <select
                  id="mkt-cat"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as MarketCategory)}
                  className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="mkt-bias" className="block text-xs font-medium text-foreground">
                  Arah Chart Awal
                </label>
                <select
                  id="mkt-bias"
                  value={trendBias}
                  onChange={(e) => setTrendBias(e.target.value as TrendBias)}
                  className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                >
                  <option value="Naik">Naik (Bullish)</option>
                  <option value="Netral">Netral (Sideways)</option>
                  <option value="Turun">Turun (Bearish)</option>
                </select>
              </div>

              <div>
                <label htmlFor="mkt-price" className="block text-xs font-medium text-foreground">
                  Harga Awal (Bid)
                </label>
                <Input
                  id="mkt-price"
                  type="number"
                  step="any"
                  required
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                  className="mt-1.5 h-10 bg-background font-mono tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="mkt-spread" className="block text-xs font-medium text-foreground">
                  Spread Harga
                </label>
                <Input
                  id="mkt-spread"
                  type="number"
                  step="any"
                  required
                  value={spreadValue}
                  onChange={(e) => setSpreadValue(e.target.value)}
                  className="mt-1.5 h-10 bg-background font-mono tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="mkt-contract" className="block text-xs font-medium text-foreground">
                  Ukuran Kontrak / Lot
                </label>
                <Input
                  id="mkt-contract"
                  type="number"
                  min={1}
                  required
                  value={contractSize}
                  onChange={(e) => setContractSize(e.target.value)}
                  className="mt-1.5 h-10 bg-background font-mono tabular-nums"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="mkt-pip" className="block text-xs font-medium text-foreground">
                    Pip Size
                  </label>
                  <Input
                    id="mkt-pip"
                    type="number"
                    step="any"
                    required
                    value={pipSize}
                    onChange={(e) => setPipSize(e.target.value)}
                    className="mt-1.5 h-10 bg-background font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="mkt-dec" className="block text-xs font-medium text-foreground">
                    Desimal
                  </label>
                  <Input
                    id="mkt-dec"
                    type="number"
                    min={0}
                    max={5}
                    required
                    value={decimals}
                    onChange={(e) => setDecimals(e.target.value)}
                    className="mt-1.5 h-10 bg-background font-mono tabular-nums"
                  />
                </div>
              </div>

              <div className="flex items-end justify-end gap-2 sm:col-span-2 lg:col-span-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                  className="h-10"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="h-10 bg-primary px-6 font-bold text-primary-foreground hover:bg-primary/90"
                >
                  {submitting ? "Menyimpan..." : "Simpan Instrumen"}
                </Button>
              </div>
            </form>
          </section>
        )}

        {/* Filter & Search Bar */}
        <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-card p-1">
            {(["Semua", ...CATEGORIES] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors",
                  categoryFilter === cat
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari simbol atau kategori..."
              className="h-10 bg-card pl-9 text-sm"
            />
          </div>
        </section>

        {/* Instruments & Chart Direction Table */}
        <section className="rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Instrumen</th>
                  <th className="px-4 py-3 text-right font-medium">Harga Bid / Ask</th>
                  <th className="px-4 py-3 font-medium">Arah Pergerakan Chart</th>
                  <th className="px-4 py-3 font-medium">Kekuatan & Dorongan</th>
                  <th className="px-4 py-3 font-medium">Status User</th>
                  <th className="px-4 py-3 text-right font-medium">CRUD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Memuat daftar instrumen pasar...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Tidak ada instrumen yang sesuai filter.
                    </td>
                  </tr>
                ) : (
                  marketsPagination.paginatedItems.map((item) => {
                    const isEditing = editingSymbol === item.symbol;
                    const upTick = item.bid >= item.prevBid;
                    return (
                      <tr key={item.symbol} className="align-middle hover:bg-accent/20">
                        <td className="px-4 py-4">
                          {isEditing ? (
                            <div className="space-y-1.5">
                              <p className="font-mono text-xs font-bold text-primary">
                                {item.symbol}
                              </p>
                              <Input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="h-8 bg-background text-xs"
                              />
                            </div>
                          ) : (
                            <>
                              <p className="font-display text-sm font-bold text-foreground">
                                {item.symbol}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {item.name} · {item.category}
                              </p>
                            </>
                          )}
                        </td>

                        <td className="px-4 py-4 text-right">
                          {isEditing ? (
                            <div className="flex flex-col items-end gap-1.5">
                              <Input
                                type="number"
                                step="any"
                                value={editPrice}
                                onChange={(e) => setEditPrice(e.target.value)}
                                className="h-8 w-28 bg-background text-right font-mono text-xs tabular-nums"
                              />
                              <Input
                                type="number"
                                step="any"
                                value={editSpread}
                                onChange={(e) => setEditSpread(e.target.value)}
                                className="h-8 w-28 bg-background text-right font-mono text-xs tabular-nums"
                              />
                            </div>
                          ) : (
                            <>
                              <p
                                className={cn(
                                  "font-mono text-sm font-bold tabular-nums",
                                  upTick ? "text-primary" : "text-destructive",
                                )}
                              >
                                {item.bid.toFixed(item.decimals)}
                              </p>
                              <p className="font-mono text-xs tabular-nums text-muted-foreground">
                                Ask {item.ask.toFixed(item.decimals)} · Spread {item.spreadLabel}
                              </p>
                            </>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-background p-1">
                            <button
                              type="button"
                              onClick={() =>
                                void patchMarket(
                                  item.symbol,
                                  { trendBias: "Naik" },
                                  `Chart ${item.symbol} diatur ke arah Naik.`,
                                )
                              }
                              className={cn(
                                "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-colors",
                                item.trendBias === "Naik"
                                  ? "bg-primary text-primary-foreground"
                                  : "text-muted-foreground hover:text-foreground",
                              )}
                            >
                              <ArrowUpRight className="size-3.5" />
                              Naik
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void patchMarket(
                                  item.symbol,
                                  { trendBias: "Netral" },
                                  `Chart ${item.symbol} diatur ke arah Netral.`,
                                )
                              }
                              className={cn(
                                "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-colors",
                                item.trendBias === "Netral"
                                  ? "bg-accent text-foreground"
                                  : "text-muted-foreground hover:text-foreground",
                              )}
                            >
                              <Minus className="size-3.5" />
                              Netral
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void patchMarket(
                                  item.symbol,
                                  { trendBias: "Turun" },
                                  `Chart ${item.symbol} diatur ke arah Turun.`,
                                )
                              }
                              className={cn(
                                "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-colors",
                                item.trendBias === "Turun"
                                  ? "bg-destructive text-destructive-foreground"
                                  : "text-muted-foreground hover:text-foreground",
                              )}
                            >
                              <ArrowDownRight className="size-3.5" />
                              Turun
                            </button>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {([1, 2, 3] as const).map((str) => (
                              <button
                                key={str}
                                type="button"
                                onClick={() =>
                                  void patchMarket(item.symbol, { trendStrength: str })
                                }
                                className={cn(
                                  "rounded border px-2 py-1 font-mono text-[11px] font-semibold tabular-nums transition-colors",
                                  item.trendStrength === str
                                    ? "border-primary bg-primary/15 text-primary"
                                    : "border-border bg-background text-muted-foreground hover:text-foreground",
                                )}
                              >
                                {str}x
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() =>
                                void patchMarket(
                                  item.symbol,
                                  { nudgeDirection: "up" },
                                  `Harga ${item.symbol} didorong naik seketika.`,
                                )
                              }
                              title="Dorong harga naik seketika"
                              className="rounded border border-border bg-background px-2 py-1 text-[11px] font-semibold text-primary hover:border-primary"
                            >
                              +Pump
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void patchMarket(
                                  item.symbol,
                                  { nudgeDirection: "down" },
                                  `Harga ${item.symbol} didorong turun seketika.`,
                                )
                              }
                              title="Dorong harga turun seketika"
                              className="rounded border border-border bg-background px-2 py-1 text-[11px] font-semibold text-destructive hover:border-destructive"
                            >
                              -Dump
                            </button>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <button
                            type="button"
                            onClick={() =>
                              void patchMarket(
                                item.symbol,
                                { enabled: !item.enabled },
                                `${item.symbol} sekarang ${!item.enabled ? "Aktif" : "Disembunyikan"} untuk user.`,
                              )
                            }
                            className={cn(
                              "rounded-md border px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-colors",
                              item.enabled
                                ? "border-primary/40 bg-primary/10 text-primary"
                                : "border-border bg-background text-muted-foreground",
                            )}
                          >
                            {item.enabled ? "Aktif" : "Nonaktif"}
                          </button>
                        </td>

                        <td className="px-4 py-4 text-right">
                          {isEditing ? (
                            <div className="flex justify-end gap-1.5">
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => void saveEdit(item.symbol)}
                                className="h-8 bg-primary px-2.5 text-xs font-bold text-primary-foreground"
                              >
                                Simpan
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingSymbol(null)}
                                className="h-8 px-2.5 text-xs"
                              >
                                Batal
                              </Button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => startEdit(item)}
                                aria-label={`Edit ${item.symbol}`}
                                className="h-8 px-2 text-muted-foreground hover:text-foreground"
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => void handleDeleteMarket(item.symbol)}
                                aria-label={`Hapus ${item.symbol}`}
                                className="h-8 px-2 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <DataPagination
            page={marketsPagination.page}
            totalPages={marketsPagination.totalPages}
            totalItems={marketsPagination.totalItems}
            startItem={marketsPagination.startItem}
            endItem={marketsPagination.endItem}
            pageSize={marketsPagination.pageSize}
            onPageChange={marketsPagination.setPage}
            onPageSizeChange={marketsPagination.setPageSize}
            className="px-4 py-3"
          />
        </section>
      </div>
    </AdminShell>
  );
}
