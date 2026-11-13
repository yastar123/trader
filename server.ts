import express, { type NextFunction, type Request, type Response } from "express";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { db, getStorageStatus, initDatabase, runMarketTickCycle } from "./src/server/db.ts";
import {
  computePositionFloatingPnl,
  generateSeedCandles,
  memoryStore,
  USD_TO_IDR_RATE,
  type CommunityPostRecord,
  type InboxMessage,
  type JournalRecord,
  type MarketCategory,
  type MarketInstrumentRecord,
  type TradePosition,
  type TrendBias,
  type UserProfile,
} from "./src/server/store.ts";

function sanitizePositionForUser(pos: TradePosition, defaultProfitPercent?: number) {
  const { adminProfitUsd: _hidden, ...safe } = pos;
  const market = memoryStore.markets.find((m) => m.symbol === pos.symbol);
  const livePnl = computePositionFloatingPnl(pos, market, Date.now(), defaultProfitPercent);
  return {
    ...safe,
    livePnl,
  };
}

// Load .env into process.env using Node 22 built-in loader if present
try {
  if (typeof process.loadEnvFile === "function" && fs.existsSync(".env")) {
    process.loadEnvFile(".env");
  }
} catch {
  // Ignore if .env is not readable
}

const PORT = Number(process.env.PORT) || 3010;
const HOST = "0.0.0.0";
const ADMIN_COOKIE_NAME = "ic_admin_session";

function parseCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

async function getAdminEmailFromCookie(req: Request): Promise<string | undefined> {
  const token = parseCookie(req.headers.cookie, ADMIN_COOKIE_NAME);
  return db.getAdminEmailByToken(token);
}

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const adminEmail = await getAdminEmailFromCookie(req);
  if (!adminEmail) {
    return res.status(401).json({ error: "Akses admin memerlukan login terlebih dahulu." });
  }
  res.locals["adminEmail"] = adminEmail;
  return next();
}

function createApiRouter() {
  const api = express.Router();
  api.use(express.json({ limit: "10mb" }));

  api.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      port: PORT,
      ...getStorageStatus(),
    });
  });

  // Trader Session & Profile (PostgreSQL-backed)
  api.get("/session", async (_req: Request, res: Response) => {
    const session = await db.getSession();
    res.json(session);
  });

  api.post("/auth/login", async (req: Request, res: Response) => {
    const body = req.body as { email?: string; name?: string };
    const email = body.email?.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Masukkan alamat email yang valid." });
    }
    const session = await db.loginOrRegisterTrader({
      email,
      name: body.name,
      isRegister: false,
    });
    return res.json(session);
  });

  api.post("/auth/register", async (req: Request, res: Response) => {
    const body = req.body as { email?: string; name?: string };
    const email = body.email?.trim().toLowerCase();
    const name = body.name?.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Masukkan alamat email yang valid." });
    }
    if (!name) {
      return res.status(400).json({ error: "Nama lengkap wajib diisi." });
    }
    const session = await db.loginOrRegisterTrader({
      email,
      name,
      isRegister: true,
    });
    return res.status(201).json(session);
  });

  api.post("/auth/logout", async (_req: Request, res: Response) => {
    await db.logoutTrader();
    res.json({ ok: true });
  });

  api.put("/profile", async (req: Request, res: Response) => {
    const body = req.body as Partial<UserProfile>;
    const updated = await db.updateProfile(body);
    res.json(updated);
  });

  // Live Markets for Traders
  api.get("/markets", async (_req: Request, res: Response) => {
    const markets = await db.getEnabledMarkets();
    res.json(markets);
  });

  // Trader Wallet (Deposit & Withdraw requests awaiting manual admin verification)
  api.get("/wallet/transactions", async (_req: Request, res: Response) => {
    const tx = await db.getWalletTransactions();
    res.json(tx);
  });

  api.get("/wallet/limits", async (_req: Request, res: Response) => {
    const limits = await db.getWalletLimits();
    res.json(limits);
  });

  api.get("/wallet/deposit-methods", async (_req: Request, res: Response) => {
    const methods = await db.getDepositMethods(false);
    res.json(methods);
  });

  api.post("/wallet/deposit", async (req: Request, res: Response) => {
    const userId = await db.getCurrentTraderId();
    if (!userId) return res.status(401).json({ error: "Silakan masuk untuk mengajukan deposit." });
    const body = req.body as {
      amount?: number;
      amountIdr?: number;
      method?: string;
      reference?: string;
      proofImage?: string;
      proofFileName?: string;
    };
    const limits = await db.getWalletLimits();
    const method = body.method?.trim();
    const reference = body.reference?.trim() ?? "";
    const depositMethods = await db.getDepositMethods(false);
    if (!method || !depositMethods.some((item) => item.label === method)) {
      return res.status(400).json({ error: "Pilih metode deposit aktif yang tersedia." });
    }
    const hasAmountIdr = body.amountIdr !== undefined && body.amountIdr !== null;
    const rawIdr = hasAmountIdr ? Number(body.amountIdr) : Number.NaN;
    const amountUsd = hasAmountIdr
      ? Number((rawIdr / USD_TO_IDR_RATE).toFixed(2))
      : Number(body.amount);
    const amountIdr = hasAmountIdr
      ? Math.round(rawIdr)
      : Math.round((Number.isFinite(amountUsd) ? amountUsd : 0) * USD_TO_IDR_RATE);

    const minIdr = Math.round(limits.minDeposit * USD_TO_IDR_RATE);
    const maxIdr = Math.round(limits.maxDeposit * USD_TO_IDR_RATE);

    if (!Number.isFinite(amountUsd) || amountUsd < limits.minDeposit) {
      return res.status(400).json({
        error: `Nominal deposit minimal Rp ${minIdr.toLocaleString("id-ID")} ($${limits.minDeposit.toLocaleString(
          "en-US",
          {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          },
        )} USD).`,
      });
    }
    if (amountUsd > limits.maxDeposit) {
      return res.status(400).json({
        error: `Nominal deposit maksimal Rp ${maxIdr.toLocaleString("id-ID")} ($${limits.maxDeposit.toLocaleString(
          "en-US",
          {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          },
        )} USD) per transaksi.`,
      });
    }
    const proofImage = typeof body.proofImage === "string" ? body.proofImage.trim() : "";
    if (!proofImage || !proofImage.startsWith("data:image/")) {
      return res.status(400).json({
        error: "Mohon unggah bukti transfer berupa gambar atau screenshot (PNG/JPG/WebP).",
      });
    }
    if (proofImage.length > 8 * 1024 * 1024) {
      return res.status(400).json({
        error: "Ukuran gambar bukti transfer terlalu besar (maksimal 5 MB).",
      });
    }

    const created = await db.createDeposit({
      amount: amountUsd,
      amountIdr,
      exchangeRate: USD_TO_IDR_RATE,
      method,
      reference,
      proofImage,
      proofFileName: body.proofFileName?.trim() || "",
    });
    return res.status(201).json(created);
  });

  api.post("/wallet/withdraw", async (req: Request, res: Response) => {
    const userId = await db.getCurrentTraderId();
    if (!userId)
      return res.status(401).json({ error: "Silakan masuk untuk mengajukan penarikan." });
    const body = req.body as { amount?: number; destination?: string };
    const limits = await db.getWalletLimits();
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount < limits.minWithdraw) {
      return res.status(400).json({
        error: `Nominal penarikan minimal $${limits.minWithdraw.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}.`,
      });
    }
    if (amount > limits.maxWithdraw) {
      return res.status(400).json({
        error: `Nominal penarikan maksimal $${limits.maxWithdraw.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} per transaksi.`,
      });
    }
    const destination = body.destination?.trim();
    if (!destination) {
      return res.status(400).json({ error: "Rekening atau tujuan penarikan wajib diisi." });
    }
    const result = await db.createWithdraw({
      amount,
      destination,
    });
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    return res.status(201).json(result.withdrawal);
  });

  // Trading Rules & Daily Quota Summary for Traders (hides admin profit config)
  api.get("/trading-rules", async (_req: Request, res: Response) => {
    const summary = await db.getTraderTradingSummary();
    res.json({
      rules: {
        maxDailyPositions: summary.rules.maxDailyPositions,
        minCloseMinutes: summary.rules.minCloseMinutes,
      },
      todayOpenCount: summary.todayOpenCount,
      todayDate: summary.todayDate,
    });
  });

  // Trade Positions (server-computed livePnl; hides adminProfitUsd)
  api.get("/positions", async (_req: Request, res: Response) => {
    const [positions, rules] = await Promise.all([db.getUserPositions(), db.getTradingRules()]);
    res.json(positions.map((pos) => sanitizePositionForUser(pos, rules.defaultProfitPercent)));
  });

  api.post("/positions", async (req: Request, res: Response) => {
    const body = req.body as Partial<TradePosition> & { stakeUsd?: number; amountIdr?: number };
    const result = await db.createPosition(body);
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    const rules = await db.getTradingRules();
    return res
      .status(201)
      .json(sanitizePositionForUser(result.position!, rules.defaultProfitPercent));
  });

  api.patch("/positions/:id/activate", async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const updated = await db.activatePosition(id);
    if (!updated) return res.status(404).json({ error: "Order tidak ditemukan" });
    const rules = await db.getTradingRules();
    return res.json(sanitizePositionForUser(updated, rules.defaultProfitPercent));
  });

  api.patch("/positions/:id/close", async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const body = (req.body ?? {}) as { pnl?: number };
    const result = await db.closePosition(id, body.pnl);
    if (!result) return res.status(404).json({ error: "Posisi tidak ditemukan" });
    if (result.error) {
      return res.status(result.status ?? 400).json({
        error: result.error,
        unlockAtMs: result.unlockAtMs,
      });
    }
    const rules = await db.getTradingRules();
    return res.json({
      position: result.position
        ? sanitizePositionForUser(result.position, rules.defaultProfitPercent)
        : undefined,
      balance: result.balance,
    });
  });

  // Journal
  api.get("/journal", async (_req: Request, res: Response) => {
    const entries = await db.getJournal();
    res.json(entries);
  });

  api.post("/journal", async (req: Request, res: Response) => {
    const body = req.body as Partial<JournalRecord>;
    const userId = await db.getCurrentTraderId();
    if (!userId) return res.status(401).json({ error: "Silakan masuk untuk mencatat jurnal." });
    if (
      !body.symbol?.trim() ||
      !body.entry?.trim() ||
      !body.exit?.trim() ||
      !Number.isFinite(Number(body.lot)) ||
      Number(body.lot) <= 0 ||
      !Number.isFinite(Number(body.pnl)) ||
      !body.strategy
    ) {
      return res.status(400).json({ error: "Lengkapi instrumen, harga, lot, P&L, dan strategi." });
    }
    const created = await db.createJournal(body);
    return res.status(201).json(created);
  });

  api.delete("/journal/:id", async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    await db.deleteJournal(id);
    res.json({ ok: true });
  });

  // Inbox Messages
  api.get("/messages", async (_req: Request, res: Response) => {
    const userId = await db.getCurrentTraderId();
    if (!userId) return res.status(401).json({ error: "Silakan masuk untuk melihat kotak surat." });
    const msgs = await db.getMessagesForUser(userId);
    return res.json(msgs);
  });

  api.post("/messages", async (req: Request, res: Response) => {
    const body = req.body as { subject?: string; body?: string };
    const userId = await db.getCurrentTraderId();
    if (!userId) return res.status(401).json({ error: "Silakan masuk untuk mengirim pesan." });
    if (!body.subject?.trim() || !body.body?.trim()) {
      return res.status(400).json({ error: "Subjek dan isi pesan wajib diisi." });
    }
    const created = await db.createMessage(body, userId);
    return res.status(201).json(created);
  });

  api.patch("/messages/:id", async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const patch = req.body as Partial<Pick<InboxMessage, "unread" | "archived">>;
    const userId = await db.getCurrentTraderId();
    if (!userId) return res.status(401).json({ error: "Silakan masuk untuk mengubah pesan." });
    const updated = await db.updateMessageForUser(id, userId, patch);
    if (!updated) return res.status(404).json({ error: "Pesan tidak ditemukan" });
    return res.json(updated);
  });

  api.delete("/messages/:id", async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const userId = await db.getCurrentTraderId();
    if (!userId) return res.status(401).json({ error: "Silakan masuk untuk menghapus pesan." });
    const deleted = await db.deleteMessageForUser(id, userId);
    if (!deleted) return res.status(404).json({ error: "Pesan tidak ditemukan" });
    return res.json({ ok: true });
  });

  // Community
  api.get("/community", async (_req: Request, res: Response) => {
    const posts = await db.getCommunityPosts();
    res.json(posts);
  });

  api.post("/community", async (req: Request, res: Response) => {
    const body = req.body as Partial<CommunityPostRecord>;
    const userId = await db.getCurrentTraderId();
    if (!userId) return res.status(401).json({ error: "Silakan masuk untuk mempublikasikan ide." });
    if (!body.pair?.trim() || !body.title?.trim() || !body.content?.trim()) {
      return res.status(400).json({ error: "Instrumen, judul, dan isi ide wajib diisi." });
    }
    const created = await db.createCommunityPost(body);
    return res.status(201).json(created);
  });

  api.post("/community/:id/like", async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const updated = await db.toggleCommunityLike(id);
    if (!updated) return res.status(404).json({ error: "Post tidak ditemukan" });
    return res.json(updated);
  });

  api.post("/community/:id/comments", async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const body = req.body as { author?: string; text?: string };
    const text = body.text?.trim();
    if (!text) return res.status(400).json({ error: "Komentar wajib diisi" });
    const updated = await db.addCommunityComment(
      id,
      body.author ? { author: body.author, text } : { text },
    );
    if (!updated) return res.status(404).json({ error: "Post tidak ditemukan" });
    return res.status(201).json(updated);
  });

  // ---------------- ADMIN AUTH & PORTAL ROUTES ----------------

  api.get("/admin/session", async (req: Request, res: Response) => {
    const email = await getAdminEmailFromCookie(req);
    res.json({
      authenticated: Boolean(email),
      email: email ?? null,
    });
  });

  api.post("/admin/login", async (req: Request, res: Response) => {
    const body = req.body as { email?: string; password?: string };
    const expectedEmail = process.env["ADMIN_EMAIL"]?.trim();
    const expectedPassword = process.env["ADMIN_PASSWORD"];

    if (!expectedEmail || !expectedPassword) {
      return res
        .status(500)
        .json({ error: "Kredensial admin belum dikonfigurasi pada environment (.env)." });
    }

    const email = body.email?.trim() ?? "";
    const password = body.password ?? "";
    if (email !== expectedEmail || password !== expectedPassword) {
      return res.status(401).json({ error: "Email atau kata sandi admin tidak sesuai." });
    }

    const token = await db.createAdminSession(expectedEmail);
    res.setHeader(
      "Set-Cookie",
      `${ADMIN_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax`,
    );
    return res.json({ authenticated: true, email: expectedEmail });
  });

  api.post("/admin/logout", async (req: Request, res: Response) => {
    const token = parseCookie(req.headers.cookie, ADMIN_COOKIE_NAME);
    await db.deleteAdminSession(token);
    res.setHeader("Set-Cookie", `${ADMIN_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    res.json({ ok: true });
  });

  api.get("/admin/overview", requireAdmin, async (_req: Request, res: Response) => {
    const overview = await db.getAdminOverview();
    res.json(overview);
  });

  api.get("/admin/deposits", requireAdmin, async (_req: Request, res: Response) => {
    const deposits = await db.getAdminDeposits();
    res.json(deposits);
  });

  api.delete("/admin/deposits/:id", requireAdmin, async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const adminEmail = String(res.locals["adminEmail"] ?? "admin");
    const deleted = await db.deleteAdminDeposit(id, adminEmail);
    if (!deleted) return res.status(404).json({ error: "Permintaan deposit tidak ditemukan." });
    return res.json({ ok: true });
  });

  api.patch("/admin/deposits/:id", requireAdmin, async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const body = req.body as { decision?: "approve" | "reject"; note?: string };
    const adminEmail = String(res.locals["adminEmail"] ?? "admin");
    const result = await db.reviewDeposit({
      id,
      decision: body.decision === "approve" ? "approve" : "reject",
      note: body.note,
      adminEmail,
    });
    if (result.error) {
      return res.status(result.status ?? 400).json({ error: result.error });
    }
    return res.json(result.deposit);
  });

  api.get("/admin/withdrawals", requireAdmin, async (_req: Request, res: Response) => {
    const withdrawals = await db.getAdminWithdrawals();
    res.json(withdrawals);
  });

  api.delete("/admin/withdrawals/:id", requireAdmin, async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const adminEmail = String(res.locals["adminEmail"] ?? "admin");
    const deleted = await db.deleteAdminWithdrawal(id, adminEmail);
    if (!deleted) return res.status(404).json({ error: "Permintaan withdraw tidak ditemukan." });
    return res.json({ ok: true });
  });

  api.patch("/admin/withdrawals/:id", requireAdmin, async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const body = req.body as { decision?: "approve" | "reject"; note?: string };
    const adminEmail = String(res.locals["adminEmail"] ?? "admin");
    const result = await db.reviewWithdraw({
      id,
      decision: body.decision === "approve" ? "approve" : "reject",
      note: body.note,
      adminEmail,
    });
    if (result.error) {
      return res.status(result.status ?? 400).json({ error: result.error });
    }
    return res.json(result.withdrawal);
  });

  api.get("/admin/wallet-limits", requireAdmin, async (_req: Request, res: Response) => {
    const limits = await db.getWalletLimits();
    res.json(limits);
  });

  api.put("/admin/wallet-limits", requireAdmin, async (req: Request, res: Response) => {
    const body = req.body as Partial<{
      minDeposit: number;
      maxDeposit: number;
      minWithdraw: number;
      maxWithdraw: number;
    }>;
    const adminEmail = String(res.locals["adminEmail"] ?? "admin");
    const result = await db.updateWalletLimits(
      {
        minDeposit: body.minDeposit !== undefined ? Number(body.minDeposit) : undefined,
        maxDeposit: body.maxDeposit !== undefined ? Number(body.maxDeposit) : undefined,
        minWithdraw: body.minWithdraw !== undefined ? Number(body.minWithdraw) : undefined,
        maxWithdraw: body.maxWithdraw !== undefined ? Number(body.maxWithdraw) : undefined,
      },
      adminEmail,
    );
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    return res.json(result.limits);
  });

  // Admin Deposit Payment Methods & Transfer Instructions (CRUD)
  api.get("/admin/deposit-methods", requireAdmin, async (_req: Request, res: Response) => {
    const methods = await db.getDepositMethods(true);
    res.json(methods);
  });

  api.post("/admin/deposit-methods", requireAdmin, async (req: Request, res: Response) => {
    const body = req.body as Partial<{
      label: string;
      accountInfo: string;
      accountHolder: string;
      fee: string;
      eta: string;
      enabled: boolean;
    }>;
    const adminEmail = String(res.locals["adminEmail"] ?? "admin");
    const result = await db.createDepositMethod(
      {
        label: body.label ?? "",
        accountInfo: body.accountInfo ?? "",
        accountHolder: body.accountHolder ?? "",
        fee: body.fee ?? "Gratis (0%)",
        eta: body.eta ?? "5–15 menit setelah verifikasi admin",
        enabled: body.enabled ?? true,
      },
      adminEmail,
    );
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    return res.status(201).json(result.method);
  });

  api.patch("/admin/deposit-methods/:id", requireAdmin, async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const body = req.body as Partial<{
      label: string;
      accountInfo: string;
      accountHolder: string;
      fee: string;
      eta: string;
      enabled: boolean;
    }>;
    const adminEmail = String(res.locals["adminEmail"] ?? "admin");
    const result = await db.updateDepositMethod(id, body, adminEmail);
    if (result.error) {
      return res.status(404).json({ error: result.error });
    }
    return res.json(result.method);
  });

  api.delete("/admin/deposit-methods/:id", requireAdmin, async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const adminEmail = String(res.locals["adminEmail"] ?? "admin");
    const result = await db.deleteDepositMethod(id, adminEmail);
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    return res.json({ ok: true });
  });

  api.get("/admin/users", requireAdmin, async (_req: Request, res: Response) => {
    const users = await db.getAdminUsers();
    res.json(users);
  });

  api.get("/admin/messages", requireAdmin, async (_req: Request, res: Response) => {
    const messages = await db.getAdminMessages();
    res.json(messages);
  });

  api.post("/admin/messages", requireAdmin, async (req: Request, res: Response) => {
    const body = req.body as {
      recipientUserId?: unknown;
      subject?: unknown;
      body?: unknown;
      category?: unknown;
    };
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const messageBody = typeof body.body === "string" ? body.body.trim() : "";
    const category = body.category;
    const validCategories: InboxMessage["category"][] = [
      "Peringatan Pasar",
      "Sistem & Akun",
      "Dukungan",
    ];
    if (!subject || !messageBody) {
      return res.status(400).json({ error: "Subjek dan isi surat wajib diisi." });
    }
    if (subject.length > 200 || messageBody.length > 10000) {
      return res.status(400).json({ error: "Subjek atau isi surat melebihi batas panjang." });
    }
    if (
      typeof category !== "string" ||
      !validCategories.includes(category as InboxMessage["category"])
    ) {
      return res.status(400).json({ error: "Kategori surat tidak valid." });
    }
    const recipientUserId =
      body.recipientUserId === "all"
        ? null
        : typeof body.recipientUserId === "string" && body.recipientUserId.trim()
          ? body.recipientUserId.trim()
          : undefined;
    if (recipientUserId === undefined) {
      return res.status(400).json({ error: "Pilih satu pengguna atau semua pengguna." });
    }
    const result = await db.sendAdminMessage({
      recipientUserId,
      subject,
      body: messageBody,
      category: category as InboxMessage["category"],
      adminEmail: String(res.locals["adminEmail"] ?? "admin"),
    });
    if (result.error) return res.status(404).json({ error: result.error });
    return res.status(201).json(result.messages);
  });

  api.delete("/admin/users/:id", requireAdmin, async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const adminEmail = String(res.locals["adminEmail"] ?? "admin");
    const deleted = await db.deleteAdminUser(id, adminEmail);
    if (!deleted) return res.status(404).json({ error: "Pengguna tidak ditemukan." });
    return res.json({ ok: true });
  });

  api.patch("/admin/users/:id", requireAdmin, async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const body = req.body as Partial<{
      status: "Aktif" | "Ditangguhkan";
      kycStatus: "Terverifikasi" | "Menunggu";
      accountType: "Raw Spread" | "Standard";
    }>;
    const adminEmail = String(res.locals["adminEmail"] ?? "admin");
    const updated = await db.updateAdminUser({
      id,
      status: body.status,
      kycStatus: body.kycStatus,
      accountType: body.accountType,
      adminEmail,
    });
    if (!updated) return res.status(404).json({ error: "Pengguna tidak ditemukan." });
    return res.json(updated);
  });

  api.get("/admin/audit", requireAdmin, async (_req: Request, res: Response) => {
    const logs = await db.getAdminAudit();
    res.json(logs);
  });

  // Admin Market & Chart Direction Control (CRUD)
  api.get("/admin/markets", requireAdmin, async (_req: Request, res: Response) => {
    const markets = await db.getAllMarkets();
    res.json(markets);
  });

  api.post("/admin/markets", requireAdmin, async (req: Request, res: Response) => {
    const body = req.body as Partial<{
      symbol: string;
      name: string;
      category: MarketCategory;
      basePrice: number;
      spreadValue: number;
      pipSize: number;
      tickStep: number;
      decimals: number;
      contractSize: number;
      quoteInJpy: boolean;
      trendBias: TrendBias;
      trendStrength: 1 | 2 | 3;
      enabled: boolean;
    }>;
    const adminEmail = String(res.locals["adminEmail"] ?? "admin");
    const symbol = (body.symbol ?? "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");
    if (!symbol || symbol.length < 3) {
      return res
        .status(400)
        .json({ error: "Simbol instrumen minimal 3 karakter (mis. ETHUSD, USOIL)." });
    }

    const decimals = Math.max(0, Math.min(5, Number(body.decimals ?? 2)));
    const basePrice = Number(body.basePrice);
    if (!Number.isFinite(basePrice) || basePrice <= 0) {
      return res.status(400).json({ error: "Harga awal harus lebih besar dari 0." });
    }
    const pipSize = Math.max(0.00001, Number(body.pipSize) || 0.01);
    const spreadValue = Math.max(0, Number(body.spreadValue) || pipSize * 2);
    const tickStep = Math.max(0.00001, Number(body.tickStep) || pipSize * 1.5);
    const contractSize = Math.max(1, Number(body.contractSize) || 100);
    const spreadPips = pipSize > 0 ? (spreadValue / pipSize).toFixed(1) : "0.0";
    const candles = generateSeedCandles(basePrice, tickStep, decimals);

    const created: MarketInstrumentRecord = {
      symbol,
      name: body.name?.trim() || symbol,
      category: body.category ?? "Kripto / Coin",
      basePrice,
      bid: Number(basePrice.toFixed(decimals)),
      ask: Number((basePrice + spreadValue).toFixed(decimals)),
      prevBid: Number(basePrice.toFixed(decimals)),
      openDay: candles[0]?.open ?? basePrice,
      spreadValue,
      spreadLabel: spreadPips,
      pipSize,
      tickStep,
      decimals,
      contractSize,
      quoteInJpy: Boolean(body.quoteInJpy),
      trendBias: body.trendBias ?? "Netral",
      trendStrength: body.trendStrength === 1 || body.trendStrength === 3 ? body.trendStrength : 2,
      enabled: body.enabled ?? true,
      candles,
    };

    const result = await db.createMarket(created, adminEmail);
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    return res.status(201).json(result.market);
  });

  api.patch("/admin/markets/:symbol", requireAdmin, async (req: Request, res: Response) => {
    const symbolParam = String(req.params["symbol"] ?? "").toUpperCase();
    const markets = await db.getAllMarkets();
    const target = markets.find((m) => m.symbol === symbolParam);
    if (!target) return res.status(404).json({ error: "Instrumen tidak ditemukan." });

    const body = req.body as Partial<{
      name: string;
      category: MarketCategory;
      basePrice: number;
      bid: number;
      spreadValue: number;
      pipSize: number;
      tickStep: number;
      decimals: number;
      contractSize: number;
      trendBias: TrendBias;
      trendStrength: 1 | 2 | 3;
      enabled: boolean;
      nudgeDirection: "up" | "down";
    }>;
    const adminEmail = String(res.locals["adminEmail"] ?? "admin");

    const nextDecimals =
      typeof body.decimals === "number" ? Math.max(0, Math.min(5, body.decimals)) : target.decimals;
    const nextPip =
      typeof body.pipSize === "number" && body.pipSize > 0 ? body.pipSize : target.pipSize;
    const nextSpread =
      typeof body.spreadValue === "number" && body.spreadValue >= 0
        ? body.spreadValue
        : target.spreadValue;
    const nextTickStep =
      typeof body.tickStep === "number" && body.tickStep > 0 ? body.tickStep : target.tickStep;

    let nextBid =
      typeof body.bid === "number" && body.bid > 0
        ? Number(body.bid.toFixed(nextDecimals))
        : target.bid;

    if (body.nudgeDirection === "up") {
      nextBid = Number((nextBid + nextTickStep * 6).toFixed(nextDecimals));
    } else if (body.nudgeDirection === "down") {
      nextBid = Number(Math.max(nextPip * 5, nextBid - nextTickStep * 6).toFixed(nextDecimals));
    }

    const updated: MarketInstrumentRecord = {
      ...target,
      name: body.name?.trim() || target.name,
      category: body.category ?? target.category,
      basePrice:
        typeof body.basePrice === "number" && body.basePrice > 0
          ? body.basePrice
          : typeof body.bid === "number" && body.bid > 0
            ? nextBid
            : target.basePrice,
      prevBid: target.bid,
      bid: nextBid,
      ask: Number((nextBid + nextSpread).toFixed(nextDecimals)),
      spreadValue: nextSpread,
      spreadLabel: nextPip > 0 ? (nextSpread / nextPip).toFixed(1) : target.spreadLabel,
      pipSize: nextPip,
      tickStep: nextTickStep,
      decimals: nextDecimals,
      contractSize:
        typeof body.contractSize === "number" && body.contractSize >= 1
          ? body.contractSize
          : target.contractSize,
      trendBias: body.trendBias ?? target.trendBias,
      trendStrength:
        body.trendStrength === 1 || body.trendStrength === 2 || body.trendStrength === 3
          ? body.trendStrength
          : target.trendStrength,
      enabled: typeof body.enabled === "boolean" ? body.enabled : target.enabled,
    };

    const lastCandle = updated.candles[updated.candles.length - 1];
    if (lastCandle && (body.nudgeDirection || typeof body.bid === "number")) {
      lastCandle.close = updated.bid;
      lastCandle.high = Number(Math.max(lastCandle.high, updated.bid).toFixed(nextDecimals));
      lastCandle.low = Number(Math.min(lastCandle.low, updated.bid).toFixed(nextDecimals));
    }

    const saved = await db.updateMarket(symbolParam, updated, adminEmail);
    return res.json(saved);
  });

  api.delete("/admin/markets/:symbol", requireAdmin, async (req: Request, res: Response) => {
    const symbolParam = String(req.params["symbol"] ?? "").toUpperCase();
    const adminEmail = String(res.locals["adminEmail"] ?? "admin");
    const removed = await db.deleteMarket(symbolParam, adminEmail);
    if (!removed) return res.status(404).json({ error: "Instrumen tidak ditemukan." });
    return res.json({ ok: true });
  });

  // Admin Trading Rules (Max Daily Open Positions, Min Hold Duration & Default Profit %)
  api.get("/admin/trading-rules", requireAdmin, async (_req: Request, res: Response) => {
    const rules = await db.getTradingRules();
    res.json(rules);
  });

  api.put("/admin/trading-rules", requireAdmin, async (req: Request, res: Response) => {
    const body = req.body as Partial<{
      maxDailyPositions: number;
      minCloseMinutes: number;
      defaultProfitPercent: number;
    }>;
    const adminEmail = String(res.locals["adminEmail"] ?? "admin");
    const result = await db.updateTradingRules(
      {
        maxDailyPositions:
          body.maxDailyPositions !== undefined ? Number(body.maxDailyPositions) : undefined,
        minCloseMinutes:
          body.minCloseMinutes !== undefined ? Number(body.minCloseMinutes) : undefined,
        defaultProfitPercent:
          body.defaultProfitPercent !== undefined ? Number(body.defaultProfitPercent) : undefined,
      },
      adminEmail,
    );
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    return res.json(result.rules);
  });

  // Admin All-User Live Positions Monitor & Per-Position Profit Control
  api.get("/admin/positions", requireAdmin, async (_req: Request, res: Response) => {
    const enriched = await db.getAdminPositions();
    res.json(enriched);
  });

  api.delete("/admin/positions/:id", requireAdmin, async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const adminEmail = String(res.locals["adminEmail"] ?? "admin");
    const deleted = await db.deleteAdminPosition(id, adminEmail);
    if (!deleted) return res.status(404).json({ error: "Posisi tidak ditemukan." });
    return res.json({ ok: true });
  });

  api.patch("/admin/positions/:id/profit", requireAdmin, async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const body = (req.body ?? {}) as { profitUsd?: number };
    const adminEmail = String(res.locals["adminEmail"] ?? "admin");
    const result = await db.setPositionAdminProfit(id, Number(body.profitUsd), adminEmail);
    if (result.error) {
      return res.status(result.status ?? 400).json({ error: result.error });
    }
    return res.json(result.position);
  });

  api.patch("/admin/positions/:id/close", requireAdmin, async (req: Request, res: Response) => {
    const id = String(req.params["id"] ?? "");
    const body = (req.body ?? {}) as { profitUsd?: number };
    const adminEmail = String(res.locals["adminEmail"] ?? "admin");
    const closed = await db.adminClosePosition(id, adminEmail, body.profitUsd);
    if (!closed) return res.status(404).json({ error: "Posisi tidak ditemukan." });
    return res.json(closed);
  });

  // API error handler
  api.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan pada server.";
    res.status(500).json({ error: message });
  });

  return api;
}

let marketTimerStarted = false;

async function startServer() {
  await initDatabase();

  const app = express();

  if (!marketTimerStarted) {
    marketTimerStarted = true;
    setInterval(runMarketTickCycle, 900);
  }

  app.use("/api", createApiRouter());

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
    });
    app.use(vite.middlewares);
  } else {
    const clientDir = path.resolve(process.cwd(), "dist/client");
    if (fs.existsSync(clientDir)) {
      app.use(express.static(clientDir, { index: false }));
    }

    const ssrCandidates = [
      path.resolve(process.cwd(), "dist/server/server.js"),
      path.resolve(process.cwd(), "dist/server/index.mjs"),
    ];
    const ssrEntryPath = ssrCandidates.find((candidate) => fs.existsSync(candidate));
    if (ssrEntryPath) {
      const serverMod = (await import(pathToFileURL(ssrEntryPath).href)) as {
        default?: { fetch: (req: globalThis.Request) => Promise<globalThis.Response> };
      };
      const fetchHandler = serverMod.default?.fetch;
      if (fetchHandler) {
        app.use(async (req: Request, res: Response, next) => {
          try {
            const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
            const headers = new Headers();
            for (const [key, val] of Object.entries(req.headers)) {
              if (typeof val === "string") headers.set(key, val);
              else if (Array.isArray(val)) headers.set(key, val.join(", "));
            }
            const webReq = new globalThis.Request(url, {
              method: req.method,
              headers,
            });
            const webRes = await fetchHandler(webReq);
            res.status(webRes.status);
            webRes.headers.forEach((value, key) => {
              if (key.toLowerCase() !== "content-encoding") {
                res.setHeader(key, value);
              }
            });
            const arrayBuf = await webRes.arrayBuffer();
            res.send(Buffer.from(arrayBuf));
          } catch (err) {
            next(err);
          }
        });
      }
    }

    app.use((_req: Request, res: Response) => {
      const fallbackHtml = path.join(clientDir, "index.html");
      if (fs.existsSync(fallbackHtml)) {
        res.sendFile(fallbackHtml);
      } else {
        res.status(404).send("Not found");
      }
    });
  }

  // Bind port utama sesuai .env (default 3010)
  const primaryServer = http.createServer(app);
  primaryServer.listen(PORT, HOST, () => {
    console.log(`Express + React server running at http://${HOST}:${PORT}`);
  });

  // Di environment preview container (APPLET_ID), pastikan port 3010 & 3000 sama-sama aktif
  // agar permintaan pengguna pada port 3010 dan iframe preview pada port 3000 berjalan lancar.
  const secondaryPorts = new Set<number>();
  if (process.env.APPLET_ID) {
    if (PORT !== 3010) secondaryPorts.add(3010);
    if (PORT !== 3000) secondaryPorts.add(3000);
  }
  for (const extraPort of secondaryPorts) {
    const mirrorServer = http.createServer(app);
    mirrorServer.on("error", () => {
      // Abaikan jika port sekunder sudah digunakan oleh proses lain
    });
    mirrorServer.listen(extraPort, HOST, () => {
      console.log(`Preview bridge active at http://${HOST}:${extraPort}`);
    });
  }
}

void startServer();
