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

export function KotakSuratView() {
  const [messages, setMessages] = useState<MailItem[]>([]);
  const [filter, setFilter] = useState<"Semua" | "Belum Dibaca" | "Arsip">("Semua");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [composing, setComposing] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newBody, setNewBody] = useState("");
  const [sentNotice, setSentNotice] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/messages")
      .then(async (res) => {
        if (!res.ok) throw new Error("Gagal memuat kotak surat.");
        return (await res.json()) as MailItem[];
      })
      .then((data) => {
        setMessages(data);
      })
      .catch((error: unknown) => {
        setRequestError(error instanceof Error ? error.message : "Gagal memuat kotak surat.");
      });
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

  async function selectAndRead(id: string) {
    setRequestError(null);
    try {
      const res = await fetch(`/api/messages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unread: false }),
      });
      if (!res.ok) throw new Error("Status pesan gagal diperbarui.");
      setSelectedId(id);
      setComposing(false);
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, unread: false } : m)));
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Status pesan gagal diperbarui.");
    }
  }

  async function toggleRead(id: string) {
    const target = messages.find((m) => m.id === id);
    const nextUnread = target ? !target.unread : false;
    await updateMessage(id, { unread: nextUnread });
  }

  async function toggleArchive(id: string) {
    const target = messages.find((m) => m.id === id);
    const nextArchived = target ? !target.archived : false;
    await updateMessage(id, { archived: nextArchived });
  }

  async function updateMessage(id: string, changes: { unread?: boolean; archived?: boolean }) {
    setRequestError(null);
    try {
      const res = await fetch(`/api/messages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      if (!res.ok) throw new Error("Status pesan gagal diperbarui.");
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...changes } : m)));
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Status pesan gagal diperbarui.");
    }
  }

  async function deleteMessage(id: string) {
    setRequestError(null);
    try {
      const res = await fetch(`/api/messages/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Pesan gagal dihapus.");
      setMessages((prev) => prev.filter((m) => m.id !== id));
      if (selectedId === id) setSelectedId("");
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Pesan gagal dihapus.");
    }
  }

  async function handleSendSupport(e: FormEvent) {
    e.preventDefault();
    if (!newSubject.trim() || !newBody.trim()) return;
    setRequestError(null);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: newSubject.trim(), body: newBody.trim() }),
      });
      if (!res.ok) throw new Error("Pesan gagal dikirim.");
      const created = (await res.json()) as MailItem;
      setMessages((prev) => [created, ...prev]);
      setSelectedId(created.id);
      setComposing(false);
      setNewSubject("");
      setNewBody("");
      setSentNotice("Pesan telah dikirim ke tim dukungan.");
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Pesan gagal dikirim.");
    }
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

      {requestError && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {requestError}
        </p>
      )}

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
