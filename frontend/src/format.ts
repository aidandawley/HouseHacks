const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 2 });

export const fmtUsd = (n: number) => usd.format(n);
export const fmtUsd0 = (n: number) => usd0.format(n);
export const fmtPct = (n: number) => pct.format(n);
