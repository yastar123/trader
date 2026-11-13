import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BookOpenText,
  Building2,
  CalendarDays,
  CandlestickChart,
  CircleHelp,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Users,
  X,
} from "lucide-react";
import { formatMoneyPair, type DisplayCurrency } from "@/lib/currency";
import { clearDemoSession, useDemoSession, useSidebarCollapse } from "@/lib/fe-session";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
  count?: number;
};

const primaryNav: NavItem[] = [
  { label: "Beranda", to: "/beranda", icon: LayoutDashboard },
  { label: "Trade", to: "/trade", icon: CandlestickChart },
  { label: "Deposit", to: "/deposit", icon: ArrowDownToLine },
  { label: "Withdraw", to: "/withdraw", icon: ArrowUpFromLine },
  { label: "Kotak Surat", to: "/kotak-surat", icon: Mail, count: 3 },
  { label: "Jurnal", to: "/jurnal", icon: BookOpenText },
];

const ecosystemNav: NavItem[] = [
  { label: "Kalender Akademi", to: "/kalender-akademi", icon: CalendarDays },
  { label: "Komunitas", to: "/komunitas", icon: Users },
  { label: "Panduan Pengguna", to: "/panduan-pengguna", icon: CircleHelp },
  { label: "Tentang", to: "/tentang", icon: Building2 },
  { label: "Pengaturan", to: "/pengaturan", icon: Settings },
];

type WorkspaceShellProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
};

export function WorkspaceShell({ title, subtitle, action, children }: WorkspaceShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { collapsed, toggleCollapsed } = useSidebarCollapse("user");
  const navigate = useNavigate();
  const { session, updateSession } = useDemoSession();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const displayCurrency: DisplayCurrency = session.currency === "IDR" ? "IDR" : "USD";
  const headerBalance = formatMoneyPair(session.balance ?? 24510, displayCurrency);

  function handleLogout() {
    clearDemoSession();
    void navigate({ to: "/login" });
  }

  function renderNavGroup(items: NavItem[], groupLabel: string, isCollapsed: boolean) {
    return (
      <div className="space-y-1">
        {!isCollapsed && (
          <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">{groupLabel}</p>
        )}
        {items.map((item) => {
          const isActive = pathname === item.to;
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
              {!isCollapsed && typeof item.count === "number" && item.count > 0 && (
                <span className="font-mono text-xs font-semibold tabular-nums text-primary">
                  {item.count}
                </span>
              )}
            </Link>
          );
        })}
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
              to="/beranda"
              title="wmTrader"
              className="flex items-center gap-3 whitespace-nowrap"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary">
                <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
                  <rect
                    x="3"
                    y="9"
                    width="4"
                    height="8"
                    rx="1"
                    fill="var(--color-primary-foreground)"
                  />
                  <rect
                    x="10"
                    y="5"
                    width="4"
                    height="10"
                    rx="1"
                    fill="var(--color-primary-foreground)"
                    opacity="0.75"
                  />
                  <rect
                    x="17"
                    y="2"
                    width="4"
                    height="12"
                    rx="1"
                    fill="var(--color-primary-foreground)"
                  />
                </svg>
              </span>
              {!isCollapsed && (
                <span className="font-display text-xl font-extrabold tracking-tight text-foreground">
                  wmTrader
                </span>
              )}
            </Link>
            {isMobileDrawer ? (
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Tutup navigasi"
                className="inline-flex size-9 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            ) : !isCollapsed ? (
              <button
                type="button"
                onClick={toggleCollapsed}
                aria-label="Kecilkan sidebar"
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
                aria-label="Lebarkan sidebar"
                title="Lebarkan sidebar"
                className="inline-flex size-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <PanelLeftOpen className="size-4" />
              </button>
            </div>
          )}

          <nav aria-label="Navigasi ruang kerja" className="space-y-6">
            {renderNavGroup(primaryNav, "Ruang Trading", isCollapsed)}
            <div className="border-t border-border/70 pt-5">
              {renderNavGroup(ecosystemNav, "Akademi & Akun", isCollapsed)}
            </div>
          </nav>
        </div>

        <div className="space-y-3 border-t border-border pt-4">
          {!isCollapsed && (
            <div className="px-2">
              <p className="truncate text-sm font-semibold text-foreground">{session.name}</p>
              <p className="mt-0.5 truncate font-mono text-xs tabular-nums text-muted-foreground">
                {session.accountId} · 1:{session.leverage ?? 500}
              </p>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <Link
              to="/"
              title={isCollapsed ? "Situs Publik" : undefined}
              className={cn(
                "flex items-center rounded-lg py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground",
                isCollapsed ? "justify-center px-2" : "gap-2.5 px-3",
              )}
            >
              <ExternalLink className="size-3.5 shrink-0" />
              {!isCollapsed && <span>Situs Publik</span>}
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              title={isCollapsed ? "Keluar Sesi" : undefined}
              className={cn(
                "flex w-full items-center rounded-lg py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-destructive",
                isCollapsed ? "justify-center px-2" : "gap-2.5 px-3",
              )}
            >
              <LogOut className="size-3.5 shrink-0" />
              {!isCollapsed && <span>Keluar Sesi</span>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop Collapsible Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden border-r border-border transition-[width] duration-200 lg:block",
          collapsed ? "w-[72px]" : "w-64",
        )}
      >
        {renderSidebarContent(collapsed, false)}
      </aside>

      {/* Mobile Drawer */}
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

      {/* Main Content Area */}
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
              aria-label="Buka navigasi"
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-border text-foreground hover:bg-accent lg:hidden"
            >
              <Menu className="size-5" />
            </button>
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Buka sidebar" : "Tutup sidebar"}
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
                <span className="hidden sm:inline">wmTrader Portal</span>
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
              aria-label="Pilih mata uang tampilan"
              className="inline-flex items-center rounded-md border border-border bg-card p-0.5 font-mono text-[11px] font-semibold"
            >
              {(["USD", "IDR"] as const).map((curr) => (
                <button
                  key={curr}
                  type="button"
                  onClick={() => void updateSession({ currency: curr })}
                  aria-pressed={displayCurrency === curr}
                  className={cn(
                    "rounded px-2 py-1 transition-colors",
                    displayCurrency === curr
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {curr}
                </button>
              ))}
            </div>
            <div className="hidden text-right sm:block">
              <p className="text-[11px] text-muted-foreground">Saldo Akun</p>
              <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
                {headerBalance.primary}
              </p>
              <p className="font-mono text-[10px] tabular-nums text-muted-foreground">
                {headerBalance.secondary}
              </p>
            </div>
            {action ?? (
              <Link
                to="/trade"
                className="inline-flex h-10 shrink-0 items-center justify-center rounded-md bg-primary px-4 text-sm font-bold whitespace-nowrap text-primary-foreground transition-opacity hover:opacity-90"
              >
                Buka Terminal Trade
              </Link>
            )}
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>

        <footer className="border-t border-border/60 px-4 py-4 text-xs text-muted-foreground sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <span>© 2026 wmTrader · Platform Trading & Pendanaan Klien</span>
            <div className="flex items-center gap-4">
              <Link to="/panduan-pengguna" className="transition-colors hover:text-foreground">
                Panduan Pengguna
              </Link>
              <Link to="/tentang" className="transition-colors hover:text-foreground">
                Tentang & Kepatuhan
              </Link>
              <Link to="/admin/login" className="transition-colors hover:text-primary">
                Panel Admin
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
