import {
  Zap,
  Building2,
  Percent,
  Globe2,
  Award,
  Layers,
  Laptop,
  Smartphone,
  Tablet,
  Monitor,
  Globe,
  Bot,
  Wallet,
  ArrowRight,
} from "lucide-react";
import spreadVisual from "@/assets/spread-markets.jpg";
import platformsVisual from "@/assets/platforms-devices.jpg";
import goldVisual from "@/assets/gold-market.jpg";
import { Reveal } from "./reveal";

/* ---------------- Keunggulan True RAW ---------------- */

const rawFeatures = [
  {
    icon: Percent,
    title: "Spread Mulai 0.0 Pip",
    points: [
      "Spread mentah tanpa biaya tersembunyi, sehingga kami benar-benar mencapai 0.0 pip*",
      "Perpaduan likuiditas beragam dan eksklusif membuat spread selalu ketat 24/5",
    ],
    cta: "Ringkasan Harga",
    image: spreadVisual,
  },
  {
    icon: Zap,
    title: "Eksekusi Order Cepat",
    points: [
      "Rata-rata kecepatan eksekusi di bawah 40 milidetik***",
      "Serat optik berlatensi rendah terhubung silang ke penyedia likuiditas",
      "Tersedia VPS ko-lokasi latensi rendah gratis",
    ],
    cta: "Dapatkan VPS Gratis Anda",
  },
  {
    icon: Building2,
    title: "Trading Berkualitas Institusional",
    points: [
      "Akses likuiditas nyata, dalam, dan beragam untuk trading",
      "Slippage yang lebih rendah",
      "Miliaran USD transaksi FX diproses setiap hari",
    ],
    cta: "Keunggulan Harga Raw",
  },
];

export function RawSection() {
  return (
    <section id="keunggulan" className="container-page py-16 lg:py-24">
      <Reveal>
        <div className="max-w-3xl">
          <h2 className="text-hero-display text-3xl sm:text-4xl lg:text-5xl">
            Keunggulan True RAW
          </h2>
          <p className="mt-5 text-muted-foreground sm:text-lg">
            Raw adalah perbedaan yang Anda nantikan. Trading di lingkungan IC dengan spread mulai
            0.0 pips*, tanpa requotes, tanpa manipulasi harga, dan tanpa batasan. IC adalah penyedia
            CFD online pilihan bagi trader bervolume tinggi, scalper, dan robot.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a
              href="#mulai"
              className="rounded-md bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-transform hover:scale-[1.03]"
            >
              Mulai Trading
            </a>
            <a
              href="#mulai"
              className="rounded-md border border-input px-6 py-3 text-sm font-semibold transition-colors hover:bg-accent"
            >
              Coba DEMO Gratis
            </a>
          </div>
        </div>
      </Reveal>

      <div className="mt-14 space-y-14 lg:space-y-20">
        {rawFeatures.map((f, i) => (
          <Reveal key={f.title} delay={i * 100}>
            <div
              className={`grid items-center gap-8 lg:grid-cols-2 lg:gap-14 ${
                i % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""
              }`}
            >
              <div>
                <div className="flex size-12 items-center justify-center rounded-lg bg-primary/12 text-primary">
                  <f.icon className="size-6" />
                </div>
                <h3 className="mt-5 font-display text-2xl font-bold tracking-tight sm:text-3xl">
                  {f.title}
                </h3>
                <ul className="mt-5 space-y-3">
                  {f.points.map((p) => (
                    <li key={p} className="flex gap-3 text-sm text-muted-foreground sm:text-base">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                      {p}
                    </li>
                  ))}
                </ul>
                {f.cta && (
                  <a
                    href="#mulai"
                    className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-foreground"
                  >
                    {f.cta}
                    <ArrowRight className="size-4" />
                  </a>
                )}
              </div>
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                {f.image ? (
                  <img
                    src={f.image}
                    alt={f.title}
                    width={1536}
                    height={1024}
                    loading="lazy"
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-card to-background">
                    <div className="font-display text-6xl font-extrabold text-primary/80 glow-pulse">
                      &lt;40ms
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Kekuatan dalam angka ---------------- */

const strengthItems = [
  { icon: Globe2, value: "192+", label: "Negara yang Dijangkau" },
  { icon: Award, value: "19+ Tahun", label: "Pengalaman Industri" },
  { icon: Layers, value: "10,000+", label: "Aset CFD" },
];

const strengthStats = [
  { value: "14.3M", label: "Akun" },
  { value: "$2.1T", label: "Volume Perdagangan Bulanan" },
  { value: "$68M", label: "Penarikan per Bulan" },
];

export function StrengthSection() {
  return (
    <section className="border-y border-border/60 bg-card/40 py-16 lg:py-20">
      <div className="container-page">
        <Reveal>
          <p className="label-stat text-primary">Kekuatan Kami Terletak pada Angka</p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Salah satu penyedia CFD Forex terbesar di dunia berdasarkan volume perdagangan.
          </h2>
        </Reveal>

        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {strengthItems.map((s, i) => (
            <Reveal key={s.label} delay={i * 100}>
              <div className="flex items-start gap-4 rounded-xl border border-border bg-background/60 p-6">
                <s.icon className="mt-1 size-6 text-primary" />
                <div>
                  <div className="font-display text-2xl font-bold">{s.value}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{s.label}</div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-6 rounded-2xl border border-border bg-background/60 px-8 py-8">
          {strengthStats.map((s) => (
            <div key={s.label}>
              <div className="font-display text-3xl font-extrabold text-primary sm:text-4xl">
                {s.value}
              </div>
              <div className="mt-1 text-xs text-muted-foreground sm:text-sm">{s.label}</div>
            </div>
          ))}
          <div className="flex gap-3">
            <a
              href="#mulai"
              className="rounded-md bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-transform hover:scale-[1.03]"
            >
              Mulai Trading
            </a>
            <a
              href="#mulai"
              className="rounded-md border border-input px-6 py-3 text-sm font-semibold transition-colors hover:bg-accent"
            >
              Coba Demo Gratis
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Platform ---------------- */

const platformTabs = [
  { icon: Monitor, label: "Windows" },
  { icon: Globe, label: "Browser Web" },
  { icon: Smartphone, label: "Android" },
  { icon: Laptop, label: "MAC" },
  { icon: Tablet, label: "iOS" },
];

export function PlatformsSection() {
  return (
    <section id="platform" className="container-page py-16 lg:py-24">
      <Reveal>
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <h2 className="text-hero-display text-3xl sm:text-4xl lg:text-5xl">
              Platform Trading yang Powerful
            </h2>
            <p className="mt-5 text-muted-foreground sm:text-lg">
              Pilih platform favorit Anda dan trading kapan saja, di mana saja — dari desktop hingga
              perangkat mobile, semua tersambung ke satu akun.
            </p>
            <div className="mt-7 flex flex-wrap gap-2.5">
              {platformTabs.map((t) => (
                <span
                  key={t.label}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium"
                >
                  <t.icon className="size-4 text-primary" />
                  {t.label}
                </span>
              ))}
            </div>
            <a
              href="#mulai"
              className="mt-8 inline-flex items-center rounded-md bg-primary px-7 py-3 text-sm font-bold text-primary-foreground transition-transform hover:scale-[1.03]"
            >
              Jelajahi Platform
            </a>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border">
            <img
              src={platformsVisual}
              alt="Platform trading di berbagai perangkat"
              width={1536}
              height={1024}
              loading="lazy"
              className="size-full object-cover"
            />
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ---------------- Pasar global ---------------- */

const markets = [
  "CFD Forex",
  "CFD Komoditas",
  "CFD Saham",
  "CFD Indeks",
  "CFD Obligasi",
  "CFD Cryptocurrency",
  "CFD Futures",
];

export function MarketsSection() {
  return (
    <section id="pasar" className="border-y border-border/60 bg-card/40 py-16 lg:py-20">
      <div className="container-page">
        <Reveal>
          <h2 className="text-hero-display max-w-xl text-3xl sm:text-4xl lg:text-5xl">
            Pasar Global dalam Genggaman Anda
          </h2>
          <div className="mt-8 flex flex-wrap gap-3">
            {markets.map((m) => (
              <span
                key={m}
                className="rounded-full border border-border bg-background px-5 py-2.5 text-sm font-semibold transition-colors hover:border-primary/50 hover:text-primary"
              >
                {m}
              </span>
            ))}
          </div>
          <a
            href="#mulai"
            className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-foreground"
          >
            Beragam Pilihan Pasar
            <ArrowRight className="size-4" />
          </a>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- Emas + otomatis + pembayaran ---------------- */

export function GoldSection() {
  return (
    <section className="container-page py-16 lg:py-24">
      <Reveal>
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="overflow-hidden rounded-2xl border border-border">
            <img
              src={goldVisual}
              alt="Trading emas"
              width={1536}
              height={1024}
              loading="lazy"
              className="size-full object-cover"
            />
          </div>
          <div>
            <h2 className="text-hero-display text-3xl sm:text-4xl lg:text-5xl">
              Trading Emas dengan IC — Kondisi yang Membentuk Standar Industri
            </h2>
            <ul className="mt-6 space-y-3">
              {["Likuiditas melalui 25+ penyedia tepercaya", "Eksekusi dalam <40 md"].map((p) => (
                <li key={p} className="flex gap-3 text-sm text-muted-foreground sm:text-base">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                  {p}
                </li>
              ))}
            </ul>
            <div className="mt-8 grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="font-display text-3xl font-extrabold text-primary">&lt; 40ms</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Kecepatan Eksekusi Rata-Rata
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="font-display text-3xl font-extrabold text-primary">4.8/5</div>
                <div className="mt-1 text-sm text-muted-foreground">Rating yang Sangat Baik</div>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#mulai"
                className="rounded-md bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-transform hover:scale-[1.03]"
              >
                Trading Spot Emas
              </a>
              <a
                href="#mulai"
                className="rounded-md border border-input px-6 py-3 text-sm font-semibold transition-colors hover:bg-accent"
              >
                Coba Demo Gratis
              </a>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

export function AutomationSection() {
  return (
    <section className="border-y border-border/60 bg-card/40 py-16 lg:py-20">
      <div className="container-page">
        <Reveal>
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-xl bg-primary/12 text-primary">
              <Bot className="size-7" />
            </div>
            <h2 className="mt-6 text-hero-display text-3xl sm:text-4xl">
              Berikan Keunggulan pada Sistem Trading Otomatis Anda
            </h2>
            <p className="mt-5 text-muted-foreground sm:text-lg">
              IC merupakan salah satu pilihan utama bagi trader otomatis. Mesin pencocokan order
              kami yang berlokasi di pusat data Equinix NY4, New York, memproses jutaan transaksi
              setiap hari — dengan lebih dari dua pertiga total transaksi berasal dari sistem
              trading otomatis.
            </p>
          </div>
        </Reveal>

        <Reveal delay={150}>
          <div
            id="mulai"
            className="mt-12 grid gap-6 rounded-2xl border border-border bg-background/60 p-8 sm:grid-cols-2"
          >
            <div>
              <div className="flex items-center gap-3">
                <Wallet className="size-5 text-primary" />
                <h3 className="font-display text-xl font-bold">Dana Anda, Pilihan Anda</h3>
              </div>
              <div className="mt-5 flex flex-wrap gap-2.5">
                {["Deposit Instan", "Withdrawal Cepat", "Komisi 0%"].map((b) => (
                  <span
                    key={b}
                    className="rounded-full bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground"
                  >
                    {b}
                  </span>
                ))}
              </div>
              <p className="mt-5 text-sm text-muted-foreground">
                Untuk informasi lebih lanjut mengenai deposit, penarikan, dan cara mendanai akun
                trading Anda.{" "}
                <a href="#" className="font-semibold text-primary hover:text-foreground">
                  Lihat Selengkapnya
                </a>
              </p>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Metode pembayaran
              </div>
              <div className="mt-4 flex flex-wrap gap-2.5">
                {[
                  "Visa",
                  "Mastercard",
                  "Apple Pay",
                  "Google Pay",
                  "Skrill",
                  "Neteller",
                  "Online Payment",
                ].map((m) => (
                  <span
                    key={m}
                    className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
