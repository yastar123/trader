import { useMemo, useState } from "react";
import { CheckSquare, ChevronDown, ChevronUp, Search, Square } from "lucide-react";
import { DataPagination, usePagination } from "@/components/ui/data-pagination";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type GuideTopic = {
  id: string;
  category: "Memulai" | "Eksekusi Order" | "Manajemen Risiko" | "Akun & Keamanan";
  title: string;
  readTime: string;
  summary: string;
  steps: string[];
};

const guideTopics: GuideTopic[] = [
  {
    id: "G-1",
    category: "Memulai",
    title: "Mengenal Perbedaan Akun Raw Spread dan Standard",
    readTime: "3 menit baca",
    summary:
      "Akun Raw Spread menawarkan spread mentah mulai 0.0 pip dengan komisi tetap per lot, cocok untuk scalper dan pengguna EA. Akun Standard menggabungkan biaya ke dalam spread tanpa komisi tambahan.",
    steps: [
      "Buka menu Pengaturan → Profil untuk meninjau tipe akun aktif Anda.",
      "Gunakan akun Raw Spread bila Anda bertransaksi dengan target pip rapat atau frekuensi tinggi.",
      "Pastikan saldo awal mencukupi batas margin instrumen yang dipilih.",
    ],
  },
  {
    id: "G-2",
    category: "Eksekusi Order",
    title: "Cara Memasang Order Market dan Limit Beserta Stop Loss",
    readTime: "4 menit baca",
    summary:
      "Terminal Trade memungkinkan eksekusi instan (Market) maupun antrean harga tertentu (Limit) dilengkapi pengaman Stop Loss dan Take Profit otomatis.",
    steps: [
      "Pilih instrumen pada bilah atas terminal Trade (misalnya EURUSD atau XAUUSD).",
      "Tentukan tipe order Market atau Limit, lalu pilih arah BUY atau SELL.",
      "Masukkan ukuran volume lot (mulai 0.01 lot) serta level Stop Loss dan Take Profit sebelum menekan tombol pasang order.",
    ],
  },
  {
    id: "G-3",
    category: "Manajemen Risiko",
    title: "Mencatat Evaluasi Konsisten di Jurnal Trading",
    readTime: "4 menit baca",
    summary:
      "Jurnal Trading membantu mengidentifikasi pola setup terbaik dan mengurangi keputusan emosional melalui pencatatan rasio Risk-to-Reward.",
    steps: [
      "Setiap posisi selesai, klik 'Catat Trading' di halaman Jurnal.",
      "Pilih kategori strategi (Breakout, Pullback, Scalping, atau Swing) secara konsisten.",
      "Tinjau Win Rate dan Profit Factor setiap akhir pekan untuk mengevaluasi strategi.",
    ],
  },
  {
    id: "G-4",
    category: "Akun & Keamanan",
    title: "Mengaktifkan Autentikasi Dua Faktor (2FA) dan Mengelola Sesi",
    readTime: "2 menit baca",
    summary:
      "Melindungi akses akun portal klien dengan lapisan verifikasi ganda dan pemantauan perangkat aktif secara berkala.",
    steps: [
      "Masuk ke halaman Pengaturan lalu pilih tab Keamanan.",
      "Aktifkan sakelar Autentikasi Dua Faktor (2FA).",
      "Periksa daftar perangkat aktif dan cabut akses perangkat yang sudah tidak digunakan.",
    ],
  },
];

const faqs = [
  {
    q: "Apakah halaman workspace ini sudah terhubung ke eksekusi pasar nyata?",
    a: "Saat ini portal berada pada mode antarmuka frontend (FE) sehingga seluruh simulasi order, jurnal, dan pesan berjalan secara lokal di peramban Anda.",
  },
  {
    q: "Bagaimana cara mengganti nama tampilan atau mata uang akun?",
    a: "Anda dapat membuka menu Pengaturan → Profil, mengubah nama maupun mata uang dasar, lalu menekan Simpan Profil.",
  },
  {
    q: "Kapan jadwal pemeliharaan server berlangsung?",
    a: "Pemeliharaan rutin dijadwalkan setiap akhir pekan saat pasar tutup agar tidak mengganggu eksekusi transaksi hari kerja.",
  },
];

const initialChecklist = [
  { id: "CHK-1", label: "Lengkapi nama & preferensi zona waktu di Pengaturan", done: true },
  { id: "CHK-2", label: "Pelajari tiket order di terminal Trade", done: false },
  { id: "CHK-3", label: "Catat transaksi pertama di Jurnal Trading", done: false },
  { id: "CHK-4", label: "Aktifkan pengingat rilis CPI di Kalender Akademi", done: false },
];

export function PanduanPenggunaView() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Semua");
  const [selectedGuideId, setSelectedGuideId] = useState<string>("G-1");
  const [checklist, setChecklist] = useState(initialChecklist);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const filteredGuides = useMemo(() => {
    return guideTopics.filter((g) => {
      if (selectedCategory !== "Semua" && g.category !== selectedCategory) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return g.title.toLowerCase().includes(q) || g.summary.toLowerCase().includes(q);
      }
      return true;
    });
  }, [search, selectedCategory]);

  const guidesPagination = usePagination(filteredGuides, 3);

  const activeGuide =
    guideTopics.find((g) => g.id === selectedGuideId) ?? filteredGuides[0] ?? guideTopics[0]!;

  function toggleCheck(id: string) {
    setChecklist((prev) => prev.map((c) => (c.id === id ? { ...c, done: !c.done } : c)));
  }

  const completedCount = checklist.filter((c) => c.done).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Panduan Pengguna
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Dokumentasi penggunaan terminal, daftar periksa awal, dan pertanyaan umum
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari topik panduan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1 sm:w-fit">
        {(
          ["Semua", "Memulai", "Eksekusi Order", "Manajemen Risiko", "Akun & Keamanan"] as const
        ).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors",
              selectedCategory === cat
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Guide Directory + Reader */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-5">
          {filteredGuides.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
              Tidak ditemukan panduan untuk kata kunci "{search}".
            </div>
          ) : (
            <>
              {guidesPagination.paginatedItems.map((g) => {
                const active = activeGuide.id === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setSelectedGuideId(g.id)}
                    className={cn(
                      "block w-full rounded-xl border p-4 text-left transition-colors",
                      active
                        ? "border-primary bg-accent"
                        : "border-border bg-card hover:bg-accent/50",
                    )}
                  >
                    <p className="text-xs text-muted-foreground">
                      <span className="font-semibold text-primary">{g.category}</span> ·{" "}
                      {g.readTime}
                    </p>
                    <p className="mt-1.5 font-display text-base font-bold text-foreground">
                      {g.title}
                    </p>
                  </button>
                );
              })}
              <DataPagination
                page={guidesPagination.page}
                totalPages={guidesPagination.totalPages}
                totalItems={guidesPagination.totalItems}
                startItem={guidesPagination.startItem}
                endItem={guidesPagination.endItem}
                pageSize={guidesPagination.pageSize}
                onPageChange={guidesPagination.setPage}
                compact
              />
            </>
          )}
        </div>

        <article className="rounded-xl border border-border bg-card p-6 sm:p-8 lg:col-span-7">
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-primary">{activeGuide.category}</span> ·{" "}
            {activeGuide.readTime}
          </p>
          <h2 className="mt-2 font-display text-2xl font-bold leading-tight text-foreground">
            {activeGuide.title}
          </h2>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">{activeGuide.summary}</p>

          <div className="mt-6 border-t border-border pt-5">
            <h3 className="text-sm font-bold text-foreground">Langkah Praktis</h3>
            <ol className="mt-3 space-y-3 text-sm text-foreground/90">
              {activeGuide.steps.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="font-mono text-xs font-bold tabular-nums text-primary">
                    0{index + 1}.
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </article>
      </div>

      {/* Onboarding Checklist + FAQ */}
      <div className="grid gap-6 lg:grid-cols-12">
        <section className="rounded-xl border border-border bg-card p-6 lg:col-span-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Daftar Periksa Awal</h2>
            <span className="font-mono text-xs font-semibold tabular-nums text-primary">
              {completedCount}/{checklist.length} selesai
            </span>
          </div>
          <div className="mt-4 space-y-2">
            {checklist.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleCheck(item.id)}
                className="flex w-full items-start gap-3 rounded-lg border border-border/70 bg-background p-3 text-left text-sm transition-colors hover:bg-accent/40"
              >
                {item.done ? (
                  <CheckSquare className="mt-0.5 size-4 shrink-0 text-primary" />
                ) : (
                  <Square className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                )}
                <span className={cn(item.done && "text-muted-foreground line-through")}>
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-6 lg:col-span-7">
          <h2 className="font-display text-lg font-bold">Pertanyaan yang Sering Diajukan</h2>
          <div className="mt-4 divide-y divide-border">
            {faqs.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={item.q} className="py-3">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between gap-4 py-1 text-left text-sm font-semibold text-foreground"
                  >
                    <span>{item.q}</span>
                    {isOpen ? (
                      <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                    )}
                  </button>
                  {isOpen && (
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.a}</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
