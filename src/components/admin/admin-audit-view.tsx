import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import type { AuditLogRecord } from "@/components/admin/admin-types";
import { DataPagination, usePagination } from "@/components/ui/data-pagination";
import { Input } from "@/components/ui/input";

export function AdminAuditView() {
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/admin/audit")
      .then((res) => (res.ok ? (res.json() as Promise<AuditLogRecord[]>) : []))
      .then((data) => {
        if (active) setLogs(data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter(
      (log) =>
        log.actor.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        log.target.toLowerCase().includes(q) ||
        log.detail.toLowerCase().includes(q),
    );
  }, [logs, query]);

  const auditPagination = usePagination(filtered, 5);

  return (
    <AdminShell
      title="Log Audit"
      subtitle="Rekam jejak seluruh verifikasi manual dan perubahan status oleh administrator."
    >
      <div className="space-y-6">
        <section className="flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-end">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Log Audit Administrator
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Setiap persetujuan deposit, penolakan withdraw, dan pembaruan pengguna tercatat secara
              berurutan.
            </p>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari aksi, target, atau catatan..."
              className="h-10 bg-card pl-9 text-sm"
            />
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">ID & Waktu</th>
                  <th className="px-4 py-3 font-medium">Administrator</th>
                  <th className="px-4 py-3 font-medium">Aksi</th>
                  <th className="px-4 py-3 font-medium">Target</th>
                  <th className="px-4 py-3 font-medium">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Memuat log audit...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Tidak ada catatan audit yang cocok.
                    </td>
                  </tr>
                ) : (
                  auditPagination.paginatedItems.map((log) => (
                    <tr key={log.id} className="hover:bg-accent/25">
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <p className="font-mono text-xs font-bold text-foreground">{log.id}</p>
                        <p className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground">
                          {log.timestamp}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs whitespace-nowrap text-muted-foreground">
                        {log.actor}
                      </td>
                      <td className="px-4 py-3.5 font-semibold whitespace-nowrap text-foreground">
                        {log.action}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs whitespace-nowrap text-primary">
                        {log.target}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground">{log.detail}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <DataPagination
            page={auditPagination.page}
            totalPages={auditPagination.totalPages}
            totalItems={auditPagination.totalItems}
            startItem={auditPagination.startItem}
            endItem={auditPagination.endItem}
            pageSize={auditPagination.pageSize}
            onPageChange={auditPagination.setPage}
            onPageSizeChange={auditPagination.setPageSize}
            className="px-4 py-3"
          />
        </section>
      </div>
    </AdminShell>
  );
}
