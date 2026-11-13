-- IC Trading PostgreSQL Schema
-- Dijalankan melalui: npm run db:push

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  account_type TEXT NOT NULL DEFAULT 'Raw Spread',
  currency TEXT NOT NULL DEFAULT 'USD',
  timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta (WIB)',
  leverage INTEGER NOT NULL DEFAULT 500,
  balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  kyc_status TEXT NOT NULL DEFAULT 'Menunggu',
  status TEXT NOT NULL DEFAULT 'Aktif',
  joined_at TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS markets (
  symbol TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  base_price NUMERIC(18, 6) NOT NULL,
  bid NUMERIC(18, 6) NOT NULL,
  ask NUMERIC(18, 6) NOT NULL,
  prev_bid NUMERIC(18, 6) NOT NULL,
  open_day NUMERIC(18, 6) NOT NULL,
  spread_value NUMERIC(18, 6) NOT NULL,
  spread_label TEXT NOT NULL,
  pip_size NUMERIC(18, 6) NOT NULL,
  tick_step NUMERIC(18, 6) NOT NULL,
  decimals INTEGER NOT NULL DEFAULT 2,
  contract_size INTEGER NOT NULL DEFAULT 100,
  quote_in_jpy BOOLEAN NOT NULL DEFAULT FALSE,
  trend_bias TEXT NOT NULL DEFAULT 'Netral',
  trend_strength INTEGER NOT NULL DEFAULT 2,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  candles_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS positions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  account_id TEXT NOT NULL,
  symbol TEXT NOT NULL,
  order_type TEXT NOT NULL,
  side TEXT NOT NULL,
  lot NUMERIC(10, 2) NOT NULL,
  stake_usd NUMERIC(14, 2) NOT NULL DEFAULT 100.00,
  leverage INTEGER NOT NULL DEFAULT 500,
  entry_price NUMERIC(18, 6) NOT NULL,
  stop_loss TEXT NOT NULL DEFAULT '-',
  take_profit TEXT NOT NULL DEFAULT '-',
  pnl NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  admin_profit_usd NUMERIC(14, 2),
  status TEXT NOT NULL,
  opened_at TEXT NOT NULL,
  opened_at_ms BIGINT NOT NULL DEFAULT 0,
  unlock_at_ms BIGINT NOT NULL DEFAULT 0,
  opened_date TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deposit_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  account_id TEXT NOT NULL,
  method TEXT NOT NULL,
  reference TEXT NOT NULL,
  amount NUMERIC(14, 2) NOT NULL,
  amount_idr NUMERIC(16, 2),
  exchange_rate NUMERIC(12, 2) DEFAULT 17000.00,
  currency TEXT NOT NULL DEFAULT 'USD',
  proof_image TEXT,
  proof_file_name TEXT,
  status TEXT NOT NULL DEFAULT 'Menunggu',
  submitted_at TEXT NOT NULL,
  reviewed_at TEXT,
  reviewed_by TEXT,
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS withdraw_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  account_id TEXT NOT NULL,
  destination TEXT NOT NULL,
  amount NUMERIC(14, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'Menunggu',
  submitted_at TEXT NOT NULL,
  reviewed_at TEXT,
  reviewed_by TEXT,
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY,
  entry_date TEXT NOT NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  lot NUMERIC(10, 2) NOT NULL,
  entry_price TEXT NOT NULL,
  exit_price TEXT NOT NULL,
  pnl NUMERIC(14, 2) NOT NULL,
  rr TEXT NOT NULL,
  strategy TEXT NOT NULL,
  emotion TEXT NOT NULL,
  notes TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inbox_messages (
  id TEXT PRIMARY KEY,
  sender TEXT NOT NULL,
  subject TEXT NOT NULL,
  preview TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL,
  timestamp_label TEXT NOT NULL,
  unread BOOLEAN NOT NULL DEFAULT TRUE,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE inbox_messages
  ADD COLUMN IF NOT EXISTS recipient_user_id TEXT
  REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS inbox_messages_recipient_created_idx
  ON inbox_messages (recipient_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS community_posts (
  id TEXT PRIMARY KEY,
  author TEXT NOT NULL,
  pair TEXT NOT NULL,
  bias TEXT NOT NULL,
  category TEXT NOT NULL,
  time_ago TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  likes INTEGER NOT NULL DEFAULT 0,
  liked_by_me BOOLEAN NOT NULL DEFAULT FALSE,
  comments_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  timestamp_label TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  detail TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_sessions (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  account_id TEXT,
  email TEXT,
  logged_in BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallet_limits (
  id TEXT PRIMARY KEY,
  min_deposit NUMERIC(14, 2) NOT NULL DEFAULT 10.00,
  max_deposit NUMERIC(14, 2) NOT NULL DEFAULT 50000.00,
  min_withdraw NUMERIC(14, 2) NOT NULL DEFAULT 10.00,
  max_withdraw NUMERIC(14, 2) NOT NULL DEFAULT 25000.00,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deposit_methods (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  account_info TEXT NOT NULL,
  account_holder TEXT NOT NULL,
  fee TEXT NOT NULL,
  eta TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trading_rules (
  id TEXT PRIMARY KEY,
  max_daily_positions INTEGER NOT NULL DEFAULT 5,
  min_close_minutes INTEGER NOT NULL DEFAULT 5,
  default_profit_percent NUMERIC(8, 2) NOT NULL DEFAULT 10.00,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE markets ADD COLUMN IF NOT EXISTS candles_json JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS liked_by_me BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE deposit_requests ADD COLUMN IF NOT EXISTS amount_idr NUMERIC(16, 2);
ALTER TABLE deposit_requests ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(12, 2) DEFAULT 17000.00;
ALTER TABLE positions ADD COLUMN IF NOT EXISTS stake_usd NUMERIC(14, 2) NOT NULL DEFAULT 100.00;
ALTER TABLE positions ADD COLUMN IF NOT EXISTS admin_profit_usd NUMERIC(14, 2);
ALTER TABLE positions ADD COLUMN IF NOT EXISTS opened_at_ms BIGINT NOT NULL DEFAULT 0;
ALTER TABLE positions ADD COLUMN IF NOT EXISTS unlock_at_ms BIGINT NOT NULL DEFAULT 0;
ALTER TABLE positions ADD COLUMN IF NOT EXISTS opened_date TEXT NOT NULL DEFAULT '';
ALTER TABLE trading_rules ADD COLUMN IF NOT EXISTS default_profit_percent NUMERIC(8, 2) NOT NULL DEFAULT 10.00;
