import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ImagePlus,
  Mail,
  Trash2,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  formatIdr,
  formatUsd,
  USD_TO_IDR_RATE,
  type DepositMethodRecord,
  type DepositRequestRecord,
  type MarketInstrumentRecord,
  type WalletLimitsRecord,
  type WithdrawRequestRecord,
} from "@/components/admin/admin-types";
import { Button } from "@/components/ui/button";
import { DataPagination, usePagination } from "@/components/ui/data-pagination";
import { Input } from "@/components/ui/input";
import { formatMoneyPair, type DisplayCurrency } from "@/lib/currency";
import { saveDemoSession, useDemoSession } from "@/lib/fe-session";
import { readImageFileAsDataUrl } from "@/lib/image-upload";
import { computeGuaranteedPositionPnl, resolvePositionStakeUsd } from "@/lib/trading";
import { cn } from "@/lib/utils";

type EquityPoint = {
  label: string;
  ekuitas: number;
  saldo: number;
};

const equitySeriesByRange: Record<"1M" | "1B" | "3B" | "1T", EquityPoint[]> = {
  "1M": [
    { label: "Sen", ekuitas: 23940, saldo: 23800 },
    { label: "Sel", ekuitas: 24120, saldo: 23950 },
    { label: "Rab", ekuitas: 24010, saldo: 24050 },
    { label: "Kam", ekuitas: 24480, saldo: 24210 },
    { label: "Jum", ekuitas: 24850.4, saldo: 24510 },
  ],
  "1B": [
    { label: "Mgg 1", ekuitas: 22100, saldo: 22000 },
    { label: "Mgg 2", ekuitas: 22740, saldo: 22680 },
    { label: "Mgg 3", ekuitas: 23490, saldo: 23310 },
    { label: "Mgg 4", ekuitas: 24850.4, saldo: 24510 },
  ],
  "3B": [
    { label: "Sep", ekuitas: 19800, saldo: 19800 },
    { label: "Okt", ekuitas: 21950, saldo: 21700 },
    { label: "Nov", ekuitas: 24850.4, saldo: 24510 },
  ],
  "1T": [
    { label: "Jan", ekuitas: 15000, saldo: 15000 },
    { label: "Mar", ekuitas: 16800, saldo: 16650 },
    { label: "Mei", ekuitas: 18420, saldo: 18200 },
    { label: "Jul", ekuitas: 19950, saldo: 19780 },
    { label: "Sep", ekuitas: 21600, saldo: 21450 },
    { label: "Nov", ekuitas: 24850.4, saldo: 24510 },
  ],
};

const watchlistPairs = [
  {
    symbol: "EURUSD",
    name: "Euro / Dolar AS",
    bid: "1.08452",
    ask: "1.08454",
    spread: "0.2",
    change: "+0.38%",
    up: true,
  },
  {
    symbol: "XAUUSD",
    name: "Emas / Dolar AS",
    bid: "2684.40",
    ask: "2684.61",
    spread: "2.1",
    change: "+1.24%",
    up: true,
  },
  {
    symbol: "GBPUSD",
    name: "Pound / Dolar AS",
    bid: "1.29610",
    ask: "1.29613",
    spread: "0.3",
    change: "-0.19%",
    up: false,
  },
  {
    symbol: "USDJPY",
    name: "Dolar AS / Yen",
    bid: "152.340",
    ask: "152.343",
    spread: "0.3",
    change: "+0.52%",
    up: true,
  },
  {
    symbol: "BTCUSD",
    name: "Bitcoin / Dolar AS",
    bid: "88420.0",
    ask: "88438.0",
    spread: "18.0",
    change: "+2.85%",
    up: true,
  },
];

const fallbackOpenPositions = [
  {
    id: "POS-9041",
    symbol: "EURUSD",
    side: "BUY",
    lot: "$500.00",
    entry: "1.08120",
    current: "1.08452",
    pnlUsd: 62.5,
    up: true,
  },
  {
    id: "POS-9044",
    symbol: "XAUUSD",
    side: "BUY",
    lot: "$1,000.00",
    entry: "2672.50",
    current: "2684.40",
    pnlUsd: 124.0,
    up: true,
  },
  {
    id: "POS-9045",
    symbol: "BTCUSD",
    side: "BUY",
    lot: "$450.00",
    entry: "88110.0",
    current: "88420.0",
    pnlUsd: 54.0,
    up: true,
  },
];

type RawPosition = {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  lot: number;
  stakeUsd?: number;
  leverage?: number;
  entry: number;
  pnl: number;
  livePnl?: number;
  status: "Terbuka" | "Tertunda" | "Ditutup";
  openedAtMs?: number;
  unlockAtMs?: number;
};

type WalletTransactionsPayload = {
  balance: number;
  deposits: DepositRequestRecord[];
  withdrawals: WithdrawRequestRecord[];
  limits?: WalletLimitsRecord;
  depositMethods?: DepositMethodRecord[];
  idrPerUsd?: number;
};

export function BerandaView() {
  const { session } = useDemoSession();
  const [positions, setPositions] = useState<RawPosition[] | null>(null);
  const [markets, setMarkets] = useState<MarketInstrumentRecord[]>([]);
  const [range, setRange] = useState<"1M" | "1B" | "3B" | "1T">("1B");
  const [walletMode, setWalletMode] = useState<"deposit" | "withdraw">("deposit");
  const [amountInput, setAmountInput] = useState("1700000");
  const [methodInput, setMethodInput] = useState("Transfer Bank BCA");
  const [referenceInput, setReferenceInput] = useState("");
  const [proofImage, setProofImage] = useState("");
  const [proofFileName, setProofFileName] = useState("");
  const [destinationInput, setDestinationInput] = useState("Bank BCA · 5210948120");
  const [walletData, setWalletData] = useState<WalletTransactionsPayload>({
    balance: session.balance ?? 24510,
    deposits: [],
    withdrawals: [],
    limits: { minDeposit: 10, maxDeposit: 50000, minWithdraw: 10, maxWithdraw: 25000 },
    idrPerUsd: USD_TO_IDR_RATE,
  });
  const [walletMessage, setWalletMessage] = useState<{ type: "ok" | "err"; text: string } | null>(
    null,
  );
  const [submittingWallet, setSubmittingWallet] = useState(false);

  const loadWallet = useCallback(async () => {
    try {
      const [walletRes, posRes, mktRes] = await Promise.all([
        fetch("/api/wallet/transactions"),
        fetch("/api/positions"),
        fetch("/api/markets"),
      ]);
      if (walletRes.ok) {
        const json = (await walletRes.json()) as WalletTransactionsPayload;
        setWalletData(json);
        if (Array.isArray(json.depositMethods) && json.depositMethods.length > 0) {
          setMethodInput((prev) =>
            json.depositMethods!.some((m) => m.label === prev)
              ? prev
              : json.depositMethods![0]!.label,
          );
        }
        saveDemoSession({ balance: json.balance });
      }
      if (posRes.ok) {
        const posData = (await posRes.json()) as RawPosition[];
        if (Array.isArray(posData)) setPositions(posData);
      }
      if (mktRes.ok) {
        const mktData = (await mktRes.json()) as MarketInstrumentRecord[];
        if (Array.isArray(mktData)) setMarkets(mktData);
      }
    } catch {
      // Ignore transient load failures
    }
  }, []);

  useEffect(() => {
    void loadWallet();
    const timer = window.setInterval(() => {
      void loadWallet();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [loadWallet]);

  async function handleQuickProofUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setWalletMessage(null);
    try {
      const dataUrl = await readImageFileAsDataUrl(file);
      setProofImage(dataUrl);
      setProofFileName(file.name);
    } catch (err) {
      setWalletMessage({
        type: "err",
        text: err instanceof Error ? err.message : "Gagal membaca gambar bukti transfer.",
      });
    }
  }

  async function handleWalletSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWalletMessage(null);
    const activeLimits = walletData.limits ?? {
      minDeposit: 10,
      maxDeposit: 50000,
      minWithdraw: 10,
      maxWithdraw: 25000,
    };
    const rate = walletData.idrPerUsd ?? USD_TO_IDR_RATE;
    const numericAmount = Number(amountInput);

    if (walletMode === "deposit") {
      const minIdr = Math.round(activeLimits.minDeposit * rate);
      const maxIdr = Math.round(activeLimits.maxDeposit * rate);
      const convertedUsd = Number((numericAmount / rate).toFixed(2));
      if (!Number.isFinite(numericAmount) || convertedUsd < activeLimits.minDeposit) {
        setWalletMessage({
          type: "err",
          text: `Nominal deposit minimal ${formatIdr(minIdr)} (${formatUsd(activeLimits.minDeposit)}).`,
        });
        return;
      }
      if (convertedUsd > activeLimits.maxDeposit) {
        setWalletMessage({
          type: "err",
          text: `Nominal deposit maksimal ${formatIdr(maxIdr)} (${formatUsd(activeLimits.maxDeposit)}).`,
        });
        return;
      }
      if (!proofImage) {
        setWalletMessage({
          type: "err",
          text: "Mohon unggah bukti transfer (gambar/screenshot) sebelum mengirim deposit.",
        });
        return;
      }
    } else {
      if (!Number.isFinite(numericAmount) || numericAmount < activeLimits.minWithdraw) {
        setWalletMessage({
          type: "err",
          text: `Nominal penarikan minimal ${formatUsd(activeLimits.minWithdraw)} USD.`,
        });
        return;
      }
      if (numericAmount > activeLimits.maxWithdraw) {
        setWalletMessage({
          type: "err",
          text: `Nominal penarikan maksimal ${formatUsd(activeLimits.maxWithdraw)} USD.`,
        });
        return;
      }
    }

    setSubmittingWallet(true);
    try {
      const endpoint = walletMode === "deposit" ? "/api/wallet/deposit" : "/api/wallet/withdraw";
      const payload =
        walletMode === "deposit"
          ? {
              amountIdr: Math.round(numericAmount),
              method: methodInput,
              reference: referenceInput,
              proofImage,
              proofFileName,
            }
          : {
              amount: numericAmount,
              destination: destinationInput,
            };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as { id?: string; error?: string } | null;
      if (!res.ok) {
        setWalletMessage({
          type: "err",
          text: json?.error ?? "Gagal mengajukan permintaan dana.",
        });
        return;
      }
      setReferenceInput("");
      setProofImage("");
      setProofFileName("");
      setWalletMessage({
        type: "ok",
        text: `Pengajuan ${json?.id ?? ""} dikirim dengan status Menunggu Verifikasi Admin.`,
      });
      await loadWallet();
    } finally {
      setSubmittingWallet(false);
    }
  }

  const chartData = equitySeriesByRange[range];
  const rate = walletData.idrPerUsd ?? USD_TO_IDR_RATE;
  const displayCurrency: DisplayCurrency = session.currency === "IDR" ? "IDR" : "USD";
  const liveBalance = walletData.balance;

  const marketMap = useMemo(() => {
    const map: Record<string, MarketInstrumentRecord> = {};
    for (const m of markets) map[m.symbol] = m;
    return map;
  }, [markets]);

  const liveOpenPositions = useMemo(() => {
    if (!positions) return fallbackOpenPositions;
    return positions
      .filter((p) => p.status === "Terbuka")
      .map((p) => {
        const mkt = marketMap[p.symbol];
        const currentPrice = mkt ? (p.side === "BUY" ? mkt.bid : mkt.ask) : p.entry;
        const livePnl =
          typeof p.livePnl === "number" && Number.isFinite(p.livePnl)
            ? p.livePnl
            : computeGuaranteedPositionPnl(p, mkt?.bid, mkt?.tickStep);
        const posMargin = resolvePositionStakeUsd(p);
        return {
          id: p.id,
          symbol: p.symbol,
          side: p.side,
          lot: formatUsd(posMargin),
          entry: p.entry.toFixed(mkt?.decimals ?? 5),
          current: currentPrice.toFixed(mkt?.decimals ?? 5),
          pnlUsd: livePnl,
          posMargin,
          up: livePnl >= 0,
        };
      });
  }, [positions, marketMap]);

  const totalFloatingPnl = useMemo(() => {
    if (!positions) return 340.4;
    return liveOpenPositions.reduce((acc, cur) => acc + cur.pnlUsd, 0);
  }, [positions, liveOpenPositions]);

  const totalUsedMargin = useMemo(() => {
    if (!positions) return 1910.25;
    return liveOpenPositions.reduce(
      (acc, cur) => acc + ("posMargin" in cur ? cur.posMargin : 0),
      0,
    );
  }, [positions, liveOpenPositions]);

  const liveEquity = liveBalance + totalFloatingPnl;
  const freeMargin = Math.max(0, liveEquity - totalUsedMargin);
  const marginLevelPct = totalUsedMargin > 0 ? (liveEquity / totalUsedMargin) * 100 : 0;

  const walletHistoryRows = useMemo(
    () => [
      ...walletData.deposits.map((d) => ({
        id: d.id,
        kind: "Deposit",
        detail: `${d.method} · ${d.reference}`,
        amount: d.amount,
        amountIdr: d.amountIdr ?? Math.round(d.amount * rate),
        status: d.status,
        time: d.submittedAt,
      })),
      ...walletData.withdrawals.map((w) => ({
        id: w.id,
        kind: "Withdraw",
        detail: w.destination,
        amount: w.amount,
        amountIdr: Math.round(w.amount * rate),
        status: w.status,
        time: w.submittedAt,
      })),
    ],
    [walletData.deposits, walletData.withdrawals, rate],
  );

  const openPositionsPagination = usePagination(liveOpenPositions, 5);
  const walletHistoryPagination = usePagination(walletHistoryRows, 5);

  const kpis = [
    {
      label: "Saldo Akun",
      pair: formatMoneyPair(liveBalance, displayCurrency, { rate }),
      note: "Dana terealisasi · Kurs 1 USD = Rp 17.000",
      up: true,
    },
    {
      label: "Ekuitas Saat Ini",
      pair: formatMoneyPair(liveEquity, displayCurrency, { rate }),
      note: "Tersinkronisasi langsung",
      up: true,
    },
    {
      label: "P&L Mengambang",
      pair: formatMoneyPair(totalFloatingPnl, displayCurrency, { signed: true, rate }),
      note: `${liveOpenPositions.length} posisi terbuka`,
      up: totalFloatingPnl >= 0,
    },
    {
      label: "Margin Tersedia",
      pair: formatMoneyPair(freeMargin, displayCurrency, { rate }),
      note:
        totalUsedMargin > 0
          ? `Level margin ${Math.round(marginLevelPct).toLocaleString("en-US")}%`
          : "Bebas digunakan",
      up: true,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Greeting Header */}
      <section className="flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-muted-foreground">
            Selamat datang kembali,{" "}
            <span className="font-medium text-foreground">{session.name}</span>
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Ringkasan Portofolio & Pasar
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/deposit"
            className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-card px-4 text-sm font-medium whitespace-nowrap text-foreground transition-colors hover:bg-accent"
          >
            Deposit
          </Link>
          <Link
            to="/withdraw"
            className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-card px-4 text-sm font-medium whitespace-nowrap text-foreground transition-colors hover:bg-accent"
          >
            Withdraw
          </Link>
          <Link
            to="/jurnal"
            className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-card px-4 text-sm font-medium whitespace-nowrap text-foreground transition-colors hover:bg-accent"
          >
            Catat Jurnal
          </Link>
          <Link
            to="/trade"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-bold whitespace-nowrap text-primary-foreground transition-opacity hover:opacity-90"
          >
            Eksekusi Order
          </Link>
        </div>
      </section>

      {/* 4-Column KPI Strip */}
      <section aria-label="Metrik akun utama" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((item) => (
          <div key={item.label} className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
            <p
              className={cn(
                "mt-2 font-mono text-2xl font-bold tabular-nums",
                item.label === "P&L Mengambang"
                  ? item.up
                    ? "text-primary"
                    : "text-destructive"
                  : "text-foreground",
              )}
            >
              {item.pair.primary}
            </p>
            <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">
              ≈ {item.pair.secondary}
            </p>
            <p
              className={cn(
                "mt-2 flex items-center gap-1 text-xs",
                item.up ? "text-primary" : "text-destructive",
              )}
            >
              {item.up ? (
                <ArrowUpRight className="size-3.5 shrink-0" />
              ) : (
                <ArrowDownRight className="size-3.5 shrink-0" />
              )}
              <span>{item.note}</span>
            </p>
          </div>
        ))}
      </section>

      {/* Main Chart + Watchlist */}
      <section className="grid gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-border bg-card p-5 sm:p-6 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-bold">Pertumbuhan Ekuitas</h2>
              <p className="text-xs text-muted-foreground">
                Perbandingan ekuitas berjalan dan saldo terealisasi
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
              {(["1M", "1B", "3B", "1T"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRange(r)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors",
                    range === r
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="oklch(0.82 0.23 148)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="oklch(0.82 0.23 148)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="oklch(0.24 0.006 260)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  stroke="oklch(0.68 0.008 260)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="oklch(0.68 0.008 260)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  domain={["dataMin - 500", "dataMax + 300"]}
                  tickFormatter={(val: number) =>
                    displayCurrency === "IDR"
                      ? `Rp ${Math.round((val * rate) / 1_000_000)}jt`
                      : `$${(val / 1000).toFixed(1)}k`
                  }
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "oklch(0.135 0.005 260)",
                    borderColor: "oklch(0.24 0.006 260)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value: number) => {
                    const pair = formatMoneyPair(value, displayCurrency, { rate });
                    return [`${pair.primary} (${pair.secondary})`, "Ekuitas"];
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="ekuitas"
                  stroke="oklch(0.82 0.23 148)"
                  strokeWidth={2}
                  fill="url(#equityGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Watchlist Table */}
        <div className="rounded-xl border border-border bg-card p-5 sm:p-6 lg:col-span-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-bold">Pantauan Pasar Utama</h2>
              <p className="text-xs text-muted-foreground">Klik instrumen untuk membuka terminal</p>
            </div>
            <Link
              to="/trade"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              Semua Pasar
              <ArrowRight className="size-3.5" />
            </Link>
          </div>

          <div className="mt-4 divide-y divide-border">
            {watchlistPairs.map((pair) => (
              <Link
                key={pair.symbol}
                to="/trade"
                className="flex items-center justify-between gap-3 py-3 transition-colors hover:bg-accent/40"
              >
                <div className="min-w-0">
                  <p className="font-display text-sm font-bold text-foreground">{pair.symbol}</p>
                  <p className="truncate text-xs text-muted-foreground">{pair.name}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
                    {pair.bid} / {pair.ask}
                  </p>
                  <p
                    className={cn(
                      "mt-0.5 inline-flex items-center gap-1 font-mono text-xs font-medium tabular-nums",
                      pair.up ? "text-primary" : "text-destructive",
                    )}
                  >
                    {pair.up ? (
                      <ArrowUpRight className="size-3" />
                    ) : (
                      <ArrowDownRight className="size-3" />
                    )}
                    <span>{pair.change}</span>
                    <span className="text-muted-foreground">· Spread {pair.spread}</span>
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Open Positions + Quick Ecosystem Links */}
      <section className="grid gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-border bg-card p-5 sm:p-6 lg:col-span-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-lg font-bold">Posisi Terbuka Aktif</h2>
            <Link to="/trade" className="text-xs font-semibold text-primary hover:underline">
              Kelola di Terminal
            </Link>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="py-2.5 pr-4 font-medium">Instrumen</th>
                  <th className="py-2.5 pr-4 font-medium">Arah</th>
                  <th className="py-2.5 pr-4 text-right font-medium">Nominal</th>
                  <th className="py-2.5 pr-4 text-right font-medium">Harga Masuk</th>
                  <th className="py-2.5 pr-4 text-right font-medium">Harga Kini</th>
                  <th className="py-2.5 text-right font-medium">P&L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {openPositionsPagination.paginatedItems.map((pos) => (
                  <tr key={pos.id} className="hover:bg-accent/30">
                    <td className="py-3 pr-4 font-display font-bold">{pos.symbol}</td>
                    <td
                      className={cn(
                        "py-3 pr-4 text-xs font-bold",
                        pos.side === "BUY" ? "text-primary" : "text-destructive",
                      )}
                    >
                      {pos.side}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums">{pos.lot}</td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums">{pos.entry}</td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums">{pos.current}</td>
                    <td
                      className={cn(
                        "py-3 text-right font-mono font-semibold tabular-nums",
                        pos.up ? "text-primary" : "text-destructive",
                      )}
                    >
                      {(() => {
                        const pnlPair = formatMoneyPair(pos.pnlUsd, displayCurrency, {
                          signed: true,
                          rate,
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
                  </tr>
                ))}
              </tbody>
            </table>
            <DataPagination
              page={openPositionsPagination.page}
              totalPages={openPositionsPagination.totalPages}
              totalItems={openPositionsPagination.totalItems}
              startItem={openPositionsPagination.startItem}
              endItem={openPositionsPagination.endItem}
              pageSize={openPositionsPagination.pageSize}
              onPageChange={openPositionsPagination.setPage}
              onPageSizeChange={openPositionsPagination.setPageSize}
              className="mt-4"
            />
          </div>
        </div>

        <div className="space-y-4 lg:col-span-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold">Agenda Terdekat</h3>
              <CalendarDays className="size-4 text-primary" />
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="border-b border-border/70 pb-3">
                <p className="font-medium text-foreground">Rilis Data CPI Inti AS (YoY)</p>
                <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">
                  Hari ini · 20:30 WIB · Dampak Tinggi
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground">Webinar: Struktur Pasar XAUUSD</p>
                <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">
                  Besok · 19:00 WIB · Menengah
                </p>
              </div>
            </div>
            <Link
              to="/kalender-akademi"
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              Buka Kalender Akademi
              <ArrowRight className="size-3.5" />
            </Link>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold">Kotak Surat</h3>
              <Mail className="size-4 text-primary" />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Anda memiliki 3 pesan baru termasuk konfirmasi penyesuaian margin & ringkasan
              mingguan.
            </p>
            <Link
              to="/kotak-surat"
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              Baca Kotak Surat
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Deposit & Withdraw Request Panel (Manual Admin Verification) */}
      <section className="grid gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-border bg-card p-5 sm:p-6 lg:col-span-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold">Deposit & Penarikan Dana</h2>
              <p className="text-xs text-muted-foreground">
                Semua pengajuan diproses melalui verifikasi manual oleh admin.
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-1 rounded-lg border border-border bg-background p-1">
            <button
              type="button"
              onClick={() => {
                setWalletMode("deposit");
                setAmountInput("1700000");
                setWalletMessage(null);
              }}
              className={cn(
                "rounded-md py-2 text-xs font-semibold transition-colors",
                walletMode === "deposit"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Ajukan Deposit
            </button>
            <button
              type="button"
              onClick={() => {
                setWalletMode("withdraw");
                setAmountInput("250");
                setWalletMessage(null);
              }}
              className={cn(
                "rounded-md py-2 text-xs font-semibold transition-colors",
                walletMode === "withdraw"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Ajukan Withdraw
            </button>
          </div>

          <form className="mt-5 space-y-4" onSubmit={(e) => void handleWalletSubmit(e)}>
            <div>
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="wallet-amount"
                  className="block text-xs font-medium text-foreground"
                >
                  {walletMode === "deposit" ? "Nominal Deposit (IDR)" : "Nominal Penarikan (USD)"}
                </label>
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {walletMode === "deposit"
                    ? `Min ${formatIdr((walletData.limits?.minDeposit ?? 10) * (walletData.idrPerUsd ?? USD_TO_IDR_RATE))} · Maks ${formatIdr((walletData.limits?.maxDeposit ?? 50000) * (walletData.idrPerUsd ?? USD_TO_IDR_RATE))}`
                    : `Min $${(walletData.limits?.minWithdraw ?? 10).toLocaleString("en-US")} · Maks $${(walletData.limits?.maxWithdraw ?? 25000).toLocaleString("en-US")}`}
                </span>
              </div>
              <Input
                id="wallet-amount"
                type="number"
                min={
                  walletMode === "deposit"
                    ? Math.round(
                        (walletData.limits?.minDeposit ?? 10) *
                          (walletData.idrPerUsd ?? USD_TO_IDR_RATE),
                      )
                    : (walletData.limits?.minWithdraw ?? 10)
                }
                max={
                  walletMode === "deposit"
                    ? Math.round(
                        (walletData.limits?.maxDeposit ?? 50000) *
                          (walletData.idrPerUsd ?? USD_TO_IDR_RATE),
                      )
                    : (walletData.limits?.maxWithdraw ?? 25000)
                }
                step={walletMode === "deposit" ? "1000" : "0.01"}
                required
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="mt-1.5 h-10 bg-background font-mono tabular-nums"
              />
              {walletMode === "deposit" && (
                <p className="mt-1 font-mono text-[11px] tabular-nums text-primary">
                  Kurs 1 USD = {formatIdr(walletData.idrPerUsd ?? USD_TO_IDR_RATE)} → Estimasi
                  kredit:{" "}
                  {formatUsd(
                    (Number(amountInput) || 0) / (walletData.idrPerUsd ?? USD_TO_IDR_RATE),
                  )}
                </p>
              )}
            </div>

            {walletMode === "deposit" ? (
              <>
                <div>
                  <label
                    htmlFor="wallet-method"
                    className="block text-xs font-medium text-foreground"
                  >
                    Metode Transfer
                  </label>
                  {walletData.depositMethods && walletData.depositMethods.length > 0 ? (
                    <select
                      id="wallet-method"
                      value={methodInput}
                      onChange={(e) => setMethodInput(e.target.value)}
                      className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none"
                    >
                      {walletData.depositMethods.map((m) => (
                        <option key={m.id} value={m.label}>
                          {m.label} · {m.accountInfo}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id="wallet-method"
                      required
                      value={methodInput}
                      onChange={(e) => setMethodInput(e.target.value)}
                      placeholder="Transfer Bank BCA / Mandiri / BNI / USDT"
                      className="mt-1.5 h-10 bg-background"
                    />
                  )}
                </div>
                <div>
                  <label htmlFor="wallet-ref" className="block text-xs font-medium text-foreground">
                    Nomor Referensi Bukti Transfer
                  </label>
                  <Input
                    id="wallet-ref"
                    value={referenceInput}
                    onChange={(e) => setReferenceInput(e.target.value)}
                    placeholder="Contoh: BCA-REF-8839201"
                    className="mt-1.5 h-10 bg-background font-mono"
                  />
                </div>
                <div>
                  <label
                    htmlFor="wallet-proof"
                    className="block text-xs font-medium text-foreground"
                  >
                    Bukti Transfer (Gambar / Screenshot)
                  </label>
                  {!proofImage ? (
                    <label
                      htmlFor="wallet-proof"
                      className="mt-1.5 flex cursor-pointer items-center gap-2.5 rounded-lg border border-dashed border-border bg-background px-3 py-2.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                    >
                      <ImagePlus className="size-4 shrink-0 text-primary" />
                      <span>Unggah screenshot / foto bukti transfer</span>
                    </label>
                  ) : (
                    <div className="mt-1.5 flex items-center justify-between gap-2 rounded-lg border border-border bg-background p-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <img
                          src={proofImage}
                          alt="Pratinjau bukti transfer"
                          className="h-9 w-14 shrink-0 rounded object-cover"
                        />
                        <span className="truncate text-xs text-foreground">
                          {proofFileName || "bukti-transfer.png"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setProofImage("");
                          setProofFileName("");
                        }}
                        aria-label="Hapus bukti transfer"
                        className="rounded p-1 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  )}
                  <input
                    id="wallet-proof"
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={(e) => void handleQuickProofUpload(e)}
                    className="sr-only"
                  />
                </div>
              </>
            ) : (
              <div>
                <label htmlFor="wallet-dest" className="block text-xs font-medium text-foreground">
                  Rekening Tujuan Penarikan
                </label>
                <Input
                  id="wallet-dest"
                  required
                  value={destinationInput}
                  onChange={(e) => setDestinationInput(e.target.value)}
                  placeholder="Bank BCA · Nomor Rekening"
                  className="mt-1.5 h-10 bg-background"
                />
              </div>
            )}

            {walletMessage && (
              <p
                role="status"
                className={cn(
                  "rounded-lg border px-3 py-2 text-xs font-medium",
                  walletMessage.type === "ok"
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-destructive/40 bg-destructive/10 text-destructive",
                )}
              >
                {walletMessage.text}
              </p>
            )}

            <Button
              type="submit"
              disabled={submittingWallet}
              className="h-10 w-full bg-primary font-bold text-primary-foreground hover:bg-primary/90"
            >
              {submittingWallet
                ? "Mengirim..."
                : walletMode === "deposit"
                  ? "Kirim Permintaan Deposit"
                  : "Kirim Permintaan Withdraw"}
            </Button>
          </form>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 sm:p-6 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <div>
              <h2 className="font-display text-lg font-bold">Riwayat Pengajuan Dana</h2>
              <p className="text-xs text-muted-foreground">
                Status diperbarui setelah verifikasi manual pada Panel Admin.
              </p>
            </div>
            <Link to="/admin/login" className="text-xs font-semibold text-primary hover:underline">
              Verifikasi di Panel Admin
            </Link>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="py-2.5 pr-4 font-medium">ID</th>
                  <th className="py-2.5 pr-4 font-medium">Jenis & Detail</th>
                  <th className="py-2.5 pr-4 text-right font-medium">Nominal</th>
                  <th className="py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {walletHistoryPagination.paginatedItems.map((row) => (
                  <tr key={row.id} className="hover:bg-accent/25">
                    <td className="py-3 pr-4">
                      <p className="font-mono text-xs font-bold text-foreground">{row.id}</p>
                      <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
                        {row.time}
                      </p>
                    </td>
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-foreground">{row.kind}</p>
                      <p className="text-xs text-muted-foreground">{row.detail}</p>
                    </td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums text-foreground">
                      <p className="font-semibold">
                        {displayCurrency === "IDR"
                          ? formatIdr(row.amountIdr)
                          : formatUsd(row.amount)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {displayCurrency === "IDR"
                          ? formatUsd(row.amount)
                          : formatIdr(row.amountIdr)}
                      </p>
                    </td>
                    <td className="py-3">
                      <span
                        className={cn(
                          "inline-block rounded-md border px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
                          row.status === "Disetujui" &&
                            "border-primary/40 bg-primary/10 text-primary",
                          row.status === "Menunggu" &&
                            "border-amber-500/40 bg-amber-500/10 text-amber-400",
                          row.status === "Ditolak" &&
                            "border-destructive/40 bg-destructive/10 text-destructive",
                        )}
                      >
                        {row.status === "Menunggu" ? "Menunggu Admin" : row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <DataPagination
              page={walletHistoryPagination.page}
              totalPages={walletHistoryPagination.totalPages}
              totalItems={walletHistoryPagination.totalItems}
              startItem={walletHistoryPagination.startItem}
              endItem={walletHistoryPagination.endItem}
              pageSize={walletHistoryPagination.pageSize}
              onPageChange={walletHistoryPagination.setPage}
              onPageSizeChange={walletHistoryPagination.setPageSize}
              className="mt-4"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
