import { useState, type FormEvent } from "react";
import { CheckCircle2, Globe2, Server, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const pillars = [
  {
    icon: Server,
    title: "Infrastruktur Latensi Rendah",
    body: "Koneksi serat optik terdedikasi di pusat data Equinix NY4 dan LD4 untuk menjaga rata-rata eksekusi order di bawah 40 milidetik.",
  },
  {
    icon: ShieldCheck,
    title: "Kepatuhan & Segregasi Dana",
    body: "Dana klien ditempatkan pada rekening terpisah di bank kustodian tier-1 serta dilengkapi perlindungan saldo negatif.",
  },
  {
    icon: Globe2,
    title: "Dukungan Multibahasa 24/7",
    body: "Tim spesialis teknis dan layanan nasabah siap membantu setiap hari termasuk saat pembukaan pasar sesi Asia, Eropa, dan AS.",
  },
];

const metrics = [
  { label: "Kecepatan Eksekusi Rata-rata", value: "< 40 ms" },
  { label: "Instrumen CFD Tersedia", value: "10,000+" },
  { label: "Spread Minimum Akun Raw", value: "0.0 pip" },
  { label: "Ketersediaan Layanan Klien", value: "24/7" },
];

export function TentangView() {
  const [topic, setTopic] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!topic.trim() || !message.trim()) return;
    setSubmitted(true);
    setTopic("");
    setMessage("");
  }

  return (
    <div className="space-y-8">
      <section className="border-b border-border pb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Tentang IC Trading
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
          IC Trading dibangun untuk menjembatani kesenjangan antara trader ritel dan likuiditas
          institusional — menghadirkan transparansi harga True Raw, eksekusi berkecepatan tinggi,
          serta perangkat analisis yang terintegrasi dalam satu portal.
        </p>
      </section>

      {/* Key Metrics */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-medium text-muted-foreground">{m.label}</p>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-primary">{m.value}</p>
          </div>
        ))}
      </section>

      {/* Three Pillars */}
      <section className="grid gap-6 md:grid-cols-3">
        {pillars.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="rounded-xl border border-border bg-card p-6">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Icon className="size-5" />
              </div>
              <h2 className="mt-4 font-display text-lg font-bold text-foreground">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
            </div>
          );
        })}
      </section>

      {/* Regulatory & Contact Grid */}
      <section className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-4 rounded-xl border border-border bg-card p-6 lg:col-span-6">
          <h2 className="font-display text-lg font-bold">Pengungkapan Risiko & Kepatuhan</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Perdagangan produk derivatif dengan leverage seperti Forex dan CFD mengandung tingkat
            risiko yang tinggi terhadap modal Anda dan mungkin tidak sesuai untuk semua investor.
            Pastikan Anda memahami sepenuhnya risiko yang terlibat dan mengelola ukuran posisi
            sesuai toleransi risiko pribadi.
          </p>
          <div className="space-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
            <p>
              <strong className="text-foreground">Alamat Kantor Operasional:</strong> Menara
              Finansial Lantai 18, Kawasan Bisnis Pusat
            </p>
            <p>
              <strong className="text-foreground">Email Resmi Dukungan:</strong>{" "}
              support@ictrading.id
            </p>
            <p>
              <strong className="text-foreground">Jam Meja Eksekusi:</strong> Senin 04:00 WIB —
              Sabtu 04:00 WIB
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-border bg-card p-6 lg:col-span-6"
        >
          <div>
            <h2 className="font-display text-lg font-bold">Kirim Masukan atau Pertanyaan</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Formulir pratinjau antarmuka untuk menghubungi tim hubungan klien.
            </p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="about-topic" className="text-sm font-medium">
              Topik Pertanyaan
            </label>
            <Input
              id="about-topic"
              placeholder="Contoh: Kemitraan, VPS Gratis, atau Informasi Regulasi"
              value={topic}
              onChange={(e) => {
                setTopic(e.target.value);
                setSubmitted(false);
              }}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="about-msg" className="text-sm font-medium">
              Pesan
            </label>
            <Textarea
              id="about-msg"
              rows={4}
              placeholder="Tuliskan pesan Anda..."
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                setSubmitted(false);
              }}
              required
            />
          </div>
          <Button type="submit" className="font-bold">
            Kirim Pertanyaan
          </Button>

          {submitted && (
            <p role="status" className="flex items-center gap-2 text-xs font-medium text-primary">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>Pertanyaan Anda telah dicatat pada pratinjau frontend.</span>
            </p>
          )}
        </form>
      </section>
    </div>
  );
}
