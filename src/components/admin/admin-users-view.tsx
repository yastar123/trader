import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Search } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { formatUsd, type AdminUserRecord } from "@/components/admin/admin-types";
import { Button } from "@/components/ui/button";
import { DataPagination, usePagination } from "@/components/ui/data-pagination";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type UserFilter = "Semua" | "Aktif" | "Ditangguhkan";

export function AdminUsersView() {
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<UserFilter>("Semua");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = (await res.json()) as AdminUserRecord[];
        setUsers(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  async function updateUser(
    id: string,
    patch: Partial<Pick<AdminUserRecord, "status" | "kycStatus" | "accountType">>,
    label: string,
  ) {
    setBusyId(id);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        setFeedback(`Data pengguna ${id} diperbarui: ${label}.`);
        await loadUsers();
      }
    } finally {
      setBusyId(null);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((user) => {
      if (filter !== "Semua" && user.status !== filter) return false;
      if (!q) return true;
      return (
        user.name.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q) ||
        user.accountId.toLowerCase().includes(q) ||
        user.id.toLowerCase().includes(q)
      );
    });
  }, [users, filter, query]);

  const usersPagination = usePagination(filtered, 5);

  return (
    <AdminShell
      title="Manajemen Pengguna"
      subtitle="Kelola status akun trader, verifikasi KYC, tipe akun, dan pantauan saldo."
    >
      <div className="space-y-6">
        <section className="flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-end">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Daftar Pengguna Trader
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Saldo pengguna terhubung langsung dengan hasil verifikasi manual deposit dan withdraw.
            </p>
          </div>
          <div className="font-mono text-xs tabular-nums text-muted-foreground">
            Total Terdaftar: <span className="font-bold text-foreground">{users.length}</span>
          </div>
        </section>

        {feedback && (
          <div
            role="status"
            className="rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary"
          >
            {feedback}
          </div>
        )}

        <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-card p-1">
            {(["Semua", "Aktif", "Ditangguhkan"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors",
                  filter === tab
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama, email, atau ID akun..."
              className="h-10 bg-card pl-9 text-sm"
            />
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Trader</th>
                  <th className="px-4 py-3 font-medium">Akun & Tipe</th>
                  <th className="px-4 py-3 text-right font-medium">Saldo Akun</th>
                  <th className="px-4 py-3 font-medium">KYC</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Tindakan Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Memuat daftar pengguna...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Tidak ada pengguna yang cocok.
                    </td>
                  </tr>
                ) : (
                  usersPagination.paginatedItems.map((user) => (
                    <tr key={user.id} className="align-middle hover:bg-accent/25">
                      <td className="px-4 py-4">
                        <p className="font-semibold text-foreground">{user.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{user.email}</p>
                        <p className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                          Bergabung {user.joinedAt}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-mono text-xs font-bold text-foreground">
                          {user.accountId}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{user.accountType}</p>
                      </td>
                      <td className="px-4 py-4 text-right font-mono font-bold tabular-nums text-foreground">
                        {formatUsd(user.balance)}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={cn(
                            "inline-block rounded-md border px-2 py-1 text-xs font-semibold whitespace-nowrap",
                            user.kycStatus === "Terverifikasi"
                              ? "border-primary/40 bg-primary/10 text-primary"
                              : "border-amber-500/40 bg-amber-500/10 text-amber-400",
                          )}
                        >
                          {user.kycStatus}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={cn(
                            "inline-block rounded-md border px-2 py-1 text-xs font-semibold whitespace-nowrap",
                            user.status === "Aktif"
                              ? "border-border bg-background text-foreground"
                              : "border-destructive/40 bg-destructive/10 text-destructive",
                          )}
                        >
                          {user.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          {user.kycStatus !== "Terverifikasi" && (
                            <Button
                              type="button"
                              size="sm"
                              disabled={busyId === user.id}
                              onClick={() =>
                                void updateUser(
                                  user.id,
                                  { kycStatus: "Terverifikasi" },
                                  "KYC Terverifikasi",
                                )
                              }
                              className="h-8 bg-primary px-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90"
                            >
                              <CheckCircle2 className="mr-1 size-3.5" />
                              Verifikasi KYC
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busyId === user.id}
                            onClick={() =>
                              void updateUser(
                                user.id,
                                {
                                  accountType:
                                    user.accountType === "Raw Spread" ? "Standard" : "Raw Spread",
                                },
                                `Tipe Akun ${user.accountType === "Raw Spread" ? "Standard" : "Raw Spread"}`,
                              )
                            }
                            className="h-8 border-border px-2.5 text-xs whitespace-nowrap"
                          >
                            Ubah Tipe
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busyId === user.id}
                            onClick={() =>
                              void updateUser(
                                user.id,
                                {
                                  status: user.status === "Aktif" ? "Ditangguhkan" : "Aktif",
                                },
                                user.status === "Aktif" ? "Ditangguhkan" : "Diaktifkan",
                              )
                            }
                            className={cn(
                              "h-8 border-border px-2.5 text-xs whitespace-nowrap",
                              user.status === "Aktif"
                                ? "text-destructive hover:bg-destructive/10"
                                : "text-primary hover:bg-primary/10",
                            )}
                          >
                            {user.status === "Aktif" ? "Tangguhkan" : "Aktifkan"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <DataPagination
            page={usersPagination.page}
            totalPages={usersPagination.totalPages}
            totalItems={usersPagination.totalItems}
            startItem={usersPagination.startItem}
            endItem={usersPagination.endItem}
            pageSize={usersPagination.pageSize}
            onPageChange={usersPagination.setPage}
            onPageSizeChange={usersPagination.setPageSize}
            className="px-4 py-3"
          />
        </section>
      </div>
    </AdminShell>
  );
}
