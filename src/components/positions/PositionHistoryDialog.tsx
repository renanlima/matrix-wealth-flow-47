import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Money, CryptoQty } from "@/components/Money";
import { formatDate, formatUSD, formatPct, pnlClass } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fundId: string;
  coinSymbol: string;
  /** Admin sees lot id reference + admin metadata in vendas tab. Default: false. */
  isAdmin?: boolean;
}

interface HoldingRow {
  id: string;
  coin_symbol: string;
  coin_name: string | null;
  quantity: number | string;
  entry_price_usd: number | string;
  purchase_date: string;
  status: "ativa" | "encerrada";
  notes: string | null;
}

interface RealizationRow {
  id: string;
  holding_id: string;
  exit_date: string;
  exit_price_usd: number | string;
  quantity: number | string;
  total_usd: number | string;
  profit_usd: number | string;
  notes?: string | null;
}

export function PositionHistoryDialog({ open, onOpenChange, fundId, coinSymbol, isAdmin }: Props) {
  const sym = coinSymbol.toUpperCase();
  const [loading, setLoading] = useState(true);
  const [holdings, setHoldings] = useState<HoldingRow[]>([]);
  const [realizations, setRealizations] = useState<RealizationRow[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: h }, { data: p }] = await Promise.all([
        supabase
          .from("holdings")
          .select("id, coin_symbol, coin_name, quantity, entry_price_usd, purchase_date, status, notes")
          .eq("fund_id", fundId)
          .ilike("coin_symbol", sym)
          .order("purchase_date", { ascending: true }),
        supabase.from("coin_prices").select("price_usd").eq("symbol", sym).maybeSingle(),
      ]);
      if (cancelled) return;
      const hh = (h as HoldingRow[]) ?? [];
      const ids = hh.map((x) => x.id);
      let rs: RealizationRow[] = [];
      if (ids.length) {
        const { data: r } = await supabase
          .from("realizations")
          .select("*")
          .in("holding_id", ids)
          .order("exit_date", { ascending: true });
        rs = (r as RealizationRow[]) ?? [];
      }
      if (cancelled) return;
      setHoldings(hh);
      setRealizations(rs);
      setCurrentPrice(p?.price_usd != null ? Number(p.price_usd) : null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, fundId, sym]);

  // Mapa rápido holding_id → holding
  const holdingById = useMemo(() => new Map(holdings.map((h) => [h.id, h])), [holdings]);

  // Quantidades originais por holding (mesma lógica do extrato)
  const originalQtyByHolding = useMemo(() => {
    const soldBy = new Map<string, number>();
    for (const r of realizations) {
      soldBy.set(r.holding_id, (soldBy.get(r.holding_id) ?? 0) + Number(r.quantity));
    }
    const out = new Map<string, number>();
    for (const h of holdings) {
      const current = Number(h.quantity);
      const sold = soldBy.get(h.id) ?? 0;
      const orig = h.status === "encerrada" ? (sold > 0 ? sold : current) : current + sold;
      out.set(h.id, orig);
    }
    return out;
  }, [holdings, realizations]);

  const summary = useMemo(() => {
    let totalBoughtUsd = 0;
    let totalSoldUsd = 0;
    let realizedPnl = 0;
    let activeQty = 0;
    let activeCost = 0;
    for (const h of holdings) {
      const orig = originalQtyByHolding.get(h.id) ?? Number(h.quantity);
      const price = Number(h.entry_price_usd);
      totalBoughtUsd += orig * price;
      if (h.status === "ativa") {
        activeQty += Number(h.quantity);
        activeCost += Number(h.quantity) * price;
      }
    }
    for (const r of realizations) {
      totalSoldUsd += Number(r.total_usd);
      realizedPnl += Number(r.profit_usd);
    }
    const market = currentPrice != null ? activeQty * currentPrice : null;
    const unrealizedPnl = market != null ? market - activeCost : null;
    const unrealizedPct = market != null && activeCost > 0 ? ((market - activeCost) / activeCost) * 100 : null;
    return { totalBoughtUsd, totalSoldUsd, realizedPnl, activeQty, activeCost, market, unrealizedPnl, unrealizedPct };
  }, [holdings, realizations, currentPrice, originalQtyByHolding]);

  // Timeline: merge holdings (compra) + realizations (venda), ASC
  const timeline = useMemo(() => {
    type TLItem =
      | { kind: "buy"; date: string; qty: number; price: number; holdingId: string; notes: string | null }
      | { kind: "sell"; date: string; qty: number; price: number; total: number; profit: number; holdingId: string; notes: string | null };
    const items: TLItem[] = [];
    for (const h of holdings) {
      items.push({
        kind: "buy",
        date: h.purchase_date,
        qty: originalQtyByHolding.get(h.id) ?? Number(h.quantity),
        price: Number(h.entry_price_usd),
        holdingId: h.id,
        notes: h.notes,
      });
    }
    for (const r of realizations) {
      items.push({
        kind: "sell",
        date: r.exit_date,
        qty: Number(r.quantity),
        price: Number(r.exit_price_usd),
        total: Number(r.total_usd),
        profit: Number(r.profit_usd),
        holdingId: r.holding_id,
        notes: r.notes ?? null,
      });
    }
    items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return items;
  }, [holdings, realizations, originalQtyByHolding]);

  const lotLabel = (holdingId: string) => {
    const h = holdingById.get(holdingId);
    return h ? `Lote ${formatDate(h.purchase_date)}` : "—";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono">{sym} — histórico no fundo</DialogTitle>
          <DialogDescription>
            Todas as compras e vendas dessa moeda neste fundo.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : holdings.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Nenhum movimento de {sym} neste fundo.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <StatCard label="Total comprado" value={<Money usd={summary.totalBoughtUsd} />} />
              <StatCard label="Total vendido" value={<Money usd={summary.totalSoldUsd} />} />
              <StatCard
                label="P&L realizado"
                value={
                  <span className={pnlClass(summary.realizedPnl)}>
                    {summary.realizedPnl >= 0 ? "+" : ""}{formatUSD(summary.realizedPnl)}
                  </span>
                }
              />
              <StatCard
                label="Posição ativa"
                value={
                  <div className="leading-tight">
                    <div><CryptoQty qty={summary.activeQty} /> <span className="text-xs text-muted-foreground">{sym}</span></div>
                    <div className="text-[10px] text-muted-foreground">custo: {formatUSD(summary.activeCost)}</div>
                  </div>
                }
              />
              <StatCard
                label="P&L não realizado"
                value={
                  summary.unrealizedPnl != null ? (
                    <div className="leading-tight">
                      <span className={pnlClass(summary.unrealizedPnl)}>
                        {summary.unrealizedPnl >= 0 ? "+" : ""}{formatUSD(summary.unrealizedPnl)}
                      </span>
                      {summary.unrealizedPct != null && (
                        <div className="text-[10px] text-muted-foreground">({formatPct(summary.unrealizedPct)})</div>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">sem preço</span>
                  )
                }
              />
            </div>

            <Tabs defaultValue="timeline" className="mt-4">
              <TabsList>
                <TabsTrigger value="timeline">Linha do tempo</TabsTrigger>
                <TabsTrigger value="buys">Compras ({holdings.length})</TabsTrigger>
                <TabsTrigger value="sells">Vendas ({realizations.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="timeline" className="mt-3">
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[110px]">Data</TableHead>
                          <TableHead className="w-[80px]">Tipo</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="text-right">Qtd</TableHead>
                          <TableHead className="text-right">Preço</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          {isAdmin && <TableHead>Lote</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {timeline.map((t, i) => {
                          if (t.kind === "buy") {
                            const value = -(t.qty * t.price);
                            return (
                              <TableRow key={`b-${t.holdingId}-${i}`}>
                                <TableCell className="font-mono text-xs whitespace-nowrap">{formatDate(t.date)}</TableCell>
                                <TableCell>
                                  <span className="inline-flex items-center gap-1 text-xs text-orange-500">
                                    <ArrowDownCircle className="h-3.5 w-3.5" /> Compra
                                  </span>
                                </TableCell>
                                <TableCell className="text-sm">
                                  Compra de {t.qty} {sym}
                                  {t.notes && <div className="text-[11px] italic text-muted-foreground">“{t.notes}”</div>}
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs"><CryptoQty qty={t.qty} /></TableCell>
                                <TableCell className="text-right font-mono text-xs"><Money usd={t.price} /></TableCell>
                                <TableCell className="text-right font-mono tabular-nums text-destructive">
                                  {formatUSD(value)}
                                </TableCell>
                                {isAdmin && (
                                  <TableCell className="text-xs text-muted-foreground">{lotLabel(t.holdingId)}</TableCell>
                                )}
                              </TableRow>
                            );
                          }
                          return (
                            <TableRow key={`s-${t.holdingId}-${i}`}>
                              <TableCell className="font-mono text-xs whitespace-nowrap">{formatDate(t.date)}</TableCell>
                              <TableCell>
                                <span className={cn("inline-flex items-center gap-1 text-xs", pnlClass(t.profit))}>
                                  <ArrowUpCircle className="h-3.5 w-3.5" /> Venda
                                </span>
                              </TableCell>
                              <TableCell className="text-sm">
                                Venda de {t.qty} {sym}
                                <span className={cn("ml-2 text-[11px] font-mono", pnlClass(t.profit))}>
                                  ({t.profit >= 0 ? "+" : ""}{formatUSD(t.profit)})
                                </span>
                                {t.notes && <div className="text-[11px] italic text-muted-foreground">“{t.notes}”</div>}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs"><CryptoQty qty={t.qty} /></TableCell>
                              <TableCell className="text-right font-mono text-xs"><Money usd={t.price} /></TableCell>
                              <TableCell className="text-right font-mono tabular-nums text-success">
                                +{formatUSD(t.total)}
                              </TableCell>
                              {isAdmin && (
                                <TableCell className="text-xs text-muted-foreground">{lotLabel(t.holdingId)}</TableCell>
                              )}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="buys" className="mt-3">
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[110px]">Data</TableHead>
                          <TableHead className="text-right">Qtd original</TableHead>
                          <TableHead className="text-right">Preço</TableHead>
                          <TableHead className="text-right">Custo total</TableHead>
                          <TableHead className="text-right">Qtd restante</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Notas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {holdings.map((h) => {
                          const orig = originalQtyByHolding.get(h.id) ?? Number(h.quantity);
                          const price = Number(h.entry_price_usd);
                          const cost = orig * price;
                          const remaining = h.status === "ativa" ? Number(h.quantity) : 0;
                          return (
                            <TableRow key={h.id}>
                              <TableCell className="font-mono text-xs whitespace-nowrap">{formatDate(h.purchase_date)}</TableCell>
                              <TableCell className="text-right font-mono text-xs"><CryptoQty qty={orig} /></TableCell>
                              <TableCell className="text-right font-mono text-xs"><Money usd={price} /></TableCell>
                              <TableCell className="text-right font-mono text-xs"><Money usd={cost} /></TableCell>
                              <TableCell className="text-right font-mono text-xs">
                                <CryptoQty qty={remaining} />
                              </TableCell>
                              <TableCell>
                                <span className={cn("text-xs uppercase font-mono", h.status === "ativa" ? "text-success" : "text-muted-foreground")}>
                                  {h.status}
                                </span>
                              </TableCell>
                              <TableCell className="text-xs italic text-muted-foreground max-w-[200px] truncate">
                                {h.notes || "—"}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="sells" className="mt-3">
                <Card>
                  <CardContent className="p-0">
                    {realizations.length === 0 ? (
                      <div className="py-8 text-center text-sm text-muted-foreground">
                        Nenhuma venda registrada para {sym}.
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[110px]">Data</TableHead>
                            <TableHead className="text-right">Qtd vendida</TableHead>
                            <TableHead className="text-right">Preço saída</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="text-right">Lucro</TableHead>
                            {isAdmin && <TableHead>Lote origem</TableHead>}
                            <TableHead>Notas</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {realizations.map((r) => {
                            const qty = Number(r.quantity);
                            const profit = Number(r.profit_usd);
                            return (
                              <TableRow key={r.id}>
                                <TableCell className="font-mono text-xs whitespace-nowrap">{formatDate(r.exit_date)}</TableCell>
                                <TableCell className="text-right font-mono text-xs"><CryptoQty qty={qty} /></TableCell>
                                <TableCell className="text-right font-mono text-xs"><Money usd={r.exit_price_usd} /></TableCell>
                                <TableCell className="text-right font-mono text-xs"><Money usd={r.total_usd} /></TableCell>
                                <TableCell className={cn("text-right font-mono text-xs", pnlClass(profit))}>
                                  {profit >= 0 ? "+" : ""}{formatUSD(profit)}
                                </TableCell>
                                {isAdmin && (
                                  <TableCell className="text-xs text-muted-foreground">{lotLabel(r.holding_id)}</TableCell>
                                )}
                                <TableCell className="text-xs italic text-muted-foreground max-w-[200px] truncate">
                                  {r.notes || "—"}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card className="border-primary/10">
      <CardContent className="p-2.5">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</div>
        <div className="text-sm font-mono tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}
