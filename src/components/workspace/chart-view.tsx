import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MarketInstrumentRecord } from "@/components/admin/admin-types";

export function ChartView() {
  const [markets, setMarkets] = useState<MarketInstrumentRecord[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadMarkets() {
      try {
        const response = await fetch("/api/markets");
        if (!response.ok) {
          throw new Error(`Permintaan data pasar gagal (${response.status}).`);
        }

        const records = (await response.json()) as MarketInstrumentRecord[];
        if (!Array.isArray(records)) {
          throw new Error("Format data pasar tidak valid.");
        }
        if (active) {
          const cryptoMarkets = records.filter(
            (market) => market.enabled && market.category === "Kripto / Coin",
          );
          setMarkets(cryptoMarkets);
          setSelectedSymbol((current) =>
            cryptoMarkets.some((market) => market.symbol === current)
              ? current
              : (cryptoMarkets[0]?.symbol ?? ""),
          );
          setError(null);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error ? loadError.message : "Data pasar tidak dapat dimuat.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadMarkets();
    const timer = window.setInterval(() => void loadMarkets(), 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const selectedMarket = useMemo(
    () => markets.find((market) => market.symbol === selectedSymbol),
    [markets, selectedSymbol],
  );
  const chartData = useMemo(
    () =>
      (selectedMarket?.candles ?? []).filter(
        (candle) => Number.isFinite(candle.close) && Number.isFinite(candle.open),
      ),
    [selectedMarket],
  );

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
        <div className="mb-5">
          <h2 className="text-lg font-bold text-foreground">Pilih coin</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Grafik menampilkan instrumen Kripto / Coin yang tersedia di pasar.
          </p>
        </div>

        {loading && markets.length === 0 ? (
          <p role="status" className="py-8 text-center text-sm text-muted-foreground">
            Memuat instrumen coin…
          </p>
        ) : markets.length === 0 ? (
          <p
            role={error ? "alert" : "status"}
            className="py-8 text-center text-sm text-muted-foreground"
          >
            {error ?? "Belum ada instrumen coin yang tersedia."}
          </p>
        ) : (
          <>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {markets.map((market) => (
                <button
                  key={market.symbol}
                  type="button"
                  aria-pressed={selectedSymbol === market.symbol}
                  onClick={() => setSelectedSymbol(market.symbol)}
                  className={`shrink-0 rounded-lg border px-4 py-2 text-left transition-colors ${
                    selectedSymbol === market.symbol
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="block font-mono text-sm font-bold">{market.symbol}</span>
                  <span className="block max-w-48 truncate text-xs">{market.name}</span>
                </button>
              ))}
            </div>

            {error && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {error}
              </p>
            )}

            {selectedMarket && (
              <section
                aria-label={`Grafik ${selectedMarket.name}`}
                className="mt-5 rounded-lg border border-border bg-background p-3 sm:p-5"
              >
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-foreground">{selectedMarket.name}</h3>
                    <p className="font-mono text-xs text-muted-foreground">
                      {selectedMarket.symbol} · Data pasar
                    </p>
                  </div>
                  <p className="font-mono text-xl font-bold tabular-nums text-foreground">
                    {selectedMarket.bid.toFixed(selectedMarket.decimals)}
                  </p>
                </div>

                {chartData.length === 0 ? (
                  <p role="status" className="py-16 text-center text-sm text-muted-foreground">
                    Data grafik belum tersedia untuk instrumen ini.
                  </p>
                ) : (
                  <div className="h-[300px] w-full sm:h-[420px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={chartData}
                        margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
                      >
                        <defs>
                          <linearGradient id="coin-chart-fill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.24} />
                            <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                        <XAxis
                          dataKey="time"
                          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          minTickGap={24}
                        />
                        <YAxis
                          domain={["auto", "auto"]}
                          tickFormatter={(value: number) => value.toFixed(selectedMarket.decimals)}
                          tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          width={84}
                        />
                        <Tooltip
                          formatter={(value) => [
                            Number(value).toFixed(selectedMarket.decimals),
                            "Harga",
                          ]}
                          contentStyle={{
                            backgroundColor: "var(--card)",
                            borderColor: "var(--border)",
                            borderRadius: "0.5rem",
                            color: "var(--foreground)",
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="close"
                          name="Harga"
                          stroke="var(--primary)"
                          strokeWidth={2}
                          fill="url(#coin-chart-fill)"
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </section>
    </div>
  );
}
