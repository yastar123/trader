import { describe, expect, it } from "vitest";
import {
  USD_TO_IDR_RATE,
  formatIdr,
  formatMoneyPair,
  formatUsd,
  idrToUsd,
  usdToIdr,
} from "@/lib/currency";

describe("USD <-> IDR Currency Conversion (1 USD = Rp 17.000)", () => {
  it("uses fixed 17,000 IDR per USD rate", () => {
    expect(USD_TO_IDR_RATE).toBe(17000);
    expect(usdToIdr(1)).toBe(17000);
    expect(usdToIdr(9934.6)).toBe(168888200);
    expect(idrToUsd(1700000)).toBe(100);
  });

  it("formats USD and IDR with optional signed prefix cleanly", () => {
    expect(formatUsd(9934.6)).toBe("$9,934.60");
    expect(formatUsd(996.8, { signed: true })).toBe("+$996.80");
    expect(formatUsd(-63.6, { signed: true })).toBe("-$63.60");
    expect(formatUsd(-0.001, { signed: true })).toBe("+$0.00");

    expect(formatIdr(168888200)).toBe("Rp 168.888.200");
    expect(formatIdr(996.8 * 17000, { signed: true })).toBe("+Rp 16.945.600");
    expect(formatIdr(-63.6 * 17000, { signed: true })).toBe("-Rp 1.081.200");
  });

  it("returns matching primary and secondary currency pairs for USD and IDR modes", () => {
    const usdPrimary = formatMoneyPair(9934.6, "USD");
    expect(usdPrimary.primary).toBe("$9,934.60");
    expect(usdPrimary.secondary).toBe("Rp 168.888.200");

    const idrPrimary = formatMoneyPair(9934.6, "IDR");
    expect(idrPrimary.primary).toBe("Rp 168.888.200");
    expect(idrPrimary.secondary).toBe("$9,934.60");
  });
});
