export type TradingRulesRecord = {
  maxDailyPositions: number;
  minCloseMinutes: number;
  defaultProfitPercent?: number;
  updatedBy?: string;
  updatedAt?: string;
};

export const DEFAULT_TRADING_RULES: TradingRulesRecord = {
  maxDailyPositions: 5,
  minCloseMinutes: 5,
  defaultProfitPercent: 10,
  updatedBy: "admin@ictrading.id",
  updatedAt: "Bawaan sistem",
};

export function getWibDateKey(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function resolvePositionStakeUsd(pos: { stakeUsd?: number; lot?: number }): number {
  if (typeof pos.stakeUsd === "number" && Number.isFinite(pos.stakeUsd) && pos.stakeUsd > 0) {
    return Number(pos.stakeUsd.toFixed(2));
  }
  const lot = typeof pos.lot === "number" && Number.isFinite(pos.lot) ? pos.lot : 0.1;
  return Number(Math.max(10, lot * 1000).toFixed(2));
}

export function resolveTargetProfitUsd(
  pos: {
    stakeUsd?: number;
    lot?: number;
    adminProfitUsd?: number;
  },
  defaultProfitPercent = 10,
): number {
  if (
    typeof pos.adminProfitUsd === "number" &&
    Number.isFinite(pos.adminProfitUsd) &&
    pos.adminProfitUsd > 0
  ) {
    return Number(pos.adminProfitUsd.toFixed(2));
  }
  const stake = resolvePositionStakeUsd(pos);
  const pct =
    Number.isFinite(defaultProfitPercent) && defaultProfitPercent > 0 ? defaultProfitPercent : 10;
  return Math.max(0.5, Number(((stake * pct) / 100).toFixed(2)));
}

export function computeGuaranteedPositionPnl(
  pos: {
    status: "Terbuka" | "Tertunda" | "Ditutup";
    pnl?: number;
    stakeUsd?: number;
    lot?: number;
    adminProfitUsd?: number;
    openedAtMs?: number;
    unlockAtMs?: number;
  },
  currentBid?: number,
  tickStep?: number,
  nowMs = Date.now(),
  defaultProfitPercent = 10,
): number {
  if (pos.status === "Tertunda") return 0;

  const targetUsd = resolveTargetProfitUsd(pos, defaultProfitPercent);

  if (pos.status === "Ditutup") {
    const existing = Number(pos.pnl ?? 0);
    if (Number.isFinite(existing) && existing > 0) {
      return Number(existing.toFixed(2));
    }
    return targetUsd;
  }

  // If position has an auto-close/unlock timestamp and has reached it, settle at exact target profit
  if (typeof pos.unlockAtMs === "number" && pos.unlockAtMs > 0 && nowMs >= pos.unlockAtMs) {
    return targetUsd;
  }

  const openedAtMs =
    typeof pos.openedAtMs === "number" && pos.openedAtMs > 0 ? pos.openedAtMs : nowMs - 120_000;
  const unlockAtMs =
    typeof pos.unlockAtMs === "number" && pos.unlockAtMs > openedAtMs
      ? pos.unlockAtMs
      : openedAtMs + DEFAULT_TRADING_RULES.minCloseMinutes * 60_000;

  const elapsedSec = Math.max(1, (nowMs - openedAtMs) / 1000);
  const holdSec = Math.max(60, (unlockAtMs - openedAtMs) / 1000);
  const progress = Math.min(1, elapsedSec / holdSec);

  const baseRatio = 0.25 + 0.72 * progress;
  const waveRatio =
    typeof currentBid === "number" && currentBid > 0
      ? Math.abs(Math.sin((currentBid / Math.max(0.00001, tickStep ?? 0.01)) * 0.15)) * 0.03
      : 0.015;

  const factor = Math.min(0.99, baseRatio + waveRatio);
  return Math.max(0.5, Number((targetUsd * factor).toFixed(2)));
}

export function formatHoldCountdown(
  unlockAtMs: number | undefined,
  nowMs = Date.now(),
): {
  locked: boolean;
  remainingMs: number;
  label: string;
} {
  if (!unlockAtMs || !Number.isFinite(unlockAtMs) || nowMs >= unlockAtMs) {
    return { locked: false, remainingMs: 0, label: "Siap ditutup" };
  }
  const remainingMs = Math.max(0, unlockAtMs - nowMs);
  const totalSec = Math.ceil(remainingMs / 1000);
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  const mmss = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  const label = hours > 0 ? `${String(hours).padStart(2, "0")}:${mmss}` : mmss;
  return { locked: true, remainingMs, label };
}

export function formatMinCloseDuration(minutes: number): string {
  const safe = Math.max(1, Math.round(minutes));
  if (safe < 60) return `${safe} menit`;
  const hours = Math.floor(safe / 60);
  const rem = safe % 60;
  if (rem === 0) return `${hours} jam (${safe} menit)`;
  return `${hours} jam ${rem} menit`;
}
