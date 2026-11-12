import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Pool, type PoolClient } from "pg";
import {
  computePositionFloatingPnl,
  generateSeedCandles,
  memoryStore,
  stepMarketTicks,
  type AdminUserRecord,
  type AuditLogRecord,
  type CandleRecord,
  type CommunityPostRecord,
  type DepositRequestRecord,
  type InboxMessage,
  type JournalRecord,
  type MarketCategory,
  type MarketInstrumentRecord,
  type TradePosition,
  type TrendBias,
  type UserProfile,
  type WithdrawRequestRecord,
} from "./store.ts";

let pool: Pool | null = null;
let pgReady = false;
let lastPgError: string | null = null;

function nowWibLabel(): string {
  return (
    new Date().toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }) + " WIB"
  );
}

function parseJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function loadSchemaSql(): string {
  const schemaPath = path.resolve(process.cwd(), "src/db/schema.sql");
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`File skema PostgreSQL tidak ditemukan di ${schemaPath}`);
  }
  return fs.readFileSync(schemaPath, "utf-8");
}

export async function pushSchemaAndSeedClient(client: PoolClient): Promise<void> {
  const schemaSql = loadSchemaSql();
  await client.query(schemaSql);

  for (const user of memoryStore.users) {
    const isDefaultProfile = user.accountId === memoryStore.profile.accountId;
    await client.query(
      `INSERT INTO users (
         id, account_id, name, email, account_type, currency, timezone, leverage,
         balance, kyc_status, status, joined_at
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (id) DO NOTHING`,
      [
        user.id,
        user.accountId,
        user.name,
        user.email,
        user.accountType,
        isDefaultProfile ? memoryStore.profile.currency : "USD",
        isDefaultProfile ? memoryStore.profile.timezone : "Asia/Jakarta (WIB)",
        isDefaultProfile ? memoryStore.profile.leverage : 500,
        user.balance,
        user.kycStatus,
        user.status,
        user.joinedAt,
      ],
    );
  }

  for (const m of memoryStore.markets) {
    await client.query(
      `INSERT INTO markets (
         symbol, name, category, base_price, bid, ask, prev_bid, open_day,
         spread_value, spread_label, pip_size, tick_step, decimals,
         contract_size, quote_in_jpy, trend_bias, trend_strength, enabled, candles_json
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb)
       ON CONFLICT (symbol) DO NOTHING`,
      [
        m.symbol,
        m.name,
        m.category,
        m.basePrice,
        m.bid,
        m.ask,
        m.prevBid,
        m.openDay,
        m.spreadValue,
        m.spreadLabel,
        m.pipSize,
        m.tickStep,
        m.decimals,
        m.contractSize,
        Boolean(m.quoteInJpy),
        m.trendBias,
        m.trendStrength,
        m.enabled,
        JSON.stringify(m.candles),
      ],
    );
  }

  for (const dep of memoryStore.deposits) {
    await client.query(
      `INSERT INTO deposit_requests (
         id, user_id, user_name, user_email, account_id, method, reference,
         amount, currency, proof_image, proof_file_name, status,
         submitted_at, reviewed_at, reviewed_by, admin_note
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       ON CONFLICT (id) DO NOTHING`,
      [
        dep.id,
        dep.userId,
        dep.userName,
        dep.userEmail,
        dep.accountId,
        dep.method,
        dep.reference,
        dep.amount,
        dep.currency,
        dep.proofImage ?? null,
        dep.proofFileName ?? null,
        dep.status,
        dep.submittedAt,
        dep.reviewedAt ?? null,
        dep.reviewedBy ?? null,
        dep.adminNote ?? null,
      ],
    );
  }

  for (const wd of memoryStore.withdrawals) {
    await client.query(
      `INSERT INTO withdraw_requests (
         id, user_id, user_name, user_email, account_id, destination,
         amount, currency, status, submitted_at, reviewed_at, reviewed_by, admin_note
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (id) DO NOTHING`,
      [
        wd.id,
        wd.userId,
        wd.userName,
        wd.userEmail,
        wd.accountId,
        wd.destination,
        wd.amount,
        wd.currency,
        wd.status,
        wd.submittedAt,
        wd.reviewedAt ?? null,
        wd.reviewedBy ?? null,
        wd.adminNote ?? null,
      ],
    );
  }

  for (const pos of memoryStore.positions) {
    await client.query(
      `INSERT INTO positions (
         id, user_id, user_name, account_id, symbol, order_type, side,
         lot, leverage, entry_price, stop_loss, take_profit, pnl, status, opened_at
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (id) DO NOTHING`,
      [
        pos.id,
        pos.userId,
        pos.userName,
        pos.accountId,
        pos.symbol,
        pos.type,
        pos.side,
        pos.lot,
        pos.leverage,
        pos.entry,
        pos.sl,
        pos.tp,
        pos.pnl,
        pos.status,
        pos.openedAt,
      ],
    );
  }

  for (const jrn of memoryStore.journal) {
    await client.query(
      `INSERT INTO journal_entries (
         id, entry_date, symbol, side, lot, entry_price, exit_price, pnl, rr, strategy, emotion, notes
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (id) DO NOTHING`,
      [
        jrn.id,
        jrn.date,
        jrn.symbol,
        jrn.side,
        jrn.lot,
        jrn.entry,
        jrn.exit,
        jrn.pnl,
        jrn.rr,
        jrn.strategy,
        jrn.emotion,
        jrn.notes,
      ],
    );
  }

  for (const msg of memoryStore.messages) {
    await client.query(
      `INSERT INTO inbox_messages (id, sender, subject, preview, body, category, timestamp_label, unread, archived)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO NOTHING`,
      [
        msg.id,
        msg.sender,
        msg.subject,
        msg.preview,
        msg.body,
        msg.category,
        msg.timestamp,
        msg.unread,
        msg.archived,
      ],
    );
  }

  for (const post of memoryStore.communityPosts) {
    await client.query(
      `INSERT INTO community_posts (
         id, author, pair, bias, category, time_ago, title, content, likes, liked_by_me, comments_json
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
       ON CONFLICT (id) DO NOTHING`,
      [
        post.id,
        post.author,
        post.pair,
        post.bias,
        post.category,
        post.timeAgo,
        post.title,
        post.content,
        post.likes,
        post.likedByMe,
        JSON.stringify(post.comments),
      ],
    );
  }

  for (const log of memoryStore.auditLogs) {
    await client.query(
      `INSERT INTO audit_logs (id, timestamp_label, actor, action, target, detail)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (id) DO NOTHING`,
      [log.id, log.timestamp, log.actor, log.action, log.target, log.detail],
    );
  }

  await client.query(
    `INSERT INTO app_sessions (id, kind, account_id, email, logged_in)
     VALUES ('trader-active', 'trader', $1, $2, TRUE)
     ON CONFLICT (id) DO NOTHING`,
    [memoryStore.profile.accountId, memoryStore.profile.email],
  );
}

function mapMarketRow(row: Record<string, unknown>): MarketInstrumentRecord {
  const basePrice = Number(row.base_price);
  const tickStep = Number(row.tick_step);
  const decimals = Number(row.decimals);
  const parsedCandles = parseJsonArray<CandleRecord>(row.candles_json);
  const candles =
    parsedCandles.length > 0 ? parsedCandles : generateSeedCandles(basePrice, tickStep, decimals);

  return {
    symbol: String(row.symbol),
    name: String(row.name),
    category: row.category as MarketCategory,
    basePrice,
    bid: Number(row.bid),
    ask: Number(row.ask),
    prevBid: Number(row.prev_bid),
    openDay: Number(row.open_day),
    spreadValue: Number(row.spread_value),
    spreadLabel: String(row.spread_label),
    pipSize: Number(row.pip_size),
    tickStep,
    decimals,
    contractSize: Number(row.contract_size),
    quoteInJpy: Boolean(row.quote_in_jpy),
    trendBias: row.trend_bias as TrendBias,
    trendStrength: (Number(row.trend_strength) === 1 || Number(row.trend_strength) === 3
      ? Number(row.trend_strength)
      : 2) as 1 | 2 | 3,
    enabled: Boolean(row.enabled),
    candles,
  };
}

function mapUserRow(row: Record<string, unknown>): AdminUserRecord {
  return {
    id: String(row.id),
    accountId: String(row.account_id),
    name: String(row.name),
    email: String(row.email),
    accountType: row.account_type === "Standard" ? "Standard" : "Raw Spread",
    balance: Number(row.balance),
    kycStatus: row.kyc_status === "Terverifikasi" ? "Terverifikasi" : "Menunggu",
    status: row.status === "Ditangguhkan" ? "Ditangguhkan" : "Aktif",
    joinedAt: String(row.joined_at),
  };
}

function mapDepositRow(row: Record<string, unknown>): DepositRequestRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    userName: String(row.user_name),
    userEmail: String(row.user_email),
    accountId: String(row.account_id),
    method: String(row.method),
    reference: String(row.reference),
    amount: Number(row.amount),
    currency: "USD",
    proofImage: row.proof_image ? String(row.proof_image) : undefined,
    proofFileName: row.proof_file_name ? String(row.proof_file_name) : undefined,
    status: row.status as DepositRequestRecord["status"],
    submittedAt: String(row.submitted_at),
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : undefined,
    reviewedBy: row.reviewed_by ? String(row.reviewed_by) : undefined,
    adminNote: row.admin_note ? String(row.admin_note) : undefined,
  };
}

function mapWithdrawRow(row: Record<string, unknown>): WithdrawRequestRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    userName: String(row.user_name),
    userEmail: String(row.user_email),
    accountId: String(row.account_id),
    destination: String(row.destination),
    amount: Number(row.amount),
    currency: "USD",
    status: row.status as WithdrawRequestRecord["status"],
    submittedAt: String(row.submitted_at),
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : undefined,
    reviewedBy: row.reviewed_by ? String(row.reviewed_by) : undefined,
    adminNote: row.admin_note ? String(row.admin_note) : undefined,
  };
}

function mapPositionRow(row: Record<string, unknown>): TradePosition {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    userName: String(row.user_name),
    accountId: String(row.account_id),
    symbol: String(row.symbol),
    type: row.order_type === "Limit" ? "Limit" : "Market",
    side: row.side === "SELL" ? "SELL" : "BUY",
    lot: Number(row.lot),
    leverage: Number(row.leverage),
    entry: Number(row.entry_price),
    sl: String(row.stop_loss),
    tp: String(row.take_profit),
    pnl: Number(row.pnl),
    status: row.status as TradePosition["status"],
    openedAt: String(row.opened_at),
  };
}

function mapJournalRow(row: Record<string, unknown>): JournalRecord {
  return {
    id: String(row.id),
    date: String(row.entry_date),
    symbol: String(row.symbol),
    side: row.side === "SELL" ? "SELL" : "BUY",
    lot: Number(row.lot),
    entry: String(row.entry_price),
    exit: String(row.exit_price),
    pnl: Number(row.pnl),
    rr: String(row.rr),
    strategy: row.strategy as JournalRecord["strategy"],
    emotion: String(row.emotion),
    notes: String(row.notes),
  };
}

function mapMessageRow(row: Record<string, unknown>): InboxMessage {
  return {
    id: String(row.id),
    sender: String(row.sender),
    subject: String(row.subject),
    preview: String(row.preview),
    body: String(row.body),
    category: row.category as InboxMessage["category"],
    timestamp: String(row.timestamp_label),
    unread: Boolean(row.unread),
    archived: Boolean(row.archived),
  };
}

function mapCommunityRow(row: Record<string, unknown>): CommunityPostRecord {
  return {
    id: String(row.id),
    author: String(row.author),
    pair: String(row.pair),
    bias: row.bias as CommunityPostRecord["bias"],
    category: row.category as CommunityPostRecord["category"],
    timeAgo: String(row.time_ago),
    title: String(row.title),
    content: String(row.content),
    likes: Number(row.likes),
    likedByMe: Boolean(row.liked_by_me),
    comments: parseJsonArray<CommunityPostRecord["comments"][number]>(row.comments_json),
  };
}

function mapAuditRow(row: Record<string, unknown>): AuditLogRecord {
  return {
    id: String(row.id),
    timestamp: String(row.timestamp_label),
    actor: String(row.actor),
    action: String(row.action),
    target: String(row.target),
    detail: String(row.detail),
  };
}

export async function initDatabase(): Promise<{ mode: "postgresql" | "in-memory" }> {
  const databaseUrl = process.env["DATABASE_URL"]?.trim();
  if (!databaseUrl) {
    lastPgError = "DATABASE_URL tidak ditemukan pada .env";
    pgReady = false;
    return { mode: "in-memory" };
  }

  const candidatePool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 2500,
    max: 10,
  });

  try {
    const client = await candidatePool.connect();
    try {
      await client.query("BEGIN");
      await pushSchemaAndSeedClient(client);
      await client.query("COMMIT");

      const mktRows = await client.query("SELECT * FROM markets ORDER BY symbol ASC");
      if (mktRows.rows.length > 0) {
        memoryStore.markets = mktRows.rows.map(mapMarketRow);
      }
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }

    pool = candidatePool;
    pgReady = true;
    lastPgError = null;
    console.log("[db] Terhubung ke PostgreSQL sesuai DATABASE_URL pada .env.");
    return { mode: "postgresql" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    lastPgError = message;
    pgReady = false;
    await candidatePool.end().catch(() => {});
    console.warn(
      `[db] PostgreSQL belum aktif (${message}). Menggunakan fallback store sementara hingga PostgreSQL tersedia.`,
    );
    return { mode: "in-memory" };
  }
}

export function getStorageStatus() {
  return {
    storage: pgReady ? "postgresql" : "in-memory-fallback",
    databaseConfigured: Boolean(process.env["DATABASE_URL"]?.trim()),
    lastError: pgReady ? null : lastPgError,
  };
}

let tickFlushCounter = 0;

export function runMarketTickCycle(): void {
  stepMarketTicks();
  if (!pgReady || !pool) return;

  tickFlushCounter += 1;
  if (tickFlushCounter % 5 !== 0) return;

  const snapshot = memoryStore.markets.filter((m) => m.enabled);
  const currentPool = pool;
  void (async () => {
    for (const inst of snapshot) {
      try {
        await currentPool.query(
          `UPDATE markets
           SET bid = $1, ask = $2, prev_bid = $3, candles_json = $4::jsonb, updated_at = NOW()
           WHERE symbol = $5`,
          [inst.bid, inst.ask, inst.prevBid, JSON.stringify(inst.candles), inst.symbol],
        );
      } catch {
        // Abaikan error flush tick latar belakang
      }
    }
  })();
}

async function getActiveTraderRow(clientOrPool: Pool | PoolClient) {
  const sessRes = await clientOrPool.query(
    `SELECT account_id, logged_in FROM app_sessions WHERE id = 'trader-active' LIMIT 1`,
  );
  const activeAccountId = String(sessRes.rows[0]?.account_id ?? memoryStore.profile.accountId);
  const loggedIn = sessRes.rows[0] ? Boolean(sessRes.rows[0].logged_in) : true;

  let userRes = await clientOrPool.query(`SELECT * FROM users WHERE account_id = $1 LIMIT 1`, [
    activeAccountId,
  ]);
  if (userRes.rows.length === 0) {
    userRes = await clientOrPool.query(`SELECT * FROM users ORDER BY created_at ASC LIMIT 1`);
  }
  return { userRow: userRes.rows[0] as Record<string, unknown> | undefined, loggedIn };
}

function rowToSession(
  userRow: Record<string, unknown> | undefined,
  loggedIn: boolean,
): UserProfile & { balance: number } {
  if (!userRow) {
    const currentUser = memoryStore.users.find(
      (u) => u.accountId === memoryStore.profile.accountId,
    );
    return { ...memoryStore.profile, loggedIn, balance: currentUser?.balance ?? 24510 };
  }
  return {
    name: String(userRow.name),
    email: String(userRow.email),
    accountId: String(userRow.account_id),
    accountType: userRow.account_type === "Standard" ? "Standard" : "Raw Spread",
    currency: userRow.currency === "IDR" ? "IDR" : "USD",
    timezone: String(userRow.timezone || "Asia/Jakarta (WIB)"),
    leverage: Number(userRow.leverage) || 500,
    loggedIn,
    balance: Number(userRow.balance),
  };
}

export const db = {
  async getSession(): Promise<UserProfile & { balance: number }> {
    if (!pgReady || !pool) {
      const currentUser = memoryStore.users.find(
        (u) => u.accountId === memoryStore.profile.accountId,
      );
      return { ...memoryStore.profile, balance: currentUser?.balance ?? 24510 };
    }
    const { userRow, loggedIn } = await getActiveTraderRow(pool);
    return rowToSession(userRow, loggedIn);
  },

  async loginOrRegisterTrader(payload: {
    email?: string;
    name?: string;
    isRegister?: boolean;
  }): Promise<UserProfile & { balance: number }> {
    const email = payload.email?.trim().toLowerCase();
    const name = payload.name?.trim();

    if (!pgReady || !pool) {
      if (email) memoryStore.profile.email = email;
      if (name) memoryStore.profile.name = name;
      else if (email) memoryStore.profile.name = email.split("@")[0] || memoryStore.profile.name;
      memoryStore.profile.loggedIn = true;
      const currentUser = memoryStore.users.find(
        (u) => u.accountId === memoryStore.profile.accountId,
      );
      return { ...memoryStore.profile, balance: currentUser?.balance ?? 24510 };
    }

    if (email) {
      const existing = await pool.query(`SELECT * FROM users WHERE LOWER(email) = $1 LIMIT 1`, [
        email,
      ]);
      if (existing.rows.length > 0) {
        const row = existing.rows[0] as Record<string, unknown>;
        if (name && name !== row.name && !payload.isRegister) {
          await pool.query(`UPDATE users SET name = $1 WHERE id = $2`, [name, row.id]);
          row.name = name;
        }
        await pool.query(
          `INSERT INTO app_sessions (id, kind, account_id, email, logged_in, updated_at)
           VALUES ('trader-active', 'trader', $1, $2, TRUE, NOW())
           ON CONFLICT (id) DO UPDATE SET account_id = $1, email = $2, logged_in = TRUE, updated_at = NOW()`,
          [row.account_id, row.email],
        );
        return rowToSession(row, true);
      }

      const newId = `USR-${Math.floor(100 + Math.random() * 899)}`;
      const newAccountId = `IC-${Math.floor(885000 + Math.random() * 99000)}`;
      const displayName = name || email.split("@")[0] || "Trader Baru";
      const inserted = await pool.query(
        `INSERT INTO users (
           id, account_id, name, email, account_type, currency, timezone, leverage,
           balance, kyc_status, status, joined_at
         )
         VALUES ($1,$2,$3,$4,'Raw Spread','USD','Asia/Jakarta (WIB)',500,10000.00,'Menunggu','Aktif',$5)
         RETURNING *`,
        [newId, newAccountId, displayName, email, "Hari ini"],
      );
      const row = inserted.rows[0] as Record<string, unknown>;
      await pool.query(
        `INSERT INTO app_sessions (id, kind, account_id, email, logged_in, updated_at)
         VALUES ('trader-active', 'trader', $1, $2, TRUE, NOW())
         ON CONFLICT (id) DO UPDATE SET account_id = $1, email = $2, logged_in = TRUE, updated_at = NOW()`,
        [row.account_id, row.email],
      );
      return rowToSession(row, true);
    }

    const { userRow } = await getActiveTraderRow(pool);
    if (userRow) {
      await pool.query(
        `INSERT INTO app_sessions (id, kind, account_id, email, logged_in, updated_at)
         VALUES ('trader-active', 'trader', $1, $2, TRUE, NOW())
         ON CONFLICT (id) DO UPDATE SET logged_in = TRUE, updated_at = NOW()`,
        [userRow.account_id, userRow.email],
      );
    }
    return rowToSession(userRow, true);
  },

  async logoutTrader(): Promise<void> {
    if (!pgReady || !pool) {
      memoryStore.profile.loggedIn = false;
      return;
    }
    await pool.query(
      `UPDATE app_sessions SET logged_in = FALSE, updated_at = NOW() WHERE id = 'trader-active'`,
    );
  },

  async updateProfile(partial: Partial<UserProfile>): Promise<UserProfile & { balance: number }> {
    const allowedLeverages = [50, 100, 200, 500, 1000];
    if (!pgReady || !pool) {
      const nextLeverage =
        typeof partial.leverage === "number" && allowedLeverages.includes(partial.leverage)
          ? partial.leverage
          : memoryStore.profile.leverage;
      memoryStore.profile = {
        ...memoryStore.profile,
        name: partial.name?.trim() || memoryStore.profile.name,
        email: partial.email?.trim() || memoryStore.profile.email,
        accountType: partial.accountType ?? memoryStore.profile.accountType,
        currency: partial.currency ?? memoryStore.profile.currency,
        timezone: partial.timezone ?? memoryStore.profile.timezone,
        leverage: nextLeverage,
      };
      const currentUser = memoryStore.users.find(
        (u) => u.accountId === memoryStore.profile.accountId,
      );
      return { ...memoryStore.profile, balance: currentUser?.balance ?? 24510 };
    }

    const { userRow, loggedIn } = await getActiveTraderRow(pool);
    if (!userRow) return this.getSession();

    const currentLeverage = Number(userRow.leverage) || 500;
    const nextLeverage =
      typeof partial.leverage === "number" && allowedLeverages.includes(partial.leverage)
        ? partial.leverage
        : currentLeverage;

    const updated = await pool.query(
      `UPDATE users
       SET name = $1, email = $2, account_type = $3, currency = $4, timezone = $5, leverage = $6
       WHERE id = $7
       RETURNING *`,
      [
        partial.name?.trim() || String(userRow.name),
        partial.email?.trim() || String(userRow.email),
        partial.accountType ?? (userRow.account_type === "Standard" ? "Standard" : "Raw Spread"),
        partial.currency ?? (userRow.currency === "IDR" ? "IDR" : "USD"),
        partial.timezone ?? String(userRow.timezone || "Asia/Jakarta (WIB)"),
        nextLeverage,
        userRow.id,
      ],
    );
    return rowToSession(updated.rows[0] as Record<string, unknown>, loggedIn);
  },

  async getEnabledMarkets(): Promise<MarketInstrumentRecord[]> {
    // Live tick prices are streamed from memoryStore.markets (which stays synced with PostgreSQL)
    if (pgReady && memoryStore.markets.length === 0 && pool) {
      const res = await pool.query(`SELECT * FROM markets ORDER BY symbol ASC`);
      memoryStore.markets = res.rows.map(mapMarketRow);
    }
    return memoryStore.markets.filter((m) => m.enabled);
  },

  async getAllMarkets(): Promise<MarketInstrumentRecord[]> {
    if (!pgReady || !pool) return memoryStore.markets;
    const res = await pool.query(`SELECT * FROM markets ORDER BY symbol ASC`);
    const dbMarkets = res.rows.map(mapMarketRow);
    // Preserve freshest live ticks/candles in memory if matching symbol exists
    const merged = dbMarkets.map((dbM) => {
      const mem = memoryStore.markets.find((m) => m.symbol === dbM.symbol);
      return mem
        ? { ...dbM, bid: mem.bid, ask: mem.ask, prevBid: mem.prevBid, candles: mem.candles }
        : dbM;
    });
    memoryStore.markets = merged;
    return merged;
  },

  async createMarket(
    created: MarketInstrumentRecord,
    adminEmail: string,
  ): Promise<{ error?: string; market?: MarketInstrumentRecord }> {
    if (memoryStore.markets.some((m) => m.symbol === created.symbol)) {
      return { error: `Instrumen ${created.symbol} sudah terdaftar.` };
    }

    if (pgReady && pool) {
      const exists = await pool.query(`SELECT symbol FROM markets WHERE symbol = $1`, [
        created.symbol,
      ]);
      if (exists.rows.length > 0) {
        return { error: `Instrumen ${created.symbol} sudah terdaftar.` };
      }
      await pool.query(
        `INSERT INTO markets (
           symbol, name, category, base_price, bid, ask, prev_bid, open_day,
           spread_value, spread_label, pip_size, tick_step, decimals,
           contract_size, quote_in_jpy, trend_bias, trend_strength, enabled, candles_json
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb)`,
        [
          created.symbol,
          created.name,
          created.category,
          created.basePrice,
          created.bid,
          created.ask,
          created.prevBid,
          created.openDay,
          created.spreadValue,
          created.spreadLabel,
          created.pipSize,
          created.tickStep,
          created.decimals,
          created.contractSize,
          Boolean(created.quoteInJpy),
          created.trendBias,
          created.trendStrength,
          created.enabled,
          JSON.stringify(created.candles),
        ],
      );
      await this.appendAuditLog({
        id: `AUD-${Math.floor(110 + Math.random() * 890)}`,
        timestamp: `Hari ini · ${nowWibLabel()}`,
        actor: adminEmail,
        action: "Tambah Instrumen",
        target: `${created.symbol} (${created.category})`,
        detail: `Harga awal ${created.bid.toFixed(created.decimals)}, arah ${created.trendBias}.`,
      });
    } else {
      memoryStore.auditLogs = [
        {
          id: `AUD-${Math.floor(110 + Math.random() * 890)}`,
          timestamp: `Hari ini · ${nowWibLabel()}`,
          actor: adminEmail,
          action: "Tambah Instrumen",
          target: `${created.symbol} (${created.category})`,
          detail: `Harga awal ${created.bid.toFixed(created.decimals)}, arah ${created.trendBias}.`,
        },
        ...memoryStore.auditLogs,
      ];
    }

    memoryStore.markets = [...memoryStore.markets, created];
    return { market: created };
  },

  async updateMarket(
    symbol: string,
    updated: MarketInstrumentRecord,
    adminEmail: string,
  ): Promise<MarketInstrumentRecord> {
    memoryStore.markets = memoryStore.markets.map((m) => (m.symbol === symbol ? updated : m));

    const logEntry: AuditLogRecord = {
      id: `AUD-${Math.floor(110 + Math.random() * 890)}`,
      timestamp: `Hari ini · ${nowWibLabel()}`,
      actor: adminEmail,
      action: "Atur Pasar",
      target: updated.symbol,
      detail: `Arah: ${updated.trendBias} (Kekuatan ${updated.trendStrength}), Aktif: ${updated.enabled ? "Ya" : "Tidak"}, Harga: ${updated.bid.toFixed(updated.decimals)}`,
    };

    if (pgReady && pool) {
      await pool.query(
        `UPDATE markets
         SET name = $1, category = $2, base_price = $3, bid = $4, ask = $5, prev_bid = $6,
             spread_value = $7, spread_label = $8, pip_size = $9, tick_step = $10,
             decimals = $11, contract_size = $12, trend_bias = $13, trend_strength = $14,
             enabled = $15, candles_json = $16::jsonb, updated_at = NOW()
         WHERE symbol = $17`,
        [
          updated.name,
          updated.category,
          updated.basePrice,
          updated.bid,
          updated.ask,
          updated.prevBid,
          updated.spreadValue,
          updated.spreadLabel,
          updated.pipSize,
          updated.tickStep,
          updated.decimals,
          updated.contractSize,
          updated.trendBias,
          updated.trendStrength,
          updated.enabled,
          JSON.stringify(updated.candles),
          symbol,
        ],
      );
      await this.appendAuditLog(logEntry);
    } else {
      memoryStore.auditLogs = [logEntry, ...memoryStore.auditLogs];
    }
    return updated;
  },

  async deleteMarket(symbol: string, adminEmail: string): Promise<boolean> {
    const target = memoryStore.markets.find((m) => m.symbol === symbol);
    if (!target) return false;
    memoryStore.markets = memoryStore.markets.filter((m) => m.symbol !== symbol);

    const logEntry: AuditLogRecord = {
      id: `AUD-${Math.floor(110 + Math.random() * 890)}`,
      timestamp: `Hari ini · ${nowWibLabel()}`,
      actor: adminEmail,
      action: "Hapus Instrumen",
      target: symbol,
      detail: `Instrumen ${target.name} dihapus dari daftar trading.`,
    };

    if (pgReady && pool) {
      await pool.query(`DELETE FROM markets WHERE symbol = $1`, [symbol]);
      await this.appendAuditLog(logEntry);
    } else {
      memoryStore.auditLogs = [logEntry, ...memoryStore.auditLogs];
    }
    return true;
  },

  async getWalletTransactions() {
    if (!pgReady || !pool) {
      const currentUser = memoryStore.users.find(
        (u) => u.accountId === memoryStore.profile.accountId,
      );
      return {
        balance: currentUser?.balance ?? 24510,
        deposits: memoryStore.deposits.filter((d) => d.accountId === memoryStore.profile.accountId),
        withdrawals: memoryStore.withdrawals.filter(
          (w) => w.accountId === memoryStore.profile.accountId,
        ),
      };
    }

    const { userRow } = await getActiveTraderRow(pool);
    const accountId = String(userRow?.account_id ?? memoryStore.profile.accountId);
    const [depRes, wdRes] = await Promise.all([
      pool.query(`SELECT * FROM deposit_requests WHERE account_id = $1 ORDER BY created_at DESC`, [
        accountId,
      ]),
      pool.query(`SELECT * FROM withdraw_requests WHERE account_id = $1 ORDER BY created_at DESC`, [
        accountId,
      ]),
    ]);

    return {
      balance: Number(userRow?.balance ?? 24510),
      deposits: depRes.rows.map(mapDepositRow),
      withdrawals: wdRes.rows.map(mapWithdrawRow),
    };
  },

  async createDeposit(input: {
    amount: number;
    method: string;
    reference: string;
    proofImage: string;
    proofFileName: string;
  }): Promise<DepositRequestRecord> {
    if (!pgReady || !pool) {
      const currentUser = memoryStore.users.find(
        (u) => u.accountId === memoryStore.profile.accountId,
      );
      const created: DepositRequestRecord = {
        id: `DEP-${Math.floor(3050 + Math.random() * 900)}`,
        userId: currentUser?.id ?? "USR-01",
        userName: memoryStore.profile.name,
        userEmail: memoryStore.profile.email,
        accountId: memoryStore.profile.accountId,
        method: input.method,
        reference: input.reference,
        amount: input.amount,
        currency: "USD",
        proofImage: input.proofImage,
        proofFileName: input.proofFileName,
        status: "Menunggu",
        submittedAt: `Hari ini · ${nowWibLabel()}`,
      };
      memoryStore.deposits = [created, ...memoryStore.deposits];
      return created;
    }

    const { userRow } = await getActiveTraderRow(pool);
    const created: DepositRequestRecord = {
      id: `DEP-${Math.floor(3050 + Math.random() * 900)}`,
      userId: String(userRow?.id ?? "USR-01"),
      userName: String(userRow?.name ?? memoryStore.profile.name),
      userEmail: String(userRow?.email ?? memoryStore.profile.email),
      accountId: String(userRow?.account_id ?? memoryStore.profile.accountId),
      method: input.method,
      reference: input.reference,
      amount: input.amount,
      currency: "USD",
      proofImage: input.proofImage,
      proofFileName: input.proofFileName,
      status: "Menunggu",
      submittedAt: `Hari ini · ${nowWibLabel()}`,
    };

    await pool.query(
      `INSERT INTO deposit_requests (
         id, user_id, user_name, user_email, account_id, method, reference,
         amount, currency, proof_image, proof_file_name, status, submitted_at
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        created.id,
        created.userId,
        created.userName,
        created.userEmail,
        created.accountId,
        created.method,
        created.reference,
        created.amount,
        created.currency,
        created.proofImage ?? null,
        created.proofFileName ?? null,
        created.status,
        created.submittedAt,
      ],
    );
    return created;
  },

  async createWithdraw(input: {
    amount: number;
    destination: string;
  }): Promise<{ error?: string; withdrawal?: WithdrawRequestRecord }> {
    if (!pgReady || !pool) {
      const currentUser = memoryStore.users.find(
        (u) => u.accountId === memoryStore.profile.accountId,
      );
      if (currentUser && input.amount > currentUser.balance) {
        return { error: "Saldo akun tidak mencukupi untuk penarikan ini." };
      }
      const created: WithdrawRequestRecord = {
        id: `WD-${Math.floor(2100 + Math.random() * 900)}`,
        userId: currentUser?.id ?? "USR-01",
        userName: memoryStore.profile.name,
        userEmail: memoryStore.profile.email,
        accountId: memoryStore.profile.accountId,
        destination: input.destination,
        amount: input.amount,
        currency: "USD",
        status: "Menunggu",
        submittedAt: `Hari ini · ${nowWibLabel()}`,
      };
      memoryStore.withdrawals = [created, ...memoryStore.withdrawals];
      return { withdrawal: created };
    }

    const { userRow } = await getActiveTraderRow(pool);
    const balance = Number(userRow?.balance ?? 0);
    if (userRow && input.amount > balance) {
      return { error: "Saldo akun tidak mencukupi untuk penarikan ini." };
    }
    const created: WithdrawRequestRecord = {
      id: `WD-${Math.floor(2100 + Math.random() * 900)}`,
      userId: String(userRow?.id ?? "USR-01"),
      userName: String(userRow?.name ?? memoryStore.profile.name),
      userEmail: String(userRow?.email ?? memoryStore.profile.email),
      accountId: String(userRow?.account_id ?? memoryStore.profile.accountId),
      destination: input.destination,
      amount: input.amount,
      currency: "USD",
      status: "Menunggu",
      submittedAt: `Hari ini · ${nowWibLabel()}`,
    };
    await pool.query(
      `INSERT INTO withdraw_requests (
         id, user_id, user_name, user_email, account_id, destination,
         amount, currency, status, submitted_at
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        created.id,
        created.userId,
        created.userName,
        created.userEmail,
        created.accountId,
        created.destination,
        created.amount,
        created.currency,
        created.status,
        created.submittedAt,
      ],
    );
    return { withdrawal: created };
  },

  async getUserPositions(): Promise<TradePosition[]> {
    if (!pgReady || !pool) {
      return memoryStore.positions.filter((p) => p.accountId === memoryStore.profile.accountId);
    }
    const { userRow } = await getActiveTraderRow(pool);
    const accountId = String(userRow?.account_id ?? memoryStore.profile.accountId);
    const res = await pool.query(
      `SELECT * FROM positions WHERE account_id = $1 ORDER BY created_at DESC`,
      [accountId],
    );
    return res.rows.map(mapPositionRow);
  },

  async createPosition(body: Partial<TradePosition>): Promise<{
    error?: string;
    position?: TradePosition;
  }> {
    const symbol = (body.symbol ?? "EURUSD").toUpperCase();
    const spec = memoryStore.markets.find((m) => m.symbol === symbol);
    const lot = Math.max(0.01, Math.min(50, Number(body.lot) || 0.1));

    if (!pgReady || !pool) {
      const currentUser = memoryStore.users.find(
        (u) => u.accountId === memoryStore.profile.accountId,
      );
      const leverage = Math.max(
        50,
        Math.min(1000, Number(body.leverage) || memoryStore.profile.leverage || 500),
      );
      const entry = Number(body.entry) || spec?.bid || 1.0845;
      const notionalUsd = spec
        ? spec.quoteInJpy
          ? lot * spec.contractSize
          : lot * spec.contractSize * entry
        : lot * 100000 * entry;
      const estimatedMargin = notionalUsd / leverage;

      if (currentUser && estimatedMargin > currentUser.balance) {
        return { error: "Margin bebas tidak mencukupi untuk volume lot dan leverage ini." };
      }

      const order: TradePosition = {
        id: `ORD-${Math.floor(9050 + Math.random() * 900)}`,
        userId: currentUser?.id ?? "USR-01",
        userName: currentUser?.name ?? memoryStore.profile.name,
        accountId: memoryStore.profile.accountId,
        symbol,
        type: body.type === "Limit" ? "Limit" : "Market",
        side: body.side === "SELL" ? "SELL" : "BUY",
        lot,
        leverage,
        entry,
        sl: body.sl || "-",
        tp: body.tp || "-",
        pnl: 0,
        status: body.type === "Limit" ? "Tertunda" : "Terbuka",
        openedAt: nowWibLabel(),
      };
      memoryStore.positions = [order, ...memoryStore.positions];
      return { position: order };
    }

    const { userRow } = await getActiveTraderRow(pool);
    const userBalance = Number(userRow?.balance ?? 24510);
    const userLeverage = Number(userRow?.leverage ?? 500);
    const leverage = Math.max(50, Math.min(1000, Number(body.leverage) || userLeverage || 500));
    const entry = Number(body.entry) || spec?.bid || 1.0845;
    const notionalUsd = spec
      ? spec.quoteInJpy
        ? lot * spec.contractSize
        : lot * spec.contractSize * entry
      : lot * 100000 * entry;
    const estimatedMargin = notionalUsd / leverage;

    if (userRow && estimatedMargin > userBalance) {
      return { error: "Margin bebas tidak mencukupi untuk volume lot dan leverage ini." };
    }

    const order: TradePosition = {
      id: `ORD-${Math.floor(9050 + Math.random() * 900)}`,
      userId: String(userRow?.id ?? "USR-01"),
      userName: String(userRow?.name ?? memoryStore.profile.name),
      accountId: String(userRow?.account_id ?? memoryStore.profile.accountId),
      symbol,
      type: body.type === "Limit" ? "Limit" : "Market",
      side: body.side === "SELL" ? "SELL" : "BUY",
      lot,
      leverage,
      entry,
      sl: body.sl || "-",
      tp: body.tp || "-",
      pnl: 0,
      status: body.type === "Limit" ? "Tertunda" : "Terbuka",
      openedAt: nowWibLabel(),
    };

    await pool.query(
      `INSERT INTO positions (
         id, user_id, user_name, account_id, symbol, order_type, side,
         lot, leverage, entry_price, stop_loss, take_profit, pnl, status, opened_at
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        order.id,
        order.userId,
        order.userName,
        order.accountId,
        order.symbol,
        order.type,
        order.side,
        order.lot,
        order.leverage,
        order.entry,
        order.sl,
        order.tp,
        order.pnl,
        order.status,
        order.openedAt,
      ],
    );
    return { position: order };
  },

  async activatePosition(id: string): Promise<TradePosition | null> {
    if (!pgReady || !pool) {
      const target = memoryStore.positions.find((p) => p.id === id);
      if (!target) return null;
      if (target.status !== "Tertunda") return target;
      memoryStore.positions = memoryStore.positions.map((p) =>
        p.id === id ? { ...p, status: "Terbuka", openedAt: nowWibLabel() } : p,
      );
      return memoryStore.positions.find((p) => p.id === id) ?? null;
    }

    const existing = await pool.query(`SELECT * FROM positions WHERE id = $1`, [id]);
    if (existing.rows.length === 0) return null;
    const pos = mapPositionRow(existing.rows[0] as Record<string, unknown>);
    if (pos.status !== "Tertunda") return pos;

    const updated = await pool.query(
      `UPDATE positions SET status = 'Terbuka', opened_at = $1 WHERE id = $2 RETURNING *`,
      [nowWibLabel(), id],
    );
    return mapPositionRow(updated.rows[0] as Record<string, unknown>);
  },

  async closePosition(
    id: string,
    pnlInput?: number,
  ): Promise<{ position: TradePosition; balance: number } | null> {
    if (!pgReady || !pool) {
      const existing = memoryStore.positions.find((p) => p.id === id);
      if (!existing) return null;
      if (existing.status === "Ditutup") {
        const cur = memoryStore.users.find((u) => u.accountId === existing.accountId);
        return { position: existing, balance: cur?.balance ?? 24510 };
      }
      const wasOpen = existing.status === "Terbuka";
      const settledPnl =
        wasOpen && typeof pnlInput === "number" && Number.isFinite(pnlInput)
          ? Number(pnlInput.toFixed(2))
          : existing.pnl;
      memoryStore.positions = memoryStore.positions.map((p) =>
        p.id === id ? { ...p, status: "Ditutup", pnl: wasOpen ? settledPnl : 0 } : p,
      );
      if (wasOpen && settledPnl !== 0) {
        memoryStore.users = memoryStore.users.map((u) =>
          u.accountId === existing.accountId
            ? { ...u, balance: Number(Math.max(0, u.balance + settledPnl).toFixed(2)) }
            : u,
        );
      }
      const updated = memoryStore.positions.find((p) => p.id === id)!;
      const cur = memoryStore.users.find((u) => u.accountId === existing.accountId);
      return { position: updated, balance: cur?.balance ?? 24510 };
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const res = await client.query(`SELECT * FROM positions WHERE id = $1 FOR UPDATE`, [id]);
      if (res.rows.length === 0) {
        await client.query("ROLLBACK");
        return null;
      }
      const existing = mapPositionRow(res.rows[0] as Record<string, unknown>);
      if (existing.status === "Ditutup") {
        const uRes = await client.query(`SELECT balance FROM users WHERE account_id = $1`, [
          existing.accountId,
        ]);
        await client.query("COMMIT");
        return {
          position: existing,
          balance: Number(uRes.rows[0]?.balance ?? 24510),
        };
      }

      const wasOpen = existing.status === "Terbuka";
      const settledPnl =
        wasOpen && typeof pnlInput === "number" && Number.isFinite(pnlInput)
          ? Number(pnlInput.toFixed(2))
          : existing.pnl;

      const updatedPosRes = await client.query(
        `UPDATE positions SET status = 'Ditutup', pnl = $1 WHERE id = $2 RETURNING *`,
        [wasOpen ? settledPnl : 0, id],
      );

      let nextBalance = 24510;
      if (wasOpen && settledPnl !== 0) {
        const uUpd = await client.query(
          `UPDATE users SET balance = GREATEST(0, ROUND((balance + $1)::numeric, 2))
           WHERE account_id = $2 RETURNING balance`,
          [settledPnl, existing.accountId],
        );
        nextBalance = Number(uUpd.rows[0]?.balance ?? 24510);
      } else {
        const uRes = await client.query(`SELECT balance FROM users WHERE account_id = $1`, [
          existing.accountId,
        ]);
        nextBalance = Number(uRes.rows[0]?.balance ?? 24510);
      }

      await client.query("COMMIT");
      return {
        position: mapPositionRow(updatedPosRes.rows[0] as Record<string, unknown>),
        balance: nextBalance,
      };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  async getJournal(): Promise<JournalRecord[]> {
    if (!pgReady || !pool) return memoryStore.journal;
    const res = await pool.query(`SELECT * FROM journal_entries ORDER BY created_at DESC`);
    return res.rows.map(mapJournalRow);
  },

  async createJournal(body: Partial<JournalRecord>): Promise<JournalRecord> {
    const created: JournalRecord = {
      id: `JRN-${Math.floor(415 + Math.random() * 500)}`,
      date: body.date || "12 Nov 2026",
      symbol: (body.symbol || "EURUSD").toUpperCase(),
      side: body.side === "SELL" ? "SELL" : "BUY",
      lot: Math.max(0.01, Number(body.lot) || 0.1),
      entry: body.entry || "1.08200",
      exit: body.exit || "1.08450",
      pnl: Number(body.pnl) || 0,
      rr: Number(body.pnl) >= 0 ? "1:2.0" : "1:1.0",
      strategy: body.strategy ?? "Pullback",
      emotion: body.emotion || "Tercatat",
      notes: body.notes || "Catatan transaksi baru.",
    };
    if (!pgReady || !pool) {
      memoryStore.journal = [created, ...memoryStore.journal];
      return created;
    }
    await pool.query(
      `INSERT INTO journal_entries (
         id, entry_date, symbol, side, lot, entry_price, exit_price, pnl, rr, strategy, emotion, notes
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        created.id,
        created.date,
        created.symbol,
        created.side,
        created.lot,
        created.entry,
        created.exit,
        created.pnl,
        created.rr,
        created.strategy,
        created.emotion,
        created.notes,
      ],
    );
    return created;
  },

  async deleteJournal(id: string): Promise<void> {
    if (!pgReady || !pool) {
      memoryStore.journal = memoryStore.journal.filter((item) => item.id !== id);
      return;
    }
    await pool.query(`DELETE FROM journal_entries WHERE id = $1`, [id]);
  },

  async getMessages(): Promise<InboxMessage[]> {
    if (!pgReady || !pool) return memoryStore.messages;
    const res = await pool.query(`SELECT * FROM inbox_messages ORDER BY created_at DESC`);
    return res.rows.map(mapMessageRow);
  },

  async createMessage(body: { subject?: string; body?: string }): Promise<InboxMessage> {
    const created: InboxMessage = {
      id: `MSG-${Math.floor(200 + Math.random() * 800)}`,
      sender: "Anda → Tim Dukungan IC",
      subject: body.subject?.trim() || "Pertanyaan Akun",
      preview: (body.body?.trim() || "").slice(0, 90),
      body: body.body?.trim() || "",
      category: "Dukungan",
      timestamp: "Baru saja",
      unread: false,
      archived: false,
    };
    if (!pgReady || !pool) {
      memoryStore.messages = [created, ...memoryStore.messages];
      return created;
    }
    await pool.query(
      `INSERT INTO inbox_messages (
         id, sender, subject, preview, body, category, timestamp_label, unread, archived
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        created.id,
        created.sender,
        created.subject,
        created.preview,
        created.body,
        created.category,
        created.timestamp,
        created.unread,
        created.archived,
      ],
    );
    return created;
  },

  async updateMessage(
    id: string,
    patch: Partial<Pick<InboxMessage, "unread" | "archived">>,
  ): Promise<InboxMessage | null> {
    if (!pgReady || !pool) {
      memoryStore.messages = memoryStore.messages.map((m) =>
        m.id === id ? { ...m, ...patch } : m,
      );
      return memoryStore.messages.find((m) => m.id === id) ?? null;
    }
    const cur = await pool.query(`SELECT * FROM inbox_messages WHERE id = $1`, [id]);
    if (cur.rows.length === 0) return null;
    const existing = mapMessageRow(cur.rows[0] as Record<string, unknown>);
    const res = await pool.query(
      `UPDATE inbox_messages SET unread = $1, archived = $2 WHERE id = $3 RETURNING *`,
      [
        typeof patch.unread === "boolean" ? patch.unread : existing.unread,
        typeof patch.archived === "boolean" ? patch.archived : existing.archived,
        id,
      ],
    );
    return mapMessageRow(res.rows[0] as Record<string, unknown>);
  },

  async deleteMessage(id: string): Promise<void> {
    if (!pgReady || !pool) {
      memoryStore.messages = memoryStore.messages.filter((m) => m.id !== id);
      return;
    }
    await pool.query(`DELETE FROM inbox_messages WHERE id = $1`, [id]);
  },

  async getCommunityPosts(): Promise<CommunityPostRecord[]> {
    if (!pgReady || !pool) return memoryStore.communityPosts;
    const res = await pool.query(`SELECT * FROM community_posts ORDER BY created_at DESC`);
    return res.rows.map(mapCommunityRow);
  },

  async createCommunityPost(body: Partial<CommunityPostRecord>): Promise<CommunityPostRecord> {
    const session = await this.getSession();
    const created: CommunityPostRecord = {
      id: `POST-${Date.now()}`,
      author: body.author || session.name,
      pair: (body.pair || "EURUSD").toUpperCase(),
      bias: body.bias ?? "Bullish",
      category: body.category ?? "Analisis Teknikal",
      timeAgo: "Baru saja",
      title: body.title?.trim() || "Ide Analisis",
      content: body.content?.trim() || "",
      likes: 1,
      likedByMe: true,
      comments: [],
    };
    if (!pgReady || !pool) {
      memoryStore.communityPosts = [created, ...memoryStore.communityPosts];
      return created;
    }
    await pool.query(
      `INSERT INTO community_posts (
         id, author, pair, bias, category, time_ago, title, content, likes, liked_by_me, comments_json
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
      [
        created.id,
        created.author,
        created.pair,
        created.bias,
        created.category,
        created.timeAgo,
        created.title,
        created.content,
        created.likes,
        created.likedByMe,
        JSON.stringify(created.comments),
      ],
    );
    return created;
  },

  async toggleCommunityLike(id: string): Promise<CommunityPostRecord | null> {
    if (!pgReady || !pool) {
      memoryStore.communityPosts = memoryStore.communityPosts.map((p) =>
        p.id === id
          ? { ...p, likedByMe: !p.likedByMe, likes: p.likedByMe ? p.likes - 1 : p.likes + 1 }
          : p,
      );
      return memoryStore.communityPosts.find((p) => p.id === id) ?? null;
    }
    const cur = await pool.query(`SELECT * FROM community_posts WHERE id = $1`, [id]);
    if (cur.rows.length === 0) return null;
    const existing = mapCommunityRow(cur.rows[0] as Record<string, unknown>);
    const nextLiked = !existing.likedByMe;
    const nextLikes = nextLiked ? existing.likes + 1 : Math.max(0, existing.likes - 1);
    const res = await pool.query(
      `UPDATE community_posts SET liked_by_me = $1, likes = $2 WHERE id = $3 RETURNING *`,
      [nextLiked, nextLikes, id],
    );
    return mapCommunityRow(res.rows[0] as Record<string, unknown>);
  },

  async addCommunityComment(
    id: string,
    payload: { author?: string; text: string },
  ): Promise<CommunityPostRecord | null> {
    const session = await this.getSession();
    const comment = {
      id: `CMT-${Date.now()}`,
      author: payload.author || session.name,
      text: payload.text,
      time: "Baru saja",
    };
    if (!pgReady || !pool) {
      memoryStore.communityPosts = memoryStore.communityPosts.map((p) =>
        p.id === id ? { ...p, comments: [...p.comments, comment] } : p,
      );
      return memoryStore.communityPosts.find((p) => p.id === id) ?? null;
    }
    const cur = await pool.query(`SELECT * FROM community_posts WHERE id = $1`, [id]);
    if (cur.rows.length === 0) return null;
    const existing = mapCommunityRow(cur.rows[0] as Record<string, unknown>);
    const nextComments = [...existing.comments, comment];
    const res = await pool.query(
      `UPDATE community_posts SET comments_json = $1::jsonb WHERE id = $2 RETURNING *`,
      [JSON.stringify(nextComments), id],
    );
    return mapCommunityRow(res.rows[0] as Record<string, unknown>);
  },

  async appendAuditLog(log: AuditLogRecord): Promise<void> {
    if (!pgReady || !pool) {
      memoryStore.auditLogs = [log, ...memoryStore.auditLogs];
      return;
    }
    await pool.query(
      `INSERT INTO audit_logs (id, timestamp_label, actor, action, target, detail)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [log.id, log.timestamp, log.actor, log.action, log.target, log.detail],
    );
  },

  async createAdminSession(email: string): Promise<string> {
    const token = crypto.randomBytes(24).toString("hex");
    memoryStore.adminSessions.set(token, email);
    const log: AuditLogRecord = {
      id: `AUD-${Math.floor(110 + Math.random() * 890)}`,
      timestamp: `Hari ini · ${nowWibLabel()}`,
      actor: email,
      action: "Login Admin",
      target: "Portal Admin",
      detail: "Berhasil masuk menggunakan kredensial admin.",
    };

    if (pgReady && pool) {
      await pool.query(
        `INSERT INTO app_sessions (id, kind, email, logged_in)
         VALUES ($1, 'admin', $2, TRUE)
         ON CONFLICT (id) DO UPDATE SET email = $2, logged_in = TRUE, updated_at = NOW()`,
        [token, email],
      );
      await this.appendAuditLog(log);
    } else {
      memoryStore.auditLogs = [log, ...memoryStore.auditLogs];
    }
    return token;
  },

  async getAdminEmailByToken(token: string | undefined): Promise<string | undefined> {
    if (!token) return undefined;
    const cached = memoryStore.adminSessions.get(token);
    if (cached) return cached;
    if (!pgReady || !pool) return undefined;
    const res = await pool.query(
      `SELECT email FROM app_sessions WHERE id = $1 AND kind = 'admin' AND logged_in = TRUE LIMIT 1`,
      [token],
    );
    const email = res.rows[0]?.email ? String(res.rows[0].email) : undefined;
    if (email) memoryStore.adminSessions.set(token, email);
    return email;
  },

  async deleteAdminSession(token: string | undefined): Promise<void> {
    if (!token) return;
    memoryStore.adminSessions.delete(token);
    if (pgReady && pool) {
      await pool.query(`DELETE FROM app_sessions WHERE id = $1 AND kind = 'admin'`, [token]);
    }
  },

  async getAdminOverview() {
    if (!pgReady || !pool) {
      const pendingDeposits = memoryStore.deposits.filter((d) => d.status === "Menunggu");
      const pendingWithdrawals = memoryStore.withdrawals.filter((w) => w.status === "Menunggu");
      const approvedDepositTotal = memoryStore.deposits
        .filter((d) => d.status === "Disetujui")
        .reduce((acc, cur) => acc + cur.amount, 0);
      const approvedWithdrawTotal = memoryStore.withdrawals
        .filter((w) => w.status === "Disetujui")
        .reduce((acc, cur) => acc + cur.amount, 0);
      const activeUsersCount = memoryStore.users.filter((u) => u.status === "Aktif").length;

      return {
        stats: {
          pendingDepositsCount: pendingDeposits.length,
          pendingWithdrawalsCount: pendingWithdrawals.length,
          approvedDepositTotal,
          approvedWithdrawTotal,
          totalUsersCount: memoryStore.users.length,
          activeUsersCount,
        },
        pendingDeposits,
        pendingWithdrawals,
        recentAudit: memoryStore.auditLogs.slice(0, 6),
      };
    }

    const [depRes, wdRes, usrRes, audRes] = await Promise.all([
      pool.query(`SELECT * FROM deposit_requests ORDER BY created_at DESC`),
      pool.query(`SELECT * FROM withdraw_requests ORDER BY created_at DESC`),
      pool.query(`SELECT * FROM users`),
      pool.query(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 6`),
    ]);

    const deposits = depRes.rows.map(mapDepositRow);
    const withdrawals = wdRes.rows.map(mapWithdrawRow);
    const users = usrRes.rows.map(mapUserRow);
    const recentAudit = audRes.rows.map(mapAuditRow);

    const pendingDeposits = deposits.filter((d) => d.status === "Menunggu");
    const pendingWithdrawals = withdrawals.filter((w) => w.status === "Menunggu");

    return {
      stats: {
        pendingDepositsCount: pendingDeposits.length,
        pendingWithdrawalsCount: pendingWithdrawals.length,
        approvedDepositTotal: deposits
          .filter((d) => d.status === "Disetujui")
          .reduce((acc, cur) => acc + cur.amount, 0),
        approvedWithdrawTotal: withdrawals
          .filter((w) => w.status === "Disetujui")
          .reduce((acc, cur) => acc + cur.amount, 0),
        totalUsersCount: users.length,
        activeUsersCount: users.filter((u) => u.status === "Aktif").length,
      },
      pendingDeposits,
      pendingWithdrawals,
      recentAudit,
    };
  },

  async getAdminDeposits(): Promise<DepositRequestRecord[]> {
    if (!pgReady || !pool) return memoryStore.deposits;
    const res = await pool.query(`SELECT * FROM deposit_requests ORDER BY created_at DESC`);
    return res.rows.map(mapDepositRow);
  },

  async reviewDeposit(params: {
    id: string;
    decision: "approve" | "reject";
    note?: string;
    adminEmail: string;
  }): Promise<{ error?: string; status?: number; deposit?: DepositRequestRecord }> {
    const nextStatus = params.decision === "approve" ? "Disetujui" : "Ditolak";
    const reviewedAt = `Hari ini · ${nowWibLabel()}`;
    const note =
      params.note?.trim() ||
      (nextStatus === "Disetujui"
        ? "Mutasi diverifikasi manual oleh admin."
        : "Bukti transfer tidak sesuai atau ditolak admin.");

    if (!pgReady || !pool) {
      const target = memoryStore.deposits.find((d) => d.id === params.id);
      if (!target) return { error: "Permintaan deposit tidak ditemukan.", status: 404 };
      if (target.status !== "Menunggu") {
        return { error: "Permintaan deposit ini sudah diverifikasi sebelumnya.", status: 400 };
      }
      memoryStore.deposits = memoryStore.deposits.map((d) =>
        d.id === params.id
          ? {
              ...d,
              status: nextStatus,
              reviewedAt,
              reviewedBy: params.adminEmail,
              adminNote: note,
            }
          : d,
      );
      if (nextStatus === "Disetujui") {
        memoryStore.users = memoryStore.users.map((u) =>
          u.id === target.userId || u.accountId === target.accountId
            ? { ...u, balance: Number((u.balance + target.amount).toFixed(2)) }
            : u,
        );
      }
      memoryStore.auditLogs = [
        {
          id: `AUD-${Math.floor(110 + Math.random() * 890)}`,
          timestamp: reviewedAt,
          actor: params.adminEmail,
          action: nextStatus === "Disetujui" ? "Setujui Deposit" : "Tolak Deposit",
          target: `${target.id} (${target.accountId})`,
          detail: `${nextStatus} deposit $${target.amount.toFixed(2)} — ${note}`,
        },
        ...memoryStore.auditLogs,
      ];
      return { deposit: memoryStore.deposits.find((d) => d.id === params.id) };
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const res = await client.query(`SELECT * FROM deposit_requests WHERE id = $1 FOR UPDATE`, [
        params.id,
      ]);
      if (res.rows.length === 0) {
        await client.query("ROLLBACK");
        return { error: "Permintaan deposit tidak ditemukan.", status: 404 };
      }
      const target = mapDepositRow(res.rows[0] as Record<string, unknown>);
      if (target.status !== "Menunggu") {
        await client.query("ROLLBACK");
        return { error: "Permintaan deposit ini sudah diverifikasi sebelumnya.", status: 400 };
      }

      const updRes = await client.query(
        `UPDATE deposit_requests
         SET status = $1, reviewed_at = $2, reviewed_by = $3, admin_note = $4
         WHERE id = $5 RETURNING *`,
        [nextStatus, reviewedAt, params.adminEmail, note, params.id],
      );

      if (nextStatus === "Disetujui") {
        await client.query(
          `UPDATE users SET balance = ROUND((balance + $1)::numeric, 2) WHERE id = $2 OR account_id = $3`,
          [target.amount, target.userId, target.accountId],
        );
      }

      await client.query(
        `INSERT INTO audit_logs (id, timestamp_label, actor, action, target, detail)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          `AUD-${Math.floor(110 + Math.random() * 890)}`,
          reviewedAt,
          params.adminEmail,
          nextStatus === "Disetujui" ? "Setujui Deposit" : "Tolak Deposit",
          `${target.id} (${target.accountId})`,
          `${nextStatus} deposit $${target.amount.toFixed(2)} — ${note}`,
        ],
      );

      await client.query("COMMIT");
      return { deposit: mapDepositRow(updRes.rows[0] as Record<string, unknown>) };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  async getAdminWithdrawals(): Promise<WithdrawRequestRecord[]> {
    if (!pgReady || !pool) return memoryStore.withdrawals;
    const res = await pool.query(`SELECT * FROM withdraw_requests ORDER BY created_at DESC`);
    return res.rows.map(mapWithdrawRow);
  },

  async reviewWithdraw(params: {
    id: string;
    decision: "approve" | "reject";
    note?: string;
    adminEmail: string;
  }): Promise<{ error?: string; status?: number; withdrawal?: WithdrawRequestRecord }> {
    const nextStatus = params.decision === "approve" ? "Disetujui" : "Ditolak";
    const reviewedAt = `Hari ini · ${nowWibLabel()}`;
    const note =
      params.note?.trim() ||
      (nextStatus === "Disetujui"
        ? "Transfer dana disetujui manual oleh admin."
        : "Permintaan penarikan ditolak oleh admin.");

    if (!pgReady || !pool) {
      const target = memoryStore.withdrawals.find((w) => w.id === params.id);
      if (!target) return { error: "Permintaan withdraw tidak ditemukan.", status: 404 };
      if (target.status !== "Menunggu") {
        return { error: "Permintaan withdraw ini sudah diverifikasi sebelumnya.", status: 400 };
      }
      const user = memoryStore.users.find(
        (u) => u.id === target.userId || u.accountId === target.accountId,
      );
      if (params.decision === "approve" && user && user.balance < target.amount) {
        return {
          error: "Saldo pengguna saat ini tidak mencukupi untuk menyetujui penarikan.",
          status: 400,
        };
      }
      memoryStore.withdrawals = memoryStore.withdrawals.map((w) =>
        w.id === params.id
          ? {
              ...w,
              status: nextStatus,
              reviewedAt,
              reviewedBy: params.adminEmail,
              adminNote: note,
            }
          : w,
      );
      if (nextStatus === "Disetujui") {
        memoryStore.users = memoryStore.users.map((u) =>
          u.id === target.userId || u.accountId === target.accountId
            ? { ...u, balance: Number(Math.max(0, u.balance - target.amount).toFixed(2)) }
            : u,
        );
      }
      memoryStore.auditLogs = [
        {
          id: `AUD-${Math.floor(110 + Math.random() * 890)}`,
          timestamp: reviewedAt,
          actor: params.adminEmail,
          action: nextStatus === "Disetujui" ? "Setujui Withdraw" : "Tolak Withdraw",
          target: `${target.id} (${target.accountId})`,
          detail: `${nextStatus} penarikan $${target.amount.toFixed(2)} — ${note}`,
        },
        ...memoryStore.auditLogs,
      ];
      return { withdrawal: memoryStore.withdrawals.find((w) => w.id === params.id) };
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const res = await client.query(`SELECT * FROM withdraw_requests WHERE id = $1 FOR UPDATE`, [
        params.id,
      ]);
      if (res.rows.length === 0) {
        await client.query("ROLLBACK");
        return { error: "Permintaan withdraw tidak ditemukan.", status: 404 };
      }
      const target = mapWithdrawRow(res.rows[0] as Record<string, unknown>);
      if (target.status !== "Menunggu") {
        await client.query("ROLLBACK");
        return { error: "Permintaan withdraw ini sudah diverifikasi sebelumnya.", status: 400 };
      }

      const uRes = await client.query(
        `SELECT id, balance FROM users WHERE id = $1 OR account_id = $2 FOR UPDATE`,
        [target.userId, target.accountId],
      );
      const uBalance = Number(uRes.rows[0]?.balance ?? 0);
      if (params.decision === "approve" && uRes.rows.length > 0 && uBalance < target.amount) {
        await client.query("ROLLBACK");
        return {
          error: "Saldo pengguna saat ini tidak mencukupi untuk menyetujui penarikan.",
          status: 400,
        };
      }

      const updRes = await client.query(
        `UPDATE withdraw_requests
         SET status = $1, reviewed_at = $2, reviewed_by = $3, admin_note = $4
         WHERE id = $5 RETURNING *`,
        [nextStatus, reviewedAt, params.adminEmail, note, params.id],
      );

      if (nextStatus === "Disetujui") {
        await client.query(
          `UPDATE users SET balance = GREATEST(0, ROUND((balance - $1)::numeric, 2))
           WHERE id = $2 OR account_id = $3`,
          [target.amount, target.userId, target.accountId],
        );
      }

      await client.query(
        `INSERT INTO audit_logs (id, timestamp_label, actor, action, target, detail)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          `AUD-${Math.floor(110 + Math.random() * 890)}`,
          reviewedAt,
          params.adminEmail,
          nextStatus === "Disetujui" ? "Setujui Withdraw" : "Tolak Withdraw",
          `${target.id} (${target.accountId})`,
          `${nextStatus} penarikan $${target.amount.toFixed(2)} — ${note}`,
        ],
      );

      await client.query("COMMIT");
      return { withdrawal: mapWithdrawRow(updRes.rows[0] as Record<string, unknown>) };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  async getAdminUsers(): Promise<AdminUserRecord[]> {
    if (!pgReady || !pool) return memoryStore.users;
    const res = await pool.query(`SELECT * FROM users ORDER BY created_at ASC`);
    return res.rows.map(mapUserRow);
  },

  async updateAdminUser(params: {
    id: string;
    status?: "Aktif" | "Ditangguhkan";
    kycStatus?: "Terverifikasi" | "Menunggu";
    accountType?: "Raw Spread" | "Standard";
    adminEmail: string;
  }): Promise<AdminUserRecord | null> {
    if (!pgReady || !pool) {
      const target = memoryStore.users.find((u) => u.id === params.id);
      if (!target) return null;
      memoryStore.users = memoryStore.users.map((u) =>
        u.id === params.id
          ? {
              ...u,
              status: params.status ?? u.status,
              kycStatus: params.kycStatus ?? u.kycStatus,
              accountType: params.accountType ?? u.accountType,
            }
          : u,
      );
      memoryStore.auditLogs = [
        {
          id: `AUD-${Math.floor(110 + Math.random() * 890)}`,
          timestamp: `Hari ini · ${nowWibLabel()}`,
          actor: params.adminEmail,
          action: "Perbarui Pengguna",
          target: `${target.name} (${target.accountId})`,
          detail: `Status: ${params.status ?? target.status}, KYC: ${params.kycStatus ?? target.kycStatus}, Tipe: ${params.accountType ?? target.accountType}`,
        },
        ...memoryStore.auditLogs,
      ];
      return memoryStore.users.find((u) => u.id === params.id) ?? null;
    }

    const cur = await pool.query(`SELECT * FROM users WHERE id = $1`, [params.id]);
    if (cur.rows.length === 0) return null;
    const target = mapUserRow(cur.rows[0] as Record<string, unknown>);
    const nextStatus = params.status ?? target.status;
    const nextKyc = params.kycStatus ?? target.kycStatus;
    const nextType = params.accountType ?? target.accountType;

    const upd = await pool.query(
      `UPDATE users SET status = $1, kyc_status = $2, account_type = $3 WHERE id = $4 RETURNING *`,
      [nextStatus, nextKyc, nextType, params.id],
    );

    await this.appendAuditLog({
      id: `AUD-${Math.floor(110 + Math.random() * 890)}`,
      timestamp: `Hari ini · ${nowWibLabel()}`,
      actor: params.adminEmail,
      action: "Perbarui Pengguna",
      target: `${target.name} (${target.accountId})`,
      detail: `Status: ${nextStatus}, KYC: ${nextKyc}, Tipe: ${nextType}`,
    });

    return mapUserRow(upd.rows[0] as Record<string, unknown>);
  },

  async getAdminAudit(): Promise<AuditLogRecord[]> {
    if (!pgReady || !pool) return memoryStore.auditLogs;
    const res = await pool.query(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100`);
    return res.rows.map(mapAuditRow);
  },

  async getAdminPositions() {
    const positions =
      !pgReady || !pool
        ? memoryStore.positions
        : (await pool.query(`SELECT * FROM positions ORDER BY created_at DESC`)).rows.map(
            mapPositionRow,
          );

    return positions.map((pos) => {
      const market = memoryStore.markets.find((m) => m.symbol === pos.symbol);
      const currentPrice = market ? (pos.side === "BUY" ? market.bid : market.ask) : pos.entry;
      const livePnl = computePositionFloatingPnl(pos, market);
      return {
        ...pos,
        currentPrice,
        decimals: market?.decimals ?? 5,
        livePnl,
      };
    });
  },

  async adminClosePosition(id: string, adminEmail: string): Promise<TradePosition | null> {
    if (!pgReady || !pool) {
      const existing = memoryStore.positions.find((p) => p.id === id);
      if (!existing) return null;
      if (existing.status === "Ditutup") return existing;
      const market = memoryStore.markets.find((m) => m.symbol === existing.symbol);
      const wasOpen = existing.status === "Terbuka";
      const settledPnl = wasOpen ? computePositionFloatingPnl(existing, market) : 0;

      memoryStore.positions = memoryStore.positions.map((p) =>
        p.id === id ? { ...p, status: "Ditutup", pnl: settledPnl } : p,
      );
      if (wasOpen && settledPnl !== 0) {
        memoryStore.users = memoryStore.users.map((u) =>
          u.id === existing.userId || u.accountId === existing.accountId
            ? { ...u, balance: Number(Math.max(0, u.balance + settledPnl).toFixed(2)) }
            : u,
        );
      }
      memoryStore.auditLogs = [
        {
          id: `AUD-${Math.floor(110 + Math.random() * 890)}`,
          timestamp: `Hari ini · ${nowWibLabel()}`,
          actor: adminEmail,
          action: wasOpen ? "Tutup Posisi User" : "Batalkan Order User",
          target: `${existing.id} (${existing.accountId})`,
          detail: `${existing.symbol} ${existing.side} ${existing.lot.toFixed(2)} lot — Realisasi P&L $${settledPnl.toFixed(2)}`,
        },
        ...memoryStore.auditLogs,
      ];
      return memoryStore.positions.find((p) => p.id === id) ?? null;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const res = await client.query(`SELECT * FROM positions WHERE id = $1 FOR UPDATE`, [id]);
      if (res.rows.length === 0) {
        await client.query("ROLLBACK");
        return null;
      }
      const existing = mapPositionRow(res.rows[0] as Record<string, unknown>);
      if (existing.status === "Ditutup") {
        await client.query("COMMIT");
        return existing;
      }

      const market = memoryStore.markets.find((m) => m.symbol === existing.symbol);
      const wasOpen = existing.status === "Terbuka";
      const settledPnl = wasOpen ? computePositionFloatingPnl(existing, market) : 0;

      const upd = await client.query(
        `UPDATE positions SET status = 'Ditutup', pnl = $1 WHERE id = $2 RETURNING *`,
        [settledPnl, id],
      );

      if (wasOpen && settledPnl !== 0) {
        await client.query(
          `UPDATE users SET balance = GREATEST(0, ROUND((balance + $1)::numeric, 2))
           WHERE id = $2 OR account_id = $3`,
          [settledPnl, existing.userId, existing.accountId],
        );
      }

      await client.query(
        `INSERT INTO audit_logs (id, timestamp_label, actor, action, target, detail)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          `AUD-${Math.floor(110 + Math.random() * 890)}`,
          `Hari ini · ${nowWibLabel()}`,
          adminEmail,
          wasOpen ? "Tutup Posisi User" : "Batalkan Order User",
          `${existing.id} (${existing.accountId})`,
          `${existing.symbol} ${existing.side} ${existing.lot.toFixed(2)} lot — Realisasi P&L $${settledPnl.toFixed(2)}`,
        ],
      );

      await client.query("COMMIT");
      return mapPositionRow(upd.rows[0] as Record<string, unknown>);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },
};
