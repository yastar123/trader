import { afterEach, describe, expect, it } from "vitest";
import {
  computeGuaranteedPositionPnl,
  DEFAULT_TRADING_RULES,
  formatHoldCountdown,
  formatMinCloseDuration,
} from "@/lib/trading";
import { db } from "@/server/db";
import { memoryStore } from "@/server/store";

const initialPositions = [...memoryStore.positions];
const initialUsers = memoryStore.users.map((u) => ({ ...u }));
const initialRules = { ...memoryStore.tradingRules };

afterEach(() => {
  memoryStore.positions = [...initialPositions];
  memoryStore.users = initialUsers.map((u) => ({ ...u }));
  memoryStore.tradingRules = { ...initialRules };
});

describe("Trading Mechanics: Guaranteed Profit, Hold Lock & Daily Quota", () => {
  it("computes strictly positive P&L for any open position and grows over hold time", () => {
    const now = 1_762_930_000_000;
    const early = computeGuaranteedPositionPnl(
      {
        status: "Terbuka",
        stakeUsd: 200,
        openedAtMs: now - 5_000,
        unlockAtMs: now + 295_000,
      },
      1.05,
      0.0001,
      now,
    );
    const later = computeGuaranteedPositionPnl(
      {
        status: "Terbuka",
        stakeUsd: 200,
        openedAtMs: now - 250_000,
        unlockAtMs: now + 50_000,
      },
      1.05,
      0.0001,
      now,
    );

    expect(early).toBeGreaterThan(0);
    expect(later).toBeGreaterThan(early);
    expect(
      computeGuaranteedPositionPnl({ status: "Tertunda", stakeUsd: 200 }, 1.05, 0.0001, now),
    ).toBe(0);
  });

  it("formats hold lock countdowns and minute/hour duration labels accurately", () => {
    const now = 1_762_930_000_000;
    expect(formatHoldCountdown(now + 95_000, now)).toEqual({
      locked: true,
      remainingMs: 95_000,
      label: "01:35",
    });
    expect(formatHoldCountdown(now + 3_665_000, now)).toEqual({
      locked: true,
      remainingMs: 3_665_000,
      label: "01:01:05",
    });
    expect(formatHoldCountdown(now - 1000, now).locked).toBe(false);

    expect(formatMinCloseDuration(5)).toBe("5 menit");
    expect(formatMinCloseDuration(120)).toBe("2 jam (120 menit)");
    expect(formatMinCloseDuration(90)).toBe("1 jam 30 menit");
  });

  it("enforces admin daily position limit and minimum hold time lock on close", async () => {
    const ruleUpdate = await db.updateTradingRules(
      { maxDailyPositions: 2, minCloseMinutes: 10 },
      "admin@ictrading.id",
    );
    expect(ruleUpdate.rules?.maxDailyPositions).toBe(2);
    expect(ruleUpdate.rules?.minCloseMinutes).toBe(10);

    const first = await db.createPosition({
      symbol: "EURUSD",
      type: "Market",
      side: "BUY",
      amountIdr: 1_700_000, // Rp 1.700.000 -> $100.00
    });
    expect(first.error).toBeUndefined();
    expect(first.position?.stakeUsd).toBe(100);
    expect(first.position?.pnl).toBeGreaterThan(0);
    expect((first.position?.unlockAtMs ?? 0) > Date.now()).toBe(true);

    // User cannot close before minCloseMinutes expires
    const lockedClose = await db.closePosition(first.position!.id);
    expect(lockedClose?.error).toContain("terkunci");

    // Second open position today succeeds
    const second = await db.createPosition({
      symbol: "XAUUSD",
      type: "Market",
      side: "SELL",
      stakeUsd: 150,
    });
    expect(second.error).toBeUndefined();
    expect(second.position?.pnl).toBeGreaterThan(0);

    // Third open position today exceeds maxDailyPositions (2)
    const third = await db.createPosition({
      symbol: "BTCUSD",
      type: "Market",
      side: "BUY",
      stakeUsd: 100,
    });
    expect(third.error).toContain("Batas maksimal open posisi hari ini");

    // Once unlockAtMs elapses, closing settles with guaranteed positive profit
    memoryStore.positions = memoryStore.positions.map((p) =>
      p.id === first.position!.id ? { ...p, unlockAtMs: Date.now() - 1000 } : p,
    );
    const beforeBalance = memoryStore.users.find(
      (u) => u.accountId === memoryStore.profile.accountId,
    )!.balance;

    const settled = await db.closePosition(first.position!.id);
    expect(settled?.error).toBeUndefined();
    expect(settled?.position?.status).toBe("Ditutup");
    expect(settled?.position?.pnl).toBeGreaterThan(0);
    expect(settled?.balance).toBeGreaterThan(beforeBalance);

    // Reset default rules sanity check
    expect(DEFAULT_TRADING_RULES.maxDailyPositions).toBe(5);
    expect(DEFAULT_TRADING_RULES.defaultProfitPercent).toBe(10);
  });

  it("allows admin to set exact per-position profit and auto-closes expired positions into user balance", async () => {
    await db.updateTradingRules(
      { maxDailyPositions: 10, minCloseMinutes: 5, defaultProfitPercent: 25 },
      "admin@ictrading.id",
    );

    const created = await db.createPosition({
      symbol: "EURUSD",
      type: "Market",
      side: "BUY",
      stakeUsd: 200,
    });
    expect(created.error).toBeUndefined();
    const posId = created.position!.id;

    // Seeded open demo positions with unlockAtMs === 0 must NOT be auto-closed
    const seededBefore = memoryStore.positions.find((p) => p.id === "ORD-9041");
    expect(seededBefore?.status).toBe("Terbuka");
    expect(seededBefore?.unlockAtMs).toBe(0);

    // Admin sets custom profit of $75.00 USD before auto-close
    const adminProfitRes = await db.setPositionAdminProfit(posId, 75, "admin@ictrading.id");
    expect(adminProfitRes.error).toBeUndefined();
    expect(adminProfitRes.position?.adminProfitUsd).toBe(75);

    // Invalid profit (< 0.5) rejected
    const invalidRes = await db.setPositionAdminProfit(posId, 0.1, "admin@ictrading.id");
    expect(invalidRes.error).toContain("$0.50");

    const beforeBalance = memoryStore.users.find(
      (u) => u.accountId === memoryStore.profile.accountId,
    )!.balance;

    // Before unlock time, autoCloseExpiredPositions closes nothing
    const closedEarly = await db.autoCloseExpiredPositions();
    expect(closedEarly).toBe(0);

    // Simulate hold duration elapsed
    memoryStore.positions = memoryStore.positions.map((p) =>
      p.id === posId ? { ...p, unlockAtMs: Date.now() - 500 } : p,
    );

    const closedCount = await db.autoCloseExpiredPositions();
    expect(closedCount).toBe(1);

    const settledPos = memoryStore.positions.find((p) => p.id === posId);
    expect(settledPos?.status).toBe("Ditutup");
    expect(settledPos?.pnl).toBe(75);

    const afterBalance = memoryStore.users.find(
      (u) => u.accountId === memoryStore.profile.accountId,
    )!.balance;
    expect(afterBalance).toBe(Number((beforeBalance + 75).toFixed(2)));

    // Seeded demo position remains Terbuka
    expect(memoryStore.positions.find((p) => p.id === "ORD-9041")?.status).toBe("Terbuka");

    // Admin cannot edit profit after position is closed
    const postCloseEdit = await db.setPositionAdminProfit(posId, 90, "admin@ictrading.id");
    expect(postCloseEdit.error).toContain("sudah ditutup");
  });
});
