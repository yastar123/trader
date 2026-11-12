import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import heroRace from "@/assets/hero-race.jpg";
import type { AdminSessionState } from "@/components/admin/admin-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AdminLoginView() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetch("/api/admin/session")
      .then((res) => (res.ok ? (res.json() as Promise<AdminSessionState>) : null))
      .then((data) => {
        if (active && data?.authenticated) {
          void navigate({ to: "/admin" });
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [navigate]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setErrorMessage(body?.error ?? "Gagal masuk ke portal admin.");
        setSubmitting(false);
        return;
      }

      void navigate({ to: "/admin" });
    } catch {
      setErrorMessage("Tidak dapat terhubung ke server autentikasi admin.");
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-dvh bg-background lg:grid-cols-[0.95fr_1.05fr]">
      <section
        className="relative hidden min-h-dvh overflow-hidden bg-card lg:block"
        aria-label="IC Trading Admin"
      >
        <img
          src={heroRace}
          alt=""
          className="absolute inset-0 size-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/25 via-background/50 to-background/95" />
        <div className="relative flex min-h-dvh flex-col justify-between p-10 xl:p-16">
          <Link to="/" className="inline-flex w-fit items-center gap-3 text-foreground">
            <span className="flex size-10 items-center justify-center rounded-md bg-primary text-sm font-extrabold text-primary-foreground">
              IC
            </span>
            <span>
              <span className="block font-display text-xl font-extrabold">IC Trading</span>
              <span className="block text-xs text-muted-foreground">Portal Administrator</span>
            </span>
          </Link>
          <div className="max-w-lg pb-4">
            <p className="mb-4 text-xs font-semibold uppercase text-primary">
              Otoritas Operasional Terpusat
            </p>
            <h1 className="font-display text-4xl font-bold leading-tight xl:text-5xl">
              Kelola verifikasi dan pasar dengan kendali penuh.
            </h1>
            <p className="mt-5 max-w-md text-base leading-7 text-foreground/75">
              Periksa bukti transfer deposit, verifikasi penarikan dana, atur instrumen pasar, dan
              pantau seluruh aktivitas trading klien.
            </p>
          </div>
          <p className="text-xs text-foreground/65">© IC Trading</p>
        </div>
      </section>

      <section className="flex min-h-dvh items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <Link
            to="/"
            className="mb-10 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Kembali ke beranda
          </Link>

          <div className="mb-8">
            <p className="text-sm font-semibold text-primary">IC Trading · Administrator</p>
            <h2 className="mt-3 font-display text-3xl font-bold">Masuk ke Portal Admin</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Masukkan kredensial administrator untuk mengakses pusat verifikasi dan manajemen
              pasar.
            </p>
          </div>

          <form className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
            <div className="space-y-2">
              <label htmlFor="admin-email" className="text-sm font-medium">
                Alamat email
              </label>
              <Input
                id="admin-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="nama@email.com"
                required
                maxLength={255}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="admin-password" className="text-sm font-medium">
                  Kata sandi
                </label>
                <span className="text-xs text-muted-foreground">Akses terverifikasi server</span>
              </div>
              <div className="relative">
                <Input
                  id="admin-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Masukkan kata sandi"
                  required
                  maxLength={128}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-12"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </Button>
              </div>
            </div>

            {errorMessage && (
              <p
                role="alert"
                className="rounded-lg border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-xs font-medium text-destructive"
              >
                {errorMessage}
              </p>
            )}

            <Button type="submit" disabled={submitting} className="h-11 w-full text-sm font-bold">
              {submitting ? "Memverifikasi..." : "Masuk"}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Masuk sebagai trader biasa?{" "}
            <Link
              to="/login"
              className="font-semibold text-primary transition-colors hover:text-foreground"
            >
              Portal Login Trader
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
