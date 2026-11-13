import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import heroRace from "@/assets/hero-race.jpg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { syncLoginWithExpress } from "@/lib/fe-session";

type AccountPageProps = {
  mode: "login" | "register";
};

export function AccountPage({ mode }: AccountPageProps) {
  const isRegister = mode === "register";
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const fullName = String(formData.get("name") ?? "").trim();
    setSubmitting(true);
    setSubmitError(null);
    try {
      await syncLoginWithExpress({
        email: email || undefined,
        name: fullName || (email ? email.split("@")[0] : undefined),
        isRegister,
      });
      void navigate({ to: "/beranda" });
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Permintaan akun gagal. Silakan coba lagi.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-dvh bg-background lg:grid-cols-[0.95fr_1.05fr]">
      <section
        className="relative hidden min-h-dvh overflow-hidden bg-card lg:block"
        aria-label="wmTrader"
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
              wmT
            </span>
            <span>
              <span className="block font-display text-xl font-extrabold">wmTrader</span>
              <span className="block text-xs text-muted-foreground">Platform Trading</span>
            </span>
          </Link>
          <div className="max-w-lg pb-4">
            <p className="mb-4 text-xs font-semibold uppercase text-primary">
              Performa dimulai di sini
            </p>
            <h1 className="font-display text-4xl font-bold leading-tight xl:text-5xl">
              Ambil langkah berikutnya dengan percaya diri.
            </h1>
            <p className="mt-5 max-w-md text-base leading-7 text-foreground/75">
              Akses platform trading dan jelajahi peluang pasar bersama wmTrader.
            </p>
          </div>
          <p className="text-xs text-foreground/65">© wmTrader</p>
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
            <p className="text-sm font-semibold text-primary">wmTrader</p>
            <h2 className="mt-3 font-display text-3xl font-bold">
              {isRegister ? "Buat akun Anda" : "Selamat datang kembali"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {isRegister
                ? "Isi detail berikut untuk memulai."
                : "Masuk untuk melanjutkan ke akun trading Anda."}
            </p>
          </div>

          <div className="mb-7 grid grid-cols-2 border-b border-border" aria-label="Jenis akun">
            <Link
              to="/login"
              aria-current={!isRegister ? "page" : undefined}
              className={`border-b-2 px-3 py-3 text-center text-sm font-semibold transition-colors ${
                !isRegister
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Masuk
            </Link>
            <Link
              to="/register"
              aria-current={isRegister ? "page" : undefined}
              className={`border-b-2 px-3 py-3 text-center text-sm font-semibold transition-colors ${
                isRegister
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Daftar
            </Link>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            {isRegister && (
              <div className="space-y-2">
                <label htmlFor="full-name" className="text-sm font-medium">
                  Nama lengkap
                </label>
                <Input
                  id="full-name"
                  name="name"
                  autoComplete="name"
                  placeholder="Nama lengkap Anda"
                  required
                  maxLength={100}
                />
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Alamat email
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="nama@email.com"
                required
                maxLength={255}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="password" className="text-sm font-medium">
                  Kata sandi
                </label>
                {!isRegister && (
                  <span className="text-xs text-muted-foreground">Lupa kata sandi?</span>
                )}
              </div>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  placeholder="Minimal 8 karakter"
                  required
                  minLength={8}
                  maxLength={128}
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

            {isRegister && (
              <label className="flex items-start gap-3 text-sm leading-5 text-muted-foreground">
                <input
                  type="checkbox"
                  name="terms"
                  required
                  className="mt-1 size-4 accent-primary"
                />
                <span>Saya menyetujui syarat dan ketentuan serta kebijakan privasi.</span>
              </label>
            )}

            {submitError && (
              <p
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
              >
                {submitError}
              </p>
            )}

            <Button type="submit" disabled={submitting} className="h-11 w-full text-sm font-bold">
              {submitting ? "Memproses..." : isRegister ? "Buat akun" : "Masuk"}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            {isRegister ? "Sudah punya akun?" : "Belum punya akun?"}{" "}
            <Link
              to={isRegister ? "/login" : "/register"}
              className="font-semibold text-primary transition-colors hover:text-foreground"
            >
              {isRegister ? "Masuk" : "Daftar sekarang"}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
