import { useMemo, useState } from "react";
import { Bell, Calendar, Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataPagination, usePagination } from "@/components/ui/data-pagination";
import { cn } from "@/lib/utils";

type ImpactLevel = "Tinggi" | "Sedang" | "Rendah";

type EconomicEvent = {
  id: string;
  time: string;
  currency: "USD" | "EUR" | "GBP" | "JPY";
  title: string;
  impact: ImpactLevel;
  actual: string;
  forecast: string;
  previous: string;
};

type AcademySession = {
  id: string;
  date: string;
  time: string;
  title: string;
  mentor: string;
  level: "Pemula" | "Menengah" | "Lanjutan";
  format: string;
  description: string;
};

const economicEvents: EconomicEvent[] = [];
const academySessions: AcademySession[] = [];

export function KalenderAkademiView() {
  const [activeTab, setActiveTab] = useState<"Kalender Ekonomi" | "Jadwal Akademi">(
    "Kalender Ekonomi",
  );
  const [impactFilter, setImpactFilter] = useState<"Semua" | ImpactLevel>("Semua");
  const [currencyFilter, setCurrencyFilter] = useState<"Semua" | "USD" | "EUR" | "GBP" | "JPY">(
    "Semua",
  );
  const [levelFilter, setLevelFilter] = useState<"Semua" | "Pemula" | "Menengah" | "Lanjutan">(
    "Semua",
  );
  const [reminders, setReminders] = useState<string[]>([]);
  const [enrolled, setEnrolled] = useState<string[]>([]);

  const filteredEvents = useMemo(() => {
    return economicEvents.filter((ev) => {
      if (impactFilter !== "Semua" && ev.impact !== impactFilter) return false;
      if (currencyFilter !== "Semua" && ev.currency !== currencyFilter) return false;
      return true;
    });
  }, [impactFilter, currencyFilter]);

  const filteredAcademy = useMemo(() => {
    return academySessions.filter((s) => levelFilter === "Semua" || s.level === levelFilter);
  }, [levelFilter]);

  const eventsPagination = usePagination(filteredEvents, 4);
  const academyPagination = usePagination(filteredAcademy, 3);

  function toggleReminder(id: string) {
    setReminders((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleEnroll(id: string) {
    setEnrolled((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Kalender Akademi
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Jadwal rilis data makroekonomi berdampak tinggi dan kelas edukasi trader
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
          {(["Kalender Ekonomi", "Jadwal Akademi"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                "rounded-md px-4 py-2 text-xs font-semibold whitespace-nowrap transition-colors",
                activeTab === tab
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "Kalender Ekonomi" ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-card p-1">
              {(["Semua", "Tinggi", "Sedang", "Rendah"] as const).map((imp) => (
                <button
                  key={imp}
                  type="button"
                  onClick={() => setImpactFilter(imp)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                    impactFilter === imp
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Dampak: {imp}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
              {(["Semua", "USD", "EUR", "GBP", "JPY"] as const).map((cur) => (
                <button
                  key={cur}
                  type="button"
                  onClick={() => setCurrencyFilter(cur)}
                  className={cn(
                    "rounded-md px-3 py-1.5 font-mono text-xs font-semibold transition-colors",
                    currencyFilter === cur
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {cur}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border text-xs text-muted-foreground">
                  <tr>
                    <th className="py-2.5 pr-4 font-medium">Waktu</th>
                    <th className="py-2.5 pr-4 font-medium">Mata Uang</th>
                    <th className="py-2.5 pr-4 font-medium">Rilis Data</th>
                    <th className="py-2.5 pr-4 font-medium">Dampak</th>
                    <th className="py-2.5 pr-4 text-right font-medium">Aktual</th>
                    <th className="py-2.5 pr-4 text-right font-medium">Perkiraan</th>
                    <th className="py-2.5 pr-4 text-right font-medium">Sebelumnya</th>
                    <th className="py-2.5 text-right font-medium">Pengingat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {eventsPagination.totalItems === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                        Data kalender ekonomi belum tersedia.
                      </td>
                    </tr>
                  )}
                  {eventsPagination.paginatedItems.map((ev) => {
                    const isReminded = reminders.includes(ev.id);
                    return (
                      <tr key={ev.id} className="hover:bg-accent/30">
                        <td className="py-3.5 pr-4 font-mono text-xs whitespace-nowrap tabular-nums text-muted-foreground">
                          {ev.time}
                        </td>
                        <td className="py-3.5 pr-4 font-mono font-bold">{ev.currency}</td>
                        <td className="py-3.5 pr-4 font-medium text-foreground">{ev.title}</td>
                        <td
                          className={cn(
                            "py-3.5 pr-4 text-xs font-semibold whitespace-nowrap",
                            ev.impact === "Tinggi"
                              ? "text-destructive"
                              : ev.impact === "Sedang"
                                ? "text-primary"
                                : "text-muted-foreground",
                          )}
                        >
                          {ev.impact}
                        </td>
                        <td className="py-3.5 pr-4 text-right font-mono tabular-nums">
                          {ev.actual}
                        </td>
                        <td className="py-3.5 pr-4 text-right font-mono tabular-nums text-muted-foreground">
                          {ev.forecast}
                        </td>
                        <td className="py-3.5 pr-4 text-right font-mono tabular-nums text-muted-foreground">
                          {ev.previous}
                        </td>
                        <td className="py-3.5 text-right">
                          <Button
                            type="button"
                            variant={isReminded ? "default" : "outline"}
                            size="sm"
                            onClick={() => toggleReminder(ev.id)}
                            className="h-8 gap-1.5 text-xs"
                          >
                            <Bell className="size-3.5" />
                            <span>{isReminded ? "Aktif" : "Ingatkan"}</span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <DataPagination
              page={eventsPagination.page}
              totalPages={eventsPagination.totalPages}
              totalItems={eventsPagination.totalItems}
              startItem={eventsPagination.startItem}
              endItem={eventsPagination.endItem}
              pageSize={eventsPagination.pageSize}
              onPageChange={eventsPagination.setPage}
              onPageSizeChange={eventsPagination.setPageSize}
              pageSizeOptions={[4, 8, 15]}
              className="mt-4"
            />
          </div>
        </section>
      ) : (
        <section className="space-y-4">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1 sm:w-fit">
            {(["Semua", "Pemula", "Menengah", "Lanjutan"] as const).map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setLevelFilter(lvl)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                  levelFilter === lvl
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {lvl}
              </button>
            ))}
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {academyPagination.totalItems === 0 && (
              <p className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground md:col-span-2 lg:col-span-3">
                Jadwal akademi belum tersedia.
              </p>
            )}
            {academyPagination.paginatedItems.map((session) => {
              const isJoined = enrolled.includes(session.id);
              return (
                <article
                  key={session.id}
                  className="flex flex-col justify-between rounded-xl border border-border bg-card p-6"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-semibold text-primary">{session.level}</span>
                      <span aria-hidden="true">·</span>
                      <span>{session.format}</span>
                    </div>
                    <h2 className="mt-3 font-display text-lg font-bold leading-snug text-foreground">
                      {session.title}
                    </h2>
                    <p className="mt-2.5 text-sm leading-6 text-muted-foreground">
                      {session.description}
                    </p>
                  </div>

                  <div className="mt-6 space-y-4 border-t border-border pt-4">
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p className="font-medium text-foreground">{session.mentor}</p>
                      <p className="flex items-center gap-2 font-mono tabular-nums">
                        <Calendar className="size-3.5" />
                        <span>{session.date}</span>
                        <span aria-hidden="true">·</span>
                        <Clock className="size-3.5" />
                        <span>{session.time}</span>
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant={isJoined ? "outline" : "default"}
                      onClick={() => toggleEnroll(session.id)}
                      className="w-full gap-2 font-bold"
                    >
                      {isJoined && <Check className="size-4 text-primary" />}
                      <span>{isJoined ? "Terdaftar di Sesi" : "Daftar Webinar"}</span>
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
          <DataPagination
            page={academyPagination.page}
            totalPages={academyPagination.totalPages}
            totalItems={academyPagination.totalItems}
            startItem={academyPagination.startItem}
            endItem={academyPagination.endItem}
            pageSize={academyPagination.pageSize}
            onPageChange={academyPagination.setPage}
            onPageSizeChange={academyPagination.setPageSize}
            pageSizeOptions={[3, 6, 9]}
          />
        </section>
      )}
    </div>
  );
}
