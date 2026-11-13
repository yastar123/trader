import { useEffect, useState } from "react";

export const USD_TO_IDR_RATE = 17000;

export type DisplayCurrency = "USD" | "IDR";

export function usdToIdr(usd: number, rate = USD_TO_IDR_RATE): number {
  if (!Number.isFinite(usd)) return 0;
  return Math.round(usd * rate);
}

export function idrToUsd(idr: number, rate = USD_TO_IDR_RATE): number {
  if (!Number.isFinite(idr) || rate <= 0) return 0;
  return Number((idr / rate).toFixed(2));
}

export function formatUsd(value: number, options?: { signed?: boolean }): string {
  const safe = !Number.isFinite(value) || Math.abs(value) < 0.005 ? 0 : value;
  const formatted = `$${Math.abs(safe).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  if (options?.signed) {
    return safe >= 0 ? `+${formatted}` : `-${formatted}`;
  }
  return safe < 0 ? `-${formatted}` : formatted;
}

export function formatIdr(valueIdr: number, options?: { signed?: boolean }): string {
  const rounded = Number.isFinite(valueIdr) ? Math.round(valueIdr) : 0;
  const safe = Math.abs(rounded) === 0 ? 0 : rounded;
  const formatted = `Rp ${Math.abs(safe).toLocaleString("id-ID")}`;
  if (options?.signed) {
    return safe >= 0 ? `+${formatted}` : `-${formatted}`;
  }
  return safe < 0 ? `-${formatted}` : formatted;
}

export function formatMoneyPair(
  usdAmount: number,
  primaryCurrency: DisplayCurrency = "USD",
  options?: { signed?: boolean; rate?: number },
): {
  usd: string;
  idr: string;
  primary: string;
  secondary: string;
} {
  const rate = options?.rate && options.rate > 0 ? options.rate : USD_TO_IDR_RATE;
  const usd = formatUsd(usdAmount, { signed: options?.signed });
  const idr = formatIdr(usdAmount * rate, { signed: options?.signed });
  if (primaryCurrency === "IDR") {
    return { usd, idr, primary: idr, secondary: usd };
  }
  return { usd, idr, primary: usd, secondary: idr };
}

let adminCurrencyState: DisplayCurrency = "USD";
const adminCurrencyListeners = new Set<() => void>();

export function useAdminCurrency() {
  const [currency, setCurrencyState] = useState<DisplayCurrency>(() => adminCurrencyState);

  useEffect(() => {
    setCurrencyState(adminCurrencyState);
    const sync = () => setCurrencyState(adminCurrencyState);
    adminCurrencyListeners.add(sync);
    return () => {
      adminCurrencyListeners.delete(sync);
    };
  }, []);

  function setCurrency(next: DisplayCurrency) {
    adminCurrencyState = next;
    for (const listener of adminCurrencyListeners) {
      listener();
    }
  }

  return { currency, setCurrency };
}
