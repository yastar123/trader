import { BriefcaseBusiness, Camera, Globe2, MessageCircle, Play } from "lucide-react";

const columns = [
  {
    title: "Perusahaan",
    links: ["Tentang Kami", "Karier", "Hubungi Kami", "Blog"],
  },
  {
    title: "Trading",
    links: ["Ringkasan Harga", "Spread & Komisi", "Jangkauan Pasar", "Metode Pembayaran"],
  },
  {
    title: "Platform",
    links: ["MetaTrader 4", "MetaTrader 5", "WebTrader", "Aplikasi Mobile"],
  },
  {
    title: "Dukungan",
    links: ["Pusat Bantuan", "FAQ", "Status Layanan", "Kebijakan Privasi"],
  },
];

const socials = [
  { icon: Globe2, label: "Facebook" },
  { icon: Camera, label: "Instagram" },
  { icon: Play, label: "YouTube" },
  { icon: MessageCircle, label: "X" },
  { icon: BriefcaseBusiness, label: "LinkedIn" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-card/40">
      <div className="container-page py-14">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_2fr]">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-md bg-primary">
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
              <span className="font-display text-2xl font-extrabold tracking-tight">IC</span>
            </div>
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              Trading Edge Anda — broker online untuk trading Forex & CFD dengan spread mulai 0.0
              pip*.
            </p>
            <div className="mt-5 flex gap-2.5">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href="#"
                  aria-label={s.label}
                  className="flex size-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                >
                  <s.icon className="size-4" />
                </a>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {columns.map((c) => (
              <div key={c.title}>
                <h4 className="text-sm font-bold">{c.title}</h4>
                <ul className="mt-4 space-y-2.5">
                  {c.links.map((l) => (
                    <li key={l}>
                      <a
                        href="#"
                        className="text-sm text-muted-foreground transition-colors hover:text-primary"
                      >
                        {l}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 border-t border-border/60 pt-8">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Peringatan Risiko: Perdagangan Forex dan CFD dengan margin memiliki risiko tinggi dan
            mungkin tidak cocok untuk semua investor. Konten situs ini disediakan hanya untuk tujuan
            demonstrasi desain dan bukan merupakan nasihat investasi maupun ajakan untuk
            bertransaksi. *Spread mulai 0.0 pip tersedia pada akun Raw Spread selama jam pasar
            normal dan dapat berubah sewaktu-waktu.
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            © {new Date().getFullYear()} IC. Halaman ini adalah tiruan desain untuk keperluan
            pengembangan dan tidak berafiliasi dengan IC Markets Global.
          </p>
        </div>
      </div>
    </footer>
  );
}
