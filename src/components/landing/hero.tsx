import { useEffect, useState } from "react";
import heroRace from "@/assets/hero-race.jpg";
import spreadMarkets from "@/assets/spread-markets.jpg";
import { TrendingUp } from "lucide-react";
import { Reveal } from "./reveal";

type Slide = {
  titleTop: string;
  titleBottom: string;
  body: string;
  cta: string;
  image: string;
};

const slides: Slide[] = [
  {
    titleTop: "Arena Berbeda.",
    titleBottom: "Semangat untuk Keunggulan yang Sama.",
    body: "Dirancang untuk trading berkinerja tinggi. Dibangun untuk trader yang mengejar performa terbaik di setiap pasar.",
    cta: "Pelajari Selengkapnya",
    image: heroRace,
  },
  {
    titleTop: "Permainan Dimulai.",
    titleBottom: "Pasar Mengikuti Ritme Anda.",
    body: "Teknologi eksekusi kelas dunia yang bekerja secepat refleks atlet profesional di level tertinggi.",
    cta: "Pelajari Selengkapnya",
    image: heroRace,
  },
  {
    titleTop: "Bertindak Sebelum Wall Street Dibuka.",
    titleBottom: "24 Jam Sehari, Lima Hari Seminggu.",
    body: "Trading saham-saham unggulan AS hampir tanpa jeda — rencanakan trading Anda dan jangan lewatkan peluang.",
    cta: "Pelajari Selengkapnya",
    image: spreadMarkets,
  },
];

const stats = [
  { value: "0.0", label: "Spread Pip*" },
  { value: "1:5000", label: "Leverage" },
  { value: "0.01", label: "Trading Lot Mikro" },
  { value: "10,000+", label: "Instrumen Trading" },
  { value: "24/7", label: "Dukungan Khusus" },
];

const tickers = [
  {
    symbol: "EURUSD",
    change: "+0.38%",
    bid: "1.12296",
    ask: "1.12296",
    spread: "0.0",
    up: true,
  },
  {
    symbol: "AUDUSD",
    change: "+0.68%",
    bid: "0.70086",
    ask: "0.70087",
    spread: "0.1",
    up: true,
  },
  {
    symbol: "GBPUSD",
    change: "+0.45%",
    bid: "1.34741",
    ask: "1.34742",
    spread: "0.1",
    up: true,
  },
  {
    symbol: "XAUUSD",
    change: "+3.40%",
    bid: "4063.80",
    ask: "4064.01",
    spread: "2.1",
    up: true,
  },
];

export function Hero() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setActive((v) => (v + 1) % slides.length), 7000);
    return () => clearInterval(t);
  }, []);

  const slide = slides[active] ?? slides[0];
  if (!slide) return null;

  return (
    <section>
      {/* Hero carousel */}
      <div className="relative overflow-hidden bg-background">
        <div className="absolute inset-0">
          {slides.map((s, i) => (
            <img
              key={i}
              src={s.image}
              alt=""
              width={1536}
              height={1024}
              aria-hidden={i !== active}
              className={`absolute inset-0 size-full object-cover object-right transition-opacity duration-1000 ${
                i === active ? "opacity-100" : "opacity-0"
              }`}
            />
          ))}
          {/* Left readability gradient */}
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/10" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/60" />
        </div>

        <div className="relative container-page flex min-h-[560px] flex-col justify-center py-20 lg:min-h-[640px]">
          <div key={active} className="max-w-xl">
            <h1 className="text-hero-display text-4xl sm:text-5xl lg:text-6xl">
              {slide.titleTop}
              <span className="mt-2 block">{slide.titleBottom}</span>
            </h1>
            <p className="mt-6 max-w-md text-base text-muted-foreground sm:text-lg">{slide.body}</p>
            <a
              href="#mulai"
              className="mt-8 inline-flex items-center rounded-md bg-primary px-8 py-3.5 text-sm font-bold text-primary-foreground transition-transform hover:scale-[1.03]"
            >
              {slide.cta}
            </a>
          </div>

          {/* Carousel dots */}
          <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                aria-label={`Slide ${i + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === active
                    ? "w-8 bg-primary"
                    : "w-4 bg-muted-foreground/50 hover:bg-muted-foreground"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="border-y border-border/60 bg-card/40">
        <div className="container-page grid grid-cols-2 gap-y-8 py-10 sm:grid-cols-3 lg:grid-cols-5">
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 80}>
              <div className="text-center">
                <div className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
                  {s.value}
                </div>
                <div className="label-stat mt-2 text-muted-foreground">{s.label}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      {/* Live ticker */}
      <div className="container-page py-14">
        <Reveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {tickers.map((t) => (
              <div
                key={t.symbol}
                className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-sm font-bold">{t.symbol}</span>
                  <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                    <TrendingUp className="size-3.5" />
                    {t.change}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-muted-foreground">Bid</div>
                    <div className="mt-0.5 font-mono text-sm font-semibold">{t.bid}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Ask</div>
                    <div className="mt-0.5 font-mono text-sm font-semibold">{t.ask}</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Spread{" "}
                    <span className="font-mono font-semibold text-foreground">{t.spread}</span>
                  </span>
                  <div className="flex gap-2">
                    <a
                      href="#mulai"
                      className="rounded bg-primary px-3 py-1 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-85"
                    >
                      BUY
                    </a>
                    <a
                      href="#mulai"
                      className="rounded bg-destructive px-3 py-1 text-xs font-bold text-destructive-foreground transition-opacity hover:opacity-85"
                    >
                      SELL
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
