import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, ChevronLeft, ChevronRight, ChevronDown, DollarSign, Lock, Pencil, FileText, History, AlertTriangle } from "lucide-react";
import { PositionHistoryDialog } from "@/components/positions/PositionHistoryDialog";
import { fixedIncomeAccrued, isHoldingLiveOn } from "@/lib/patrimonio";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Money, CryptoQty, Pct } from "@/components/Money";
import { toast } from "sonner";
import { formatDate, parseUsdInput, formatUSD, formatPct, pnlClass } from "@/lib/format";
import { cn } from "@/lib/utils";

interface PHRow {
  id: string; year: number; month: number;
  patrimonio_inicio_usd: number; patrimonio_fim_usd: number;
  alocacoes_usd: number; desalocacoes_usd: number;
  lucro_bruto_usd: number; base_calculo_usd: number;
  taxa_aplicada_usd: number; novo_deficit_usd: number;
  deficit_anterior_usd: number;
}
const MONTHS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export const Route = createFileRoute("/admin/clientes/$clientId/fundos/$fundId")({
  component: FundDetail,
});

interface Fund {
  id: string;
  name: string;
  status: "ativo" | "encerrado";
  start_date: string;
  performance_fee_pct: number;
}
interface Holding {
  id: string;
  coin_symbol: string;
  coin_name: string | null;
  quantity: number;
  entry_price_usd: number;
  purchase_date: string;
  status: "ativa" | "encerrada";
  notes: string | null;
}
interface Realization {
  id: string;
  holding_id: string;
  exit_price_usd: number;
  exit_date: string;
  total_usd: number;
  profit_usd: number;
}

function FundDetail() {
  const { clientId, fundId } = useParams({ from: "/admin/clientes/$clientId/fundos/$fundId" });
  const [fund, setFund] = useState<Fund | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [realizations, setRealizations] = useState<Realization[]>([]);
  const [prices, setPrices] = useState<Map<string, number>>(new Map());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [historySymbol, setHistorySymbol] = useState<string | null>(null);

  const toggleGroup = (symbol: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
  };

  const load = useCallback(async () => {
    const [{ data: f }, { data: h }, { data: p }] = await Promise.all([
      supabase
        .from("funds")
        .select("id, name, status, start_date, performance_fee_pct")
        .eq("id", fundId)
        .maybeSingle(),
      supabase
        .from("holdings")
        .select("*")
        .eq("fund_id", fundId)
        .order("purchase_date", { ascending: false }),
      supabase.from("coin_prices").select("symbol, price_usd"),
    ]);
    setFund(f as Fund | null);
    const hh = (h as Holding[]) ?? [];
    setHoldings(hh);
    setPrices(new Map((p ?? []).map((x) => [x.symbol.toUpperCase(), Number(x.price_usd)])));
    const ids = hh.map((x) => x.id);
    if (ids.length) {
      const { data: r } = await supabase.from("realizations").select("*").in("holding_id", ids);
      setRealizations((r as Realization[]) ?? []);
    } else {
      setRealizations([]);
    }
  }, [fundId]);

  useEffect(() => {
    load();
  }, [load]);

  const closeFund = async () => {
    if (!confirm("Encerrar este fundo? Esta ação muda o status para 'encerrado'.")) return;
    const { error } = await supabase
      .from("funds")
      .update({ status: "encerrado", end_date: new Date().toISOString().slice(0, 10) })
      .eq("id", fundId);
    if (error) toast.error(error.message);
    else {
      toast.success("Fundo encerrado");
      load();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/admin/clientes/$clientId" params={{ clientId }}>
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{fund?.name ?? "—"}</h1>
          <p className="text-sm text-muted-foreground">
            Início {formatDate(fund?.start_date)} · Taxa {fund?.performance_fee_pct}% ·{" "}
            <span className={fund?.status === "ativo" ? "text-success" : "text-muted-foreground"}>
              {fund?.status}
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/clientes/$clientId/fundos/$fundId/extrato" params={{ clientId, fundId }}>
            <Button variant="outline" size="sm">
              <FileText className="h-4 w-4 mr-1" /> Extrato
            </Button>
          </Link>
          <NewHoldingDialog fundId={fundId} onCreated={load} />
          {fund?.status === "ativo" && (
            <Button variant="outline" size="sm" onClick={closeFund}>
              <Lock className="h-4 w-4 mr-1" /> Encerrar fundo
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="positions">
        <TabsList>
          <TabsTrigger value="positions">Posições</TabsTrigger>
          <TabsTrigger value="realizations">Realizações</TabsTrigger>
          <TabsTrigger value="history">Histórico mensal</TabsTrigger>
        </TabsList>

        <TabsContent value="positions" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Posições</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Moeda</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Valor Total (USD)</TableHead>
                    <TableHead className="text-right">Preço Individual</TableHead>
                    <TableHead className="text-right">Preço atual</TableHead>
                    <TableHead className="text-right">P&L</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holdings.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                        Sem posições.
                      </TableCell>
                    </TableRow>
                  )}
                  {(() => {
                    const holdingsWithSales = new Set(realizations.map((r) => r.holding_id));

                    // Agrupa preservando a ordem do primeiro lote de cada símbolo
                    const groups = new Map<string, Holding[]>();
                    for (const h of holdings) {
                      const sym = h.coin_symbol.toUpperCase();
                      const arr = groups.get(sym);
                      if (arr) arr.push(h);
                      else groups.set(sym, [h]);
                    }

                    const renderHoldingRow = (h: Holding, opts: { indented?: boolean } = {}) => {
                      const hasPrice = prices.has(h.coin_symbol.toUpperCase());
                      const cur = prices.get(h.coin_symbol.toUpperCase()) ?? Number(h.entry_price_usd);
                      const cost = Number(h.quantity) * Number(h.entry_price_usd);
                      const market = Number(h.quantity) * cur;
                      const pnl = market - cost;
                      const pnlPct = cost > 0 ? ((market - cost) / cost) * 100 : 0;
                      const locked = holdingsWithSales.has(h.id);
                      return (
                        <TableRow key={h.id} className={opts.indented ? "bg-muted/20" : undefined}>
                          <TableCell>
                            <div className={cn("flex items-center gap-1", opts.indented && "pl-8")}>
                              <div>
                                <div className="font-mono font-semibold text-sm">{h.coin_symbol}</div>
                                <div className="text-[11px] text-muted-foreground">
                                  {opts.indented ? `Lote ${formatDate(h.purchase_date)}` : (h.coin_name ?? "—")}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right"><CryptoQty qty={h.quantity} /></TableCell>
                          <TableCell className="text-right">
                            {hasPrice ? <Money usd={market} /> : <span className="text-muted-foreground text-xs">—</span>}
                          </TableCell>
                          <TableCell className="text-right"><Money usd={h.entry_price_usd} /></TableCell>
                          <TableCell className="text-right">
                            {hasPrice ? (
                              <Money usd={cur} />
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] text-amber-500" title="Sem cotação atual em coin_prices">
                                <AlertTriangle className="h-3 w-3" /> sem cotação
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {h.status === "ativa" && hasPrice ? (
                              <div className={cn("font-mono tabular-nums leading-tight", pnlClass(pnl))}>
                                <div>{pnl >= 0 ? "+" : ""}{formatUSD(pnl)}</div>
                                <div className="text-xs opacity-80">({formatPct(pnlPct)})</div>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className={`text-xs font-mono uppercase ${h.status === "ativa" ? "text-success" : "text-muted-foreground"}`}>
                              {h.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Histórico"
                                title="Histórico"
                                onClick={(e) => { e.stopPropagation(); setHistorySymbol(h.coin_symbol.toUpperCase()); }}
                              >
                                <History className="h-3.5 w-3.5" />
                              </Button>
                              {h.status === "ativa" && (
                                <EditHoldingButton holding={h} locked={locked} onDone={load} />
                              )}
                              {h.status === "ativa" && (
                                <RealizeDialog holding={h} onDone={load} />
                              )}
                            </div>
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

                      // Linha agrupada — agregações usam APENAS lotes ativos.
                      // realize_partial mantém holdings.quantity em lotes encerrados (não decrementa),
                      // então somar todos os lots infla qty/cost/market/P&L. C1 fix.
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
                      const displayName = lots[0].coin_name ?? "—";
                      const closedCount = lots.length - activeLots.length;

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
                                  {displayName} · {activeLots.length} ativ{activeLots.length === 1 ? "o" : "os"}
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
                            <div className="leading-tight" title="Σ(qty_ativo × entry_price) / Σ(qty_ativo) — cost basis dos lotes ativos. Não considera lotes encerrados.">
                              <Money usd={weightedAvg} />
                              <div className="text-[10px] text-muted-foreground font-normal">médio (posição atual)</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {hasPrice ? (
                              <Money usd={cur} />
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] text-amber-500" title="Sem cotação atual em coin_prices">
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
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className={`text-xs font-mono uppercase ${anyActive ? "text-success" : "text-muted-foreground"}`}>
                              {anyActive ? "ativa" : "encerrada"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end items-center">
                              <span className="text-[10px] text-muted-foreground mr-1">
                                {expanded ? "ocultar lotes" : "ver lotes"}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Histórico"
                                title="Histórico"
                                onClick={(e) => { e.stopPropagation(); setHistorySymbol(symbol); }}
                              >
                                <History className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );

                      if (expanded) {
                        for (const lot of lots) rows.push(renderHoldingRow(lot, { indented: true }));
                      }
                    }

                    return rows;
                  })()}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="realizations" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Realizações (vendas)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Posição</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Preço saída</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Lucro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {realizations.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                        Nenhuma realização ainda.
                      </TableCell>
                    </TableRow>
                  )}
                  {realizations.map((r) => {
                    const h = holdings.find((x) => x.id === r.holding_id);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono">{h?.coin_symbol ?? "—"}</TableCell>
                        <TableCell className="text-xs">{formatDate(r.exit_date)}</TableCell>
                        <TableCell className="text-right"><Money usd={r.exit_price_usd} /></TableCell>
                        <TableCell className="text-right"><Money usd={r.total_usd} /></TableCell>
                        <TableCell className={`text-right font-mono ${r.profit_usd >= 0 ? "text-success" : "text-destructive"}`}>
                          <Money usd={r.profit_usd} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <FundHistoryCard fundId={fundId} />
        </TabsContent>
      </Tabs>

      <PositionHistoryDialog
        open={historySymbol !== null}
        onOpenChange={(o) => { if (!o) setHistorySymbol(null); }}
        fundId={fundId}
        coinSymbol={historySymbol ?? ""}
        isAdmin
      />
    </div>
  );
}

// Mesmas fórmulas da edge function close-monthly-performance — calcula a prévia
// do mês corrente em tempo real para o admin enxergar o que vai entrar no fechamento.
// fixedIncomeAccrued importada de @/lib/patrimonio (C4).
interface PreviewResult {
  year: number;
  month: number;
  patrimonioInicio: number;
  patrimonioFim: number;
  alocacoes: number;
  desalocacoes: number;
  lucroBruto: number;
  deficitAnterior: number;
  baseCalculo: number;
  taxaAplicada: number;
  novoDeficit: number;
}
// fixedIncomeAccrued agora importada de @/lib/patrimonio (C4)

function FundHistoryCard({ fundId }: { fundId: string }) {
  const [rows, setRows] = useState<PHRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [fundStart, setFundStart] = useState<string | null>(null);
  const [fundStatus, setFundStatus] = useState<string | null>(null);
  const [fundEndDate, setFundEndDate] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);

      // 1. Histórico já fechado
      const { data: phData, error: phErr } = await supabase
        .from("performance_history")
        .select("*")
        .eq("fund_id", fundId)
        .order("year", { ascending: false })
        .order("month", { ascending: false });
      if (cancelled) return;
      if (phErr) {
        setError(phErr.message);
        setLoading(false);
        return;
      }
      setRows((phData as PHRow[]) ?? []);

      // 2. Dados pra calcular prévia do mês corrente
      try {
        const today = new Date();
        const year = today.getUTCFullYear();
        const month = today.getUTCMonth() + 1; // 1..12
        const startISO = new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10);
        const endExclusiveISO = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
        const todayISO = today.toISOString().slice(0, 10);

        const prevYM = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };

        const [
          { data: fundRow },
          { data: holdings },
          { data: fi },
          { data: prices },
          { data: prevRow },
        ] = await Promise.all([
          supabase
            .from("funds")
            .select("performance_fee_pct, carried_deficit_usd, start_date, status, end_date")
            .eq("id", fundId)
            .maybeSingle(),
          supabase
            .from("holdings")
            .select("id, coin_symbol, quantity, entry_price_usd, purchase_date, status")
            .eq("fund_id", fundId),
          supabase
            .from("fixed_income")
            .select("id, valor_aplicado_usd, taxa_anual_pct, data_registro, data_saida, ultimo_preco_usd")
            .eq("fund_id", fundId),
          supabase.from("coin_prices").select("symbol, price_usd"),
          supabase
            .from("performance_history")
            .select("patrimonio_fim_usd")
            .eq("fund_id", fundId)
            .eq("year", prevYM.y)
            .eq("month", prevYM.m)
            .maybeSingle(),
        ]);
        if (cancelled) return;
        setFundStart((fundRow?.start_date as string | undefined) ?? null);
        setFundStatus((fundRow?.status as string | undefined) ?? null);
        setFundEndDate((fundRow?.end_date as string | undefined) ?? null);

        const hIds = (holdings ?? []).map((h: any) => h.id);
        let realizations: Array<{ total_usd: number; exit_date: string; holding_id: string }> = [];
        if (hIds.length) {
          const { data: rs } = await supabase
            .from("realizations")
            .select("total_usd, exit_date, holding_id")
            .in("holding_id", hIds);
          realizations = (rs ?? []) as typeof realizations;
        }

        const priceMap = new Map(
          (prices ?? []).map((p: any) => [String(p.symbol).toUpperCase(), Number(p.price_usd)]),
        );
        const inRange = (d: string | null | undefined) => !!d && d >= startISO && d < endExclusiveISO;

        // patrimônio fim (snapshot atual) — heurística "holding viva no EOM" centralizada em
        // lib/patrimonio.ts e MIRRORED na edge function (C9).
        let patrimonioFim = 0;
        for (const h of holdings ?? []) {
          if (!isHoldingLiveOn(h as any, realizations, todayISO)) continue;
          const sym = String((h as any).coin_symbol).toUpperCase();
          const price = priceMap.get(sym) ?? Number((h as any).entry_price_usd);
          patrimonioFim += Number((h as any).quantity) * price;
        }
        for (const f of fi ?? []) {
          const exitedBefore = (f as any).data_saida && (f as any).data_saida <= todayISO;
          if (exitedBefore) continue;
          const valor = Number((f as any).valor_aplicado_usd);
          const accrued = fixedIncomeAccrued(
            valor,
            Number((f as any).taxa_anual_pct),
            (f as any).data_registro,
            todayISO,
          );
          patrimonioFim += valor + accrued;
        }

        const patrimonioInicio = prevRow ? Number(prevRow.patrimonio_fim_usd) : 0;

        let alocacoes = 0;
        for (const h of holdings ?? []) {
          if (inRange((h as any).purchase_date)) {
            alocacoes += Number((h as any).quantity) * Number((h as any).entry_price_usd);
          }
        }
        for (const f of fi ?? []) {
          if (inRange((f as any).data_registro)) alocacoes += Number((f as any).valor_aplicado_usd);
        }

        let desalocacoes = 0;
        for (const r of realizations) {
          if (inRange(r.exit_date)) desalocacoes += Number(r.total_usd);
        }
        for (const f of fi ?? []) {
          if (inRange((f as any).data_saida)) {
            const valor = Number((f as any).valor_aplicado_usd);
            const accrued = fixedIncomeAccrued(
              valor,
              Number((f as any).taxa_anual_pct),
              (f as any).data_registro,
              (f as any).data_saida,
            );
            desalocacoes += valor + accrued;
          }
        }

        const lucroBruto = patrimonioFim - patrimonioInicio - alocacoes + desalocacoes;
        const deficitAnterior = Number(fundRow?.carried_deficit_usd ?? 0);
        const baseCalculo = lucroBruto + deficitAnterior;
        const feePct = Number(fundRow?.performance_fee_pct ?? 0);
        let taxaAplicada = 0;
        let novoDeficit = 0;
        if (baseCalculo > 0) {
          taxaAplicada = baseCalculo * (feePct / 100);
          novoDeficit = 0;
        } else {
          taxaAplicada = 0;
          novoDeficit = baseCalculo;
        }

        setPreview({
          year,
          month,
          patrimonioInicio,
          patrimonioFim,
          alocacoes,
          desalocacoes,
          lucroBruto,
          deficitAnterior,
          baseCalculo,
          taxaAplicada,
          novoDeficit,
        });
      } catch (e: any) {
        if (!cancelled) setPreviewError(e?.message ?? "Falha ao calcular prévia");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fundId]);

  // Próximo fechamento previsto: último dia do mês corrente, processado no início do próximo
  const nextClose = useMemo(() => {
    const t = new Date();
    const m = t.getUTCMonth();
    const y = t.getUTCFullYear();
    const lastDay = new Date(Date.UTC(y, m + 1, 0)); // último dia do mês atual
    return formatDate(lastDay.toISOString().slice(0, 10));
  }, []);

  return (
    <div className="space-y-4">
      {/* Prévia do mês corrente */}
      {fundStatus === "encerrado" && (
        <Card className="border-muted">
          <CardContent className="py-4 text-sm text-muted-foreground">
            Fundo encerrado{fundEndDate ? ` em ${formatDate(fundEndDate)}` : ""}.
            Não há mês corrente em andamento — prévia desabilitada.
          </CardContent>
        </Card>
      )}
      {preview && fundStatus !== "encerrado" && (
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              Prévia do mês corrente — {MONTHS_PT[preview.month - 1]}/{preview.year}
              <span className="text-[10px] uppercase tracking-wider text-primary font-normal px-1.5 py-0.5 rounded bg-primary/10">
                em andamento
              </span>
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Cálculo ao vivo com mesmas fórmulas do fechamento mensal. Resultado oficial será gravado em {nextClose}.
            </p>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <PreviewStat label="Patrimônio início" value={preview.patrimonioInicio} />
              <PreviewStat label="Patrimônio atual" value={preview.patrimonioFim} highlight />
              <PreviewStat label="Aportes no mês" value={preview.alocacoes} />
              <PreviewStat label="Desalocações no mês" value={preview.desalocacoes} />
              <PreviewStat
                label="Lucro bruto projetado"
                value={preview.lucroBruto}
                colored
              />
              {preview.deficitAnterior < 0 && (
                <PreviewStat label="Déficit acumulado" value={preview.deficitAnterior} colored />
              )}
              <PreviewStat label="Base de cálculo" value={preview.baseCalculo} colored />
              <PreviewStat
                label="Taxa projetada"
                value={preview.taxaAplicada}
                highlight
              />
            </div>
            {previewError && (
              <p className="text-xs text-destructive mt-3">⚠ {previewError}</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico mensal — fechamentos consolidados</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {error && (
            <div className="p-4 text-sm text-destructive border-b border-destructive/20">
              ⚠ Erro ao carregar histórico: {error}
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Período</TableHead>
                <TableHead className="text-right">Início</TableHead>
                <TableHead className="text-right">Fim</TableHead>
                <TableHead className="text-right">Aloc.</TableHead>
                <TableHead className="text-right">Desaloc.</TableHead>
                <TableHead className="text-right">Lucro bruto</TableHead>
                <TableHead className="text-right">Déficit ant.</TableHead>
                <TableHead className="text-right">Base</TableHead>
                <TableHead className="text-right">Taxa</TableHead>
                <TableHead className="text-right">Novo déficit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={10} className="py-6 text-center text-muted-foreground">Carregando...</TableCell></TableRow>}
              {!loading && !error && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                    <div className="text-sm font-medium text-foreground">Nenhum fechamento mensal ainda</div>
                    <div className="text-xs mt-1.5">
                      Fechamentos são gerados automaticamente no fim de cada mês via cron interno.<br />
                      {fundStart && <>Este fundo iniciou em <span className="font-mono">{formatDate(fundStart)}</span>. </>}
                      Próximo fechamento previsto: <span className="font-mono">{nextClose}</span> (resultado disponível em alguns minutos depois).
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{MONTHS_PT[r.month - 1]}/{r.year}</TableCell>
                  <TableCell className="text-right"><Money usd={Number(r.patrimonio_inicio_usd)} /></TableCell>
                  <TableCell className="text-right"><Money usd={Number(r.patrimonio_fim_usd)} /></TableCell>
                  <TableCell className="text-right text-xs"><Money usd={Number(r.alocacoes_usd)} /></TableCell>
                  <TableCell className="text-right text-xs"><Money usd={Number(r.desalocacoes_usd)} /></TableCell>
                  <TableCell className={`text-right font-mono ${Number(r.lucro_bruto_usd) >= 0 ? "text-success" : "text-destructive"}`}>
                    <Money usd={Number(r.lucro_bruto_usd)} />
                  </TableCell>
                  <TableCell className="text-right text-xs text-destructive">
                    {Number(r.deficit_anterior_usd) < 0 ? <Money usd={Number(r.deficit_anterior_usd)} /> : "—"}
                  </TableCell>
                  <TableCell className="text-right text-xs"><Money usd={Number(r.base_calculo_usd)} /></TableCell>
                  <TableCell className="text-right text-primary"><Money usd={Number(r.taxa_aplicada_usd)} /></TableCell>
                  <TableCell className="text-right text-xs">
                    {Number(r.novo_deficit_usd) < 0 ? <span className="text-destructive"><Money usd={Number(r.novo_deficit_usd)} /></span> : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function PreviewStat({
  label,
  value,
  colored,
  highlight,
}: {
  label: string;
  value: number;
  colored?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded border p-2",
        highlight ? "border-primary/30 bg-primary/5" : "border-border/40",
      )}
    >
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</div>
      <div className={cn("font-mono tabular-nums text-sm", colored && pnlClass(value))}>
        <Money usd={value} />
      </div>
    </div>
  );
}

function NewHoldingDialog({ fundId, onCreated }: { fundId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    coin_symbol: "",
    coin_name: "",
    quantity: "",
    entry_price_usd: "",
    purchase_date: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // C12: guards básicos antes do round-trip.
    const qty = Number(form.quantity);
    const price = parseUsdInput(form.entry_price_usd);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Quantidade deve ser maior que zero");
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      toast.error("Preço de entrada deve ser maior que zero");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("holdings").insert({
      fund_id: fundId,
      coin_symbol: form.coin_symbol.toUpperCase(),
      coin_name: form.coin_name || null,
      quantity: qty,
      entry_price_usd: price,
      purchase_date: form.purchase_date,
      notes: form.notes || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Posição registrada");
    setForm({ coin_symbol: "", coin_name: "", quantity: "", entry_price_usd: "", purchase_date: new Date().toISOString().slice(0, 10), notes: "" });
    setOpen(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="glow-cyan">
          <Plus className="h-4 w-4 mr-1" /> Nova compra
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova posição</DialogTitle>
          <DialogDescription>Use o ticker oficial (ex.: BTC, ETH, SOL).</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Ticker *</Label>
              <Input
                value={form.coin_symbol}
                onChange={(e) => setForm({ ...form, coin_symbol: e.target.value })}
                required
                className="font-mono uppercase"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={form.coin_name} onChange={(e) => setForm({ ...form, coin_name: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Quantidade *</Label>
              <Input
                type="number"
                step="0.00000001"
                min="0.00000001"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Preço entrada (USD) *</Label>
              <MoneyInput
                decimals={8}
                value={form.entry_price_usd}
                onValueChange={(display) => setForm({ ...form, entry_price_usd: display })}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Data da compra *</Label>
            <Input
              type="date"
              value={form.purchase_date}
              onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>{submitting ? "Salvando..." : "Registrar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RealizeDialog({ holding, onDone }: { holding: Holding; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [exitPrice, setExitPrice] = useState("");
  const [qtyToSell, setQtyToSell] = useState(String(holding.quantity));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);

  const exitPriceNum = parseUsdInput(exitPrice);
  const qtyNum = Number(qtyToSell);
  const maxQty = Number(holding.quantity);
  const qtyValid = qtyNum > 0 && qtyNum <= maxQty;
  const isPartial = qtyValid && qtyNum < maxQty;
  const total = exitPriceNum * (qtyValid ? qtyNum : 0);
  const cost = Number(holding.entry_price_usd) * (qtyValid ? qtyNum : 0);
  const profit = total - cost;
  const remaining = qtyValid ? maxQty - qtyNum : maxQty;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qtyValid) { toast.error("Quantidade inválida"); return; }
    setSubmitting(true);
    const { error } = await supabase.rpc("realize_partial", {
      _holding_id: holding.id,
      _qty: qtyNum,
      _exit_price: exitPriceNum,
      _exit_date: date,
      _notes: undefined,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success(isPartial ? "Venda parcial registrada" : "Posição encerrada");
    setOpen(false);
    setExitPrice("");
    setQtyToSell(String(holding.quantity));
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setQtyToSell(String(holding.quantity)); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <DollarSign className="h-3.5 w-3.5 mr-1" /> Realizar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isPartial ? "Realizar parcial" : "Realizar (venda total)"}</DialogTitle>
          <DialogDescription>
            Disponível: {maxQty} {holding.coin_symbol}. Informe a quantidade a vender (total ou parcial).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Preço de saída (USD) *</Label>
            <MoneyInput
              decimals={8}
              value={exitPrice}
              onValueChange={(display) => setExitPrice(display)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Quantidade a vender * <span className="text-xs text-muted-foreground">(máx {maxQty})</span></Label>
            <Input
              type="number"
              step="0.00000001"
              min="0"
              max={maxQty}
              value={qtyToSell}
              onChange={(e) => setQtyToSell(e.target.value)}
              required
            />
            {qtyToSell && !qtyValid && (
              <p className="text-xs text-destructive">Quantidade deve ser maior que zero e até {maxQty}.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Data *</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          {exitPrice && qtyValid && (
            <Card><CardContent className="p-3 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Total</span><Money usd={total} /></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Custo</span><Money usd={cost} /></div>
              <div className="flex justify-between font-semibold">
                <span>Lucro/Prejuízo desta venda</span>
                <span className={pnlClass(profit)}>{profit >= 0 ? "+" : ""}{formatUSD(profit)}</span>
              </div>
              {isPartial && (
                <div className="flex justify-between text-xs text-muted-foreground pt-1 border-t border-border">
                  <span>Restante após venda</span>
                  <span className="font-mono">{remaining} {holding.coin_symbol}</span>
                </div>
              )}
            </CardContent></Card>
          )}
          <DialogFooter>
            <Button type="submit" disabled={submitting || !qtyValid || !exitPrice} className="glow-cyan">
              {submitting ? "Realizando..." : (isPartial ? "Confirmar venda parcial" : "Confirmar realização")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditHoldingButton({ holding, locked, onDone }: { holding: Holding; locked: boolean; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    coin_symbol: holding.coin_symbol,
    coin_name: holding.coin_name ?? "",
    quantity: String(holding.quantity),
    entry_price_usd: String(holding.entry_price_usd),
    purchase_date: holding.purchase_date,
    notes: holding.notes ?? "",
  });
  const [submitting, setSubmitting] = useState(false);

  if (locked) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0}>
              <Button variant="ghost" size="icon" disabled aria-label="Editar (bloqueado)">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            Holding com vendas registradas — não pode ser editado. Crie ajuste manual.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // C12: guards básicos antes do round-trip.
    const qty = Number(form.quantity);
    const price = parseUsdInput(form.entry_price_usd);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Quantidade deve ser maior que zero");
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      toast.error("Preço de entrada deve ser maior que zero");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase
      .from("holdings")
      .update({
        coin_symbol: form.coin_symbol.toUpperCase(),
        coin_name: form.coin_name || null,
        quantity: qty,
        entry_price_usd: price,
        purchase_date: form.purchase_date,
        notes: form.notes || null,
      })
      .eq("id", holding.id);
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Holding atualizado");
    setOpen(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Editar">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar holding</DialogTitle>
          <DialogDescription>Mover entre fundos não é permitido aqui.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Ticker *</Label>
              <Input
                value={form.coin_symbol}
                onChange={(e) => setForm({ ...form, coin_symbol: e.target.value })}
                required
                className="font-mono uppercase"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={form.coin_name} onChange={(e) => setForm({ ...form, coin_name: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Quantidade *</Label>
              <Input
                type="number"
                step="0.00000001"
                min="0.00000001"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Preço individual (USD) *</Label>
              <MoneyInput
                decimals={8}
                value={form.entry_price_usd}
                onValueChange={(display) => setForm({ ...form, entry_price_usd: display })}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Data da compra *</Label>
            <Input
              type="date"
              value={form.purchase_date}
              onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>{submitting ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
