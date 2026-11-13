import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  CandlestickChart,
  ExternalLink,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import type { AdminSessionState } from "@/components/admin/admin-types";
import { useAdminCurrency } from "@/lib/currency";
import { useSidebarCollapse } from "@/lib/fe-session";
import { cn } from "@/lib/utils";

type AdminNavItem = {
  label: string;
  to:
    | "/admin"
    | "/admin/markets"
    | "/admin/positions"
    | "/admin/deposit"
    | "/admin/withdraw"
    | "/admin/users"
    | "/admin/audit";
  icon: typeof LayoutDashboard;
  badge?: number;
};

type AdminShellProps = {
  title: string;
  subtitle?: string;
  pendingDepositsCount?: number;
  pendingWithdrawalsCount?: number;
  action?: ReactNode;
  children: ReactNode;
};

export function AdminShell({
  title,
  subtitle,
  pendingDepositsCount,
  pendingWithdrawalsCount,
  action,
  children,
}: AdminShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { collapsed, toggleCollapsed } = useSidebarCollapse("admin");
  const { currency, setCurrency } = useAdminCurrency();
  const [authState, setAuthState] = useState<"checking" | "authenticated" | "unauthenticated">(
    "checking",
  );
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    let active = true;
    void fetch("/api/admin/session")
      .then((res) => (res.ok ? (res.json() as Promise<AdminSessionState>) : null))
      .then((data) => {
        if (!active) return;
        if (data?.authenticated) {
          setAdminEmail(data.email);
          setAuthState("authenticated");
        } else {
          setAuthState("unauthenticated");
          void navigate({ to: "/admin/login" });
        }
      })
      .catch(() => {
        if (!active) return;
        setAuthState("unauthenticated");
        void navigate({ to: "/admin/login" });
      });

    return () => {
      active = false;
    };
  }, [navigate]);

  async function handleLogout() {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } catch {
      // Ignore network errors and route to login
    }
    void navigate({ to: "/admin/login" });
  }

  const navItems: AdminNavItem[] = [
    { label: "Ringkasan", to: "/admin", icon: LayoutDashboard },
    { label: "Instrumen & Arah", to: "/admin/markets", icon: CandlestickChart },
    { label: "Pantauan Trading", to: "/admin/positions", icon: Activity },
    {
      label: "Verifikasi Deposit",
      to: "/admin/deposit",
      icon: ArrowDownToLine,
      badge: pendingDepositsCount,
    },
    {
      label: "Verifikasi Withdraw",
      to: "/admin/withdraw",
      icon: ArrowUpFromLine,
      badge: pendingWithdrawalsCount,
    },
    { label: "Pengguna", to: "/admin/users", icon: Users },
    { label: "Log Audit", to: "/admin/audit", icon: History },
  ];

  if (authState !== "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
        <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 text-center">
          <ShieldCheck className="mx-auto size-7 text-primary" />
          <p className="mt-3 font-display text-base font-bold">Memverifikasi Sesi Admin</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Memeriksa otorisasi sebelum memuat data operasional.
          </p>
        </div>
      </div>
    );
  }

  function renderSidebarContent(isCollapsed: boolean, isMobileDrawer: boolean) {
    return (
      <div
        className={cn(
          "flex h-full flex-col justify-between bg-card py-5",
          isCollapsed ? "px-2.5" : "px-4",
        )}
      >
        <div className="space-y-6">
          <div
            className={cn(
              "flex items-center",
              isCollapsed ? "justify-center" : "justify-between px-2",
            )}
          >
            <Link
              to="/admin"
              title="IC Admin"
              className="flex items-center gap-3 whitespace-nowrap"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <ShieldCheck className="size-5" />
              </span>
              {!isCollapsed && (
                <span>
                  <span className="block font-display text-lg font-extrabold tracking-tight text-foreground">
                    IC Admin
                  </span>
                  <span className="block text-[11px] font-medium text-muted-foreground">
                    Kontrol & Verifikasi
                  </span>
                </span>
              )}
            </Link>
            {isMobileDrawer ? (
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Tutup navigasi admin"
                className="inline-flex size-9 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            ) : !isCollapsed ? (
              <button
                type="button"
                onClick={toggleCollapsed}
                aria-label="Kecilkan sidebar admin"
                title="Kecilkan sidebar"
                className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <PanelLeftClose className="size-4" />
              </button>
            ) : null}
          </div>

          {!isMobileDrawer && isCollapsed && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={toggleCollapsed}
                aria-label="Lebarkan sidebar admin"
                title="Lebarkan sidebar"
                className="inline-flex size-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <PanelLeftOpen className="size-4" />
              </button>
            </div>
          )}

          <nav aria-label="Navigasi admin" className="space-y-1">
            {!isCollapsed && (
              <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">
                Panel Operasional
              </p>
            )}
            {navItems.map((item) => {
              const normalizedPath = pathname === "/admin/" ? "/admin" : pathname;
              const isActive = normalizedPath === item.to;
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  title={isCollapsed ? item.label : undefined}
                  onClick={() => setMobileOpen(false)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center rounded-lg py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
                    isCollapsed ? "justify-center px-2" : "justify-between gap-3 px-3",
                    isActive
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  )}
                >
                  <span className={cn("flex items-center truncate", isCollapsed ? "" : "gap-3")}>
                    <Icon className={cn("size-4 shrink-0", isActive ? "text-primary" : "")} />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </span>
                  {!isCollapsed && typeof item.badge === "number" && item.badge > 0 && (
                    <span className="font-mono text-xs font-bold tabular-nums text-primary">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="space-y-3 border-t border-border pt-4">
          {!isCollapsed && (
            <div className="px-2">
              <p className="text-[11px] font-medium text-muted-foreground">Administrator Aktif</p>
              <p className="mt-0.5 truncate font-mono text-xs font-semibold text-foreground">
                {adminEmail ?? "admin"}
              </p>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <Link
              to="/beranda"
              title={isCollapsed ? "Portal Trader" : undefined}
              className={cn(
                "flex items-center rounded-lg py-2 text-xs font-medium whitespace-nowrap text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground",
                isCollapsed ? "justify-center px-2" : "gap-2.5 px-3",
              )}
            >
              <ExternalLink className="size-3.5 shrink-0" />
              {!isCollapsed && <span>Portal Trader</span>}
            </Link>
            <button
              type="button"
              onClick={() => void handleLogout()}
              title={isCollapsed ? "Keluar Admin" : undefined}
              className={cn(
                "flex w-full items-center rounded-lg py-2 text-left text-xs font-medium whitespace-nowrap text-muted-foreground transition-colors hover:bg-accent/60 hover:text-destructive",
                isCollapsed ? "justify-center px-2" : "gap-2.5 px-3",
              )}
            >
              <LogOut className="size-3.5 shrink-0" />
              {!isCollapsed && <span>Keluar Admin</span>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden border-r border-border transition-[width] duration-200 lg:block",
          collapsed ? "w-[72px]" : "w-64",
        )}
      >
        {renderSidebarContent(collapsed, false)}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button
            type="button"
            aria-label="Tutup latar navigasi"
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 bg-background/80 backdrop-blur-xs"
          />
          <aside className="relative z-10 w-72 max-w-[82vw] border-r border-border">
            {renderSidebarContent(false, true)}
          </aside>
        </div>
      )}

      <div
        className={cn(
          "flex min-h-screen flex-col transition-[padding] duration-200",
          collapsed ? "lg:pl-[72px]" : "lg:pl-64",
        )}
      >
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/90 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Buka navigasi admin"
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-border text-foreground hover:bg-accent lg:hidden"
            >
              <Menu className="size-5" />
            </button>
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Buka sidebar admin" : "Tutup sidebar admin"}
              title={collapsed ? "Buka sidebar" : "Tutup sidebar"}
              className="hidden size-9 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:inline-flex"
            >
              {collapsed ? (
                <PanelLeftOpen className="size-4" />
              ) : (
                <PanelLeftClose className="size-4" />
              )}
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="hidden sm:inline">IC Admin</span>
                <span className="hidden sm:inline" aria-hidden="true">
                  /
                </span>
                <span className="truncate font-medium text-foreground">{title}</span>
              </div>
              {subtitle && (
                <p className="hidden truncate text-xs text-muted-foreground md:block">{subtitle}</p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <div
              role="group"
              aria-label="Pilih mata uang tampilan admin"
              className="inline-flex items-center rounded-md border border-border bg-card p-0.5 font-mono text-[11px] font-semibold"
            >
              {(["USD", "IDR"] as const).map((curr) => (
                <button
                  key={curr}
                  type="button"
                  onClick={() => setCurrency(curr)}
                  aria-pressed={currency === curr}
                  className={cn(
                    "rounded px-2 py-1 transition-colors",
                    currency === curr
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {curr}
                </button>
              ))}
            </div>
            {action ?? (
              <Link
                to="/admin/markets"
                className="inline-flex h-9 shrink-0 items-center justify-center rounded-md border border-border bg-card px-3.5 text-xs font-semibold whitespace-nowrap text-foreground transition-colors hover:bg-accent"
              >
                Kontrol Pasar
              </Link>
            )}
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
