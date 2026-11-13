import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowUpRight, MessageSquare, Send, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataPagination, usePagination } from "@/components/ui/data-pagination";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useDemoSession } from "@/lib/fe-session";
import { cn } from "@/lib/utils";

type CategoryType = "Analisis Teknikal" | "Setup Trading" | "Diskusi Pasar";

type CommunityPost = {
  id: string;
  author: string;
  pair: string;
  bias: "Bullish" | "Bearish" | "Netral";
  category: CategoryType;
  timeAgo: string;
  title: string;
  content: string;
  likes: number;
  likedByMe: boolean;
  comments: { id: string; author: string; text: string; time: string }[];
};

const initialPosts: CommunityPost[] = [
  {
    id: "POST-1",
    author: "Arif Wijaya",
    pair: "XAUUSD",
    bias: "Bullish",
    category: "Analisis Teknikal",
    timeAgo: "18 menit lalu",
    title: "Struktur Ascending Channel H4 Menjelang Rilis CPI AS",
    content:
      "Selama harga bertahan di atas area permintaan 2665, peluang kelanjutan menuju 2705 tetap terbuka. Disarankan menunggu konfirmasi penutupan candle H1 setelah rilis data.",
    likes: 24,
    likedByMe: false,
    comments: [
      {
        id: "CMT-1",
        author: "Sinta Dewi",
        text: "Setuju, area 2665 juga sejajar dengan Fibonacci 0.618 dari ayunan kemarin.",
        time: "10 menit lalu",
      },
    ],
  },
  {
    id: "POST-2",
    author: "Kevin Hartono",
    pair: "EURUSD",
    bias: "Netral",
    category: "Setup Trading",
    timeAgo: "1 jam lalu",
    title: "Rentang Konsolidasi 1.0800 - 1.0865 di Sesi Eropa",
    content:
      "Spread Raw terpantau sangat rapat pagi ini (0.0-0.1 pip). Fokus saya hanya mengambil breakout bersih dengan rasio risiko berbanding imbalan minimal 1:2.",
    likes: 15,
    likedByMe: true,
    comments: [],
  },
  {
    id: "POST-3",
    author: "Nadia Kusuma",
    pair: "GBPUSD",
    bias: "Bearish",
    category: "Diskusi Pasar",
    timeAgo: "3 jam lalu",
    title: "Tekanan Jual Pasca Data Pertumbuhan Inggris Q3",
    content:
      "Respons pasar terhadap angka PDB masih cenderung berhati-hati. Mengamati apakah area 1.2940 mampu menahan tekanan jual sebelum sesi New York dibuka.",
    likes: 31,
    likedByMe: false,
    comments: [],
  },
];

const contributors = [
  { name: "Arif Wijaya", focus: "XAUUSD · EURUSD", ideas: 42, winRate: "68%" },
  { name: "Nadia Kusuma", focus: "GBPUSD · Macro", ideas: 36, winRate: "64%" },
  { name: "Kevin Hartono", focus: "Scalping FX", ideas: 29, winRate: "61%" },
  { name: "Sinta Dewi", focus: "Swing Indeks", ideas: 21, winRate: "65%" },
];

export function KomunitasView() {
  const { session } = useDemoSession();
  const [posts, setPosts] = useState<CommunityPost[]>(initialPosts);
  const [category, setCategory] = useState<"Semua" | CategoryType>("Semua");
  const [newTitle, setNewTitle] = useState("");
  const [newPair, setNewPair] = useState("EURUSD");
  const [newBias, setNewBias] = useState<"Bullish" | "Bearish" | "Netral">("Bullish");
  const [newCategory, setNewCategory] = useState<CategoryType>("Analisis Teknikal");
  const [newContent, setNewContent] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({ "POST-1": true });

  useEffect(() => {
    void fetch("/api/community")
      .then((res) => (res.ok ? (res.json() as Promise<CommunityPost[]>) : null))
      .then((data) => {
        if (Array.isArray(data)) setPosts(data);
      })
      .catch(() => {});
  }, []);

  const filteredPosts = useMemo(
    () => posts.filter((p) => category === "Semua" || p.category === category),
    [posts, category],
  );
  const postsPagination = usePagination(filteredPosts, 3);

  async function handleCreatePost(e: FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;
    const payload = {
      author: session.name,
      pair: newPair.trim().toUpperCase() || "EURUSD",
      bias: newBias,
      category: newCategory,
      title: newTitle.trim(),
      content: newContent.trim(),
    };
    try {
      const res = await fetch("/api/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const created = (await res.json()) as CommunityPost;
        setPosts((prev) => [created, ...prev]);
        setNewTitle("");
        setNewContent("");
        return;
      }
    } catch {
      // Fallback
    }

    const created: CommunityPost = {
      id: `POST-${Date.now()}`,
      ...payload,
      timeAgo: "Baru saja",
      likes: 1,
      likedByMe: true,
      comments: [],
    };
    setPosts((prev) => [created, ...prev]);
    setNewTitle("");
    setNewContent("");
  }

  function toggleLike(id: string) {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, likedByMe: !p.likedByMe, likes: p.likedByMe ? p.likes - 1 : p.likes + 1 }
          : p,
      ),
    );
    void fetch(`/api/community/${id}/like`, { method: "POST" }).catch(() => {});
  }

  function handleAddReply(postId: string, e: FormEvent) {
    e.preventDefault();
    const text = (replyDrafts[postId] ?? "").trim();
    if (!text) return;
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              comments: [
                ...p.comments,
                { id: `CMT-${Date.now()}`, author: session.name, text, time: "Baru saja" },
              ],
            }
          : p,
      ),
    );
    setReplyDrafts((prev) => ({ ...prev, [postId]: "" }));
    setOpenComments((prev) => ({ ...prev, [postId]: true }));
    void fetch(`/api/community/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: session.name, text }),
    }).catch(() => {});
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-5">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Komunitas Trader
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Berbagi analisis teknikal, ide setup pasar, dan diskusi manajemen risiko bersama sesama
          trader wmTrader
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Main Feed */}
        <div className="space-y-6 lg:col-span-8">
          {/* Composer */}
          <form
            onSubmit={handleCreatePost}
            className="space-y-4 rounded-xl border border-border bg-card p-5"
          >
            <h2 className="font-display text-base font-bold">Bagikan Ide atau Analisis Baru</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                placeholder="Judul analisis singkat..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="sm:col-span-3"
                required
              />
              <Input
                placeholder="Simbol (EURUSD)"
                value={newPair}
                onChange={(e) => setNewPair(e.target.value)}
              />
              <select
                aria-label="Bias pasar"
                value={newBias}
                onChange={(e) => setNewBias(e.target.value as "Bullish" | "Bearish" | "Netral")}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="Bullish">Bias: Bullish</option>
                <option value="Bearish">Bias: Bearish</option>
                <option value="Netral">Bias: Netral</option>
              </select>
              <select
                aria-label="Kategori diskusi"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as CategoryType)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="Analisis Teknikal">Analisis Teknikal</option>
                <option value="Setup Trading">Setup Trading</option>
                <option value="Diskusi Pasar">Diskusi Pasar</option>
              </select>
            </div>
            <Textarea
              rows={3}
              placeholder="Tuliskan level harga kunci, alasan fundamental/teknikal, dan skenario risiko..."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              required
            />
            <div className="flex justify-end">
              <Button type="submit" className="gap-2 font-bold">
                <Send className="size-4" />
                <span>Publikasikan Ide</span>
              </Button>
            </div>
          </form>

          {/* Category Filter */}
          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-card p-1 sm:w-fit">
            {(["Semua", "Analisis Teknikal", "Setup Trading", "Diskusi Pasar"] as const).map(
              (cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors",
                    category === cat
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {cat}
                </button>
              ),
            )}
          </div>

          {/* Posts */}
          <div className="space-y-4">
            {postsPagination.paginatedItems.map((post) => {
              const showComments = Boolean(openComments[post.id]);
              return (
                <article
                  key={post.id}
                  className="rounded-xl border border-border bg-card p-5 sm:p-6"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground">{post.author}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono font-bold text-primary">{post.pair}</span>
                      <span aria-hidden="true">·</span>
                      <span>{post.bias}</span>
                      <span aria-hidden="true">·</span>
                      <span>{post.category}</span>
                    </div>
                    <span className="font-mono tabular-nums">{post.timeAgo}</span>
                  </div>

                  <h3 className="mt-3 font-display text-lg font-bold text-foreground">
                    {post.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{post.content}</p>

                  <div className="mt-4 flex items-center gap-4 border-t border-border/70 pt-3">
                    <button
                      type="button"
                      onClick={() => toggleLike(post.id)}
                      className={cn(
                        "inline-flex items-center gap-1.5 text-xs font-semibold transition-colors",
                        post.likedByMe
                          ? "text-primary"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <ThumbsUp className="size-3.5" />
                      <span className="font-mono tabular-nums">{post.likes}</span>
                      <span>Dukung</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setOpenComments((prev) => ({ ...prev, [post.id]: !prev[post.id] }))
                      }
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <MessageSquare className="size-3.5" />
                      <span className="font-mono tabular-nums">{post.comments.length}</span>
                      <span>Komentar</span>
                    </button>
                  </div>

                  {showComments && (
                    <div className="mt-4 space-y-3 border-t border-border/70 pt-4">
                      {post.comments.map((cmt) => (
                        <div key={cmt.id} className="space-y-1 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">{cmt.author}</span>
                            <span className="text-muted-foreground">· {cmt.time}</span>
                          </div>
                          <p className="text-muted-foreground">{cmt.text}</p>
                        </div>
                      ))}

                      <form
                        onSubmit={(e) => handleAddReply(post.id, e)}
                        className="flex items-center gap-2 pt-1"
                      >
                        <Input
                          placeholder="Tulis tanggapan Anda..."
                          value={replyDrafts[post.id] ?? ""}
                          onChange={(e) =>
                            setReplyDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))
                          }
                          className="h-9 text-xs"
                        />
                        <Button type="submit" size="sm" variant="outline">
                          Kirim
                        </Button>
                      </form>
                    </div>
                  )}
                </article>
              );
            })}
            <DataPagination
              page={postsPagination.page}
              totalPages={postsPagination.totalPages}
              totalItems={postsPagination.totalItems}
              startItem={postsPagination.startItem}
              endItem={postsPagination.endItem}
              pageSize={postsPagination.pageSize}
              onPageChange={postsPagination.setPage}
              onPageSizeChange={postsPagination.setPageSize}
              pageSizeOptions={[3, 6, 10]}
            />
          </div>
        </div>

        {/* Right Sidebar */}
        <aside className="space-y-6 lg:col-span-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-base font-bold">Sentimen Komunitas Hari Ini</h2>
            <div className="mt-4 space-y-4 text-xs">
              {[
                { pair: "XAUUSD", buy: 72, sell: 28 },
                { pair: "EURUSD", buy: 58, sell: 42 },
                { pair: "GBPUSD", buy: 41, sell: 59 },
              ].map((s) => (
                <div key={s.pair} className="space-y-1.5">
                  <div className="flex justify-between font-mono tabular-nums">
                    <span className="font-bold text-foreground">{s.pair}</span>
                    <span className="text-muted-foreground">
                      Buy {s.buy}% / Sell {s.sell}%
                    </span>
                  </div>
                  <div className="flex h-2 overflow-hidden rounded-full bg-destructive/70">
                    <div className="bg-primary" style={{ width: `${s.buy}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-base font-bold">Kontributor Teraktif</h2>
            <div className="mt-4 divide-y divide-border/70">
              {contributors.map((c) => (
                <div key={c.name} className="flex items-center justify-between gap-3 py-3 text-xs">
                  <div>
                    <p className="font-semibold text-foreground">{c.name}</p>
                    <p className="text-muted-foreground">{c.focus}</p>
                  </div>
                  <div className="text-right font-mono tabular-nums">
                    <p className="inline-flex items-center gap-0.5 font-bold text-primary">
                      <ArrowUpRight className="size-3" />
                      {c.winRate}
                    </p>
                    <p className="text-muted-foreground">{c.ideas} ide</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
