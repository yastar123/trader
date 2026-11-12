export type VerificationStatus = "Menunggu" | "Disetujui" | "Ditolak";

export type AdminSessionState = {
  authenticated: boolean;
  email: string | null;
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

export type DepositRequestRecord = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  accountId: string;
  method: string;
  reference: string;
  amount: number;
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
  leverage: number;
  entry: number;
  currentPrice: number;
  decimals: number;
  sl: string;
  tp: string;
  pnl: number;
  livePnl: number;
  status: "Terbuka" | "Tertunda" | "Ditutup";
  openedAt: string;
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

export function formatUsd(value: number): string {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
