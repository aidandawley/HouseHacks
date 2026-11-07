const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 2 });
const pct1 = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });

/** Exact cents — use only in audit/detail views. */
export const fmtUsd = (n: number) => usd.format(n);
/** Whole dollars — default for figures built on assumptions. */
export const fmtUsd0 = (n: number) => usd0.format(n);
export const fmtPct = (n: number) => pct.format(n);
export const fmtPct1 = (n: number) => pct1.format(n);

/** Compact headline money: $5.18M, $524K, $950. */
export function fmtCompact(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(a >= 1e7 ? 1 : 2)}M`;
  if (a >= 1e4) return `${sign}$${Math.round(a / 1e3)}K`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(1)}K`;
  return `${sign}$${Math.round(a)}`;
}

/** Signed delta for "vs baseline" displays: +$12K / −$3.1K / ±$0. */
export function fmtDelta(n: number): string {
  if (Math.abs(n) < 0.5) return "±$0";
  return `${n > 0 ? "+" : "−"}${fmtCompact(Math.abs(n))}`;
}
