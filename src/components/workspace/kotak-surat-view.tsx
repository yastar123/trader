import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Archive, Check, Mail, MailOpen, PenSquare, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataPagination, usePagination } from "@/components/ui/data-pagination";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type MailCategory = "Peringatan Pasar" | "Sistem & Akun" | "Dukungan";

type MailItem = {
  id: string;
  sender: string;
  subject: string;
  preview: string;
  body: string;
  category: MailCategory;
  timestamp: string;
  unread: boolean;
  archived: boolean;
};

const initialMessages: MailItem[] = [
  {
    id: "MSG-101",
    sender: "Tim Likuiditas wmTrader",
    subject: "Pemberitahuan Jadwal Rilis Inflasi AS & Potensi Pelebaran Spread",
    preview: "Rilis CPI AS dijadwalkan pukul 20:30 WIB. Pastikan level margin Anda memadai.",
    body: "Halo Trader,\n\nSebagai bagian dari manajemen risiko menjelang rilis data Indeks Harga Konsumen (CPI) AS pada pukul 20:30 WIB hari ini, likuiditas antarbank pada pasangan USD dan XAUUSD dapat mengalami volatilitas tinggi sesaat.\n\nPastikan posisi terbuka Anda memiliki Stop Loss yang sesuai serta margin bebas yang memadai untuk mengantisipasi lonjakan harga.",
    category: "Peringatan Pasar",
    timestamp: "14:20 WIB",
    unread: true,
    archived: false,
  },
  {
    id: "MSG-102",
    sender: "Tim Kepatuhan & Akun wmTrader",
    subject: "Laporan Ringkasan Eksekusi Mingguan Akun Raw Spread",
    preview: "Rata-rata kecepatan eksekusi akun Anda minggu ini tercatat 34 ms tanpa requotes.",
    body: "Laporan ringkasan eksekusi periode mingguan untuk akun #IC-884210 telah tersedia.\n\nTotal lot ditransaksikan: 4.85 lot\nRata-rata kecepatan eksekusi: 34 milidetik\nSpread rata-rata EURUSD: 0.12 pip\n\nAnda dapat meninjau rincian per transaksi di menu Jurnal Trading.",
    category: "Sistem & Akun",
    timestamp: "Kemarin, 18:05",
    unread: true,
    archived: false,
  },
  {
    id: "MSG-103",
    sender: "Akademi wmTrader",
    subject: "Konfirmasi Pendaftaran: Bedah Struktur Pasar Emas (XAUUSD)",
    preview:
      "Kursi Anda untuk sesi webinar besok malam telah tercatat. Tautan ruang siaran aktif 15 menit sebelum mulai.",
    body: "Terima kasih telah mendaftar pada sesi webinar interaktif bersama analis senior kami.\n\nTopik: Struktur Pasar & Likuiditas Sesi New York untuk XAUUSD\nWaktu: Besok, 19:00 - 20:30 WIB\n\nSilakan siapkan catatan pertanyaan Anda di menu Komunitas atau Kalender Akademi.",
    category: "Dukungan",
    timestamp: "10 Nov, 09:40",
    unread: true,
    archived: false,
  },
  {
    id: "MSG-104",
    sender: "Infrastruktur Server wmTrader",
    subject: "Pemeliharaan Terjadwal Server NY4 Akhir Pekan",
    preview: "Pemeliharaan rutin dilakukan Sabtu pukul 15:00 - 17:00 WIB saat pasar tutup.",
    body: "Untuk menjaga latensi rendah dan kestabilan koneksi cTrader serta MetaTrader, kami menjadwalkan pemeliharaan rutin pada akhir pekan saat pasar tutup.\n\nTidak ada tindakan yang diperlukan dari pihak Anda.",
    category: "Sistem & Akun",
    timestamp: "08 Nov, 11:12",
    unread: false,
    archived: false,
  },
];

export function KotakSuratView() {
  const [messages, setMessages] = useState<MailItem[]>(initialMessages);
  const [filter, setFilter] = useState<"Semua" | "Belum Dibaca" | "Arsip">("Semua");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string>("MSG-101");
  const [composing, setComposing] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newBody, setNewBody] = useState("");
  const [sentNotice, setSentNotice] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/messages")
      .then((res) => (res.ok ? (res.json() as Promise<MailItem[]>) : null))
      .then((data) => {
        if (Array.isArray(data)) setMessages(data);
      })
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    return messages.filter((m) => {
      if (filter === "Arsip" && !m.archived) return false;
      if (filter !== "Arsip" && m.archived) return false;
      if (filter === "Belum Dibaca" && !m.unread) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          m.subject.toLowerCase().includes(q) ||
          m.sender.toLowerCase().includes(q) ||
          m.preview.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [messages, filter, search]);

  const mailPagination = usePagination(filtered, 4);

  const selectedMessage = useMemo(
    () => messages.find((m) => m.id === selectedId) ?? filtered[0] ?? null,
    [messages, selectedId, filtered],
  );

  function selectAndRead(id: string) {
    setSelectedId(id);
    setComposing(false);
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, unread: false } : m)));
    void fetch(`/api/messages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unread: false }),
    }).catch(() => {});
  }

  function toggleRead(id: string) {
    const target = messages.find((m) => m.id === id);
    const nextUnread = target ? !target.unread : false;
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, unread: nextUnread } : m)));
    void fetch(`/api/messages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unread: nextUnread }),
    }).catch(() => {});
  }

  function toggleArchive(id: string) {
    const target = messages.find((m) => m.id === id);
    const nextArchived = target ? !target.archived : false;
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, archived: nextArchived } : m)));
    void fetch(`/api/messages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: nextArchived }),
    }).catch(() => {});
  }

  function deleteMessage(id: string) {
    setMessages((prev) => prev.filter((m) => m.id !== id));
    if (selectedId === id) setSelectedId("");
    void fetch(`/api/messages/${id}`, { method: "DELETE" }).catch(() => {});
  }

  async function handleSendSupport(e: FormEvent) {
    e.preventDefault();
    if (!newSubject.trim() || !newBody.trim()) return;
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: newSubject.trim(), body: newBody.trim() }),
      });
      if (res.ok) {
        const created = (await res.json()) as MailItem;
        setMessages((prev) => [created, ...prev]);
        setSelectedId(created.id);
        setComposing(false);
        setNewSubject("");
        setNewBody("");
        setSentNotice("Pesan telah dikirim ke tim dukungan.");
        return;
      }
    } catch {
      // Fallback
    }

    const created: MailItem = {
      id: `MSG-${Math.floor(200 + Math.random() * 800)}`,
      sender: "Anda → Tim Dukungan wmTrader",
      subject: newSubject.trim(),
      preview: newBody.trim().slice(0, 90),
      body: newBody.trim(),
      category: "Dukungan",
      timestamp: "Baru saja",
      unread: false,
      archived: false,
    };
    setMessages((prev) => [created, ...prev]);
    setSelectedId(created.id);
    setComposing(false);
    setNewSubject("");
    setNewBody("");
    setSentNotice("Pesan telah ditambahkan ke daftar percakapan.");
  }

  const unreadCount = messages.filter((m) => m.unread && !m.archived).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Kotak Surat
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pemberitahuan sistem, peringatan pasar, dan pesan dukungan akun
          </p>
        </div>
        <Button type="button" onClick={() => setComposing((v) => !v)} className="gap-2 font-bold">
          <PenSquare className="size-4" />
          <span>{composing ? "Batal Tulis" : "Hubungi Dukungan"}</span>
        </Button>
      </div>

      {sentNotice && (
        <div
          role="status"
          className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground"
        >
          <span className="flex items-center gap-2">
            <Check className="size-4 text-primary" />
            {sentNotice}
          </span>
          <button
            type="button"
            onClick={() => setSentNotice(null)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Tutup
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left List Pane */}
        <section className="rounded-xl border border-border bg-card lg:col-span-5">
          <div className="space-y-3 border-b border-border p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari pengirim atau subjek..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-background p-1">
              {(["Semua", "Belum Dibaca", "Arsip"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFilter(tab)}
                  className={cn(
                    "rounded-md px-2 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors",
                    filter === tab
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab}
                  {tab === "Belum Dibaca" && unreadCount > 0 ? ` (${unreadCount})` : ""}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-border/70">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Tidak ada pesan pada kategori ini.
              </div>
            ) : (
              mailPagination.paginatedItems.map((m) => {
                const active = selectedMessage?.id === m.id && !composing;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => selectAndRead(m.id)}
                    className={cn(
                      "block w-full px-4 py-4 text-left transition-colors",
                      active ? "bg-accent" : "hover:bg-accent/40",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className={cn("truncate", m.unread && "font-bold text-primary")}>
                        {m.sender} · {m.category}
                      </span>
                      <span className="shrink-0 font-mono tabular-nums">{m.timestamp}</span>
                    </div>
                    <p
                      className={cn(
                        "mt-1 truncate text-sm",
                        m.unread ? "font-bold text-foreground" : "font-medium text-foreground/90",
                      )}
                    >
                      {m.subject}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {m.preview}
                    </p>
                  </button>
                );
              })
            )}
          </div>
          <DataPagination
            page={mailPagination.page}
            totalPages={mailPagination.totalPages}
            totalItems={mailPagination.totalItems}
            startItem={mailPagination.startItem}
            endItem={mailPagination.endItem}
            pageSize={mailPagination.pageSize}
            onPageChange={mailPagination.setPage}
            compact
            className="px-4 py-3"
          />
        </section>

        {/* Right Reading / Compose Pane */}
        <section className="rounded-xl border border-border bg-card p-5 sm:p-7 lg:col-span-7">
          {composing ? (
            <form onSubmit={handleSendSupport} className="space-y-4">
              <div>
                <h2 className="font-display text-lg font-bold">Kirim Pesan ke Tim Dukungan</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pertanyaan terkait akun, eksekusi order, atau verifikasi dokumen.
                </p>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="mail-subject" className="text-sm font-medium">
                  Subjek Pesan
                </label>
                <Input
                  id="mail-subject"
                  placeholder="Contoh: Pertanyaan komisi akun Raw Spread"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="mail-body" className="text-sm font-medium">
                  Isi Pesan
                </label>
                <Textarea
                  id="mail-body"
                  rows={7}
                  placeholder="Tuliskan detail pertanyaan atau permintaan Anda..."
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  required
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setComposing(false)}>
                  Batal
                </Button>
                <Button type="submit" className="font-bold">
                  Kirim Pesan
                </Button>
              </div>
            </form>
          ) : selectedMessage ? (
            <div className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{selectedMessage.sender}</span>
                    <span aria-hidden="true">·</span>
                    <span>{selectedMessage.category}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{selectedMessage.timestamp}</span>
                  </div>
                  <h2 className="mt-2 font-display text-xl font-bold leading-snug text-foreground">
                    {selectedMessage.subject}
                  </h2>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => toggleRead(selectedMessage.id)}
                    title={selectedMessage.unread ? "Tandai sudah dibaca" : "Tandai belum dibaca"}
                  >
                    {selectedMessage.unread ? (
                      <MailOpen className="size-4" />
                    ) : (
                      <Mail className="size-4" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => toggleArchive(selectedMessage.id)}
                    title={selectedMessage.archived ? "Pindahkan dari arsip" : "Arsipkan"}
                  >
                    <Archive className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => deleteMessage(selectedMessage.id)}
                    title="Hapus pesan"
                    className="hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="whitespace-pre-line text-sm leading-7 text-foreground/90">
                {selectedMessage.body}
              </div>
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              Pilih pesan di sebelah kiri untuk membaca detailnya.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
