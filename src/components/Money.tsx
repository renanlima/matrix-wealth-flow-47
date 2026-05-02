import { useCurrency } from "@/contexts/CurrencyContext";
import { formatMoney, formatPct, pctClass, formatCryptoQty } from "@/lib/format";
import { cn } from "@/lib/utils";

interface MoneyProps {
  usd: number | null | undefined;
  className?: string;
}

export function Money({ usd, className }: MoneyProps) {
  const { currency, brlRate } = useCurrency();
  return (
    <span className={cn("font-mono tabular-nums", className)}>
      {formatMoney(usd ?? 0, currency, brlRate)}
    </span>
  );
}

export function CryptoQty({ qty, className }: { qty: number | null | undefined; className?: string }) {
  return <span className={cn("font-mono tabular-nums", className)}>{formatCryptoQty(qty)}</span>;
}

export function Pct({ value, className }: { value: number | null | undefined; className?: string }) {
  return (
    <span className={cn("font-mono tabular-nums", pctClass(value), className)}>
      {formatPct(value)}
    </span>
  );
}
