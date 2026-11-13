import {
  computeGuaranteedPositionPnl,
  DEFAULT_TRADING_RULES,
  getWibDateKey,
  type TradingRulesRecord,
} from "../lib/trading.ts";

export { getWibDateKey, type TradingRulesRecord };

export type UserProfile = {
  name: string;
  email: string;
  accountId: string;
  accountType: "Raw Spread" | "Standard";
  currency: "USD" | "IDR";
  timezone: string;
  leverage: number;
  loggedIn: boolean;
};

export type CandleRecord = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type MarketCategory = "Forex" | "Logam Mulia" | "Energi / Oil" | "Kripto / Coin" | "Indeks";

export type TrendBias = "Naik" | "Netral" | "Turun";

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

export type TradePosition = {
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
  sl: string;
  tp: string;
  pnl: number;
  adminProfitUsd?: number;
  status: "Terbuka" | "Tertunda" | "Ditutup";
  openedAt: string;
  openedAtMs?: number;
  unlockAtMs?: number;
  openedDate?: string;
};

export type JournalRecord = {
  id: string;
  date: string;
  symbol: string;
  side: "BUY" | "SELL";
  lot: number;
  entry: string;
  exit: string;
  pnl: number;
  rr: string;
  strategy: "Breakout" | "Pullback" | "Scalping" | "Swing";
  emotion: string;
  notes: string;
};

export type InboxMessage = {
  id: string;
  sender: string;
  subject: string;
  preview: string;
  body: string;
  category: "Peringatan Pasar" | "Sistem & Akun" | "Dukungan";
  timestamp: string;
  unread: boolean;
  archived: boolean;
};

export type CommunityPostRecord = {
  id: string;
  author: string;
  pair: string;
  bias: "Bullish" | "Bearish" | "Netral";
  category: "Analisis Teknikal" | "Setup Trading" | "Diskusi Pasar";
  timeAgo: string;
  title: string;
  content: string;
  likes: number;
  likedByMe: boolean;
  comments: { id: string; author: string; text: string; time: string }[];
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

export type VerificationStatus = "Menunggu" | "Disetujui" | "Ditolak";

export const USD_TO_IDR_RATE = 17000;

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

export type WalletLimitsRecord = {
  minDeposit: number;
  maxDeposit: number;
  minWithdraw: number;
  maxWithdraw: number;
  updatedBy?: string;
  updatedAt?: string;
};

function seededNoise(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function generateSeedCandles(
  basePrice: number,
  tickStep: number,
  decimals: number,
): CandleRecord[] {
  const count = 36;
  const candles: CandleRecord[] = [];
  const scale = tickStep * 5.2;
  let cursor = basePrice - scale * 3.5;

  for (let i = 0; i < count; i++) {
    const n1 = seededNoise(i + basePrice * 13) - 0.46;
    const n2 = seededNoise(i * 3 + basePrice * 5) - 0.5;
    const n3 = seededNoise(i * 7 + basePrice * 11);
    const n4 = seededNoise(i * 11 + basePrice * 17);

    const open = cursor;
    const delta = (n1 * 1.4 + n2 * 0.6) * scale;
    const close = i === count - 1 ? basePrice : open + delta;
    const wickUp = Math.abs(n3) * scale * 0.9;
    const wickDown = Math.abs(n4) * scale * 0.9;
    const high = Math.max(open, close) + wickUp;
    const low = Math.min(open, close) - wickDown;

    const hour = (8 + Math.floor((i * 15) / 60)) % 24;
    const min = (i * 15) % 60;
    const label = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;

    candles.push({
      time: label,
      open: Number(open.toFixed(decimals)),
      high: Number(high.toFixed(decimals)),
      low: Number(low.toFixed(decimals)),
      close: Number(close.toFixed(decimals)),
    });
    cursor = close;
  }

  return candles;
}

function makeInstrument(
  params: Omit<
    MarketInstrumentRecord,
    "bid" | "ask" | "prevBid" | "openDay" | "candles" | "trendBias" | "trendStrength" | "enabled"
  > & {
    trendBias?: TrendBias;
    trendStrength?: 1 | 2 | 3;
    enabled?: boolean;
  },
): MarketInstrumentRecord {
  const candles = generateSeedCandles(params.basePrice, params.tickStep, params.decimals);
  return {
    ...params,
    bid: params.basePrice,
    ask: Number((params.basePrice + params.spreadValue).toFixed(params.decimals)),
    prevBid: params.basePrice,
    openDay: candles[0]?.open ?? params.basePrice,
    trendBias: params.trendBias ?? "Netral",
    trendStrength: params.trendStrength ?? 2,
    enabled: params.enabled ?? true,
    candles,
  };
}

function nextCandleTimeLabel(lastLabel: string): string {
  const [hStr, mStr] = lastLabel.split(":");
  const totalMin = ((Number(hStr) || 0) * 60 + (Number(mStr) || 0) + 15) % (24 * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function computePositionFloatingPnl(
  pos: TradePosition,
  market: MarketInstrumentRecord | undefined,
  nowMs = Date.now(),
  defaultProfitPercent = memoryStore.tradingRules.defaultProfitPercent ?? 10,
): number {
  return computeGuaranteedPositionPnl(
    pos,
    market?.bid,
    market?.tickStep,
    nowMs,
    defaultProfitPercent,
  );
}

function makeSampleProofSvg(params: {
  id: string;
  method: string;
  ref: string;
  amount: number;
  sender: string;
  time: string;
}): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="320" viewBox="0 0 520 320">
    <rect width="520" height="320" rx="16" fill="#0f1419"/>
    <rect x="20" y="20" width="480" height="280" rx="12" fill="#171e26" stroke="#2d3845" stroke-width="1.5"/>
    <text x="40" y="56" font-family="monospace" font-size="13" font-weight="bold" fill="#22c55e">BUKTI TRANSFER ELEKTRONIK</text>
    <text x="40" y="78" font-family="sans-serif" font-size="11" fill="#94a3b8">${params.method} · ${params.time}</text>
    <line x1="40" y1="96" x2="480" y2="96" stroke="#2d3845"/>
    <text x="40" y="132" font-family="sans-serif" font-size="12" fill="#94a3b8">Nominal Transfer</text>
    <text x="40" y="164" font-family="monospace" font-size="26" font-weight="bold" fill="#f8fafc">$${params.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} USD</text>
    <text x="40" y="204" font-family="sans-serif" font-size="12" fill="#94a3b8">Pengirim: <tspan fill="#e2e8f0" font-weight="bold">${params.sender}</tspan></text>
    <text x="40" y="228" font-family="sans-serif" font-size="12" fill="#94a3b8">Penerima: <tspan fill="#e2e8f0" font-weight="bold">PT IC Trading Nusantara</tspan></text>
    <text x="40" y="252" font-family="monospace" font-size="12" fill="#94a3b8">No. Ref: <tspan fill="#22c55e">${params.ref}</tspan></text>
    <rect x="372" y="246" width="108" height="28" rx="6" fill="#166534" fill-opacity="0.35" stroke="#22c55e"/>
    <text x="426" y="264" text-anchor="middle" font-family="monospace" font-size="11" font-weight="bold" fill="#4ade80">${params.id}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const memoryStore = {
  adminSessions: new Map<string, string>(),
  marketTickCount: 0,

  walletLimits: {
    minDeposit: 10,
    maxDeposit: 50000,
    minWithdraw: 10,
    maxWithdraw: 25000,
    updatedBy: "admin@ictrading.id",
    updatedAt: "Bawaan sistem",
  } satisfies WalletLimitsRecord,

  tradingRules: {
    ...DEFAULT_TRADING_RULES,
  } satisfies TradingRulesRecord,

  depositMethods: [
    {
      id: "bca",
      label: "Transfer Bank BCA",
      accountInfo: "5210-8842-9012",
      accountHolder: "PT IC Trading Nusantara",
      fee: "Gratis (0%)",
      eta: "5–15 menit setelah verifikasi admin",
      enabled: true,
      sortOrder: 1,
    },
    {
      id: "mandiri",
      label: "Transfer Bank Mandiri",
      accountInfo: "137-000-9921-440",
      accountHolder: "PT IC Trading Nusantara",
      fee: "Gratis (0%)",
      eta: "5–15 menit setelah verifikasi admin",
      enabled: true,
      sortOrder: 2,
    },
    {
      id: "bni",
      label: "Transfer Bank BNI",
      accountInfo: "044-8192-3301",
      accountHolder: "PT IC Trading Nusantara",
      fee: "Gratis (0%)",
      eta: "10–20 menit setelah verifikasi admin",
      enabled: true,
      sortOrder: 3,
    },
    {
      id: "usdt",
      label: "USDT (TRC20)",
      accountInfo: "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE",
      accountHolder: "Dompet Kustodian TRC20",
      fee: "Biaya jaringan sesuai pengirim",
      eta: "Konfirmasi jaringan + verifikasi admin",
      enabled: true,
      sortOrder: 4,
    },
  ] as DepositMethodRecord[],

  profile: {
    name: "Raka Pratama",
    email: "raka.pratama@ictrading.id",
    accountId: "IC-884210",
    accountType: "Raw Spread",
    currency: "USD",
    timezone: "Asia/Jakarta (WIB)",
    leverage: 500,
    loggedIn: true,
  } satisfies UserProfile,

  markets: [
    makeInstrument({
      symbol: "EURUSD",
      name: "Euro / Dolar AS",
      category: "Forex",
      basePrice: 1.08452,
      spreadValue: 0.00002,
      spreadLabel: "0.2",
      pipSize: 0.0001,
      tickStep: 0.00006,
      decimals: 5,
      contractSize: 100000,
      trendBias: "Netral",
      trendStrength: 2,
    }),
    makeInstrument({
      symbol: "XAUUSD",
      name: "Emas / Dolar AS (Gold)",
      category: "Logam Mulia",
      basePrice: 2684.4,
      spreadValue: 0.21,
      spreadLabel: "2.1",
      pipSize: 0.1,
      tickStep: 0.45,
      decimals: 2,
      contractSize: 100,
      trendBias: "Naik",
      trendStrength: 2,
    }),
    makeInstrument({
      symbol: "USOIL",
      name: "Minyak Mentah WTI (Oil)",
      category: "Energi / Oil",
      basePrice: 71.85,
      spreadValue: 0.03,
      spreadLabel: "3.0",
      pipSize: 0.01,
      tickStep: 0.06,
      decimals: 2,
      contractSize: 1000,
      trendBias: "Netral",
      trendStrength: 2,
    }),
    makeInstrument({
      symbol: "GBPUSD",
      name: "Poundsterling / Dolar AS",
      category: "Forex",
      basePrice: 1.2961,
      spreadValue: 0.00003,
      spreadLabel: "0.3",
      pipSize: 0.0001,
      tickStep: 0.00007,
      decimals: 5,
      contractSize: 100000,
      trendBias: "Netral",
      trendStrength: 2,
    }),
    makeInstrument({
      symbol: "USDJPY",
      name: "Dolar AS / Yen Jepang",
      category: "Forex",
      basePrice: 152.34,
      spreadValue: 0.003,
      spreadLabel: "0.3",
      pipSize: 0.01,
      tickStep: 0.016,
      decimals: 3,
      contractSize: 100000,
      quoteInJpy: true,
      trendBias: "Netral",
      trendStrength: 2,
    }),
    makeInstrument({
      symbol: "BTCUSD",
      name: "Bitcoin / Dolar AS",
      category: "Kripto / Coin",
      basePrice: 88420.0,
      spreadValue: 18.0,
      spreadLabel: "18.0",
      pipSize: 1.0,
      tickStep: 35.0,
      decimals: 1,
      contractSize: 1,
      trendBias: "Naik",
      trendStrength: 2,
    }),
  ] as MarketInstrumentRecord[],

  users: [
    {
      id: "USR-01",
      accountId: "IC-884210",
      name: "Raka Pratama",
      email: "raka.pratama@ictrading.id",
      accountType: "Raw Spread",
      balance: 24510.0,
      kycStatus: "Terverifikasi",
      status: "Aktif",
      joinedAt: "14 Agu 2026",
    },
    {
      id: "USR-02",
      accountId: "IC-884395",
      name: "Sinta Dewi",
      email: "sinta.dewi@mail.id",
      accountType: "Standard",
      balance: 8420.5,
      kycStatus: "Terverifikasi",
      status: "Aktif",
      joinedAt: "02 Sep 2026",
    },
    {
      id: "USR-03",
      accountId: "IC-884512",
      name: "Kevin Hartono",
      email: "kevin.h@trader.co.id",
      accountType: "Raw Spread",
      balance: 15200.0,
      kycStatus: "Menunggu",
      status: "Aktif",
      joinedAt: "19 Okt 2026",
    },
    {
      id: "USR-04",
      accountId: "IC-884601",
      name: "Dimas Mahendra",
      email: "dimas.m@investasi.id",
      accountType: "Standard",
      balance: 1250.0,
      kycStatus: "Terverifikasi",
      status: "Ditangguhkan",
      joinedAt: "01 Nov 2026",
    },
  ] as AdminUserRecord[],

  deposits: [
    {
      id: "DEP-3041",
      userId: "USR-01",
      userName: "Raka Pratama",
      userEmail: "raka.pratama@ictrading.id",
      accountId: "IC-884210",
      method: "Transfer Bank BCA",
      reference: "BCA-REF-8839201",
      amount: 2500.0,
      amountIdr: 42500000,
      exchangeRate: USD_TO_IDR_RATE,
      currency: "USD",
      proofFileName: "struk-bca-8839201.png",
      proofImage: makeSampleProofSvg({
        id: "DEP-3041",
        method: "Transfer Bank BCA",
        ref: "BCA-REF-8839201",
        amount: 2500.0,
        sender: "Raka Pratama",
        time: "12 Nov 2026 13:40 WIB",
      }),
      status: "Menunggu",
      submittedAt: "12 Nov 2026 · 13:40 WIB",
    },
    {
      id: "DEP-3040",
      userId: "USR-03",
      userName: "Kevin Hartono",
      userEmail: "kevin.h@trader.co.id",
      accountId: "IC-884512",
      method: "USDT (TRC20)",
      reference: "0x9f21...7b3e",
      amount: 1200.0,
      amountIdr: 20400000,
      exchangeRate: USD_TO_IDR_RATE,
      currency: "USD",
      proofFileName: "tx-usdt-trc20.png",
      proofImage: makeSampleProofSvg({
        id: "DEP-3040",
        method: "USDT (TRC20)",
        ref: "0x9f21...7b3e",
        amount: 1200.0,
        sender: "Kevin Hartono",
        time: "12 Nov 2026 11:15 WIB",
      }),
      status: "Menunggu",
      submittedAt: "12 Nov 2026 · 11:15 WIB",
    },
    {
      id: "DEP-3038",
      userId: "USR-02",
      userName: "Sinta Dewi",
      userEmail: "sinta.dewi@mail.id",
      accountId: "IC-884395",
      method: "Transfer Bank Mandiri",
      reference: "MDR-9920184",
      amount: 3000.0,
      amountIdr: 51000000,
      exchangeRate: USD_TO_IDR_RATE,
      currency: "USD",
      proofFileName: "mandiri-9920184.png",
      proofImage: makeSampleProofSvg({
        id: "DEP-3038",
        method: "Transfer Bank Mandiri",
        ref: "MDR-9920184",
        amount: 3000.0,
        sender: "Sinta Dewi",
        time: "10 Nov 2026 16:05 WIB",
      }),
      status: "Disetujui",
      submittedAt: "10 Nov 2026 · 16:05 WIB",
      reviewedAt: "10 Nov 2026 · 16:22 WIB",
      reviewedBy: "admin@ictrading.id",
      adminNote: "Mutasi rekening terkonfirmasi sesuai nominal.",
    },
    {
      id: "DEP-3037",
      userId: "USR-01",
      userName: "Raka Pratama",
      userEmail: "raka.pratama@ictrading.id",
      accountId: "IC-884210",
      method: "Transfer Bank BCA",
      reference: "BCA-REF-8810244",
      amount: 5000.0,
      amountIdr: 85000000,
      exchangeRate: USD_TO_IDR_RATE,
      currency: "USD",
      proofFileName: "bca-8810244.png",
      proofImage: makeSampleProofSvg({
        id: "DEP-3037",
        method: "Transfer Bank BCA",
        ref: "BCA-REF-8810244",
        amount: 5000.0,
        sender: "Raka Pratama",
        time: "08 Nov 2026 09:30 WIB",
      }),
      status: "Disetujui",
      submittedAt: "08 Nov 2026 · 09:30 WIB",
      reviewedAt: "08 Nov 2026 · 09:45 WIB",
      reviewedBy: "admin@ictrading.id",
      adminNote: "Dana masuk terverifikasi penuh.",
    },
    {
      id: "DEP-3036",
      userId: "USR-01",
      userName: "Raka Pratama",
      userEmail: "raka.pratama@ictrading.id",
      accountId: "IC-884210",
      method: "USDT (TRC20)",
      reference: "0x41a8...e912",
      amount: 1800.0,
      amountIdr: 30600000,
      exchangeRate: USD_TO_IDR_RATE,
      currency: "USD",
      proofFileName: "trc20-41a8.png",
      proofImage: makeSampleProofSvg({
        id: "DEP-3036",
        method: "USDT (TRC20)",
        ref: "0x41a8...e912",
        amount: 1800.0,
        sender: "Raka Pratama",
        time: "05 Nov 2026 14:15 WIB",
      }),
      status: "Disetujui",
      submittedAt: "05 Nov 2026 · 14:15 WIB",
      reviewedAt: "05 Nov 2026 · 14:28 WIB",
      reviewedBy: "admin@ictrading.id",
      adminNote: "Konfirmasi hash jaringan TRC20 selesai.",
    },
    {
      id: "DEP-3035",
      userId: "USR-01",
      userName: "Raka Pratama",
      userEmail: "raka.pratama@ictrading.id",
      accountId: "IC-884210",
      method: "Virtual Account BNI",
      reference: "BNI-VA-772190",
      amount: 1000.0,
      amountIdr: 17000000,
      exchangeRate: USD_TO_IDR_RATE,
      currency: "USD",
      proofFileName: "bni-va-772190.png",
      proofImage: makeSampleProofSvg({
        id: "DEP-3035",
        method: "Virtual Account BNI",
        ref: "BNI-VA-772190",
        amount: 1000.0,
        sender: "Raka Pratama",
        time: "02 Nov 2026 11:10 WIB",
      }),
      status: "Ditolak",
      submittedAt: "02 Nov 2026 · 11:10 WIB",
      reviewedAt: "02 Nov 2026 · 11:40 WIB",
      reviewedBy: "admin@ictrading.id",
      adminNote: "Referensi mutasi tidak ditemukan dalam 1x24 jam.",
    },
    {
      id: "DEP-3034",
      userId: "USR-01",
      userName: "Raka Pratama",
      userEmail: "raka.pratama@ictrading.id",
      accountId: "IC-884210",
      method: "Transfer Bank Mandiri",
      reference: "MDR-7710023",
      amount: 4200.0,
      amountIdr: 71400000,
      exchangeRate: USD_TO_IDR_RATE,
      currency: "USD",
      proofFileName: "mandiri-7710023.png",
      proofImage: makeSampleProofSvg({
        id: "DEP-3034",
        method: "Transfer Bank Mandiri",
        ref: "MDR-7710023",
        amount: 4200.0,
        sender: "Raka Pratama",
        time: "29 Okt 2026 15:10 WIB",
      }),
      status: "Disetujui",
      submittedAt: "29 Okt 2026 · 15:10 WIB",
      reviewedAt: "29 Okt 2026 · 15:26 WIB",
      reviewedBy: "admin@ictrading.id",
      adminNote: "Mutasi sesuai dan dikreditkan ke akun.",
    },
  ] as DepositRequestRecord[],

  withdrawals: [
    {
      id: "WD-2094",
      userId: "USR-02",
      userName: "Sinta Dewi",
      userEmail: "sinta.dewi@mail.id",
      accountId: "IC-884395",
      destination: "Bank Mandiri · 1370008812941",
      amount: 1500.0,
      currency: "USD",
      status: "Menunggu",
      submittedAt: "12 Nov 2026 · 14:05 WIB",
    },
    {
      id: "WD-2093",
      userId: "USR-01",
      userName: "Raka Pratama",
      userEmail: "raka.pratama@ictrading.id",
      accountId: "IC-884210",
      destination: "Bank BCA · 5210948120",
      amount: 800.0,
      currency: "USD",
      status: "Menunggu",
      submittedAt: "12 Nov 2026 · 10:50 WIB",
    },
    {
      id: "WD-2091",
      userId: "USR-03",
      userName: "Kevin Hartono",
      userEmail: "kevin.h@trader.co.id",
      accountId: "IC-884512",
      destination: "Bank BNI · 0441928310",
      amount: 600.0,
      currency: "USD",
      status: "Disetujui",
      submittedAt: "09 Nov 2026 · 09:20 WIB",
      reviewedAt: "09 Nov 2026 · 10:02 WIB",
      reviewedBy: "admin@ictrading.id",
      adminNote: "Dana ditransfer ke rekening terdaftar.",
    },
    {
      id: "WD-2090",
      userId: "USR-01",
      userName: "Raka Pratama",
      userEmail: "raka.pratama@ictrading.id",
      accountId: "IC-884210",
      destination: "Bank BCA · 5210948120",
      amount: 1200.0,
      currency: "USD",
      status: "Disetujui",
      submittedAt: "06 Nov 2026 · 15:40 WIB",
      reviewedAt: "06 Nov 2026 · 16:05 WIB",
      reviewedBy: "admin@ictrading.id",
      adminNote: "Transfer diproses ke rekening BCA terverifikasi.",
    },
    {
      id: "WD-2089",
      userId: "USR-01",
      userName: "Raka Pratama",
      userEmail: "raka.pratama@ictrading.id",
      accountId: "IC-884210",
      destination: "Bank Mandiri · 1370091827311",
      amount: 450.0,
      currency: "USD",
      status: "Disetujui",
      submittedAt: "03 Nov 2026 · 11:00 WIB",
      reviewedAt: "03 Nov 2026 · 11:22 WIB",
      reviewedBy: "admin@ictrading.id",
      adminNote: "Penarikan selesai diproses.",
    },
    {
      id: "WD-2088",
      userId: "USR-01",
      userName: "Raka Pratama",
      userEmail: "raka.pratama@ictrading.id",
      accountId: "IC-884210",
      destination: "USDT TRC20 · TXk9...88aP",
      amount: 950.0,
      currency: "USD",
      status: "Disetujui",
      submittedAt: "28 Okt 2026 · 17:15 WIB",
      reviewedAt: "28 Okt 2026 · 17:45 WIB",
      reviewedBy: "admin@ictrading.id",
      adminNote: "Pengiriman aset stabil TRC20 berhasil.",
    },
  ] as WithdrawRequestRecord[],

  auditLogs: [
    {
      id: "AUD-101",
      timestamp: "10 Nov 2026 · 16:22 WIB",
      actor: "admin@ictrading.id",
      action: "Setujui Deposit",
      target: "DEP-3038 (IC-884395)",
      detail: "Deposit $3,000.00 diverifikasi manual dan dikreditkan ke saldo.",
    },
    {
      id: "AUD-100",
      timestamp: "09 Nov 2026 · 10:02 WIB",
      actor: "admin@ictrading.id",
      action: "Setujui Withdraw",
      target: "WD-2091 (IC-884512)",
      detail: "Penarikan $600.00 disetujui setelah verifikasi rekening.",
    },
    {
      id: "AUD-099",
      timestamp: "08 Nov 2026 · 09:45 WIB",
      actor: "admin@ictrading.id",
      action: "Setujui Deposit",
      target: "DEP-3037 (IC-884210)",
      detail: "Deposit $5,000.00 melalui Transfer Bank BCA disetujui.",
    },
    {
      id: "AUD-098",
      timestamp: "06 Nov 2026 · 16:05 WIB",
      actor: "admin@ictrading.id",
      action: "Setujui Withdraw",
      target: "WD-2090 (IC-884210)",
      detail: "Penarikan $1,200.00 dikirim ke Bank BCA terverifikasi.",
    },
    {
      id: "AUD-097",
      timestamp: "05 Nov 2026 · 14:28 WIB",
      actor: "admin@ictrading.id",
      action: "Atur Pasar",
      target: "XAUUSD",
      detail: "Arah chart diatur ke Naik (Kekuatan 2).",
    },
    {
      id: "AUD-096",
      timestamp: "02 Nov 2026 · 11:40 WIB",
      actor: "admin@ictrading.id",
      action: "Tolak Deposit",
      target: "DEP-3035 (IC-884210)",
      detail: "Referensi mutasi tidak cocok pada pemeriksaan manual.",
    },
  ] as AuditLogRecord[],

  positions: [
    {
      id: "ORD-9041",
      userId: "USR-01",
      userName: "Raka Pratama",
      accountId: "IC-884210",
      symbol: "EURUSD",
      type: "Market",
      side: "BUY",
      lot: 0.5,
      stakeUsd: 500,
      leverage: 500,
      entry: 1.0812,
      sl: "1.07850",
      tp: "1.08800",
      pnl: 62.5,
      adminProfitUsd: 62.5,
      status: "Terbuka",
      openedAt: "10:15 WIB",
      openedAtMs: 0,
      unlockAtMs: 0,
      openedDate: "2026-11-12",
    },
    {
      id: "ORD-9044",
      userId: "USR-01",
      userName: "Raka Pratama",
      accountId: "IC-884210",
      symbol: "XAUUSD",
      type: "Market",
      side: "BUY",
      lot: 0.2,
      stakeUsd: 1000,
      leverage: 500,
      entry: 2672.5,
      sl: "2662.00",
      tp: "2705.00",
      pnl: 124.0,
      adminProfitUsd: 124.0,
      status: "Terbuka",
      openedAt: "11:42 WIB",
      openedAtMs: 0,
      unlockAtMs: 0,
      openedDate: "2026-11-12",
    },
    {
      id: "ORD-9045",
      userId: "USR-01",
      userName: "Raka Pratama",
      accountId: "IC-884210",
      symbol: "BTCUSD",
      type: "Market",
      side: "BUY",
      lot: 0.1,
      stakeUsd: 450,
      leverage: 200,
      entry: 88110.0,
      sl: "87200.0",
      tp: "89900.0",
      pnl: 54.0,
      adminProfitUsd: 54.0,
      status: "Terbuka",
      openedAt: "12:18 WIB",
      openedAtMs: 0,
      unlockAtMs: 0,
      openedDate: "2026-11-12",
    },
    {
      id: "ORD-9048",
      userId: "USR-01",
      userName: "Raka Pratama",
      accountId: "IC-884210",
      symbol: "GBPUSD",
      type: "Limit",
      side: "SELL",
      lot: 0.25,
      stakeUsd: 250,
      leverage: 200,
      entry: 1.2995,
      sl: "1.30300",
      tp: "1.29100",
      pnl: 0,
      status: "Tertunda",
      openedAt: "13:10 WIB",
      openedAtMs: 0,
      unlockAtMs: 0,
      openedDate: "2026-11-12",
    },
    {
      id: "ORD-9047",
      userId: "USR-01",
      userName: "Raka Pratama",
      accountId: "IC-884210",
      symbol: "USOIL",
      type: "Limit",
      side: "BUY",
      lot: 0.3,
      stakeUsd: 300,
      leverage: 500,
      entry: 71.15,
      sl: "70.40",
      tp: "72.90",
      pnl: 0,
      status: "Tertunda",
      openedAt: "12:55 WIB",
      openedAtMs: 0,
      unlockAtMs: 0,
      openedDate: "2026-11-12",
    },
    {
      id: "ORD-9040",
      userId: "USR-01",
      userName: "Raka Pratama",
      accountId: "IC-884210",
      symbol: "EURUSD",
      type: "Market",
      side: "BUY",
      lot: 0.5,
      stakeUsd: 500,
      leverage: 500,
      entry: 1.0812,
      sl: "1.07850",
      tp: "1.08480",
      pnl: 180.0,
      status: "Ditutup",
      openedAt: "11 Nov · 16:40",
      openedAtMs: 1762854000000,
      unlockAtMs: 1762854300000,
      openedDate: "2026-11-11",
    },
    {
      id: "ORD-9039",
      userId: "USR-01",
      userName: "Raka Pratama",
      accountId: "IC-884210",
      symbol: "XAUUSD",
      type: "Market",
      side: "BUY",
      lot: 0.2,
      stakeUsd: 600,
      leverage: 500,
      entry: 2668.4,
      sl: "2660.00",
      tp: "2681.90",
      pnl: 270.0,
      status: "Ditutup",
      openedAt: "11 Nov · 14:15",
      openedAtMs: 1762845300000,
      unlockAtMs: 1762845600000,
      openedDate: "2026-11-11",
    },
    {
      id: "ORD-9038",
      userId: "USR-01",
      userName: "Raka Pratama",
      accountId: "IC-884210",
      symbol: "GBPUSD",
      type: "Market",
      side: "SELL",
      lot: 0.3,
      stakeUsd: 300,
      leverage: 200,
      entry: 1.2981,
      sl: "1.30040",
      tp: "1.29300",
      pnl: 84.5,
      status: "Ditutup",
      openedAt: "10 Nov · 19:05",
      openedAtMs: 1762776300000,
      unlockAtMs: 1762776600000,
      openedDate: "2026-11-10",
    },
    {
      id: "ORD-9037",
      userId: "USR-01",
      userName: "Raka Pratama",
      accountId: "IC-884210",
      symbol: "USDJPY",
      type: "Market",
      side: "BUY",
      lot: 0.4,
      stakeUsd: 400,
      leverage: 500,
      entry: 151.6,
      sl: "151.200",
      tp: "152.280",
      pnl: 178.5,
      status: "Ditutup",
      openedAt: "08 Nov · 10:20",
      openedAtMs: 1762572000000,
      unlockAtMs: 1762572300000,
      openedDate: "2026-11-08",
    },
    {
      id: "ORD-9036",
      userId: "USR-01",
      userName: "Raka Pratama",
      accountId: "IC-884210",
      symbol: "USOIL",
      type: "Market",
      side: "SELL",
      lot: 0.2,
      stakeUsd: 250,
      leverage: 200,
      entry: 72.45,
      sl: "73.10",
      tp: "71.50",
      pnl: 190.0,
      status: "Ditutup",
      openedAt: "07 Nov · 20:10",
      openedAtMs: 1762521000000,
      unlockAtMs: 1762521300000,
      openedDate: "2026-11-07",
    },
    {
      id: "ORD-9035",
      userId: "USR-01",
      userName: "Raka Pratama",
      accountId: "IC-884210",
      symbol: "BTCUSD",
      type: "Market",
      side: "BUY",
      lot: 0.1,
      stakeUsd: 200,
      leverage: 100,
      entry: 87420.0,
      sl: "86500.0",
      tp: "88950.0",
      pnl: 153.0,
      status: "Ditutup",
      openedAt: "06 Nov · 15:02",
      openedAtMs: 1762416120000,
      unlockAtMs: 1762416420000,
      openedDate: "2026-11-06",
    },
    {
      id: "ORD-9049",
      userId: "USR-02",
      userName: "Sinta Dewi",
      accountId: "IC-884395",
      symbol: "BTCUSD",
      type: "Market",
      side: "BUY",
      lot: 0.15,
      stakeUsd: 350,
      leverage: 100,
      entry: 87950.0,
      sl: "86800.0",
      tp: "90500.0",
      pnl: 70.5,
      adminProfitUsd: 70.5,
      status: "Terbuka",
      openedAt: "12:05 WIB",
      openedAtMs: 0,
      unlockAtMs: 0,
      openedDate: "2026-11-12",
    },
    {
      id: "ORD-9050",
      userId: "USR-03",
      userName: "Kevin Hartono",
      accountId: "IC-884512",
      symbol: "USOIL",
      type: "Market",
      side: "SELL",
      lot: 0.4,
      stakeUsd: 400,
      leverage: 200,
      entry: 72.3,
      sl: "73.10",
      tp: "70.40",
      pnl: 180.0,
      adminProfitUsd: 180.0,
      status: "Terbuka",
      openedAt: "12:48 WIB",
      openedAtMs: 0,
      unlockAtMs: 0,
      openedDate: "2026-11-12",
    },
  ] as TradePosition[],

  journal: [
    {
      id: "JRN-412",
      date: "12 Nov 2026",
      symbol: "EURUSD",
      side: "BUY",
      lot: 0.5,
      entry: "1.08120",
      exit: "1.08480",
      pnl: 180.0,
      rr: "1:2.4",
      strategy: "Breakout",
      emotion: "Disiplin",
      notes: "Menembus resisten sesi London dengan volume konfirmasi. Keluar sesuai target TP.",
    },
    {
      id: "JRN-411",
      date: "11 Nov 2026",
      symbol: "XAUUSD",
      side: "BUY",
      lot: 0.2,
      entry: "2668.40",
      exit: "2681.90",
      pnl: 270.0,
      rr: "1:3.0",
      strategy: "Pullback",
      emotion: "Tenang",
      notes: "Retest area demand H1 setelah rilis data tenaga kerja AS.",
    },
    {
      id: "JRN-410",
      date: "10 Nov 2026",
      symbol: "GBPUSD",
      side: "SELL",
      lot: 0.3,
      entry: "1.29810",
      exit: "1.30040",
      pnl: -69.0,
      rr: "1:1.0",
      strategy: "Scalping",
      emotion: "Terburu-buru",
      notes: "Masuk sebelum penutupan candle M15. Perlu menunggu konfirmasi penuh.",
    },
    {
      id: "JRN-409",
      date: "08 Nov 2026",
      symbol: "USDJPY",
      side: "BUY",
      lot: 0.4,
      entry: "151.600",
      exit: "152.280",
      pnl: 178.5,
      rr: "1:2.1",
      strategy: "Swing",
      emotion: "Disiplin",
      notes: "Mengikuti tren naik harian setelah pantulan di rata-rata bergerak 20 hari.",
    },
    {
      id: "JRN-408",
      date: "07 Nov 2026",
      symbol: "USOIL",
      side: "SELL",
      lot: 0.2,
      entry: "72.45",
      exit: "71.50",
      pnl: 190.0,
      rr: "1:2.2",
      strategy: "Pullback",
      emotion: "Tenang",
      notes: "Penolakan jelas di zona suplai H4 sebelum inventori minyak AS.",
    },
    {
      id: "JRN-407",
      date: "06 Nov 2026",
      symbol: "BTCUSD",
      side: "BUY",
      lot: 0.1,
      entry: "87420.0",
      exit: "88950.0",
      pnl: 153.0,
      rr: "1:1.9",
      strategy: "Breakout",
      emotion: "Disiplin",
      notes: "Breakout struktur range Asia dengan stop loss ketat di bawah swing low.",
    },
  ] as JournalRecord[],

  messages: [
    {
      id: "MSG-101",
      sender: "Meja Likuiditas IC",
      subject: "Pemberitahuan Jadwal Rilis Inflasi AS & Potensi Pelebaran Spread",
      preview: "Rilis CPI AS dijadwalkan pukul 20:30 WIB. Pastikan level margin Anda memadai.",
      body: "Halo Trader,\n\nSebagai bagian dari manajemen risiko menjelang rilis data Indeks Harga Konsumen (CPI) AS pada pukul 20:30 WIB hari ini, likuiditas antarbank pada pasangan USD dan XAUUSD dapat mengalami volatilitas tinggi sesaat.\n\nPastikan posisi terbuka Anda memiliki Stop Loss yang sesuai serta margin bebas yang memadai untuk mengantisipasi lonjakan harga.",
      category: "Peringatan Pasar",
      timestamp: "14:20 WIB",
      unread: true,
      archived: false,
    },
    {
      id: "MSG-102",
      sender: "Kepatuhan & Akun IC",
      subject: "Laporan Ringkasan Eksekusi Mingguan Akun Raw Spread",
      preview: "Rata-rata kecepatan eksekusi akun Anda minggu ini tercatat 34 ms tanpa requotes.",
      body: "Laporan ringkasan eksekusi periode mingguan untuk akun #IC-884210 telah tersedia.\n\nTotal lot ditransaksikan: 4.85 lot\nRata-rata kecepatan eksekusi: 34 milidetik\nSpread rata-rata EURUSD: 0.12 pip\n\nAnda dapat meninjau rincian per transaksi di menu Jurnal Trading.",
      category: "Sistem & Akun",
      timestamp: "Kemarin, 18:05",
      unread: true,
      archived: false,
    },
    {
      id: "MSG-103",
      sender: "Akademi IC Trading",
      subject: "Konfirmasi Pendaftaran: Bedah Struktur Pasar Emas (XAUUSD)",
      preview:
        "Kursi Anda untuk sesi webinar besok malam telah tercatat. Tautan ruang siaran aktif 15 menit sebelum mulai.",
      body: "Terima kasih telah mendaftar pada sesi webinar interaktif bersama analis senior kami.\n\nTopik: Struktur Pasar & Likuiditas Sesi New York untuk XAUUSD\nWaktu: Besok, 19:00 - 20:30 WIB\n\nSilakan siapkan catatan pertanyaan Anda di menu Komunitas atau Kalender Akademi.",
      category: "Dukungan",
      timestamp: "10 Nov, 09:40",
      unread: true,
      archived: false,
    },
    {
      id: "MSG-104",
      sender: "Infrastruktur Server IC",
      subject: "Pemeliharaan Terjadwal Server NY4 Akhir Pekan",
      preview: "Pemeliharaan rutin dilakukan Sabtu pukul 15:00 - 17:00 WIB saat pasar tutup.",
      body: "Untuk menjaga latensi rendah dan kestabilan koneksi cTrader serta MetaTrader, kami menjadwalkan pemeliharaan rutin pada akhir pekan saat pasar tutup.\n\nTidak ada tindakan yang diperlukan dari pihak Anda.",
      category: "Sistem & Akun",
      timestamp: "08 Nov, 11:12",
      unread: false,
      archived: false,
    },
    {
      id: "MSG-105",
      sender: "Manajemen Risiko IC",
      subject: "Pembaruan Rasio Leverage Dinamis & Margin Instrumen Kripto",
      preview: "Kini Anda dapat menyesuaikan rasio leverage hingga 1:1000 melalui menu Trade.",
      body: "Pengaturan rasio leverage akun kini tersedia langsung pada tiket order terminal Trade serta halaman Pengaturan.\n\nSesuaikan leverage dengan ukuran lot agar level margin tetap aman di atas 100%.",
      category: "Sistem & Akun",
      timestamp: "06 Nov, 10:15",
      unread: false,
      archived: false,
    },
    {
      id: "MSG-106",
      sender: "Meja Likuiditas IC",
      subject: "Ringkasan Volatilitas Minyak Mentah WTI (USOIL)",
      preview: "Laporan stok mingguan EIA memicu pergerakan 120 pip pada sesi New York.",
      body: "Instrumen energi USOIL mencatatkan peningkatan likuiditas selama sesi New York. Pastikan batas Stop Loss disesuaikan dengan rentang pergerakan harian rata-rata.",
      category: "Peringatan Pasar",
      timestamp: "04 Nov, 21:00",
      unread: false,
      archived: false,
    },
  ] as InboxMessage[],

  communityPosts: [
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
    {
      id: "POST-4",
      author: "Bagus Santoso",
      pair: "BTCUSD",
      bias: "Bullish",
      category: "Analisis Teknikal",
      timeAgo: "5 jam lalu",
      title: "Momentum Kuat BTCUSD Menuju Resisten Psikologis 90.000",
      content:
        "Volume beli di sesi AS kembali mendominasi setelah koreksi ringan di 87.500. Perhatikan pengelolaan leverage agar tidak terkena sapuan likuiditas jangka pendek.",
      likes: 42,
      likedByMe: false,
      comments: [],
    },
    {
      id: "POST-5",
      author: "Raka Pratama",
      pair: "USOIL",
      bias: "Bearish",
      category: "Setup Trading",
      timeAgo: "1 hari lalu",
      title: "Skenario Pullback WTI di Area Suplai 72.50",
      content:
        "Menempatkan pending sell limit dengan target 70.80 serta manajemen lot terukur 0.30 lot.",
      likes: 19,
      likedByMe: false,
      comments: [],
    },
  ] as CommunityPostRecord[],
};

export function stepMarketTicks() {
  memoryStore.marketTickCount += 1;
  const shouldRollCandle = memoryStore.marketTickCount % 8 === 0;

  for (const inst of memoryStore.markets) {
    if (!inst.enabled) continue;

    // Directional drift governed by Admin's trendBias ("Naik" | "Netral" | "Turun") + strength
    const strengthFactor = inst.trendStrength === 3 ? 1.15 : inst.trendStrength === 2 ? 0.65 : 0.35;
    const biasDrift =
      inst.trendBias === "Naik"
        ? inst.tickStep * strengthFactor
        : inst.trendBias === "Turun"
          ? -inst.tickStep * strengthFactor
          : (inst.basePrice - inst.bid) * 0.025;

    const randomWave = (Math.random() - 0.5) * inst.tickStep * 2.2;
    const rawNextBid = Math.max(inst.pipSize * 5, inst.bid + biasDrift + randomWave);
    const nextBid = Number(rawNextBid.toFixed(inst.decimals));
    const nextAsk = Number((nextBid + inst.spreadValue).toFixed(inst.decimals));

    inst.prevBid = inst.bid;
    inst.bid = nextBid;
    inst.ask = nextAsk;

    const last = inst.candles[inst.candles.length - 1];
    if (last) {
      if (shouldRollCandle) {
        inst.candles.push({
          time: nextCandleTimeLabel(last.time),
          open: last.close,
          high: Number(Math.max(last.close, nextBid).toFixed(inst.decimals)),
          low: Number(Math.min(last.close, nextBid).toFixed(inst.decimals)),
          close: nextBid,
        });
        if (inst.candles.length > 36) inst.candles.shift();
      } else {
        last.high = Number(Math.max(last.high, nextBid).toFixed(inst.decimals));
        last.low = Number(Math.min(last.low, nextBid).toFixed(inst.decimals));
        last.close = nextBid;
      }
    }
  }
}
