import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useDemoSession } from "@/lib/fe-session";
import { cn } from "@/lib/utils";

type SettingsTab = "Profil" | "Preferensi Trading" | "Keamanan" | "Notifikasi";

export function PengaturanView() {
  const { session, updateSession } = useDemoSession();
  const [tab, setTab] = useState<SettingsTab>("Profil");
  const [name, setName] = useState(session.name);
  const [email, setEmail] = useState(session.email);
  const [accountType, setAccountType] = useState<"Raw Spread" | "Standard">(session.accountType);
  const [currency, setCurrency] = useState<"USD" | "IDR">(session.currency);
  const [timezone, setTimezone] = useState(session.timezone);

  // Trading preferences
  const [defaultLot, setDefaultLot] = useState("0.10");
  const [leverage, setLeverage] = useState(String(session.leverage ?? 500));
  const [oneClickTrade, setOneClickTrade] = useState(true);
  const [slippageGuard, setSlippageGuard] = useState("2");

  // Security & notifications
  const [twoFactor, setTwoFactor] = useState(true);
  const [notifExecution, setNotifExecution] = useState(true);
  const [notifCalendar, setNotifCalendar] = useState(true);
  const [notifDigest, setNotifDigest] = useState(false);

  const [sessions, setSessions] = useState([
    { id: "SES-1", device: "Chrome di macOS · Jakarta", status: "Sesi Saat Ini", active: true },
    { id: "SES-2", device: "IC Mobile App · iOS 19", status: "Aktif 2 jam lalu", active: false },
  ]);

  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    setName(session.name);
    setEmail(session.email);
    setAccountType(session.accountType);
    setCurrency(session.currency);
    setTimezone(session.timezone);
    if (typeof session.leverage === "number") {
      setLeverage(String(session.leverage));
    }
  }, [session]);

  function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    updateSession({ name, email, accountType, currency, timezone });
    setSavedNotice("Profil dan preferensi akun berhasil diperbarui.");
  }

  function handleSaveGeneric(e: FormEvent, message: string) {
    e.preventDefault();
    setSavedNotice(message);
  }

  function revokeSession(id: string) {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setSavedNotice("Sesi perangkat telah dicabut dari daftar.");
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-5">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Pengaturan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kelola detail profil trader, parameter eksekusi order, keamanan, dan notifikasi
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1 sm:w-fit">
        {(["Profil", "Preferensi Trading", "Keamanan", "Notifikasi"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setTab(item);
              setSavedNotice(null);
            }}
            className={cn(
              "rounded-md px-4 py-2 text-xs font-semibold whitespace-nowrap transition-colors",
              tab === item
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item}
          </button>
        ))}
      </div>

      {savedNotice && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground"
        >
          <CheckCircle2 className="size-4 shrink-0 text-primary" />
          <span>{savedNotice}</span>
        </div>
      )}

      {tab === "Profil" && (
        <form
          onSubmit={handleSaveProfile}
          className="max-w-3xl space-y-5 rounded-xl border border-border bg-card p-5 sm:p-7"
        >
          <div>
            <h2 className="font-display text-lg font-bold">Informasi Trader & Akun</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Perubahan nama dan tipe akun akan langsung terlihat pada bilah navigasi portal.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="set-name" className="text-sm font-medium">
                Nama Lengkap
              </label>
              <Input
                id="set-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="set-email" className="text-sm font-medium">
                Alamat Email
              </label>
              <Input
                id="set-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="set-acct" className="text-sm font-medium">
                Tipe Akun Utama
              </label>
              <select
                id="set-acct"
                value={accountType}
                onChange={(e) => setAccountType(e.target.value as "Raw Spread" | "Standard")}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="Raw Spread">Raw Spread (Spread 0.0 pip)</option>
                <option value="Standard">Standard (Bebas Komisi)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="set-curr" className="text-sm font-medium">
                Mata Uang Dasar
              </label>
              <select
                id="set-curr"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as "USD" | "IDR")}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="USD">USD — Dolar Amerika Serikat</option>
                <option value="IDR">IDR — Rupiah Indonesia</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="set-tz" className="text-sm font-medium">
              Zona Waktu Tampilan
            </label>
            <select
              id="set-tz"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm sm:max-w-sm"
            >
              <option value="Asia/Jakarta (WIB)">Asia/Jakarta (UTC+7 / WIB)</option>
              <option value="Asia/Makassar (WITA)">Asia/Makassar (UTC+8 / WITA)</option>
              <option value="Asia/Jayapura (WIT)">Asia/Jayapura (UTC+9 / WIT)</option>
            </select>
          </div>
          <div className="pt-2">
            <Button type="submit" className="font-bold">
              Simpan Profil
            </Button>
          </div>
        </form>
      )}

      {tab === "Preferensi Trading" && (
        <form
          onSubmit={(e) => {
            void updateSession({ leverage: Number(leverage) || 500 });
            handleSaveGeneric(e, `Preferensi eksekusi & leverage 1:${leverage} telah diperbarui.`);
          }}
          className="max-w-3xl space-y-5 rounded-xl border border-border bg-card p-5 sm:p-7"
        >
          <h2 className="font-display text-lg font-bold">Parameter Eksekusi Default</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label htmlFor="pref-lot" className="text-sm font-medium">
                Lot Default
              </label>
              <Input
                id="pref-lot"
                type="number"
                step="0.01"
                value={defaultLot}
                onChange={(e) => setDefaultLot(e.target.value)}
                className="font-mono tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="pref-lev" className="text-sm font-medium">
                Leverage Akun
              </label>
              <select
                id="pref-lev"
                value={leverage}
                onChange={(e) => setLeverage(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm font-mono"
              >
                <option value="50">1:50</option>
                <option value="100">1:100</option>
                <option value="200">1:200</option>
                <option value="500">1:500</option>
                <option value="1000">1:1000</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="pref-slip" className="text-sm font-medium">
                Batas Slippage (Pip)
              </label>
              <Input
                id="pref-slip"
                type="number"
                min="0"
                max="20"
                value={slippageGuard}
                onChange={(e) => setSlippageGuard(e.target.value)}
                className="font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
            <div>
              <p className="text-sm font-medium">Trading Satu-Klik (One-Click Execution)</p>
              <p className="text-xs text-muted-foreground">
                Kirim order market secara langsung tanpa dialog konfirmasi tambahan.
              </p>
            </div>
            <Switch checked={oneClickTrade} onCheckedChange={setOneClickTrade} />
          </div>

          <Button type="submit" className="font-bold">
            Simpan Preferensi
          </Button>
        </form>
      )}

      {tab === "Keamanan" && (
        <div className="max-w-3xl space-y-6">
          <form
            onSubmit={(e) =>
              handleSaveGeneric(e, "Pengaturan kata sandi & keamanan 2FA diperbarui (FE).")
            }
            className="space-y-5 rounded-xl border border-border bg-card p-5 sm:p-7"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" />
              <h2 className="font-display text-lg font-bold">Autentikasi & Kata Sandi</h2>
            </div>

            <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
              <div>
                <p className="text-sm font-medium">Autentikasi Dua Faktor (2FA)</p>
                <p className="text-xs text-muted-foreground">
                  Wajibkan kode verifikasi tambahan saat masuk dari perangkat baru.
                </p>
              </div>
              <Switch checked={twoFactor} onCheckedChange={setTwoFactor} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="sec-pw" className="text-sm font-medium">
                  Kata Sandi Baru
                </label>
                <Input id="sec-pw" type="password" placeholder="Minimal 8 karakter" minLength={8} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="sec-pw2" className="text-sm font-medium">
                  Konfirmasi Kata Sandi
                </label>
                <Input
                  id="sec-pw2"
                  type="password"
                  placeholder="Ulangi kata sandi baru"
                  minLength={8}
                />
              </div>
            </div>
            <Button type="submit" className="font-bold">
              Perbarui Keamanan
            </Button>
          </form>

          <section className="rounded-xl border border-border bg-card p-5 sm:p-7">
            <h3 className="font-display text-base font-bold">Perangkat Aktif</h3>
            <div className="mt-4 divide-y divide-border">
              {sessions.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{s.device}</p>
                    <p className="text-xs text-muted-foreground">{s.status}</p>
                  </div>
                  {!s.active && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => revokeSession(s.id)}
                    >
                      Cabut Akses
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {tab === "Notifikasi" && (
        <form
          onSubmit={(e) => handleSaveGeneric(e, "Preferensi notifikasi berhasil disimpan.")}
          className="max-w-3xl space-y-5 rounded-xl border border-border bg-card p-5 sm:p-7"
        >
          <h2 className="font-display text-lg font-bold">Pengaturan Pemberitahuan</h2>
          <div className="divide-y divide-border">
            <div className="flex items-center justify-between gap-4 py-3.5">
              <div>
                <p className="text-sm font-medium">Konfirmasi Eksekusi & Margin</p>
                <p className="text-xs text-muted-foreground">
                  Kirim notifikasi setiap order terisi, TP/SL tersentuh, atau batas margin tercapai.
                </p>
              </div>
              <Switch checked={notifExecution} onCheckedChange={setNotifExecution} />
            </div>
            <div className="flex items-center justify-between gap-4 py-3.5">
              <div>
                <p className="text-sm font-medium">Pengingat Kalender Ekonomi & Akademi</p>
                <p className="text-xs text-muted-foreground">
                  Ingatkan 15 menit sebelum berita berdampak tinggi atau webinar dimulai.
                </p>
              </div>
              <Switch checked={notifCalendar} onCheckedChange={setNotifCalendar} />
            </div>
            <div className="flex items-center justify-between gap-4 py-3.5">
              <div>
                <p className="text-sm font-medium">Ringkasan Jurnal Mingguan</p>
                <p className="text-xs text-muted-foreground">
                  Kirim rekap metrik performa trading setiap hari Sabtu melalui email.
                </p>
              </div>
              <Switch checked={notifDigest} onCheckedChange={setNotifDigest} />
            </div>
          </div>
          <Button type="submit" className="font-bold">
            Simpan Notifikasi
          </Button>
        </form>
      )}
    </div>
  );
}
