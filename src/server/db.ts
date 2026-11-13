import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Pool, type PoolClient } from "pg";
import {
  formatHoldCountdown,
  formatMinCloseDuration,
  resolvePositionStakeUsd,
  resolveTargetProfitUsd,
  type TradingRulesRecord,
} from "../lib/trading.ts";
import {
  computePositionFloatingPnl,
  generateSeedCandles,
  getWibDateKey,
  memoryStore,
  stepMarketTicks,
  USD_TO_IDR_RATE,
  type AdminUserRecord,
  type AuditLogRecord,
  type CandleRecord,
  type CommunityPostRecord,
  type DepositMethodRecord,
  type DepositRequestRecord,
  type InboxMessage,
  type JournalRecord,
  type MarketCategory,
  type MarketInstrumentRecord,
  type TradePosition,
  type TrendBias,
  type UserProfile,
  type WalletLimitsRecord,
  type WithdrawRequestRecord,
} from "./store.ts";

let pool: Pool | null = null;
let pgReady = false;
let lastPgError: string | null = null;

type SqlQueryClient = {
  query: (queryText: string) => Promise<unknown>;
};

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

export async function pushSchemaClient(client: SqlQueryClient): Promise<void> {
  const schemaSql = loadSchemaSql();
  await client.query(schemaSql);
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

function mapDepositMethodRow(row: Record<string, unknown>): DepositMethodRecord {
  return {
    id: String(row.id),
    label: String(row.label),
    accountInfo: String(row.account_info),
    accountHolder: String(row.account_holder),
    fee: String(row.fee),
    eta: String(row.eta),
    enabled: Boolean(row.enabled),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function mapDepositRow(row: Record<string, unknown>): DepositRequestRecord {
  const amount = Number(row.amount);
  const exchangeRate =
    row.exchange_rate != null && Number(row.exchange_rate) > 0
      ? Number(row.exchange_rate)
      : USD_TO_IDR_RATE;
  const amountIdr =
    row.amount_idr != null && Number(row.amount_idr) > 0
      ? Number(row.amount_idr)
      : Math.round(amount * exchangeRate);
  return {
    id: String(row.id),
    userId: String(row.user_id),
    userName: String(row.user_name),
    userEmail: String(row.user_email),
    accountId: String(row.account_id),
    method: String(row.method),
    reference: String(row.reference),
    amount,
    amountIdr,
    exchangeRate,
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
  const lot = Number(row.lot);
  const rawStake = row.stake_usd != null ? Number(row.stake_usd) : Number.NaN;
  const stakeUsd =
    Number.isFinite(rawStake) && rawStake > 0
      ? Number(rawStake.toFixed(2))
      : resolvePositionStakeUsd({ lot });
  return {
    id: String(row.id),
    userId: String(row.user_id),
    userName: String(row.user_name),
    accountId: String(row.account_id),
    symbol: String(row.symbol),
    type: row.order_type === "Limit" ? "Limit" : "Market",
    side: row.side === "SELL" ? "SELL" : "BUY",
    lot,
    stakeUsd,
    leverage: Number(row.leverage),
    entry: Number(row.entry_price),
    sl: String(row.stop_loss),
    tp: String(row.take_profit),
    pnl: Number(row.pnl),
    adminProfitUsd:
      row.admin_profit_usd != null && Number.isFinite(Number(row.admin_profit_usd))
        ? Number(row.admin_profit_usd)
        : undefined,
    status: row.status as TradePosition["status"],
    openedAt: String(row.opened_at),
    openedAtMs: row.opened_at_ms != null ? Number(row.opened_at_ms) : 0,
    unlockAtMs: row.unlock_at_ms != null ? Number(row.unlock_at_ms) : 0,
    openedDate: row.opened_date ? String(row.opened_date) : "",
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
    recipientUserId: row.recipient_user_id == null ? null : String(row.recipient_user_id),
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
      await pushSchemaClient(client);
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
let autoClosingInProgress = false;

export function runMarketTickCycle(): void {
  stepMarketTicks();
  void db.autoCloseExpiredPositions().catch(() => {});

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
  const sessionRow = sessRes.rows[0] as
    { account_id?: string | null; logged_in?: boolean } | undefined;
  const activeAccountId = sessionRow?.account_id;
  const loggedIn = Boolean(sessionRow?.logged_in && activeAccountId);
  if (!loggedIn || !activeAccountId) return { userRow: undefined, loggedIn: false };

  const userRes = await clientOrPool.query(`SELECT * FROM users WHERE account_id = $1 LIMIT 1`, [
    activeAccountId,
  ]);
  return {
    userRow: userRes.rows[0] as Record<string, unknown> | undefined,
    loggedIn: userRes.rows.length > 0,
  };
}

function rowToSession(
  userRow: Record<string, unknown> | undefined,
  loggedIn: boolean,
): UserProfile & { balance: number } {
  if (!userRow) {
    const currentUser = memoryStore.users.find(
      (u) => u.accountId === memoryStore.profile.accountId,
    );
    return { ...memoryStore.profile, loggedIn, balance: currentUser?.balance ?? 0 };
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
      return { ...memoryStore.profile, balance: currentUser?.balance ?? 0 };
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
      const currentUser = email
        ? memoryStore.users.find((user) => user.email.toLowerCase() === email)
        : undefined;
      if (currentUser) {
        if (name && name !== currentUser.name && !payload.isRegister) {
          currentUser.name = name;
        }
        memoryStore.profile.accountId = currentUser.accountId;
        memoryStore.profile.email = currentUser.email;
        memoryStore.profile.name = currentUser.name;
        memoryStore.profile.accountType = currentUser.accountType;
      } else if (email) {
        let id = `USR-${crypto.randomBytes(6).toString("hex")}`;
        while (memoryStore.users.some((user) => user.id === id)) {
          id = `USR-${crypto.randomBytes(6).toString("hex")}`;
        }
        let accountId = `IC-${Math.floor(885000 + Math.random() * 99000)}`;
        while (memoryStore.users.some((user) => user.accountId === accountId)) {
          accountId = `IC-${Math.floor(885000 + Math.random() * 99000)}`;
        }
        const displayName = name || email.split("@")[0] || "Trader Baru";
        const newUser: AdminUserRecord = {
          id,
          accountId,
          name: displayName,
          email,
          accountType: "Raw Spread",
          balance: 0,
          kycStatus: "Menunggu",
          status: "Aktif",
          joinedAt: "Hari ini",
        };
        memoryStore.users = [...memoryStore.users, newUser];
        memoryStore.profile.accountId = accountId;
        memoryStore.profile.email = email;
        memoryStore.profile.name = displayName;
        memoryStore.profile.accountType = "Raw Spread";
      } else if (name) {
        memoryStore.profile.name = name;
      }
      memoryStore.profile.loggedIn = true;
      const activeUser = memoryStore.users.find(
        (u) => u.accountId === memoryStore.profile.accountId,
      );
      return { ...memoryStore.profile, balance: activeUser?.balance ?? 0 };
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
           VALUES ($1,$2,$3,$4,'Raw Spread','USD','Asia/Jakarta (WIB)',500,0.00,'Menunggu','Aktif',$5)
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
      return { ...memoryStore.profile, balance: currentUser?.balance ?? 0 };
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

  async getWalletLimits(): Promise<WalletLimitsRecord> {
    if (!pgReady || !pool) {
      return { ...memoryStore.walletLimits };
    }
    const res = await pool.query(`SELECT * FROM wallet_limits WHERE id = 'default' LIMIT 1`);
    if (res.rows.length === 0) {
      return { ...memoryStore.walletLimits };
    }
    const row = res.rows[0] as Record<string, unknown>;
    return {
      minDeposit: Number(row.min_deposit),
      maxDeposit: Number(row.max_deposit),
      minWithdraw: Number(row.min_withdraw),
      maxWithdraw: Number(row.max_withdraw),
      updatedBy: row.updated_by ? String(row.updated_by) : undefined,
      updatedAt: row.updated_at
        ? new Date(String(row.updated_at)).toLocaleString("id-ID")
        : undefined,
    };
  },

  async updateWalletLimits(
    partial: Partial<
      Pick<WalletLimitsRecord, "minDeposit" | "maxDeposit" | "minWithdraw" | "maxWithdraw">
    >,
    adminEmail: string,
  ): Promise<{ error?: string; limits?: WalletLimitsRecord }> {
    const current = await this.getWalletLimits();
    const minDeposit =
      typeof partial.minDeposit === "number" && Number.isFinite(partial.minDeposit)
        ? Number(partial.minDeposit.toFixed(2))
        : current.minDeposit;
    const maxDeposit =
      typeof partial.maxDeposit === "number" && Number.isFinite(partial.maxDeposit)
        ? Number(partial.maxDeposit.toFixed(2))
        : current.maxDeposit;
    const minWithdraw =
      typeof partial.minWithdraw === "number" && Number.isFinite(partial.minWithdraw)
        ? Number(partial.minWithdraw.toFixed(2))
        : current.minWithdraw;
    const maxWithdraw =
      typeof partial.maxWithdraw === "number" && Number.isFinite(partial.maxWithdraw)
        ? Number(partial.maxWithdraw.toFixed(2))
        : current.maxWithdraw;

    if (minDeposit < 1 || minWithdraw < 1) {
      return { error: "Nominal minimal deposit dan withdraw harus minimal $1.00." };
    }
    if (maxDeposit < minDeposit) {
      return { error: "Maksimal deposit tidak boleh lebih kecil daripada minimal deposit." };
    }
    if (maxWithdraw < minWithdraw) {
      return { error: "Maksimal withdraw tidak boleh lebih kecil daripada minimal withdraw." };
    }

    const updatedAt = `Hari ini · ${nowWibLabel()}`;
    const next: WalletLimitsRecord = {
      minDeposit,
      maxDeposit,
      minWithdraw,
      maxWithdraw,
      updatedBy: adminEmail,
      updatedAt,
    };
    memoryStore.walletLimits = next;

    const logEntry: AuditLogRecord = {
      id: `AUD-${Math.floor(110 + Math.random() * 890)}`,
      timestamp: updatedAt,
      actor: adminEmail,
      action: "Atur Batas Deposit & Withdraw",
      target: "Kebijakan Wallet",
      detail: `Deposit: $${minDeposit.toFixed(2)}–$${maxDeposit.toFixed(2)} · Withdraw: $${minWithdraw.toFixed(2)}–$${maxWithdraw.toFixed(2)}`,
    };

    if (pgReady && pool) {
      await pool.query(
        `INSERT INTO wallet_limits (id, min_deposit, max_deposit, min_withdraw, max_withdraw, updated_by, updated_at)
         VALUES ('default', $1, $2, $3, $4, $5, NOW())
         ON CONFLICT (id) DO UPDATE
         SET min_deposit = $1, max_deposit = $2, min_withdraw = $3, max_withdraw = $4, updated_by = $5, updated_at = NOW()`,
        [minDeposit, maxDeposit, minWithdraw, maxWithdraw, adminEmail],
      );
      await this.appendAuditLog(logEntry);
    } else {
      memoryStore.auditLogs = [logEntry, ...memoryStore.auditLogs];
    }

    return { limits: next };
  },

  async getTradingRules(): Promise<TradingRulesRecord> {
    if (!pgReady || !pool) {
      return { ...memoryStore.tradingRules };
    }
    const res = await pool.query(`SELECT * FROM trading_rules WHERE id = 'default' LIMIT 1`);
    if (res.rows.length === 0) {
      return { ...memoryStore.tradingRules };
    }
    const row = res.rows[0] as Record<string, unknown>;
    const rawPct =
      row.default_profit_percent != null ? Number(row.default_profit_percent) : Number.NaN;
    return {
      maxDailyPositions: Math.max(1, Math.round(Number(row.max_daily_positions) || 5)),
      minCloseMinutes: Math.max(1, Math.round(Number(row.min_close_minutes) || 5)),
      defaultProfitPercent: Number.isFinite(rawPct) && rawPct > 0 ? Number(rawPct.toFixed(2)) : 10,
      updatedBy: row.updated_by ? String(row.updated_by) : undefined,
      updatedAt: row.updated_at
        ? new Date(String(row.updated_at)).toLocaleString("id-ID")
        : undefined,
    };
  },

  async updateTradingRules(
    partial: Partial<
      Pick<TradingRulesRecord, "maxDailyPositions" | "minCloseMinutes" | "defaultProfitPercent">
    >,
    adminEmail: string,
  ): Promise<{ error?: string; rules?: TradingRulesRecord }> {
    const current = await this.getTradingRules();
    const maxDailyPositions =
      typeof partial.maxDailyPositions === "number" && Number.isFinite(partial.maxDailyPositions)
        ? Math.round(partial.maxDailyPositions)
        : current.maxDailyPositions;
    const minCloseMinutes =
      typeof partial.minCloseMinutes === "number" && Number.isFinite(partial.minCloseMinutes)
        ? Math.round(partial.minCloseMinutes)
        : current.minCloseMinutes;
    const defaultProfitPercent =
      typeof partial.defaultProfitPercent === "number" &&
      Number.isFinite(partial.defaultProfitPercent)
        ? Number(partial.defaultProfitPercent.toFixed(2))
        : (current.defaultProfitPercent ?? 10);

    if (maxDailyPositions < 1 || maxDailyPositions > 500) {
      return { error: "Maksimal open posisi per hari harus antara 1 sampai 500 kali." };
    }
    if (minCloseMinutes < 1 || minCloseMinutes > 10080) {
      return { error: "Minimal waktu tutup posisi harus antara 1 menit hingga 168 jam (7 hari)." };
    }
    if (defaultProfitPercent < 0.1 || defaultProfitPercent > 1000) {
      return { error: "Persentase keuntungan default harus antara 0.1% sampai 1000%." };
    }

    const updatedAt = `Hari ini · ${nowWibLabel()}`;
    const next: TradingRulesRecord = {
      maxDailyPositions,
      minCloseMinutes,
      defaultProfitPercent,
      updatedBy: adminEmail,
      updatedAt,
    };
    memoryStore.tradingRules = next;

    const logEntry: AuditLogRecord = {
      id: `AUD-${Math.floor(110 + Math.random() * 890)}`,
      timestamp: updatedAt,
      actor: adminEmail,
      action: "Atur Aturan Trading",
      target: "Kebijakan Trading Global",
      detail: `Maks ${maxDailyPositions} open/hari · Minimal tutup ${formatMinCloseDuration(minCloseMinutes)} · Default keuntungan ${defaultProfitPercent}%`,
    };

    if (pgReady && pool) {
      await pool.query(
        `INSERT INTO trading_rules (id, max_daily_positions, min_close_minutes, default_profit_percent, updated_by, updated_at)
         VALUES ('default', $1, $2, $3, $4, NOW())
         ON CONFLICT (id) DO UPDATE
         SET max_daily_positions = $1, min_close_minutes = $2, default_profit_percent = $3, updated_by = $4, updated_at = NOW()`,
        [maxDailyPositions, minCloseMinutes, defaultProfitPercent, adminEmail],
      );
      await this.appendAuditLog(logEntry);
    } else {
      memoryStore.auditLogs = [logEntry, ...memoryStore.auditLogs];
    }

    return { rules: next };
  },

  async getTraderTradingSummary(): Promise<{
    rules: TradingRulesRecord;
    todayOpenCount: number;
    todayDate: string;
  }> {
    const rules = await this.getTradingRules();
    const todayDate = getWibDateKey();

    if (!pgReady || !pool) {
      const todayOpenCount = memoryStore.positions.filter(
        (p) => p.accountId === memoryStore.profile.accountId && p.openedDate === todayDate,
      ).length;
      return { rules, todayOpenCount, todayDate };
    }

    const { userRow } = await getActiveTraderRow(pool);
    const accountId = String(userRow?.["account_id"] ?? memoryStore.profile.accountId);
    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM positions WHERE account_id = $1 AND opened_date = $2`,
      [accountId, todayDate],
    );
    const todayOpenCount = Number(countRes.rows[0]?.cnt ?? 0);
    return { rules, todayOpenCount, todayDate };
  },

  async getDepositMethods(includeDisabled = false): Promise<DepositMethodRecord[]> {
    if (!pgReady || !pool) {
      return includeDisabled
        ? [...memoryStore.depositMethods]
        : memoryStore.depositMethods.filter((m) => m.enabled);
    }
    const res = await pool.query(
      includeDisabled
        ? `SELECT * FROM deposit_methods ORDER BY sort_order ASC, created_at ASC`
        : `SELECT * FROM deposit_methods WHERE enabled = TRUE ORDER BY sort_order ASC, created_at ASC`,
    );
    return res.rows.map(mapDepositMethodRow);
  },

  async createDepositMethod(
    input: {
      label: string;
      accountInfo: string;
      accountHolder: string;
      fee: string;
      eta: string;
      enabled?: boolean;
    },
    adminEmail: string,
  ): Promise<{ error?: string; method?: DepositMethodRecord }> {
    const label = input.label.trim();
    const accountInfo = input.accountInfo.trim();
    const accountHolder = input.accountHolder.trim();
    const fee = input.fee.trim() || "Gratis (0%)";
    const eta = input.eta.trim() || "5–15 menit setelah verifikasi admin";
    if (!label || !accountInfo || !accountHolder) {
      return { error: "Nama metode, nomor rekening/tujuan, dan nama penerima wajib diisi." };
    }

    const baseSlug = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 24);
    const id = `${baseSlug || "metode"}-${Math.floor(100 + Math.random() * 899)}`;
    const existingMethods = await this.getDepositMethods(true);
    const sortOrder =
      existingMethods.reduce((max, cur) => Math.max(max, cur.sortOrder ?? 0), 0) + 1;

    const created: DepositMethodRecord = {
      id,
      label,
      accountInfo,
      accountHolder,
      fee,
      eta,
      enabled: input.enabled ?? true,
      sortOrder,
    };

    const logEntry: AuditLogRecord = {
      id: `AUD-${Math.floor(110 + Math.random() * 890)}`,
      timestamp: `Hari ini · ${nowWibLabel()}`,
      actor: adminEmail,
      action: "Tambah Metode Deposit",
      target: created.label,
      detail: `${created.accountInfo} (${created.accountHolder})`,
    };

    memoryStore.depositMethods = [...memoryStore.depositMethods, created];

    if (pgReady && pool) {
      await pool.query(
        `INSERT INTO deposit_methods (id, label, account_info, account_holder, fee, eta, enabled, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          created.id,
          created.label,
          created.accountInfo,
          created.accountHolder,
          created.fee,
          created.eta,
          created.enabled,
          created.sortOrder ?? 0,
        ],
      );
      await this.appendAuditLog(logEntry);
    } else {
      memoryStore.auditLogs = [logEntry, ...memoryStore.auditLogs];
    }

    return { method: created };
  },

  async updateDepositMethod(
    id: string,
    patch: Partial<Omit<DepositMethodRecord, "id">>,
    adminEmail: string,
  ): Promise<{ error?: string; method?: DepositMethodRecord }> {
    const methods = await this.getDepositMethods(true);
    const target = methods.find((m) => m.id === id);
    if (!target) {
      return { error: "Metode pembayaran deposit tidak ditemukan." };
    }

    const updated: DepositMethodRecord = {
      ...target,
      label: patch.label !== undefined ? patch.label.trim() || target.label : target.label,
      accountInfo:
        patch.accountInfo !== undefined
          ? patch.accountInfo.trim() || target.accountInfo
          : target.accountInfo,
      accountHolder:
        patch.accountHolder !== undefined
          ? patch.accountHolder.trim() || target.accountHolder
          : target.accountHolder,
      fee: patch.fee !== undefined ? patch.fee.trim() || target.fee : target.fee,
      eta: patch.eta !== undefined ? patch.eta.trim() || target.eta : target.eta,
      enabled: typeof patch.enabled === "boolean" ? patch.enabled : target.enabled,
      sortOrder: typeof patch.sortOrder === "number" ? patch.sortOrder : target.sortOrder,
    };

    memoryStore.depositMethods = memoryStore.depositMethods.map((m) => (m.id === id ? updated : m));

    const logEntry: AuditLogRecord = {
      id: `AUD-${Math.floor(110 + Math.random() * 890)}`,
      timestamp: `Hari ini · ${nowWibLabel()}`,
      actor: adminEmail,
      action: "Ubah Metode Deposit",
      target: updated.label,
      detail: `${updated.accountInfo} · Status: ${updated.enabled ? "Aktif" : "Nonaktif"}`,
    };

    if (pgReady && pool) {
      await pool.query(
        `UPDATE deposit_methods
         SET label = $1, account_info = $2, account_holder = $3, fee = $4, eta = $5, enabled = $6, sort_order = $7
         WHERE id = $8`,
        [
          updated.label,
          updated.accountInfo,
          updated.accountHolder,
          updated.fee,
          updated.eta,
          updated.enabled,
          updated.sortOrder ?? 0,
          id,
        ],
      );
      await this.appendAuditLog(logEntry);
    } else {
      memoryStore.auditLogs = [logEntry, ...memoryStore.auditLogs];
    }

    return { method: updated };
  },

  async deleteDepositMethod(
    id: string,
    adminEmail: string,
  ): Promise<{ error?: string; ok?: boolean }> {
    const methods = await this.getDepositMethods(true);
    const target = methods.find((m) => m.id === id);
    if (!target) {
      return { error: "Metode pembayaran deposit tidak ditemukan." };
    }
    if (methods.length <= 1) {
      return { error: "Minimal harus ada 1 metode pembayaran deposit yang tersedia." };
    }

    memoryStore.depositMethods = memoryStore.depositMethods.filter((m) => m.id !== id);

    const logEntry: AuditLogRecord = {
      id: `AUD-${Math.floor(110 + Math.random() * 890)}`,
      timestamp: `Hari ini · ${nowWibLabel()}`,
      actor: adminEmail,
      action: "Hapus Metode Deposit",
      target: target.label,
      detail: `Rekening ${target.accountInfo} dihapus oleh admin.`,
    };

    if (pgReady && pool) {
      await pool.query(`DELETE FROM deposit_methods WHERE id = $1`, [id]);
      await this.appendAuditLog(logEntry);
    } else {
      memoryStore.auditLogs = [logEntry, ...memoryStore.auditLogs];
    }

    return { ok: true };
  },

  async getWalletTransactions() {
    const [limits, depositMethods] = await Promise.all([
      this.getWalletLimits(),
      this.getDepositMethods(false),
    ]);
    if (!pgReady || !pool) {
      const currentUser = memoryStore.users.find(
        (u) => u.accountId === memoryStore.profile.accountId,
      );
      return {
        balance: currentUser?.balance ?? 0,
        deposits: memoryStore.deposits.filter((d) => d.accountId === memoryStore.profile.accountId),
        withdrawals: memoryStore.withdrawals.filter(
          (w) => w.accountId === memoryStore.profile.accountId,
        ),
        limits,
        depositMethods,
        idrPerUsd: USD_TO_IDR_RATE,
      };
    }

    const { userRow } = await getActiveTraderRow(pool);
    const accountId = String(userRow?.["account_id"] ?? memoryStore.profile.accountId);
    const [depRes, wdRes] = await Promise.all([
      pool.query(`SELECT * FROM deposit_requests WHERE account_id = $1 ORDER BY created_at DESC`, [
        accountId,
      ]),
      pool.query(`SELECT * FROM withdraw_requests WHERE account_id = $1 ORDER BY created_at DESC`, [
        accountId,
      ]),
    ]);

    return {
      balance: Number(userRow?.["balance"] ?? 0),
      deposits: depRes.rows.map(mapDepositRow),
      withdrawals: wdRes.rows.map(mapWithdrawRow),
      limits,
      depositMethods,
      idrPerUsd: USD_TO_IDR_RATE,
    };
  },

  async createDeposit(input: {
    amount: number;
    amountIdr?: number;
    exchangeRate?: number;
    method: string;
    reference: string;
    proofImage: string;
    proofFileName: string;
  }): Promise<DepositRequestRecord> {
    const userId = await this.getCurrentTraderId();
    if (!userId) throw new Error("Trader tidak ditemukan untuk permintaan deposit.");
    const exchangeRate = input.exchangeRate ?? USD_TO_IDR_RATE;
    const amountIdr = input.amountIdr ?? Math.round(input.amount * exchangeRate);
    if (!pgReady || !pool) {
      const currentUser = memoryStore.users.find(
        (u) => u.accountId === memoryStore.profile.accountId,
      );
      if (!currentUser) throw new Error("Trader tidak ditemukan untuk permintaan deposit.");
      const created: DepositRequestRecord = {
        id: `DEP-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
        userId: currentUser.id,
        userName: currentUser.name,
        userEmail: currentUser.email,
        accountId: currentUser.accountId,
        method: input.method,
        reference: input.reference,
        amount: input.amount,
        amountIdr,
        exchangeRate,
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
    if (!userRow) throw new Error("Trader tidak ditemukan untuk permintaan deposit.");
    const created: DepositRequestRecord = {
      id: `DEP-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
      userId: String(userRow["id"]),
      userName: String(userRow["name"]),
      userEmail: String(userRow["email"]),
      accountId: String(userRow["account_id"]),
      method: input.method,
      reference: input.reference,
      amount: input.amount,
      amountIdr,
      exchangeRate,
      currency: "USD",
      proofImage: input.proofImage,
      proofFileName: input.proofFileName,
      status: "Menunggu",
      submittedAt: `Hari ini · ${nowWibLabel()}`,
    };

    await pool.query(
      `INSERT INTO deposit_requests (
         id, user_id, user_name, user_email, account_id, method, reference,
         amount, amount_idr, exchange_rate, currency, proof_image, proof_file_name, status, submitted_at
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        created.id,
        created.userId,
        created.userName,
        created.userEmail,
        created.accountId,
        created.method,
        created.reference,
        created.amount,
        created.amountIdr,
        created.exchangeRate,
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
      if (!currentUser) return { error: "Trader tidak ditemukan untuk permintaan penarikan." };
      if (input.amount > currentUser.balance) {
        return { error: "Saldo akun tidak mencukupi untuk penarikan ini." };
      }
      const created: WithdrawRequestRecord = {
        id: `WD-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
        userId: currentUser.id,
        userName: currentUser.name,
        userEmail: currentUser.email,
        accountId: currentUser.accountId,
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
    if (!userRow) return { error: "Trader tidak ditemukan untuk permintaan penarikan." };
    const balance = Number(userRow["balance"] ?? 0);
    if (input.amount > balance) {
      return { error: "Saldo akun tidak mencukupi untuk penarikan ini." };
    }
    const created: WithdrawRequestRecord = {
      id: `WD-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
      userId: String(userRow["id"]),
      userName: String(userRow["name"]),
      userEmail: String(userRow["email"]),
      accountId: String(userRow["account_id"]),
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
    await this.autoCloseExpiredPositions();
    if (!pgReady || !pool) {
      return memoryStore.positions.filter((p) => p.accountId === memoryStore.profile.accountId);
    }
    const { userRow } = await getActiveTraderRow(pool);
    const accountId = String(userRow?.["account_id"] ?? memoryStore.profile.accountId);
    const res = await pool.query(
      `SELECT * FROM positions WHERE account_id = $1 ORDER BY created_at DESC`,
      [accountId],
    );
    return res.rows.map(mapPositionRow);
  },

  async createPosition(
    body: Partial<TradePosition> & { stakeUsd?: number; amountIdr?: number },
  ): Promise<{
    error?: string;
    position?: TradePosition;
  }> {
    const symbol = body.symbol?.trim().toUpperCase();
    if (!symbol) return { error: "Pilih instrumen sebelum membuat order." };
    const spec = memoryStore.markets.find((m) => m.symbol === symbol);
    if (!spec || !spec.enabled) return { error: "Instrumen tidak tersedia." };
    const rules = await this.getTradingRules();
    const todayDate = getWibDateKey();

    const rawIdr =
      body.amountIdr !== undefined && body.amountIdr !== null ? Number(body.amountIdr) : Number.NaN;
    const rawUsd =
      body.stakeUsd !== undefined && body.stakeUsd !== null ? Number(body.stakeUsd) : Number.NaN;
    let stakeUsd =
      Number.isFinite(rawUsd) && rawUsd > 0
        ? Number(rawUsd.toFixed(2))
        : Number.isFinite(rawIdr) && rawIdr > 0
          ? Number((rawIdr / USD_TO_IDR_RATE).toFixed(2))
          : Number(body.lot) > 0
            ? Number((Number(body.lot) * 1000).toFixed(2))
            : Number.NaN;

    if (!Number.isFinite(stakeUsd) || stakeUsd < 1) {
      return { error: "Nominal posisi minimal $1.00 (Rp 17.000)." };
    }
    stakeUsd = Number(stakeUsd.toFixed(2));
    const lot = Number(Math.max(0.01, Math.min(50, stakeUsd / 1000)).toFixed(2));
    const isLimit = body.type === "Limit";
    const nowMs = Date.now();
    const openedAtMs = isLimit ? 0 : nowMs;
    const unlockAtMs = isLimit ? 0 : nowMs + rules.minCloseMinutes * 60_000;
    const requestedEntry = Number(body.entry);
    const entry =
      Number.isFinite(requestedEntry) && requestedEntry > 0
        ? requestedEntry
        : isLimit
          ? Number.NaN
          : body.side === "SELL"
            ? spec.bid
            : spec.ask;
    if (!Number.isFinite(entry) || entry <= 0) {
      return { error: "Harga order wajib diisi dengan nilai yang valid." };
    }

    if (!pgReady || !pool) {
      const currentUser = memoryStore.users.find(
        (u) => u.accountId === memoryStore.profile.accountId,
      );
      if (!currentUser) return { error: "Silakan masuk untuk membuat order." };
      const userPositions = memoryStore.positions.filter(
        (p) => p.accountId === memoryStore.profile.accountId,
      );
      const todayCount = userPositions.filter((p) => p.openedDate === todayDate).length;
      if (todayCount >= rules.maxDailyPositions) {
        return {
          error: `Batas maksimal open posisi hari ini telah tercapai (${todayCount}/${rules.maxDailyPositions} kali/hari). Silakan lanjutkan besok.`,
        };
      }

      const activeStakeUsed = userPositions
        .filter((p) => p.status === "Terbuka")
        .reduce((acc, cur) => acc + resolvePositionStakeUsd(cur), 0);
      const freeCapital = Math.max(0, (currentUser?.balance ?? 0) - activeStakeUsed);
      if (stakeUsd > freeCapital) {
        return {
          error: `Saldo bebas tidak mencukupi ($${freeCapital.toFixed(2)} tersedia, nominal dipilih $${stakeUsd.toFixed(2)}).`,
        };
      }

      const leverage = Math.max(
        50,
        Math.min(1000, Number(body.leverage) || memoryStore.profile.leverage || 500),
      );
      const order: TradePosition = {
        id: `ORD-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
        userId: currentUser.id,
        userName: currentUser.name,
        accountId: currentUser.accountId,
        symbol,
        type: isLimit ? "Limit" : "Market",
        side: body.side === "SELL" ? "SELL" : "BUY",
        lot,
        stakeUsd,
        leverage,
        entry,
        sl: body.sl || "-",
        tp: body.tp || "-",
        pnl: 0,
        status: isLimit ? "Tertunda" : "Terbuka",
        openedAt: nowWibLabel(),
        openedAtMs,
        unlockAtMs,
        openedDate: todayDate,
      };
      order.pnl = isLimit
        ? 0
        : computePositionFloatingPnl(order, spec, nowMs, rules.defaultProfitPercent);
      memoryStore.positions = [order, ...memoryStore.positions];
      return { position: order };
    }

    const { userRow } = await getActiveTraderRow(pool);
    if (!userRow) return { error: "Silakan masuk untuk membuat order." };
    const accountId = String(userRow["account_id"]);
    const userBalance = Number(userRow["balance"] ?? 0);
    const userLeverage = Number(userRow["leverage"] ?? 500);

    const [todayRes, activeRes] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS cnt FROM positions WHERE account_id = $1 AND opened_date = $2`,
        [accountId, todayDate],
      ),
      pool.query(
        `SELECT COALESCE(SUM(stake_usd), 0)::numeric AS used_stake FROM positions WHERE account_id = $1 AND status = 'Terbuka'`,
        [accountId],
      ),
    ]);
    const todayCount = Number(todayRes.rows[0]?.cnt ?? 0);
    if (todayCount >= rules.maxDailyPositions) {
      return {
        error: `Batas maksimal open posisi hari ini telah tercapai (${todayCount}/${rules.maxDailyPositions} kali/hari). Silakan lanjutkan besok.`,
      };
    }

    const activeStakeUsed = Number(activeRes.rows[0]?.used_stake ?? 0);
    const freeCapital = Math.max(0, userBalance - activeStakeUsed);
    if (stakeUsd > freeCapital) {
      return {
        error: `Saldo bebas tidak mencukupi ($${freeCapital.toFixed(2)} tersedia, nominal dipilih $${stakeUsd.toFixed(2)}).`,
      };
    }

    const leverage = Math.max(50, Math.min(1000, Number(body.leverage) || userLeverage || 500));
    const order: TradePosition = {
      id: `ORD-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
      userId: String(userRow["id"]),
      userName: String(userRow["name"]),
      accountId,
      symbol,
      type: isLimit ? "Limit" : "Market",
      side: body.side === "SELL" ? "SELL" : "BUY",
      lot,
      stakeUsd,
      leverage,
      entry,
      sl: body.sl || "-",
      tp: body.tp || "-",
      pnl: 0,
      status: isLimit ? "Tertunda" : "Terbuka",
      openedAt: nowWibLabel(),
      openedAtMs,
      unlockAtMs,
      openedDate: todayDate,
    };
    order.pnl = isLimit
      ? 0
      : computePositionFloatingPnl(order, spec, nowMs, rules.defaultProfitPercent);

    await pool.query(
      `INSERT INTO positions (
         id, user_id, user_name, account_id, symbol, order_type, side,
         lot, stake_usd, leverage, entry_price, stop_loss, take_profit, pnl, status,
         opened_at, opened_at_ms, unlock_at_ms, opened_date
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
      [
        order.id,
        order.userId,
        order.userName,
        order.accountId,
        order.symbol,
        order.type,
        order.side,
        order.lot,
        order.stakeUsd ?? stakeUsd,
        order.leverage,
        order.entry,
        order.sl,
        order.tp,
        order.pnl,
        order.status,
        order.openedAt,
        order.openedAtMs ?? 0,
        order.unlockAtMs ?? 0,
        order.openedDate ?? todayDate,
      ],
    );
    return { position: order };
  },

  async activatePosition(id: string): Promise<TradePosition | null> {
    const rules = await this.getTradingRules();
    const nowMs = Date.now();
    const unlockAtMs = nowMs + rules.minCloseMinutes * 60_000;
    const todayDate = getWibDateKey();

    if (!pgReady || !pool) {
      const target = memoryStore.positions.find((p) => p.id === id);
      if (!target) return null;
      if (target.status !== "Tertunda") return target;
      const spec = memoryStore.markets.find((m) => m.symbol === target.symbol);
      const activated: TradePosition = {
        ...target,
        status: "Terbuka",
        openedAt: nowWibLabel(),
        openedAtMs: nowMs,
        unlockAtMs,
        openedDate: target.openedDate || todayDate,
      };
      activated.pnl = computePositionFloatingPnl(
        activated,
        spec,
        nowMs,
        rules.defaultProfitPercent,
      );
      memoryStore.positions = memoryStore.positions.map((p) => (p.id === id ? activated : p));
      return activated;
    }

    const existing = await pool.query(`SELECT * FROM positions WHERE id = $1`, [id]);
    if (existing.rows.length === 0) return null;
    const pos = mapPositionRow(existing.rows[0] as Record<string, unknown>);
    if (pos.status !== "Tertunda") return pos;
    const spec = memoryStore.markets.find((m) => m.symbol === pos.symbol);
    const initialPnl = computePositionFloatingPnl(
      { ...pos, status: "Terbuka", openedAtMs: nowMs, unlockAtMs },
      spec,
      nowMs,
      rules.defaultProfitPercent,
    );

    const updated = await pool.query(
      `UPDATE positions
       SET status = 'Terbuka', opened_at = $1, opened_at_ms = $2, unlock_at_ms = $3, opened_date = $4, pnl = $5
       WHERE id = $6 RETURNING *`,
      [nowWibLabel(), nowMs, unlockAtMs, pos.openedDate || todayDate, initialPnl, id],
    );
    return mapPositionRow(updated.rows[0] as Record<string, unknown>);
  },

  async closePosition(
    id: string,
    _pnlInput?: number,
  ): Promise<{
    error?: string;
    status?: number;
    unlockAtMs?: number;
    position?: TradePosition;
    balance?: number;
  } | null> {
    const nowMs = Date.now();

    if (!pgReady || !pool) {
      const existing = memoryStore.positions.find((p) => p.id === id);
      if (!existing) return null;
      if (existing.status === "Ditutup") {
        const cur = memoryStore.users.find((u) => u.accountId === existing.accountId);
        return { position: existing, balance: cur?.balance ?? 0 };
      }

      const wasOpen = existing.status === "Terbuka";
      if (wasOpen && existing.unlockAtMs && nowMs < existing.unlockAtMs) {
        const countdown = formatHoldCountdown(existing.unlockAtMs, nowMs);
        return {
          error: `Posisi masih terkunci. Waktu minimal tutup posisi tersisa ${countdown.label}.`,
          status: 400,
          unlockAtMs: existing.unlockAtMs,
        };
      }

      const rules = await this.getTradingRules();
      const market = memoryStore.markets.find((m) => m.symbol === existing.symbol);
      const settledPnl = wasOpen
        ? computePositionFloatingPnl(existing, market, nowMs, rules.defaultProfitPercent)
        : 0;

      memoryStore.positions = memoryStore.positions.map((p) =>
        p.id === id ? { ...p, status: "Ditutup", pnl: settledPnl } : p,
      );
      if (wasOpen && settledPnl > 0) {
        memoryStore.users = memoryStore.users.map((u) =>
          u.accountId === existing.accountId
            ? { ...u, balance: Number(Math.max(0, u.balance + settledPnl).toFixed(2)) }
            : u,
        );
      }
      const updated = memoryStore.positions.find((p) => p.id === id)!;
      const cur = memoryStore.users.find((u) => u.accountId === existing.accountId);
      return { position: updated, balance: cur?.balance ?? 0 };
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
          balance: Number(uRes.rows[0]?.balance ?? 0),
        };
      }

      const wasOpen = existing.status === "Terbuka";
      if (wasOpen && existing.unlockAtMs && nowMs < existing.unlockAtMs) {
        const countdown = formatHoldCountdown(existing.unlockAtMs, nowMs);
        await client.query("ROLLBACK");
        return {
          error: `Posisi masih terkunci. Waktu minimal tutup posisi tersisa ${countdown.label}.`,
          status: 400,
          unlockAtMs: existing.unlockAtMs,
        };
      }

      const rules = await this.getTradingRules();
      const market = memoryStore.markets.find((m) => m.symbol === existing.symbol);
      const settledPnl = wasOpen
        ? computePositionFloatingPnl(existing, market, nowMs, rules.defaultProfitPercent)
        : 0;

      const updatedPosRes = await client.query(
        `UPDATE positions SET status = 'Ditutup', pnl = $1 WHERE id = $2 RETURNING *`,
        [settledPnl, id],
      );

      let nextBalance = 0;
      if (wasOpen && settledPnl > 0) {
        const uUpd = await client.query(
          `UPDATE users SET balance = GREATEST(0, ROUND((balance + $1)::numeric, 2))
           WHERE account_id = $2 RETURNING balance`,
          [settledPnl, existing.accountId],
        );
        nextBalance = Number(uUpd.rows[0]?.balance ?? 0);
      } else {
        const uRes = await client.query(`SELECT balance FROM users WHERE account_id = $1`, [
          existing.accountId,
        ]);
        nextBalance = Number(uRes.rows[0]?.balance ?? 0);
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
    const symbol = body.symbol?.trim();
    const entry = body.entry?.trim();
    const exit = body.exit?.trim();
    if (
      !symbol ||
      !entry ||
      !exit ||
      !Number.isFinite(Number(body.lot)) ||
      Number(body.lot) <= 0 ||
      !Number.isFinite(Number(body.pnl)) ||
      !body.strategy
    ) {
      throw new Error("Data jurnal tidak lengkap atau tidak valid.");
    }
    const created: JournalRecord = {
      id: `JRN-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
      date: body.date || new Date().toLocaleDateString("id-ID"),
      symbol: symbol.toUpperCase(),
      side: body.side === "SELL" ? "SELL" : "BUY",
      lot: Number(body.lot),
      entry,
      exit,
      pnl: Number(body.pnl),
      rr: Number(body.pnl) >= 0 ? "1:2.0" : "1:1.0",
      strategy: body.strategy,
      emotion: body.emotion || "Tercatat",
      notes: body.notes ?? "",
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

  async getCurrentTraderId(): Promise<string | null> {
    if (!pgReady || !pool) {
      if (!memoryStore.profile.loggedIn) return null;
      return (
        memoryStore.users.find((user) => user.accountId === memoryStore.profile.accountId)?.id ??
        null
      );
    }
    const { userRow, loggedIn } = await getActiveTraderRow(pool);
    return loggedIn && userRow ? String(userRow["id"]) : null;
  },

  async getMessages(): Promise<InboxMessage[]> {
    if (!pgReady || !pool) return memoryStore.messages;
    const res = await pool.query(`SELECT * FROM inbox_messages ORDER BY created_at DESC`);
    return res.rows.map(mapMessageRow);
  },

  async getMessagesForUser(userId: string): Promise<InboxMessage[]> {
    if (!pgReady || !pool) {
      return memoryStore.messages.filter(
        (message) => message.recipientUserId == null || message.recipientUserId === userId,
      );
    }
    const res = await pool.query(
      `SELECT * FROM inbox_messages
       WHERE recipient_user_id IS NULL OR recipient_user_id = $1
       ORDER BY created_at DESC`,
      [userId],
    );
    return res.rows.map(mapMessageRow);
  },

  async getAdminMessages(): Promise<InboxMessage[]> {
    return this.getMessages();
  },

  async createMessage(
    body: { subject?: string; body?: string },
    recipientUserId?: string,
  ): Promise<InboxMessage> {
    const targetUserId = recipientUserId ?? (await this.getCurrentTraderId());
    const subject = body.subject?.trim();
    const content = body.body?.trim();
    if (!subject || !content) throw new Error("Subjek dan isi pesan wajib diisi.");
    const created: InboxMessage = {
      id: `MSG-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
      recipientUserId: targetUserId,
      sender: "Anda → Tim Dukungan wmTrader",
      subject,
      preview: content.slice(0, 90),
      body: content,
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
         id, recipient_user_id, sender, subject, preview, body, category, timestamp_label, unread, archived
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        created.id,
        created.recipientUserId,
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

  async updateMessageForUser(
    id: string,
    userId: string,
    patch: Partial<Pick<InboxMessage, "unread" | "archived">>,
  ): Promise<InboxMessage | null> {
    if (!pgReady || !pool) {
      const existing = memoryStore.messages.find(
        (message) =>
          message.id === id &&
          (message.recipientUserId == null || message.recipientUserId === userId),
      );
      if (!existing) return null;
      const updated = { ...existing, ...patch };
      memoryStore.messages = memoryStore.messages.map((message) =>
        message.id === id ? updated : message,
      );
      return updated;
    }
    const current = await pool.query(
      `SELECT * FROM inbox_messages
       WHERE id = $1 AND (recipient_user_id IS NULL OR recipient_user_id = $2)`,
      [id, userId],
    );
    if (current.rows.length === 0) return null;
    const existing = mapMessageRow(current.rows[0] as Record<string, unknown>);
    const result = await pool.query(
      `UPDATE inbox_messages
       SET unread = $1, archived = $2
       WHERE id = $3 AND (recipient_user_id IS NULL OR recipient_user_id = $4)
       RETURNING *`,
      [
        typeof patch.unread === "boolean" ? patch.unread : existing.unread,
        typeof patch.archived === "boolean" ? patch.archived : existing.archived,
        id,
        userId,
      ],
    );
    return result.rows[0] ? mapMessageRow(result.rows[0] as Record<string, unknown>) : null;
  },

  async deleteMessageForUser(id: string, userId: string): Promise<boolean> {
    if (!pgReady || !pool) {
      const exists = memoryStore.messages.some(
        (message) =>
          message.id === id &&
          (message.recipientUserId == null || message.recipientUserId === userId),
      );
      if (!exists) return false;
      memoryStore.messages = memoryStore.messages.filter((message) => message.id !== id);
      return true;
    }
    const result = await pool.query(
      `DELETE FROM inbox_messages
       WHERE id = $1 AND (recipient_user_id IS NULL OR recipient_user_id = $2)`,
      [id, userId],
    );
    return (result.rowCount ?? 0) > 0;
  },

  async sendAdminMessage(params: {
    recipientUserId: string | null;
    subject: string;
    body: string;
    category: InboxMessage["category"];
    adminEmail: string;
  }): Promise<{ error?: string; messages?: InboxMessage[] }> {
    const users = await this.getAdminUsers();
    const recipients =
      params.recipientUserId === null
        ? users
        : users.filter((user) => user.id === params.recipientUserId);
    if (recipients.length === 0) {
      return {
        error:
          params.recipientUserId === null
            ? "Tidak ada pengguna untuk menerima surat."
            : "Pengguna yang dipilih tidak ditemukan.",
      };
    }

    const messages = recipients.map((user, index): InboxMessage => ({
      id: `MSG-${Date.now()}-${index}-${crypto.randomBytes(4).toString("hex")}`,
      recipientUserId: user.id,
      sender: "Admin wmTrader",
      subject: params.subject.trim(),
      preview: params.body.trim().slice(0, 90),
      body: params.body.trim(),
      category: params.category,
      timestamp: `Hari ini · ${nowWibLabel()}`,
      unread: true,
      archived: false,
    }));
    const log: AuditLogRecord = {
      id: `AUD-${crypto.randomBytes(5).toString("hex")}`,
      timestamp: `Hari ini · ${nowWibLabel()}`,
      actor: params.adminEmail,
      action: "Kirim Surat Admin",
      target:
        params.recipientUserId === null
          ? "Semua Pengguna"
          : `${recipients[0]!.name} (${recipients[0]!.accountId})`,
      detail: `Subjek: ${params.subject.trim()} · Terkirim kepada ${messages.length} pengguna.`,
    };

    if (!pgReady || !pool) {
      memoryStore.messages = [...messages, ...memoryStore.messages];
      memoryStore.auditLogs = [log, ...memoryStore.auditLogs];
      return { messages };
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const message of messages) {
        await client.query(
          `INSERT INTO inbox_messages (
             id, recipient_user_id, sender, subject, preview, body, category,
             timestamp_label, unread, archived
           )
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            message.id,
            message.recipientUserId,
            message.sender,
            message.subject,
            message.preview,
            message.body,
            message.category,
            message.timestamp,
            message.unread,
            message.archived,
          ],
        );
      }
      await client.query(
        `INSERT INTO audit_logs (id, timestamp_label, actor, action, target, detail)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [log.id, log.timestamp, log.actor, log.action, log.target, log.detail],
      );
      await client.query("COMMIT");
      return { messages };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
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
    const author = session.name.trim();
    const pair = body.pair?.trim();
    const title = body.title?.trim();
    const content = body.content?.trim();
    if (!author || !pair || !title || !content) {
      throw new Error("Instrumen, judul, isi, dan penulis ide wajib diisi.");
    }
    const created: CommunityPostRecord = {
      id: `POST-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
      author,
      pair: pair.toUpperCase(),
      bias: body.bias ?? "Bullish",
      category: body.category ?? "Analisis Teknikal",
      timeAgo: "Baru saja",
      title,
      content,
      likes: 0,
      likedByMe: false,
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

  async deleteAdminDeposit(id: string, adminEmail: string): Promise<boolean> {
    let target: DepositRequestRecord;
    if (!pgReady || !pool) {
      const found = memoryStore.deposits.find((deposit) => deposit.id === id);
      if (!found) return false;
      target = found;
      memoryStore.deposits = memoryStore.deposits.filter((deposit) => deposit.id !== id);
    } else {
      const deleted = await pool.query(`DELETE FROM deposit_requests WHERE id = $1 RETURNING *`, [
        id,
      ]);
      if (deleted.rows.length === 0) return false;
      target = mapDepositRow(deleted.rows[0] as Record<string, unknown>);
    }

    await this.appendAuditLog({
      id: `AUD-${Math.floor(110 + Math.random() * 890)}`,
      timestamp: `Hari ini · ${nowWibLabel()}`,
      actor: adminEmail,
      action: "Hapus Deposit",
      target: `${target.id} (${target.accountId})`,
      detail: `Permintaan deposit $${target.amount.toFixed(2)} dihapus; saldo akun tidak berubah.`,
    });
    return true;
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

  async deleteAdminWithdrawal(id: string, adminEmail: string): Promise<boolean> {
    let target: WithdrawRequestRecord;
    if (!pgReady || !pool) {
      const found = memoryStore.withdrawals.find((withdrawal) => withdrawal.id === id);
      if (!found) return false;
      target = found;
      memoryStore.withdrawals = memoryStore.withdrawals.filter(
        (withdrawal) => withdrawal.id !== id,
      );
    } else {
      const deleted = await pool.query(`DELETE FROM withdraw_requests WHERE id = $1 RETURNING *`, [
        id,
      ]);
      if (deleted.rows.length === 0) return false;
      target = mapWithdrawRow(deleted.rows[0] as Record<string, unknown>);
    }

    await this.appendAuditLog({
      id: `AUD-${Math.floor(110 + Math.random() * 890)}`,
      timestamp: `Hari ini · ${nowWibLabel()}`,
      actor: adminEmail,
      action: "Hapus Withdraw",
      target: `${target.id} (${target.accountId})`,
      detail: `Permintaan withdraw $${target.amount.toFixed(2)} dihapus; saldo akun tidak berubah.`,
    });
    return true;
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

  async deleteAdminUser(id: string, adminEmail: string): Promise<boolean> {
    let target: AdminUserRecord;
    if (!pgReady || !pool) {
      const found = memoryStore.users.find((user) => user.id === id);
      if (!found) return false;
      target = found;
      memoryStore.users = memoryStore.users.filter((user) => user.id !== id);
      memoryStore.positions = memoryStore.positions.filter(
        (position) => position.userId !== id && position.accountId !== target.accountId,
      );
      memoryStore.deposits = memoryStore.deposits.filter(
        (deposit) => deposit.userId !== id && deposit.accountId !== target.accountId,
      );
      memoryStore.withdrawals = memoryStore.withdrawals.filter(
        (withdrawal) => withdrawal.userId !== id && withdrawal.accountId !== target.accountId,
      );
      memoryStore.messages = memoryStore.messages.filter(
        (message) => message.recipientUserId !== id,
      );
      if (memoryStore.profile.accountId === target.accountId) {
        memoryStore.profile.loggedIn = false;
      }
    } else {
      const deleted = await pool.query(`DELETE FROM users WHERE id = $1 RETURNING *`, [id]);
      if (deleted.rows.length === 0) return false;
      target = mapUserRow(deleted.rows[0] as Record<string, unknown>);
      await pool.query(
        `UPDATE app_sessions
         SET account_id = NULL, email = NULL, logged_in = FALSE, updated_at = NOW()
         WHERE kind = 'trader' AND account_id = $1`,
        [target.accountId],
      );
    }

    await this.appendAuditLog({
      id: `AUD-${Math.floor(110 + Math.random() * 890)}`,
      timestamp: `Hari ini · ${nowWibLabel()}`,
      actor: adminEmail,
      action: "Hapus Pengguna",
      target: `${target.name} (${target.accountId})`,
      detail: `Akun pengguna dan seluruh posisi, deposit, serta withdraw terkait dihapus.`,
    });
    return true;
  },

  async getAdminAudit(): Promise<AuditLogRecord[]> {
    if (!pgReady || !pool) return memoryStore.auditLogs;
    const res = await pool.query(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100`);
    return res.rows.map(mapAuditRow);
  },

  async autoCloseExpiredPositions(): Promise<number> {
    if (autoClosingInProgress) return 0;
    autoClosingInProgress = true;
    try {
      const nowMs = Date.now();
      const rules = await this.getTradingRules();

      if (!pgReady || !pool) {
        const expired = memoryStore.positions.filter(
          (p) =>
            p.status === "Terbuka" &&
            typeof p.unlockAtMs === "number" &&
            p.unlockAtMs > 0 &&
            nowMs >= p.unlockAtMs,
        );
        if (expired.length === 0) return 0;

        for (const existing of expired) {
          const market = memoryStore.markets.find((m) => m.symbol === existing.symbol);
          const settledPnl = computePositionFloatingPnl(
            existing,
            market,
            nowMs,
            rules.defaultProfitPercent,
          );
          memoryStore.positions = memoryStore.positions.map((p) =>
            p.id === existing.id ? { ...p, status: "Ditutup", pnl: settledPnl } : p,
          );
          if (settledPnl > 0) {
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
              actor: "sistem@ictrading.id",
              action: "Tutup Posisi Otomatis",
              target: `${existing.id} (${existing.accountId})`,
              detail: `${existing.symbol} ${existing.side} · Realisasi keuntungan otomatis +$${settledPnl.toFixed(2)}`,
            },
            ...memoryStore.auditLogs,
          ];
        }
        return expired.length;
      }

      const expiredRes = await pool.query(
        `SELECT id FROM positions WHERE status = 'Terbuka' AND unlock_at_ms > 0 AND unlock_at_ms <= $1`,
        [nowMs],
      );
      if (expiredRes.rows.length === 0) return 0;

      let closedCount = 0;
      for (const row of expiredRes.rows) {
        const posId = String((row as Record<string, unknown>).id);
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const locked = await client.query(`SELECT * FROM positions WHERE id = $1 FOR UPDATE`, [
            posId,
          ]);
          if (locked.rows.length === 0) {
            await client.query("ROLLBACK");
            continue;
          }
          const existing = mapPositionRow(locked.rows[0] as Record<string, unknown>);
          if (
            existing.status !== "Terbuka" ||
            !existing.unlockAtMs ||
            existing.unlockAtMs <= 0 ||
            nowMs < existing.unlockAtMs
          ) {
            await client.query("ROLLBACK");
            continue;
          }

          const market = memoryStore.markets.find((m) => m.symbol === existing.symbol);
          const settledPnl = computePositionFloatingPnl(
            existing,
            market,
            nowMs,
            rules.defaultProfitPercent,
          );

          await client.query(
            `UPDATE positions SET status = 'Ditutup', pnl = $1 WHERE id = $2 AND status = 'Terbuka'`,
            [settledPnl, posId],
          );

          if (settledPnl > 0) {
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
              "sistem@ictrading.id",
              "Tutup Posisi Otomatis",
              `${existing.id} (${existing.accountId})`,
              `${existing.symbol} ${existing.side} · Realisasi keuntungan otomatis +$${settledPnl.toFixed(2)}`,
            ],
          );

          await client.query("COMMIT");
          closedCount += 1;
        } catch {
          await client.query("ROLLBACK").catch(() => {});
        } finally {
          client.release();
        }
      }
      return closedCount;
    } finally {
      autoClosingInProgress = false;
    }
  },

  async getAdminPositions() {
    await this.autoCloseExpiredPositions();
    const rules = await this.getTradingRules();
    const positions =
      !pgReady || !pool
        ? memoryStore.positions
        : (await pool.query(`SELECT * FROM positions ORDER BY created_at DESC`)).rows.map(
            mapPositionRow,
          );

    const nowMs = Date.now();
    return positions.map((pos) => {
      const market = memoryStore.markets.find((m) => m.symbol === pos.symbol);
      const currentPrice = market ? (pos.side === "BUY" ? market.bid : market.ask) : pos.entry;
      const livePnl = computePositionFloatingPnl(pos, market, nowMs, rules.defaultProfitPercent);
      const targetProfitUsd = resolveTargetProfitUsd(pos, rules.defaultProfitPercent);
      return {
        ...pos,
        adminProfitUsd: pos.adminProfitUsd ?? targetProfitUsd,
        currentPrice,
        decimals: market?.decimals ?? 5,
        livePnl,
      };
    });
  },

  async deleteAdminPosition(id: string, adminEmail: string): Promise<boolean> {
    let target: TradePosition;
    if (!pgReady || !pool) {
      const found = memoryStore.positions.find((position) => position.id === id);
      if (!found) return false;
      target = found;
      memoryStore.positions = memoryStore.positions.filter((position) => position.id !== id);
    } else {
      const deleted = await pool.query(`DELETE FROM positions WHERE id = $1 RETURNING *`, [id]);
      if (deleted.rows.length === 0) return false;
      target = mapPositionRow(deleted.rows[0] as Record<string, unknown>);
    }

    await this.appendAuditLog({
      id: `AUD-${Math.floor(110 + Math.random() * 890)}`,
      timestamp: `Hari ini · ${nowWibLabel()}`,
      actor: adminEmail,
      action: "Hapus Posisi",
      target: `${target.id} (${target.accountId})`,
      detail: `Posisi ${target.symbol} ${target.side} dihapus; riwayat saldo tidak berubah.`,
    });
    return true;
  },

  async setPositionAdminProfit(
    id: string,
    profitUsd: number,
    adminEmail: string,
  ): Promise<{ error?: string; status?: number; position?: TradePosition & { livePnl: number } }> {
    if (!Number.isFinite(profitUsd) || profitUsd < 0.5 || profitUsd > 1_000_000) {
      return {
        error: "Nominal keuntungan posisi harus antara $0.50 sampai $1,000,000.00 USD.",
        status: 400,
      };
    }

    const cleanProfit = Number(profitUsd.toFixed(2));
    const rules = await this.getTradingRules();
    const nowMs = Date.now();

    if (!pgReady || !pool) {
      const existing = memoryStore.positions.find((p) => p.id === id);
      if (!existing) return { error: "Posisi tidak ditemukan.", status: 404 };
      if (existing.status === "Ditutup") {
        return {
          error: "Posisi yang sudah ditutup tidak dapat diubah keuntungannya.",
          status: 400,
        };
      }

      const market = memoryStore.markets.find((m) => m.symbol === existing.symbol);
      const draft: TradePosition = { ...existing, adminProfitUsd: cleanProfit };
      const livePnl = computePositionFloatingPnl(draft, market, nowMs, rules.defaultProfitPercent);
      const updated: TradePosition = {
        ...draft,
        pnl: existing.status === "Terbuka" ? livePnl : 0,
      };
      memoryStore.positions = memoryStore.positions.map((p) => (p.id === id ? updated : p));
      memoryStore.auditLogs = [
        {
          id: `AUD-${Math.floor(110 + Math.random() * 890)}`,
          timestamp: `Hari ini · ${nowWibLabel()}`,
          actor: adminEmail,
          action: "Atur Keuntungan Posisi",
          target: `${existing.id} (${existing.accountId})`,
          detail: `${existing.symbol} ${existing.side} — Target keuntungan ditetapkan $${cleanProfit.toFixed(2)} USD`,
        },
        ...memoryStore.auditLogs,
      ];
      return { position: { ...updated, livePnl } };
    }

    const cur = await pool.query(`SELECT * FROM positions WHERE id = $1`, [id]);
    if (cur.rows.length === 0) return { error: "Posisi tidak ditemukan.", status: 404 };
    const existing = mapPositionRow(cur.rows[0] as Record<string, unknown>);
    if (existing.status === "Ditutup") {
      return { error: "Posisi yang sudah ditutup tidak dapat diubah keuntungannya.", status: 400 };
    }

    const market = memoryStore.markets.find((m) => m.symbol === existing.symbol);
    const livePnl = computePositionFloatingPnl(
      { ...existing, adminProfitUsd: cleanProfit },
      market,
      nowMs,
      rules.defaultProfitPercent,
    );
    const nextPnl = existing.status === "Terbuka" ? livePnl : 0;

    const upd = await pool.query(
      `UPDATE positions SET admin_profit_usd = $1, pnl = $2 WHERE id = $3 RETURNING *`,
      [cleanProfit, nextPnl, id],
    );

    await this.appendAuditLog({
      id: `AUD-${Math.floor(110 + Math.random() * 890)}`,
      timestamp: `Hari ini · ${nowWibLabel()}`,
      actor: adminEmail,
      action: "Atur Keuntungan Posisi",
      target: `${existing.id} (${existing.accountId})`,
      detail: `${existing.symbol} ${existing.side} — Target keuntungan ditetapkan $${cleanProfit.toFixed(2)} USD`,
    });

    const saved = mapPositionRow(upd.rows[0] as Record<string, unknown>);
    return { position: { ...saved, livePnl } };
  },

  async adminClosePosition(
    id: string,
    adminEmail: string,
    overrideProfitUsd?: number,
  ): Promise<TradePosition | null> {
    const rules = await this.getTradingRules();
    const nowMs = Date.now();

    if (!pgReady || !pool) {
      const existing = memoryStore.positions.find((p) => p.id === id);
      if (!existing) return null;
      if (existing.status === "Ditutup") return existing;
      const market = memoryStore.markets.find((m) => m.symbol === existing.symbol);
      const wasOpen = existing.status === "Terbuka";
      const settledPnl = wasOpen
        ? overrideProfitUsd !== undefined && Number.isFinite(overrideProfitUsd)
          ? Number(overrideProfitUsd.toFixed(2))
          : resolveTargetProfitUsd(existing, rules.defaultProfitPercent)
        : 0;

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
      const settledPnl = wasOpen
        ? overrideProfitUsd !== undefined && Number.isFinite(overrideProfitUsd)
          ? Number(overrideProfitUsd.toFixed(2))
          : resolveTargetProfitUsd(existing, rules.defaultProfitPercent)
        : 0;

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
