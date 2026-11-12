import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, CheckCircle2, Pause, Play, X } from "lucide-react";
import type { MarketInstrumentRecord } from "@/components/admin/admin-types";
import { Button } from "@/components/ui/button";
import { DataPagination, usePagination } from "@/components/ui/data-pagination";
import { Input } from "@/components/ui/input";
import { saveDemoSession, useDemoSession } from "@/lib/fe-session";
import { cn } from "@/lib/utils";

type Timeframe = "M5" | "M15" | "H1" | "H4" | "D1";

type ActivePosition = {
  id: string;
  userId?: string;
  userName?: string;
  accountId?: string;
  symbol: string;
  type: "Market" | "Limit";
  side: "BUY" | "SELL";
  lot: number;
  leverage?: number;
  entry: number;
  sl: string;
  tp: string;
  pnl: number;
  status: "Terbuka" | "Tertunda" | "Ditutup";
  openedAt: string;
};

const FALLBACK_MARKETS: MarketInstrumentRecord[] = [
  {
    symbol: "EURUSD",
    name: "Euro / Dolar AS",
    category: "Forex",
    basePrice: 1.08452,
    bid: 1.08452,
    ask: 1.08454,
    prevBid: 1.0845,
    openDay: 1.0821,
    spreadValue: 0.00002,
    spreadLabel: "0.2",
    pipSize: 0.0001,
    tickStep: 0.00006,
    decimals: 5,
    contractSize: 100000,
    trendBias: "Netral",
    trendStrength: 2,
    enabled: true,
    candles: [
      { time: "14:00", open: 1.0835, high: 1.0846, low: 1.0831, close: 1.0842 },
      { time: "14:15", open: 1.0842, high: 1.0849, low: 1.0839, close: 1.08452 },
    ],
  },
];

const LOT_PRESETS = [0.01, 0.05, 0.1, 0.5, 1.0];
const LEVERAGE_TIERS = [50, 100, 200, 500, 1000] as const;

function computeFloatingPnl(
  pos: ActivePosition,
  market: MarketInstrumentRecord | undefined,
): number {
  if (!market) return pos.pnl;
  if (pos.status === "Ditutup") return pos.pnl;
  if (pos.status === "Tertunda") return 0;

  const exitPrice = pos.side === "BUY" ? market.bid : market.ask;
  const diff = pos.side === "BUY" ? exitPrice - pos.entry : pos.entry - exitPrice;
  const raw = diff * market.contractSize * pos.lot;
  const usd = market.quoteInJpy ? raw / Math.max(1, exitPrice) : raw;
  return Number(usd.toFixed(2));
}

function computeRequiredMargin(
  spec: MarketInstrumentRecord,
  lot: number,
  price: number,
  leverage: number,
): number {
  const notionalUsd = spec.quoteInJpy ? lot * spec.contractSize : lot * spec.contractSize * price;
  return Number((notionalUsd / Math.max(1, leverage)).toFixed(2));
}

export function TradeView() {
  const { session, updateSession } = useDemoSession();
  const [balance, setBalance] = useState<number>(session.balance ?? 24510);

  const [markets, setMarkets] = useState<MarketInstrumentRecord[]>(FALLBACK_MARKETS);
  const [selectedSymbol, setSelectedSymbol] = useState("EURUSD");
  const [timeframe, setTimeframe] = useState<Timeframe>("M15");
  const [chartType, setChartType] = useState<"candle" | "line">("candle");
  const [liveFeedActive, setLiveFeedActive] = useState(true);

  const [orderType, setOrderType] = useState<"Market" | "Limit">("Market");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [lot, setLot] = useState("0.20");
  const [leverage, setLeverage] = useState<number>(session.leverage ?? 500);
  const [limitPrice, setLimitPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");

  const [positions, setPositions] = useState<ActivePosition[]>([]);
  const [bottomTab, setBottomTab] = useState<"Terbuka" | "Tertunda" | "Ditutup">("Terbuka");
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [hoveredCandleIdx, setHoveredCandleIdx] = useState<number | null>(null);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const [chartSize, setChartSize] = useState({ width: 780, height: 360 });
  const settlingIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof session.leverage === "number") {
      setLeverage(session.leverage);
    }
  }, [session.leverage]);

  const fetchMarkets = useCallback(async () => {
    try {
      const res = await fetch("/api/markets");
      if (res.ok) {
        const data = (await res.json()) as MarketInstrumentRecord[];
        if (Array.isArray(data) && data.length > 0) {
          setMarkets(data);
        }
      }
    } catch {
      // Keep last known market snapshot
    }
  }, []);

  const loadInitialData = useCallback(async () => {
    try {
      const [posRes, sesRes] = await Promise.all([fetch("/api/positions"), fetch("/api/session")]);
      if (posRes.ok) {
        const posData = (await posRes.json()) as ActivePosition[];
        if (Array.isArray(posData)) setPositions(posData);
      }
      if (sesRes.ok) {
        const sesData = (await sesRes.json()) as { balance?: number; leverage?: number };
        if (typeof sesData.balance === "number") {
          setBalance(sesData.balance);
          saveDemoSession({ balance: sesData.balance });
        }
        if (typeof sesData.leverage === "number") {
          setLeverage(sesData.leverage);
        }
      }
    } catch {
      // Ignore transient errors
    }
  }, []);

  useEffect(() => {
    void fetchMarkets();
    void loadInitialData();
  }, [fetchMarkets, loadInitialData]);

  // Poll server-authoritative live market ticks (respecting Admin additions & trend controls)
  useEffect(() => {
    if (!liveFeedActive) return;
    const timer = window.setInterval(() => {
      void fetchMarkets();
    }, 900);
    return () => window.clearInterval(timer);
  }, [liveFeedActive, fetchMarkets]);

  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry && entry.contentRect.width > 120) {
        setChartSize({
          width: Math.floor(entry.contentRect.width),
          height: Math.floor(entry.contentRect.height),
        });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const marketMap = useMemo(() => {
    const map: Record<string, MarketInstrumentRecord> = {};
    for (const m of markets) map[m.symbol] = m;
    return map;
  }, [markets]);

  const activeMarket = useMemo(
    () => marketMap[selectedSymbol] ?? markets[0] ?? FALLBACK_MARKETS[0]!,
    [marketMap, selectedSymbol, markets],
  );

  useEffect(() => {
    if (!marketMap[selectedSymbol] && markets[0]) {
      setSelectedSymbol(markets[0].symbol);
    }
  }, [marketMap, selectedSymbol, markets]);

  const handleClosePosition = useCallback(
    async (pos: ActivePosition, customPnl?: number, reason?: string) => {
      if (settlingIdsRef.current.has(pos.id)) return;
      settlingIdsRef.current.add(pos.id);

      const market = marketMap[pos.symbol];
      const finalPnl = customPnl ?? computeFloatingPnl(pos, market);

      try {
        const res = await fetch(`/api/positions/${pos.id}/close`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pnl: finalPnl }),
        });

        if (res.ok) {
          const data = (await res.json()) as {
            position?: ActivePosition;
            balance?: number;
          };
          setPositions((prev) =>
            prev.map((item) =>
              item.id === pos.id
                ? (data.position ?? { ...item, status: "Ditutup", pnl: finalPnl })
                : item,
            ),
          );
          if (typeof data.balance === "number") {
            setBalance(data.balance);
            saveDemoSession({ balance: data.balance });
          }
        } else {
          setPositions((prev) =>
            prev.map((item) =>
              item.id === pos.id ? { ...item, status: "Ditutup", pnl: finalPnl } : item,
            ),
          );
        }

        const pnlLabel =
          pos.status === "Terbuka"
            ? `${finalPnl >= 0 ? "+" : "-"}$${Math.abs(finalPnl).toFixed(2)}`
            : "dibatalkan";
        setFeedback({
          type: "ok",
          text:
            reason ??
            `Posisi ${pos.id} (${pos.symbol} ${pos.side} ${pos.lot.toFixed(2)} lot) ${
              pos.status === "Terbuka" ? `ditutup dengan realisasi ${pnlLabel}` : "dibatalkan"
            }.`,
        });
      } finally {
        settlingIdsRef.current.delete(pos.id);
      }
    },
    [marketMap],
  );

  // Check Limit triggers and SL/TP triggers on every server market update
  useEffect(() => {
    for (const pos of positions) {
      if (settlingIdsRef.current.has(pos.id)) continue;
      const market = marketMap[pos.symbol];
      if (!market) continue;

      if (pos.status === "Tertunda") {
        const triggered =
          (pos.side === "BUY" && market.ask <= pos.entry) ||
          (pos.side === "SELL" && market.bid >= pos.entry);
        if (triggered) {
          settlingIdsRef.current.add(pos.id);
          void fetch(`/api/positions/${pos.id}/activate`, { method: "PATCH" })
            .then((res) => (res.ok ? (res.json() as Promise<ActivePosition>) : null))
            .then((updated) => {
              setPositions((prev) =>
                prev.map((item) =>
                  item.id === pos.id ? (updated ?? { ...item, status: "Terbuka" }) : item,
                ),
              );
              setFeedback({
                type: "ok",
                text: `Order Limit ${pos.id} (${pos.symbol} ${pos.side}) tereksekusi pada ${pos.entry.toFixed(market.decimals)}.`,
              });
            })
            .finally(() => {
              settlingIdsRef.current.delete(pos.id);
            });
        }
      } else if (pos.status === "Terbuka") {
        const currentClosePrice = pos.side === "BUY" ? market.bid : market.ask;
        const slNum = Number.parseFloat(pos.sl);
        const tpNum = Number.parseFloat(pos.tp);

        const hitSl =
          Number.isFinite(slNum) &&
          slNum > 0 &&
          ((pos.side === "BUY" && currentClosePrice <= slNum) ||
            (pos.side === "SELL" && currentClosePrice >= slNum));

        const hitTp =
          Number.isFinite(tpNum) &&
          tpNum > 0 &&
          ((pos.side === "BUY" && currentClosePrice >= tpNum) ||
            (pos.side === "SELL" && currentClosePrice <= tpNum));

        if (hitSl || hitTp) {
          const realized = computeFloatingPnl(pos, market);
          void handleClosePosition(
            pos,
            realized,
            `${hitTp ? "Take Profit" : "Stop Loss"} terpicu untuk ${pos.id} (${pos.symbol}) pada ${currentClosePrice.toFixed(market.decimals)} (${realized >= 0 ? "+" : "-"}$${Math.abs(realized).toFixed(2)}).`,
          );
        }
      }
    }
  }, [marketMap, positions, handleClosePosition]);

  const parsedLot = Math.max(0.01, Math.min(50, Number.parseFloat(lot) || 0.01));
  const requiredMargin = computeRequiredMargin(
    activeMarket,
    parsedLot,
    side === "BUY" ? activeMarket.ask : activeMarket.bid,
    leverage,
  );
  const pipValueUsd = useMemo(() => {
    const raw = activeMarket.pipSize * activeMarket.contractSize * parsedLot;
    return activeMarket.quoteInJpy ? raw / Math.max(1, activeMarket.bid) : raw;
  }, [activeMarket, parsedLot]);

  // Live Account Margin Telemetry across open positions
  const openPositionsWithLive = useMemo(() => {
    return positions
      .filter((p) => p.status === "Terbuka")
      .map((p) => {
        const market = marketMap[p.symbol] ?? activeMarket;
        const livePnl = computeFloatingPnl(p, market);
        const currentPrice = p.side === "BUY" ? market.bid : market.ask;
        const posLev = p.leverage ?? leverage;
        const posMargin = computeRequiredMargin(market, p.lot, p.entry, posLev);
        return {
          ...p,
          leverage: posLev,
          livePnl,
          currentPrice,
          posMargin,
          decimals: market.decimals,
        };
      });
  }, [positions, marketMap, activeMarket, leverage]);

  const totalFloatingPnl = useMemo(
    () => openPositionsWithLive.reduce((acc, cur) => acc + cur.livePnl, 0),
    [openPositionsWithLive],
  );
  const usedMargin = useMemo(
    () => openPositionsWithLive.reduce((acc, cur) => acc + cur.posMargin, 0),
    [openPositionsWithLive],
  );
  const equity = balance + totalFloatingPnl;
  const freeMargin = Math.max(0, equity - usedMargin);
  const marginLevel = usedMargin > 0 ? (equity / usedMargin) * 100 : 0;

  function handleSelectInstrument(symbol: string) {
    setSelectedSymbol(symbol);
    setLimitPrice("");
    setStopLoss("");
    setTakeProfit("");
    setHoveredCandleIdx(null);
    setFeedback(null);
  }

  function handleLeverageChange(nextLeverage: number) {
    setLeverage(nextLeverage);
    void updateSession({ leverage: nextLeverage });
  }

  function adjustLot(delta: number) {
    const next = Math.max(0.01, Math.min(50, Number((parsedLot + delta).toFixed(2))));
    setLot(next.toFixed(2));
  }

  function applyQuickSlTp(kind: "sl" | "tp", pips: number) {
    const refPrice = side === "BUY" ? activeMarket.ask : activeMarket.bid;
    const offset = pips * activeMarket.pipSize;
    if (kind === "sl") {
      const target = side === "BUY" ? refPrice - offset : refPrice + offset;
      setStopLoss(target.toFixed(activeMarket.decimals));
    } else {
      const target = side === "BUY" ? refPrice + offset : refPrice - offset;
      setTakeProfit(target.toFixed(activeMarket.decimals));
    }
  }

  async function handlePlaceOrder() {
    setFeedback(null);

    if (requiredMargin > freeMargin) {
      setFeedback({
        type: "err",
        text: `Margin bebas tidak cukup ($${freeMargin.toFixed(2)} tersedia, butuh $${requiredMargin.toFixed(2)} dengan leverage 1:${leverage}).`,
      });
      return;
    }

    const entryPrice =
      orderType === "Limit" && Number.parseFloat(limitPrice) > 0
        ? Number.parseFloat(limitPrice)
        : side === "BUY"
          ? activeMarket.ask
          : activeMarket.bid;

    const payload = {
      symbol: activeMarket.symbol,
      type: orderType,
      side,
      lot: parsedLot,
      leverage,
      entry: Number(entryPrice.toFixed(activeMarket.decimals)),
      sl: stopLoss.trim() || "-",
      tp: takeProfit.trim() || "-",
    };

    try {
      const res = await fetch("/api/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as
        (ActivePosition & { error?: string }) | null;
      if (!res.ok) {
        setFeedback({ type: "err", text: json?.error ?? "Gagal menempatkan order." });
        return;
      }
      if (json) {
        setPositions((prev) => [json, ...prev]);
        setBottomTab(orderType === "Market" ? "Terbuka" : "Tertunda");
        setFeedback({
          type: "ok",
          text: `Order ${side} ${parsedLot.toFixed(2)} lot ${activeMarket.symbol} (1:${leverage}) tereksekusi pada ${entryPrice.toFixed(activeMarket.decimals)}.`,
        });
      }
    } catch {
      setFeedback({ type: "err", text: "Koneksi ke server eksekusi gagal." });
    }
  }

  const displayedPositions = useMemo(() => {
    if (bottomTab === "Terbuka") {
      return openPositionsWithLive;
    }
    return positions
      .filter((p) => p.status === bottomTab)
      .map((p) => {
        const market = marketMap[p.symbol] ?? activeMarket;
        return {
          ...p,
          leverage: p.leverage ?? leverage,
          livePnl: p.pnl,
          currentPrice: p.side === "BUY" ? market.bid : market.ask,
          decimals: market.decimals,
        };
      });
  }, [bottomTab, openPositionsWithLive, positions, marketMap, activeMarket, leverage]);

  const positionsPagination = usePagination(displayedPositions, 5);

  // SVG Candlestick & Price Overlay Geometry
  const chartGeometry = useMemo(() => {
    const candles = activeMarket.candles;
    const padLeft = 14;
    const padRight = 78;
    const padTop = 20;
    const padBottom = 30;
    const w = Math.max(320, chartSize.width);
    const h = Math.max(240, chartSize.height);
    const plotW = w - padLeft - padRight;
    const plotH = h - padTop - padBottom;

    let minPrice = Number.POSITIVE_INFINITY;
    let maxPrice = Number.NEGATIVE_INFINITY;
    for (const c of candles) {
      if (c.low < minPrice) minPrice = c.low;
      if (c.high > maxPrice) maxPrice = c.high;
    }
    if (activeMarket.bid < minPrice) minPrice = activeMarket.bid;
    if (activeMarket.ask > maxPrice) maxPrice = activeMarket.ask;

    const span = Math.max(activeMarket.pipSize * 4, maxPrice - minPrice);
    const paddedMin = minPrice - span * 0.12;
    const paddedMax = maxPrice + span * 0.12;
    const range = Math.max(activeMarket.pipSize * 2, paddedMax - paddedMin);

    const priceToY = (price: number) => padTop + ((paddedMax - price) / range) * plotH;
    const slotW = plotW / Math.max(1, candles.length);
    const bodyW = Math.max(4, Math.min(14, slotW * 0.62));

    return {
      w,
      h,
      padLeft,
      padRight,
      padTop,
      padBottom,
      plotW,
      plotH,
      paddedMin,
      paddedMax,
      priceToY,
      slotW,
      bodyW,
      candles,
    };
  }, [activeMarket, chartSize]);

  const hoveredCandle =
    hoveredCandleIdx !== null ? chartGeometry.candles[hoveredCandleIdx] : undefined;
  const activeDayChangePct =
    activeMarket.openDay > 0
      ? ((activeMarket.bid - activeMarket.openDay) / activeMarket.openDay) * 100
      : 0;

  return (
    <div className="space-y-5">
      {/* Live Account & Margin Bar */}
      <section
        aria-label="Ringkasan margin langsung"
        className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-3 lg:grid-cols-6"
      >
        <div>
          <p className="text-[11px] font-medium text-muted-foreground">Saldo Akun</p>
          <p className="mt-1 font-mono text-sm font-bold tabular-nums text-foreground">
            $
            {balance.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-medium text-muted-foreground">Ekuitas</p>
          <p className="mt-1 font-mono text-sm font-bold tabular-nums text-foreground">
            $
            {equity.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-medium text-muted-foreground">P&L Mengambang</p>
          <p
            className={cn(
              "mt-1 font-mono text-sm font-bold tabular-nums",
              totalFloatingPnl >= 0 ? "text-primary" : "text-destructive",
            )}
          >
            {totalFloatingPnl >= 0 ? "+" : "-"}${Math.abs(totalFloatingPnl).toFixed(2)}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-medium text-muted-foreground">Margin Terpakai</p>
          <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-foreground">
            $
            {usedMargin.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-medium text-muted-foreground">Margin Bebas</p>
          <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-foreground">
            $
            {freeMargin.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-medium text-muted-foreground">
            Level Margin (1:{leverage})
          </p>
          <p className="mt-1 font-mono text-sm font-bold tabular-nums text-primary">
            {usedMargin > 0 ? `${marginLevel.toFixed(0)}%` : "—"}
          </p>
        </div>
      </section>

      {/* Instrument Selector Strip with Live Server Ticks */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {markets.map((market) => {
          const active = market.symbol === activeMarket.symbol;
          const upTick = market.bid >= market.prevBid;
          const pct =
            market.openDay > 0 ? ((market.bid - market.openDay) / market.openDay) * 100 : 0;
          return (
            <button
              key={market.symbol}
              type="button"
              onClick={() => handleSelectInstrument(market.symbol)}
              className={cn(
                "flex shrink-0 items-center gap-3 rounded-lg border px-4 py-2.5 text-left transition-colors",
                active
                  ? "border-primary bg-accent text-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="font-display text-sm font-bold text-foreground">{market.symbol}</p>
                  <span className="text-[10px] text-muted-foreground">{market.category}</span>
                </div>
                <p
                  className={cn(
                    "font-mono text-xs font-semibold tabular-nums",
                    upTick ? "text-primary" : "text-destructive",
                  )}
                >
                  {market.bid.toFixed(market.decimals)}
                </p>
              </div>
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 font-mono text-xs font-semibold tabular-nums",
                  pct >= 0 ? "text-primary" : "text-destructive",
                )}
              >
                {pct >= 0 ? (
                  <ArrowUpRight className="size-3.5" />
                ) : (
                  <ArrowDownRight className="size-3.5" />
                )}
                {pct >= 0 ? "+" : ""}
                {pct.toFixed(2)}%
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Live Chart + Order Ticket */}
      <div className="grid gap-6 xl:grid-cols-12">
        {/* Candlestick / Area Chart */}
        <section className="rounded-xl border border-border bg-card p-5 sm:p-6 xl:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
            <div>
              <div className="flex flex-wrap items-baseline gap-3">
                <h1 className="font-display text-2xl font-bold">{activeMarket.symbol}</h1>
                <span className="text-sm text-muted-foreground">{activeMarket.name}</span>
                <span
                  className={cn(
                    "font-mono text-xs font-bold tabular-nums",
                    activeDayChangePct >= 0 ? "text-primary" : "text-destructive",
                  )}
                >
                  {activeDayChangePct >= 0 ? "+" : ""}
                  {activeDayChangePct.toFixed(2)}%
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-4 font-mono text-xs tabular-nums text-muted-foreground">
                <span>
                  Bid:{" "}
                  <strong
                    className={cn(
                      activeMarket.bid >= activeMarket.prevBid
                        ? "text-primary"
                        : "text-destructive",
                    )}
                  >
                    {activeMarket.bid.toFixed(activeMarket.decimals)}
                  </strong>
                </span>
                <span>
                  Ask:{" "}
                  <strong className="text-foreground">
                    {activeMarket.ask.toFixed(activeMarket.decimals)}
                  </strong>
                </span>
                <span>
                  Spread: <strong className="text-primary">{activeMarket.spreadLabel} pip</strong>
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setLiveFeedActive((prev) => !prev)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold whitespace-nowrap transition-colors",
                  liveFeedActive
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:text-foreground",
                )}
              >
                {liveFeedActive ? (
                  <>
                    <Pause className="size-3.5" />
                    <span>Live Pasar</span>
                  </>
                ) : (
                  <>
                    <Play className="size-3.5" />
                    <span>Dijeda</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
                {(["candle", "line"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setChartType(mode)}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-colors",
                      chartType === mode
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {mode === "candle" ? "Candlestick" : "Garis"}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
                {(["M5", "M15", "H1", "H4", "D1"] as const).map((tf) => (
                  <button
                    key={tf}
                    type="button"
                    onClick={() => setTimeframe(tf)}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-colors",
                      timeframe === tf
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* OHLC Hover Bar */}
          <div className="mt-3 flex flex-wrap items-center gap-4 font-mono text-xs tabular-nums text-muted-foreground">
            {(() => {
              const displayCandle =
                hoveredCandle ?? chartGeometry.candles[chartGeometry.candles.length - 1];
              if (!displayCandle) return null;
              const isBull = displayCandle.close >= displayCandle.open;
              return (
                <>
                  <span className="text-foreground">
                    {displayCandle.time} ({timeframe})
                  </span>
                  <span>
                    O:{" "}
                    <strong className="text-foreground">
                      {displayCandle.open.toFixed(activeMarket.decimals)}
                    </strong>
                  </span>
                  <span>
                    H:{" "}
                    <strong className="text-foreground">
                      {displayCandle.high.toFixed(activeMarket.decimals)}
                    </strong>
                  </span>
                  <span>
                    L:{" "}
                    <strong className="text-foreground">
                      {displayCandle.low.toFixed(activeMarket.decimals)}
                    </strong>
                  </span>
                  <span>
                    C:{" "}
                    <strong className={isBull ? "text-primary" : "text-destructive"}>
                      {displayCandle.close.toFixed(activeMarket.decimals)}
                    </strong>
                  </span>
                </>
              );
            })()}
          </div>

          {/* Interactive SVG Chart */}
          <div
            ref={chartContainerRef}
            className="relative mt-2 h-80 w-full select-none overflow-hidden rounded-lg border border-border/70 bg-background/60 sm:h-96"
          >
            <svg
              width={chartGeometry.w}
              height={chartGeometry.h}
              className="block size-full"
              onMouseLeave={() => setHoveredCandleIdx(null)}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const relX = e.clientX - rect.left - chartGeometry.padLeft;
                const idx = Math.floor(relX / chartGeometry.slotW);
                if (idx >= 0 && idx < chartGeometry.candles.length) {
                  setHoveredCandleIdx(idx);
                } else {
                  setHoveredCandleIdx(null);
                }
              }}
            >
              {/* Horizontal Grid + Y Axis Price Labels */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const y = chartGeometry.padTop + ratio * chartGeometry.plotH;
                const price =
                  chartGeometry.paddedMax -
                  ratio * (chartGeometry.paddedMax - chartGeometry.paddedMin);
                return (
                  <g key={ratio}>
                    <line
                      x1={chartGeometry.padLeft}
                      y1={y}
                      x2={chartGeometry.w - chartGeometry.padRight}
                      y2={y}
                      stroke="oklch(0.24 0.006 260)"
                      strokeDasharray="3 3"
                      strokeWidth={1}
                    />
                    <text
                      x={chartGeometry.w - chartGeometry.padRight + 8}
                      y={y + 4}
                      fill="oklch(0.68 0.008 260)"
                      fontSize="11"
                      fontFamily="monospace"
                    >
                      {price.toFixed(activeMarket.decimals)}
                    </text>
                  </g>
                );
              })}

              {/* X Axis Time Ticks */}
              {chartGeometry.candles.map((c, idx) => {
                if (idx % 6 !== 0 && idx !== chartGeometry.candles.length - 1) return null;
                const cx =
                  chartGeometry.padLeft + idx * chartGeometry.slotW + chartGeometry.slotW / 2;
                return (
                  <text
                    key={`${c.time}-${idx}`}
                    x={cx}
                    y={chartGeometry.h - 10}
                    textAnchor="middle"
                    fill="oklch(0.68 0.008 260)"
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    {c.time}
                  </text>
                );
              })}

              {/* Hover Crosshair */}
              {hoveredCandleIdx !== null && hoveredCandle && (
                <line
                  x1={
                    chartGeometry.padLeft +
                    hoveredCandleIdx * chartGeometry.slotW +
                    chartGeometry.slotW / 2
                  }
                  y1={chartGeometry.padTop}
                  x2={
                    chartGeometry.padLeft +
                    hoveredCandleIdx * chartGeometry.slotW +
                    chartGeometry.slotW / 2
                  }
                  y2={chartGeometry.h - chartGeometry.padBottom}
                  stroke="oklch(0.45 0.01 260)"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                />
              )}

              {/* Candlesticks or Line Path */}
              {chartType === "candle" ? (
                chartGeometry.candles.map((c, idx) => {
                  const cx =
                    chartGeometry.padLeft + idx * chartGeometry.slotW + chartGeometry.slotW / 2;
                  const yHigh = chartGeometry.priceToY(c.high);
                  const yLow = chartGeometry.priceToY(c.low);
                  const yOpen = chartGeometry.priceToY(c.open);
                  const yClose = chartGeometry.priceToY(c.close);
                  const isBull = c.close >= c.open;
                  const color = isBull ? "oklch(0.82 0.23 148)" : "oklch(0.62 0.2 25)";
                  const rectTop = Math.min(yOpen, yClose);
                  const rectH = Math.max(2, Math.abs(yClose - yOpen));

                  return (
                    <g key={`candle-${idx}`}>
                      <line
                        x1={cx}
                        y1={yHigh}
                        x2={cx}
                        y2={yLow}
                        stroke={color}
                        strokeWidth={1.25}
                      />
                      <rect
                        x={cx - chartGeometry.bodyW / 2}
                        y={rectTop}
                        width={chartGeometry.bodyW}
                        height={rectH}
                        fill={color}
                        rx={1}
                      />
                    </g>
                  );
                })
              ) : (
                <polyline
                  fill="none"
                  stroke="oklch(0.82 0.23 148)"
                  strokeWidth={2}
                  points={chartGeometry.candles
                    .map((c, idx) => {
                      const cx =
                        chartGeometry.padLeft + idx * chartGeometry.slotW + chartGeometry.slotW / 2;
                      const cy = chartGeometry.priceToY(c.close);
                      return `${cx},${cy}`;
                    })
                    .join(" ")}
                />
              )}

              {/* Open Position Entry / SL / TP Overlay Lines for Active Symbol */}
              {openPositionsWithLive
                .filter((p) => p.symbol === activeMarket.symbol)
                .map((pos) => {
                  const yEntry = chartGeometry.priceToY(pos.entry);
                  const slVal = Number.parseFloat(pos.sl);
                  const tpVal = Number.parseFloat(pos.tp);
                  return (
                    <g key={`overlay-${pos.id}`}>
                      {yEntry >= chartGeometry.padTop &&
                        yEntry <= chartGeometry.h - chartGeometry.padBottom && (
                          <>
                            <line
                              x1={chartGeometry.padLeft}
                              y1={yEntry}
                              x2={chartGeometry.w - chartGeometry.padRight}
                              y2={yEntry}
                              stroke={
                                pos.side === "BUY" ? "oklch(0.82 0.23 148)" : "oklch(0.62 0.2 25)"
                              }
                              strokeDasharray="5 3"
                              strokeWidth={1}
                            />
                            <text
                              x={chartGeometry.padLeft + 6}
                              y={yEntry - 4}
                              fill={
                                pos.side === "BUY" ? "oklch(0.82 0.23 148)" : "oklch(0.62 0.2 25)"
                              }
                              fontSize="10"
                              fontFamily="monospace"
                              fontWeight="bold"
                            >
                              {pos.side} {pos.lot.toFixed(2)} @{" "}
                              {pos.entry.toFixed(activeMarket.decimals)}
                            </text>
                          </>
                        )}
                      {Number.isFinite(slVal) &&
                        chartGeometry.priceToY(slVal) >= chartGeometry.padTop &&
                        chartGeometry.priceToY(slVal) <=
                          chartGeometry.h - chartGeometry.padBottom && (
                          <line
                            x1={chartGeometry.padLeft}
                            y1={chartGeometry.priceToY(slVal)}
                            x2={chartGeometry.w - chartGeometry.padRight}
                            y2={chartGeometry.priceToY(slVal)}
                            stroke="oklch(0.62 0.2 25)"
                            strokeDasharray="2 3"
                            strokeWidth={1}
                          />
                        )}
                      {Number.isFinite(tpVal) &&
                        chartGeometry.priceToY(tpVal) >= chartGeometry.padTop &&
                        chartGeometry.priceToY(tpVal) <=
                          chartGeometry.h - chartGeometry.padBottom && (
                          <line
                            x1={chartGeometry.padLeft}
                            y1={chartGeometry.priceToY(tpVal)}
                            x2={chartGeometry.w - chartGeometry.padRight}
                            y2={chartGeometry.priceToY(tpVal)}
                            stroke="oklch(0.82 0.23 148)"
                            strokeDasharray="2 3"
                            strokeWidth={1}
                          />
                        )}
                    </g>
                  );
                })}

              {/* Live Bid Price Line + Highlighted Right-Axis Price Tag */}
              {(() => {
                const yLive = chartGeometry.priceToY(activeMarket.bid);
                const isUp = activeMarket.bid >= activeMarket.prevBid;
                const tagColor = isUp ? "oklch(0.82 0.23 148)" : "oklch(0.62 0.2 25)";
                return (
                  <g>
                    <line
                      x1={chartGeometry.padLeft}
                      y1={yLive}
                      x2={chartGeometry.w - chartGeometry.padRight}
                      y2={yLive}
                      stroke={tagColor}
                      strokeDasharray="4 2"
                      strokeWidth={1.25}
                    />
                    <rect
                      x={chartGeometry.w - chartGeometry.padRight + 2}
                      y={yLive - 10}
                      width={chartGeometry.padRight - 6}
                      height={20}
                      rx={4}
                      fill={tagColor}
                    />
                    <text
                      x={chartGeometry.w - chartGeometry.padRight + 8}
                      y={yLive + 4}
                      fill="oklch(0.13 0.02 150)"
                      fontSize="11"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      {activeMarket.bid.toFixed(activeMarket.decimals)}
                    </text>
                  </g>
                );
              })()}
            </svg>
          </div>
        </section>

        {/* Order Execution Ticket */}
        <section className="rounded-xl border border-border bg-card p-5 sm:p-6 xl:col-span-4">
          <div className="border-b border-border pb-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Tiket Order</h2>
              <span className="font-mono text-xs font-semibold tabular-nums text-primary">
                Leverage 1:{leverage}
              </span>
            </div>
            <div className="mt-3">
              <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
                Atur Leverage Trading
              </p>
              <div className="grid grid-cols-5 gap-1 rounded-lg border border-border bg-background p-1">
                {LEVERAGE_TIERS.map((lev) => (
                  <button
                    key={lev}
                    type="button"
                    onClick={() => handleLeverageChange(lev)}
                    className={cn(
                      "rounded-md py-1.5 font-mono text-[11px] font-semibold tabular-nums transition-colors",
                      leverage === lev
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    1:{lev}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {/* Market / Limit Tabs */}
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-background p-1">
              {(["Market", "Limit"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setOrderType(type)}
                  className={cn(
                    "rounded-md py-2 text-xs font-semibold transition-colors",
                    orderType === type
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Order {type}
                </button>
              ))}
            </div>

            {/* Buy / Sell Direction with Live Prices */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSide("SELL")}
                className={cn(
                  "rounded-lg border px-3 py-3 text-left transition-colors",
                  side === "SELL"
                    ? "border-destructive bg-destructive/15 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="block text-[11px] font-semibold uppercase">Sell / Jual</span>
                <span className="mt-0.5 block font-mono text-base font-bold tabular-nums text-destructive">
                  {activeMarket.bid.toFixed(activeMarket.decimals)}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setSide("BUY")}
                className={cn(
                  "rounded-lg border px-3 py-3 text-left transition-colors",
                  side === "BUY"
                    ? "border-primary bg-primary/15 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="block text-[11px] font-semibold uppercase">Buy / Beli</span>
                <span className="mt-0.5 block font-mono text-base font-bold tabular-nums text-primary">
                  {activeMarket.ask.toFixed(activeMarket.decimals)}
                </span>
              </button>
            </div>

            {/* Lot Size + Presets */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="lot-input" className="font-medium text-foreground">
                  Volume (Lot)
                </label>
                <span className="font-mono tabular-nums text-muted-foreground">
                  Nilai Pip: ${pipValueUsd.toFixed(2)}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {LOT_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setLot(preset.toFixed(2))}
                    className={cn(
                      "rounded-md border py-1.5 font-mono text-xs font-semibold tabular-nums transition-colors",
                      Math.abs(parsedLot - preset) < 0.001
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-background text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {preset.toFixed(2)}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => adjustLot(-0.1)}
                  className="px-2 font-mono text-xs"
                >
                  -0.1
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => adjustLot(-0.01)}
                  className="px-2 font-mono text-xs"
                >
                  -0.01
                </Button>
                <Input
                  id="lot-input"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="50"
                  value={lot}
                  onChange={(e) => setLot(e.target.value)}
                  className="text-center font-mono font-semibold tabular-nums"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => adjustLot(0.01)}
                  className="px-2 font-mono text-xs"
                >
                  +0.01
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => adjustLot(0.1)}
                  className="px-2 font-mono text-xs"
                >
                  +0.1
                </Button>
              </div>
            </div>

            {orderType === "Limit" && (
              <div className="space-y-1.5">
                <label htmlFor="limit-price" className="text-xs font-medium text-foreground">
                  Harga Limit Target
                </label>
                <Input
                  id="limit-price"
                  type="number"
                  step="any"
                  placeholder={activeMarket.ask.toFixed(activeMarket.decimals)}
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                  className="font-mono tabular-nums"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="sl-input" className="text-xs font-medium text-foreground">
                    Stop Loss
                  </label>
                  <button
                    type="button"
                    onClick={() => applyQuickSlTp("sl", 25)}
                    className="font-mono text-[11px] text-primary hover:underline"
                  >
                    25 pip
                  </button>
                </div>
                <Input
                  id="sl-input"
                  type="number"
                  step="any"
                  placeholder="Opsional"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(e.target.value)}
                  className="font-mono tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="tp-input" className="text-xs font-medium text-foreground">
                    Take Profit
                  </label>
                  <button
                    type="button"
                    onClick={() => applyQuickSlTp("tp", 50)}
                    className="font-mono text-[11px] text-primary hover:underline"
                  >
                    50 pip
                  </button>
                </div>
                <Input
                  id="tp-input"
                  type="number"
                  step="any"
                  placeholder="Opsional"
                  value={takeProfit}
                  onChange={(e) => setTakeProfit(e.target.value)}
                  className="font-mono tabular-nums"
                />
              </div>
            </div>

            <div className="space-y-1.5 border-t border-border pt-3 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estimasi Margin (1:{leverage})</span>
                <span className="font-mono font-semibold tabular-nums">
                  ${requiredMargin.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Komisi Raw</span>
                <span className="font-mono font-semibold tabular-nums">
                  ${(parsedLot * 7).toFixed(2)}
                </span>
              </div>
            </div>

            <Button
              type="button"
              onClick={() => void handlePlaceOrder()}
              className={cn(
                "h-11 w-full text-sm font-bold",
                side === "SELL"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "bg-primary text-primary-foreground hover:bg-primary/90",
              )}
            >
              Eksekusi {side} {parsedLot.toFixed(2)} Lot
            </Button>

            {feedback && (
              <div
                role="status"
                className={cn(
                  "flex items-start gap-2 rounded-lg border p-3 text-xs",
                  feedback.type === "ok"
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-destructive/40 bg-destructive/10 text-destructive",
                )}
              >
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>{feedback.text}</span>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Positions & Orders Table with Live P&L */}
      <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
            {(["Terbuka", "Tertunda", "Ditutup"] as const).map((tab) => {
              const count = positions.filter((p) => p.status === tab).length;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    setBottomTab(tab);
                    positionsPagination.setPage(1);
                  }}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors",
                    bottomTab === tab
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab === "Terbuka"
                    ? "Posisi Terbuka"
                    : tab === "Tertunda"
                      ? "Order Tertunda"
                      : "Riwayat Ditutup"}{" "}
                  <span className="font-mono tabular-nums text-muted-foreground">({count})</span>
                </button>
              );
            })}
          </div>
          <p className="font-mono text-xs tabular-nums text-muted-foreground">
            Menutup posisi terbuka otomatis mengkreditkan P&L ke saldo akun.
          </p>
        </div>

        {displayedPositions.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Belum ada data pada tab {bottomTab.toLowerCase()}. Gunakan tiket order untuk eksekusi.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="py-2.5 pr-4 font-medium">ID Order</th>
                  <th className="py-2.5 pr-4 font-medium">Simbol</th>
                  <th className="py-2.5 pr-4 font-medium">Arah</th>
                  <th className="py-2.5 pr-4 text-right font-medium">Lot & Lev</th>
                  <th className="py-2.5 pr-4 text-right font-medium">Masuk</th>
                  <th className="py-2.5 pr-4 text-right font-medium">Harga Kini</th>
                  <th className="py-2.5 pr-4 text-right font-medium">SL / TP</th>
                  <th className="py-2.5 pr-4 text-right font-medium">P&L</th>
                  <th className="py-2.5 text-right font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {positionsPagination.paginatedItems.map((pos) => (
                  <tr key={pos.id} className="hover:bg-accent/30">
                    <td className="py-3 pr-4">
                      <p className="font-mono text-xs tabular-nums text-foreground">{pos.id}</p>
                      <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
                        {pos.type} · {pos.openedAt}
                      </p>
                    </td>
                    <td className="py-3 pr-4 font-display font-bold">{pos.symbol}</td>
                    <td
                      className={cn(
                        "py-3 pr-4 text-xs font-bold",
                        pos.side === "BUY" ? "text-primary" : "text-destructive",
                      )}
                    >
                      {pos.side}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums">
                      <p>{pos.lot.toFixed(2)}</p>
                      <p className="text-[11px] text-muted-foreground">1:{pos.leverage}</p>
                    </td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums">
                      {pos.entry.toFixed(pos.decimals)}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums text-foreground">
                      {pos.status === "Ditutup" ? "—" : pos.currentPrice.toFixed(pos.decimals)}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {pos.sl} / {pos.tp}
                    </td>
                    <td
                      className={cn(
                        "py-3 pr-4 text-right font-mono font-semibold tabular-nums",
                        pos.livePnl >= 0 ? "text-primary" : "text-destructive",
                      )}
                    >
                      {pos.livePnl >= 0
                        ? `+$${pos.livePnl.toFixed(2)}`
                        : `-$${Math.abs(pos.livePnl).toFixed(2)}`}
                    </td>
                    <td className="py-3 text-right">
                      {pos.status !== "Ditutup" ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleClosePosition(pos, pos.livePnl)}
                          className="h-8 gap-1 text-xs text-muted-foreground hover:text-destructive"
                        >
                          <X className="size-3.5" />
                          <span>{pos.status === "Terbuka" ? "Tutup" : "Batalkan"}</span>
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Selesai</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <DataPagination
              page={positionsPagination.page}
              totalPages={positionsPagination.totalPages}
              totalItems={positionsPagination.totalItems}
              startItem={positionsPagination.startItem}
              endItem={positionsPagination.endItem}
              pageSize={positionsPagination.pageSize}
              onPageChange={positionsPagination.setPage}
              onPageSizeChange={positionsPagination.setPageSize}
              className="mt-4"
            />
          </div>
        )}
      </section>
    </div>
  );
}
