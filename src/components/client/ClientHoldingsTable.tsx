import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Money, CryptoQty } from "@/components/Money";
import { formatUSD, formatPct, pnlClass } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface ClientHoldingRow {
  id: string;
  coin_symbol: string;
  quantity: number | string;
  entry_price_usd: number | string;
  status: string;
}

interface Props {
  holdings: ClientHoldingRow[];
  prices: Map<string, number>;
  emptyMessage?: string;
}

export function ClientHoldingsTable({ holdings, prices, emptyMessage = "Sem posições." }: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Moeda</TableHead>
          <TableHead className="text-right">Qtd</TableHead>
          <TableHead className="text-right">Valor Total (USD)</TableHead>
          <TableHead className="text-right">Preço Médio</TableHead>
          <TableHead className="text-right">Preço atual</TableHead>
          <TableHead className="text-right">P&L</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {holdings.length === 0 && (
          <TableRow>
            <TableCell colSpan={6} className="text-center py-6 text-muted-foreground text-sm">
              {emptyMessage}
            </TableCell>
          </TableRow>
        )}
        {holdings.map((h) => {
          const sym = h.coin_symbol.toUpperCase();
          const hasPrice = prices.has(sym);
          const cur = prices.get(sym) ?? Number(h.entry_price_usd);
          const cost = Number(h.quantity) * Number(h.entry_price_usd);
          const market = Number(h.quantity) * cur;
          const pnl = market - cost;
          const pnlH = cost > 0 ? ((market - cost) / cost) * 100 : 0;
          return (
            <TableRow key={h.id}>
              <TableCell className="font-mono font-semibold">{h.coin_symbol}</TableCell>
              <TableCell className="text-right"><CryptoQty qty={Number(h.quantity)} /></TableCell>
              <TableCell className="text-right"><Money usd={market} /></TableCell>
              <TableCell className="text-right"><Money usd={Number(h.entry_price_usd)} /></TableCell>
              <TableCell className="text-right">{hasPrice ? <Money usd={cur} /> : "—"}</TableCell>
              <TableCell className="text-right">
                {h.status === "ativa" ? (
                  <div className={cn("font-mono tabular-nums leading-tight", pnlClass(pnl))}>
                    <div>{pnl >= 0 ? "+" : ""}{formatUSD(pnl)}</div>
                    <div className="text-xs opacity-80">({formatPct(pnlH)})</div>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">{h.status}</span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
