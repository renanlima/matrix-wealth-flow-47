// Number / currency formatters for Matrix Digital Assets

const usdFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const brlFmt = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatUSD(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return "$0.00";
  return usdFmt.format(value);
}

/** Parses a USD-masked input string ("1,234.56") into a number. Empty → 0. */
export function parseUsdInput(value: string | null | undefined): number {
  if (!value) return 0;
  const n = Number(String(value).replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

export function formatBRL(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return "R$ 0,00";
  return brlFmt.format(value);
}

export function formatMoney(usd: number | null | undefined, currency: "USD" | "BRL", brlRate: number): string {
  if (usd == null || isNaN(usd)) return currency === "USD" ? "$0.00" : "R$ 0,00";
  return currency === "USD" ? formatUSD(usd) : formatBRL(usd * brlRate);
}

export function formatCryptoQty(qty: number | null | undefined): string {
  if (qty == null || isNaN(qty)) return "0";
  // Up to 8 decimals, trim trailing zeros
  return qty
    .toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 8 });
}

export function formatPct(value: number | null | undefined, withSign = true): string {
  if (value == null || isNaN(value)) return "0,00%";
  const sign = withSign && value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

export function pctClass(value: number | null | undefined): string {
  if (value == null || isNaN(value) || value === 0) return "text-muted-foreground";
  return value > 0 ? "text-success" : "text-destructive";
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("pt-BR");
}

export function formatDateTime(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("pt-BR");
}

export const monthNamesPT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
