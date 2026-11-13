import { useEffect, useState, type FormEvent } from "react";
import { CalendarDays, Trash2 } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import type { CalendarEventRecord } from "@/components/admin/admin-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type EventType = CalendarEventRecord["type"];

function localDateValue() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

async function responseError(response: Response) {
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  return body.error ?? `Permintaan gagal (${response.status}).`;
}

export function AdminCalendarView() {
  const [events, setEvents] = useState<CalendarEventRecord[]>([]);
  const [type, setType] = useState<EventType>("Kalender Ekonomi");
  const [date, setDate] = useState(localDateValue);
  const [time, setTime] = useState("09:00");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [impact, setImpact] = useState<CalendarEventRecord["impact"]>("Sedang");
  const [actual, setActual] = useState("");
  const [forecast, setForecast] = useState("");
  const [previous, setPrevious] = useState("");
  const [mentor, setMentor] = useState("");
  const [level, setLevel] = useState<CalendarEventRecord["level"]>("Pemula");
  const [format, setFormat] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/admin/calendar")
      .then(async (response) => {
        if (!response.ok) throw new Error(await responseError(response));
        return (await response.json()) as CalendarEventRecord[];
      })
      .then((items) => {
        if (active) setEvents(items);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Gagal memuat kalender.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          date,
          time,
          title,
          description,
          currency: type === "Kalender Ekonomi" ? currency : "",
          impact: type === "Kalender Ekonomi" ? impact : "Rendah",
          actual: type === "Kalender Ekonomi" ? actual : "",
          forecast: type === "Kalender Ekonomi" ? forecast : "",
          previous: type === "Kalender Ekonomi" ? previous : "",
          mentor: type === "Jadwal Akademi" ? mentor : "",
          level: type === "Jadwal Akademi" ? level : "Pemula",
          format: type === "Jadwal Akademi" ? format : "",
        }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const created = (await response.json()) as CalendarEventRecord;
      setEvents((current) =>
        [...current, created].sort((a, b) =>
          `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`),
        ),
      );
      setTitle("");
      setDescription("");
      setActual("");
      setForecast("");
      setPrevious("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal menerbitkan informasi kalender.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setError("");
    try {
      const response = await fetch(`/api/admin/calendar/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error(await responseError(response));
      setEvents((current) => current.filter((item) => item.id !== id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal menghapus informasi kalender.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <AdminShell title="Kalender" subtitle="Terbitkan informasi kalender untuk semua pengguna.">
      <div className="space-y-6">
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-xl border border-border bg-card p-5 sm:p-6"
        >
          <div className="flex items-center gap-3">
            <CalendarDays className="size-5 text-primary" />
            <div>
              <h2 className="font-display text-lg font-bold">Terbitkan Informasi</h2>
              <p className="text-sm text-muted-foreground">
                Informasi yang disimpan akan langsung terlihat oleh semua pengguna.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1.5 text-sm font-medium">
              Jenis Informasi
              <select
                value={type}
                onChange={(event) => setType(event.target.value as EventType)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option>Kalender Ekonomi</option>
                <option>Jadwal Akademi</option>
              </select>
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              Tanggal
              <Input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                required
              />
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              Waktu
              <Input
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                required
              />
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              Judul
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={180}
                required
              />
            </label>
          </div>

          {type === "Kalender Ekonomi" ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <label className="space-y-1.5 text-sm font-medium">
                Mata Uang
                <select
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD", "CNY", "IDR"].map(
                    (item) => (
                      <option key={item}>{item}</option>
                    ),
                  )}
                </select>
              </label>
              <label className="space-y-1.5 text-sm font-medium">
                Dampak
                <select
                  value={impact}
                  onChange={(event) =>
                    setImpact(event.target.value as CalendarEventRecord["impact"])
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option>Tinggi</option>
                  <option>Sedang</option>
                  <option>Rendah</option>
                </select>
              </label>
              <label className="space-y-1.5 text-sm font-medium">
                Aktual
                <Input value={actual} onChange={(event) => setActual(event.target.value)} />
              </label>
              <label className="space-y-1.5 text-sm font-medium">
                Perkiraan
                <Input value={forecast} onChange={(event) => setForecast(event.target.value)} />
              </label>
              <label className="space-y-1.5 text-sm font-medium">
                Sebelumnya
                <Input value={previous} onChange={(event) => setPrevious(event.target.value)} />
              </label>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="space-y-1.5 text-sm font-medium">
                Mentor
                <Input value={mentor} onChange={(event) => setMentor(event.target.value)} />
              </label>
              <label className="space-y-1.5 text-sm font-medium">
                Tingkat
                <select
                  value={level}
                  onChange={(event) => setLevel(event.target.value as CalendarEventRecord["level"])}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option>Pemula</option>
                  <option>Menengah</option>
                  <option>Lanjutan</option>
                </select>
              </label>
              <label className="space-y-1.5 text-sm font-medium">
                Format
                <Input
                  value={format}
                  onChange={(event) => setFormat(event.target.value)}
                  placeholder="Webinar / Kelas langsung"
                />
              </label>
            </div>
          )}

          <label className="block space-y-1.5 text-sm font-medium">
            Deskripsi
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              maxLength={2000}
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={saving}>
            {saving ? "Menerbitkan..." : "Terbitkan ke Semua Pengguna"}
          </Button>
        </form>

        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border p-5">
            <h2 className="font-display text-lg font-bold">Informasi Terbit</h2>
          </div>
          {loading ? (
            <p className="p-6 text-sm text-muted-foreground">Memuat informasi kalender...</p>
          ) : events.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Belum ada informasi kalender.</p>
          ) : (
            <div className="divide-y divide-border/70">
              {events.map((item) => (
                <article
                  key={item.id}
                  className="flex flex-wrap items-start justify-between gap-4 p-5"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs font-semibold text-primary">
                      {item.type} · {item.date} · {item.time}
                    </p>
                    <h3 className="font-semibold">{item.title}</h3>
                    {item.description && (
                      <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                        {item.description}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={deletingId === item.id}
                    onClick={() => void handleDelete(item.id)}
                    aria-label={`Hapus ${item.title}`}
                  >
                    <Trash2 className="mr-2 size-4" />
                    {deletingId === item.id ? "Menghapus..." : "Hapus"}
                  </Button>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
