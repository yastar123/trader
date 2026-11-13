import { useState } from "react";
import { Menu, X, ChevronDown, Globe } from "lucide-react";
import { Link } from "@tanstack/react-router";

const utilityLinks = [
  { label: "Klien", href: "/login" },
  { label: "Partner", href: "#" },
  { label: "BLOG", href: "#" },
];

const utilityRight = [
  { label: "wmTrader Social", href: "#" },
  { label: "WebTrader", href: "#" },
  { label: "Mulai Trading", href: "/register" },
  { label: "Coba Akun Demo Gratis", href: "/register" },
  { label: "Hubungi kami", href: "#" },
];

const mainNav = [
  { label: "Panduan Singkat", href: "#" },
  { label: "Trading", href: "#keunggulan" },
  { label: "Platform", href: "#platform" },
  { label: "Lagi", href: "#pasar" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-md">
      {/* Utility bar */}
      <div className="hidden border-b border-border/40 lg:block">
        <div className="container-page flex h-9 items-center justify-between text-xs text-muted-foreground">
          <nav className="flex items-center gap-1">
            {utilityLinks.map((l, i) => (
              <span key={l.label} className="flex items-center">
                {i > 0 && <span className="mx-2 text-border">|</span>}
                <a href={l.href} className="transition-colors hover:text-foreground">
                  {l.label}
                </a>
              </span>
            ))}
          </nav>
          <nav className="flex items-center gap-1">
            {utilityRight.map((l, i) => (
              <span key={l.label} className="flex items-center">
                {i > 0 && <span className="mx-2 text-border">|</span>}
                <a href={l.href} className="transition-colors hover:text-foreground">
                  {l.label}
                </a>
              </span>
            ))}
            <span className="mx-2 text-border">|</span>
            <a
              href="#"
              className="flex items-center gap-1.5 transition-colors hover:text-foreground"
            >
              <Globe className="size-3.5" />
              ID
              <ChevronDown className="size-3" />
            </a>
          </nav>
        </div>
      </div>

      {/* Main bar */}
      <div className="container-page flex h-16 items-center justify-between gap-6">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-md bg-primary">
            {/* Candlestick mark */}
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
          <span className="leading-tight">
            <span className="block font-display text-2xl font-extrabold tracking-tight">
              wmTrader
            </span>
            <span className="block text-[10px] font-medium tracking-wide text-muted-foreground">
              Platform Trading
            </span>
          </span>
        </Link>

        {/* Nav */}
        <nav className="hidden items-center gap-8 text-sm font-medium lg:flex">
          {mainNav.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="flex items-center gap-1 text-foreground/90 transition-colors hover:text-primary"
            >
              {l.label}
              {l.label === "Lagi" && <ChevronDown className="size-4 text-muted-foreground" />}
            </a>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <a
            href="/register"
            className="hidden rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-transform hover:scale-[1.03] sm:inline-flex"
          >
            Mulai Trading
          </a>
          <a
            href="/login"
            className="hidden rounded-full border border-input px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-accent sm:inline-flex"
          >
            Login Klien
          </a>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Tutup menu" : "Buka menu"}
            className="inline-flex size-10 items-center justify-center rounded-md border border-border lg:hidden"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <nav className="border-t border-border/60 bg-background px-5 py-4 lg:hidden">
          <ul className="space-y-1">
            {mainNav.map((l) => (
              <li key={l.label}>
                <a
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-3 py-2.5 text-sm font-medium hover:bg-accent"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-col gap-2 border-t border-border/60 pt-3">
            <a
              href="/register"
              className="rounded-full bg-primary px-5 py-2.5 text-center text-sm font-bold text-primary-foreground"
            >
              Mulai Trading
            </a>
            <a
              href="/login"
              className="rounded-full border border-input px-5 py-2.5 text-center text-sm font-semibold"
            >
              Login Klien
            </a>
          </div>
        </nav>
      )}
    </header>
  );
}
