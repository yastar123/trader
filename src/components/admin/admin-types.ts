export type VerificationStatus = "Menunggu" | "Disetujui" | "Ditolak";

export type AdminSessionState = {
  authenticated: boolean;
  email: string | null;
};

export type CalendarEventRecord = {
  id: string;
  type: "Kalender Ekonomi" | "Jadwal Akademi";
  date: string;
  time: string;
  title: string;
  description: string;
  currency: string;
  impact: "Tinggi" | "Sedang" | "Rendah";
  actual: string;
  forecast: string;
  previous: string;
  mentor: string;
  level: "Pemula" | "Menengah" | "Lanjutan";
  format: string;
  createdAt: string;
};

export type AdminUserRecord = {
  id: string;
  accountId: string;
  name: string;
  email: string;
  accountType: "Raw Spread" | "Standard";
  balance: number;
  kycStatus: "Terverifikasi" | "Menunggu";
  status: "Aktif" | "Ditangguhkan";
  joinedAt: string;
};

export type DepositMethodRecord = {
  id: string;
  label: string;
  accountInfo: string;
  accountHolder: string;
  fee: string;
  eta: string;
  enabled: boolean;
  sortOrder?: number;
};

export type DepositRequestRecord = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  accountId: string;
  method: string;
  reference: string;
  amount: number;
  amountIdr?: number;
  exchangeRate?: number;
  currency: "USD";
  proofImage?: string;
  proofFileName?: string;
  status: VerificationStatus;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  adminNote?: string;
};

export type WithdrawRequestRecord = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  accountId: string;
  destination: string;
  amount: number;
  currency: "USD";
  status: VerificationStatus;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  adminNote?: string;
};

export type AuditLogRecord = {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  detail: string;
};

export type MarketCategory = "Forex" | "Logam Mulia" | "Energi / Oil" | "Kripto / Coin" | "Indeks";

export type TrendBias = "Naik" | "Netral" | "Turun";

export type CandleRecord = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type MarketInstrumentRecord = {
  symbol: string;
  name: string;
  category: MarketCategory;
  basePrice: number;
  bid: number;
  ask: number;
  prevBid: number;
  openDay: number;
  spreadValue: number;
  spreadLabel: string;
  pipSize: number;
  tickStep: number;
  decimals: number;
  contractSize: number;
  quoteInJpy?: boolean;
  trendBias: TrendBias;
  trendStrength: 1 | 2 | 3;
  enabled: boolean;
  candles: CandleRecord[];
};

export type AdminPositionRecord = {
  id: string;
  userId: string;
  userName: string;
  accountId: string;
  symbol: string;
  type: "Market" | "Limit";
  side: "BUY" | "SELL";
  lot: number;
  stakeUsd?: number;
  leverage: number;
  entry: number;
  currentPrice: number;
  decimals: number;
  sl: string;
  tp: string;
  pnl: number;
  livePnl: number;
  adminProfitUsd?: number;
  status: "Terbuka" | "Tertunda" | "Ditutup";
  openedAt: string;
  openedAtMs?: number;
  unlockAtMs?: number;
  openedDate?: string;
};

export type AdminOverviewResponse = {
  stats: {
    pendingDepositsCount: number;
    pendingWithdrawalsCount: number;
    approvedDepositTotal: number;
    approvedWithdrawTotal: number;
    totalUsersCount: number;
    activeUsersCount: number;
  };
  pendingDeposits: DepositRequestRecord[];
  pendingWithdrawals: WithdrawRequestRecord[];
  recentAudit: AuditLogRecord[];
};

export type WalletLimitsRecord = {
  minDeposit: number;
  maxDeposit: number;
  minWithdraw: number;
  maxWithdraw: number;
  updatedBy?: string;
  updatedAt?: string;
};

export type { TradingRulesRecord } from "@/lib/trading";

export {
  USD_TO_IDR_RATE,
  formatIdr,
  formatMoneyPair,
  formatUsd,
  type DisplayCurrency,
} from "@/lib/currency";
