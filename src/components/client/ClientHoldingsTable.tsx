import { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Money, CryptoQty } from "@/components/Money";
import { Button } from "@/components/ui/button";
import { formatUSD, formatPct, pnlClass, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ChevronRight, ChevronDown, ChevronLeft, ChevronsLeft, ChevronsRight, History, AlertTriangle } from "lucide-react";
import { PositionHistoryDialog } from "@/components/positions/PositionHistoryDialog";

const PAGE_SIZE = 20;

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
  /** ID do fundo para abrir o dialog de histórico. Se ausente, o botão histórico não aparece. */
  fundId?: string;
}

export function ClientHoldingsTable({ holdings, prices, emptyMessage = "Sem posições.", fundId }: Props) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [historySymbol, setHistorySymbol] = useState<string | null>(null);
  const [page, setPage] = useState(0);

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
        <TableCell className="text-right">
          {hasPrice ? <Money usd={market} /> : <span className="text-muted-foreground text-xs">—</span>}
        </TableCell>
        <TableCell className="text-right"><Money usd={Number(h.entry_price_usd)} /></TableCell>
        <TableCell className="text-right">
          {hasPrice ? (
            <Money usd={cur} />
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] text-amber-500" title="Sem cotação atual">
              <AlertTriangle className="h-3 w-3" /> sem cotação
            </span>
          )}
        </TableCell>
        <TableCell className="text-right">
          {h.status === "ativa" && hasPrice ? (
            <div className={cn("font-mono tabular-nums leading-tight", pnlClass(pnl))}>
              <div>{pnl >= 0 ? "+" : ""}{formatUSD(pnl)}</div>
              <div className="text-xs opacity-80">({formatPct(pnlH)})</div>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">{h.status === "ativa" ? "—" : h.status}</span>
          )}
        </TableCell>
        {fundId && (
          <TableCell className="text-right">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Histórico"
              title="Histórico"
              onClick={(e) => { e.stopPropagation(); setHistorySymbol(sym); }}
            >
              <History className="h-3.5 w-3.5" />
            </Button>
          </TableCell>
        )}
      </TableRow>
    );
  };

  // Paginação por GRUPO (moeda) — lotes expandidos não contam para o slot da página.
  // Só ativa quando há mais de PAGE_SIZE moedas no fundo.
  const allGroupEntries = [...groups.entries()];
  const totalGroups = allGroupEntries.length;
  const showPagination = totalGroups > PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(totalGroups / PAGE_SIZE));
  // Clamp page caso a lista encolha (ex: filtro Mostrar encerradas off)
  useEffect(() => {
    if (page > 0 && page >= totalPages) setPage(0);
  }, [page, totalPages]);
  const safePage = Math.min(page, totalPages - 1);
  const visibleEntries = showPagination
    ? allGroupEntries.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)
    : allGroupEntries;
  const rangeStart = showPagination ? safePage * PAGE_SIZE + 1 : 1;
  const rangeEnd = showPagination
    ? Math.min((safePage + 1) * PAGE_SIZE, totalGroups)
    : totalGroups;

  const rows: React.ReactNode[] = [];
  for (const [symbol, lots] of visibleEntries) {
    if (lots.length === 1) {
      rows.push(renderHoldingRow(lots[0]));
      continue;
    }

    // Agregação só sobre lotes ATIVOS (realize_partial mantém quantity em encerrados).
    const activeLots = lots.filter((l) => l.status === "ativa");
    const totalQty = activeLots.reduce((s, l) => s + Number(l.quantity), 0);
    const totalCost = activeLots.reduce((s, l) => s + Number(l.quantity) * Number(l.entry_price_usd), 0);
    const weightedAvg = totalQty > 0 ? totalCost / totalQty : 0;
    const hasPrice = prices.has(symbol);
    const cur = prices.get(symbol) ?? weightedAvg;
    const totalMarket = totalQty * cur;
    const totalPnl = totalMarket - totalCost;
    const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
    const anyActive = activeLots.length > 0;
    const expanded = expandedGroups.has(symbol);
    const closedCount = lots.length - activeLots.length;

    const renderGroupHistoryCell = () =>
      fundId ? (
        <TableCell className="text-right">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Histórico"
            title="Histórico"
            onClick={(e) => { e.stopPropagation(); setHistorySymbol(symbol); }}
          >
            <History className="h-3.5 w-3.5" />
          </Button>
        </TableCell>
      ) : null;

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
                {activeLots.length} ativ{activeLots.length === 1 ? "o" : "os"}
                {closedCount > 0 && ` · ${closedCount} encerrad${closedCount === 1 ? "o" : "os"}`}
              </div>
            </div>
          </div>
        </TableCell>
        <TableCell className="text-right"><CryptoQty qty={totalQty} /></TableCell>
        <TableCell className="text-right">
          {hasPrice ? <Money usd={totalMarket} /> : <span className="text-muted-foreground text-xs">—</span>}
        </TableCell>
        <TableCell className="text-right">
          <div className="leading-tight" title="Σ(qty_ativo × entry_price) / Σ(qty_ativo) — cost basis dos lotes que você possui agora. Lotes já vendidos não entram.">
            <Money usd={weightedAvg} />
            <div className="text-[10px] text-muted-foreground font-normal">médio (posição atual)</div>
          </div>
        </TableCell>
        <TableCell className="text-right">
          {hasPrice ? (
            <Money usd={cur} />
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] text-amber-500" title="Sem cotação atual">
              <AlertTriangle className="h-3 w-3" /> sem cotação
            </span>
          )}
        </TableCell>
        <TableCell className="text-right">
          {anyActive && hasPrice ? (
            <div className={cn("font-mono tabular-nums leading-tight", pnlClass(totalPnl))}>
              <div>{totalPnl >= 0 ? "+" : ""}{formatUSD(totalPnl)}</div>
              <div className="text-xs opacity-80">({formatPct(totalPnlPct)})</div>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">{anyActive ? "—" : "encerrada"}</span>
          )}
        </TableCell>
        {renderGroupHistoryCell()}
      </TableRow>
    );

    if (expanded) {
      for (const lot of lots) rows.push(renderHoldingRow(lot, { indented: true }));
    }
  }

  const colCount = fundId ? 7 : 6;
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Moeda</TableHead>
            <TableHead className="text-right">Qtd</TableHead>
            <TableHead className="text-right">Valor Total (USD)</TableHead>
            <TableHead className="text-right">Preço Individual</TableHead>
            <TableHead className="text-right">Preço atual</TableHead>
            <TableHead className="text-right">P&L</TableHead>
            {fundId && <TableHead className="text-right"></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {holdings.length === 0 && (
            <TableRow>
              <TableCell colSpan={colCount} className="text-center py-6 text-muted-foreground text-sm">
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
          {rows}
        </TableBody>
      </Table>
      {showPagination && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-border/40 text-xs">
          <div className="text-muted-foreground">
            Moedas <span className="font-mono">{rangeStart}–{rangeEnd}</span> de{" "}
            <span className="font-mono">{totalGroups}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPage(0)}
              disabled={safePage === 0}
              aria-label="Primeira página"
              title="Primeira página"
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              aria-label="Página anterior"
              title="Página anterior"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="font-mono px-2 text-muted-foreground tabular-nums">
              {safePage + 1} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              aria-label="Próxima página"
              title="Próxima página"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPage(totalPages - 1)}
              disabled={safePage >= totalPages - 1}
              aria-label="Última página"
              title="Última página"
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
      {fundId && (
        <PositionHistoryDialog
          open={historySymbol !== null}
          onOpenChange={(o) => { if (!o) setHistorySymbol(null); }}
          fundId={fundId}
          coinSymbol={historySymbol ?? ""}
        />
      )}
    </>
  );
}
