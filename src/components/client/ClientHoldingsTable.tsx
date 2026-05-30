import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Money, CryptoQty } from "@/components/Money";
import { formatUSD, formatPct, pnlClass, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ChevronRight, ChevronDown } from "lucide-react";

export interface ClientHoldingRow {
  id: string;
  coin_symbol: string;
  coin_name?: string | null;
  quantity: number | string;
  entry_price_usd: number | string;
  purchase_date?: string;
  status: string;
}

interface Props {
  holdings: ClientHoldingRow[];
  prices: Map<string, number>;
  emptyMessage?: string;
}

export function ClientHoldingsTable({ holdings, prices, emptyMessage = "Sem posições." }: Props) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (symbol: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
  };

  // Agrupa preservando a ordem do primeiro lote de cada símbolo
  const groups = new Map<string, ClientHoldingRow[]>();
  for (const h of holdings) {
    const sym = h.coin_symbol.toUpperCase();
    const arr = groups.get(sym);
    if (arr) arr.push(h);
    else groups.set(sym, [h]);
  }

  const renderHoldingRow = (h: ClientHoldingRow, opts: { indented?: boolean } = {}) => {
    const sym = h.coin_symbol.toUpperCase();
    const hasPrice = prices.has(sym);
    const cur = prices.get(sym) ?? Number(h.entry_price_usd);
    const cost = Number(h.quantity) * Number(h.entry_price_usd);
    const market = Number(h.quantity) * cur;
    const pnl = market - cost;
    const pnlH = cost > 0 ? ((market - cost) / cost) * 100 : 0;
    return (
      <TableRow key={h.id} className={opts.indented ? "bg-muted/20" : undefined}>
        <TableCell>
          <div className={cn(opts.indented && "pl-8")}>
            <div className="font-mono font-semibold text-sm">{h.coin_symbol}</div>
            {opts.indented && (
              <div className="text-[11px] text-muted-foreground">
                Lote{h.purchase_date ? ` ${formatDate(h.purchase_date)}` : ""}
              </div>
            )}
          </div>
        </TableCell>
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
  };

  const rows: React.ReactNode[] = [];
  for (const [symbol, lots] of groups) {
    if (lots.length === 1) {
      rows.push(renderHoldingRow(lots[0]));
      continue;
    }

    const totalQty = lots.reduce((s, l) => s + Number(l.quantity), 0);
    const totalCost = lots.reduce((s, l) => s + Number(l.quantity) * Number(l.entry_price_usd), 0);
    const weightedAvg = totalQty > 0 ? totalCost / totalQty : 0;
    const hasPrice = prices.has(symbol);
    const cur = prices.get(symbol) ?? weightedAvg;
    const totalMarket = totalQty * cur;
    const totalPnl = totalMarket - totalCost;
    const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
    const anyActive = lots.some((l) => l.status === "ativa");
    const expanded = expandedGroups.has(symbol);

    rows.push(
      <TableRow
        key={`group-${symbol}`}
        className="cursor-pointer bg-muted/40 hover:bg-muted/60 font-medium"
        onClick={() => toggleGroup(symbol)}
      >
        <TableCell>
          <div className="flex items-center gap-2">
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-primary" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <div>
              <div className="font-mono font-semibold">{symbol}</div>
              <div className="text-[11px] text-muted-foreground">
                {lots.length} lotes
              </div>
            </div>
          </div>
        </TableCell>
        <TableCell className="text-right"><CryptoQty qty={totalQty} /></TableCell>
        <TableCell className="text-right"><Money usd={totalMarket} /></TableCell>
        <TableCell className="text-right">
          <div className="leading-tight">
            <Money usd={weightedAvg} />
            <div className="text-[10px] text-muted-foreground font-normal">médio ponderado</div>
          </div>
        </TableCell>
        <TableCell className="text-right">
          {hasPrice ? <Money usd={cur} /> : <span className="text-muted-foreground text-xs">—</span>}
        </TableCell>
        <TableCell className="text-right">
          {anyActive ? (
            <div className={cn("font-mono tabular-nums leading-tight", pnlClass(totalPnl))}>
              <div>{totalPnl >= 0 ? "+" : ""}{formatUSD(totalPnl)}</div>
              <div className="text-xs opacity-80">({formatPct(totalPnlPct)})</div>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">encerrada</span>
          )}
        </TableCell>
      </TableRow>
    );

    if (expanded) {
      for (const lot of lots) rows.push(renderHoldingRow(lot, { indented: true }));
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Moeda</TableHead>
          <TableHead className="text-right">Qtd</TableHead>
          <TableHead className="text-right">Valor Total (USD)</TableHead>
          <TableHead className="text-right">Preço Individual</TableHead>
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
        {rows}
      </TableBody>
    </Table>
  );
}
