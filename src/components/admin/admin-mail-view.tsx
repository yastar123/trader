import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Mail, Send } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import type { AdminUserRecord } from "@/components/admin/admin-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type MailCategory = "Peringatan Pasar" | "Sistem & Akun" | "Dukungan";

type AdminMailMessage = {
  id: string;
  recipientUserId?: string | null;
  sender: string;
  subject: string;
  preview: string;
  body: string;
  category: MailCategory;
  timestamp: string;
  unread: boolean;
  archived: boolean;
};

const categories: MailCategory[] = ["Sistem & Akun", "Peringatan Pasar", "Dukungan"];

export function AdminMailView() {
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [messages, setMessages] = useState<AdminMailMessage[]>([]);
  const [recipient, setRecipient] = useState("all");
  const [category, setCategory] = useState<MailCategory>("Sistem & Akun");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersResponse, messagesResponse] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/messages"),
      ]);
      if (!usersResponse.ok || !messagesResponse.ok) {
        throw new Error("Gagal memuat pengguna atau riwayat surat.");
      }
      const [userData, messageData] = (await Promise.all([
        usersResponse.json(),
        messagesResponse.json(),
      ])) as [AdminUserRecord[], AdminMailMessage[]];
      setUsers(userData);
      setMessages(messageData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Gagal memuat data surat.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function sendLetter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subject.trim() || !body.trim()) {
      setError("Subjek dan isi surat wajib diisi.");
      return;
    }
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientUserId: recipient,
          subject: subject.trim(),
          body: body.trim(),
          category,
        }),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(result?.error ?? "Surat gagal dikirim.");
      }
      const sentMessages = (await response.json()) as AdminMailMessage[];
      setMessages((current) => [...sentMessages, ...current]);
      setNotice(`Surat berhasil dikirim kepada ${sentMessages.length} pengguna.`);
      setSubject("");
      setBody("");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Surat gagal dikirim.");
    } finally {
      setSending(false);
    }
  }

  const userById = new Map(users.map((user) => [user.id, user]));

  return (
    <AdminShell title="Kotak Surat" subtitle="Kirim surat dan pemberitahuan kepada pengguna">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Mail className="size-5" />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold">Tulis Surat</h2>
              <p className="text-sm text-muted-foreground">
                Kirim secara pribadi atau ke semua pengguna.
              </p>
            </div>
          </div>

          <form onSubmit={sendLetter} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="admin-mail-recipient" className="text-sm font-medium">
                Penerima
              </label>
              <select
                id="admin-mail-recipient"
                value={recipient}
                onChange={(event) => setRecipient(event.target.value)}
                disabled={loading || users.length === 0}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
              >
                <option value="all">Semua pengguna ({users.length})</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} · {user.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="admin-mail-category" className="text-sm font-medium">
                Kategori
              </label>
              <select
                id="admin-mail-category"
                value={category}
                onChange={(event) => setCategory(event.target.value as MailCategory)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
              >
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="admin-mail-subject" className="text-sm font-medium">
                Subjek
              </label>
              <Input
                id="admin-mail-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                maxLength={200}
                required
                placeholder="Masukkan subjek surat"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="admin-mail-body" className="text-sm font-medium">
                Isi Surat
              </label>
              <Textarea
                id="admin-mail-body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                maxLength={10000}
                rows={7}
                required
                placeholder="Tulis pesan untuk pengguna..."
              />
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
              >
                {error}
              </p>
            )}
            {notice && (
              <p
                role="status"
                className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm text-foreground"
              >
                {notice}
              </p>
            )}

            <Button
              type="submit"
              disabled={sending || loading || users.length === 0}
              className="w-full font-bold"
            >
              <Send className="size-4" />
              {sending ? "Mengirim..." : "Kirim Surat"}
            </Button>
          </form>
        </section>

        <section className="rounded-xl border border-border bg-card">
          <div className="border-b border-border p-5">
            <h2 className="font-display text-lg font-bold">Riwayat Surat</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Setiap penerima memiliki salinan dan status baca masing-masing.
            </p>
          </div>
          {loading ? (
            <p className="p-6 text-sm text-muted-foreground">Memuat riwayat surat...</p>
          ) : messages.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Belum ada surat yang dikirim.</p>
          ) : (
            <div className="divide-y divide-border/70">
              {messages.map((message) => {
                const user = message.recipientUserId
                  ? userById.get(message.recipientUserId)
                  : undefined;
                return (
                  <article key={message.id} className="space-y-2 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>
                        {user ? `${user.name} · ${user.email}` : "Pengguna lama / global"} ·{" "}
                        {message.category}
                      </span>
                      <span>{message.timestamp}</span>
                    </div>
                    <h3 className="font-semibold text-foreground">{message.subject}</h3>
                    <p className="line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">
                      {message.preview}
                    </p>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
