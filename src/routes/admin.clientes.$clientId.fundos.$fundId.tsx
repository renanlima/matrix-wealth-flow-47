import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
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
import { Plus, ChevronLeft, ChevronRight, ChevronDown, DollarSign, Lock, Pencil, FileText } from "lucide-react";
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
                          <TableCell className="text-right"><Money usd={market} /></TableCell>
                          <TableCell className="text-right"><Money usd={h.entry_price_usd} /></TableCell>
                          <TableCell className="text-right">
                            {hasPrice ? <Money usd={cur} /> : <span className="text-muted-foreground text-xs">—</span>}
                          </TableCell>
                          <TableCell className="text-right">
                            {h.status === "ativa" ? (
                              <div className={cn("font-mono tabular-nums leading-tight", pnlClass(pnl))}>
                                <div>{pnl >= 0 ? "+" : ""}{formatUSD(pnl)}</div>
                                <div className="text-xs opacity-80">({formatPct(pnlPct)})</div>
                              </div>
                            ) : "—"}
                          </TableCell>
                          <TableCell>
                            <span className={`text-xs font-mono uppercase ${h.status === "ativa" ? "text-success" : "text-muted-foreground"}`}>
                              {h.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
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

                      // Linha agrupada
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
                      const displayName = lots[0].coin_name ?? "—";

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
                                  {displayName} · {lots.length} lotes
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
                            ) : "—"}
                          </TableCell>
                          <TableCell>
                            <span className={`text-xs font-mono uppercase ${anyActive ? "text-success" : "text-muted-foreground"}`}>
                              {anyActive ? "ativa" : "encerrada"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="text-[10px] text-muted-foreground">
                              {expanded ? "ocultar lotes" : "ver lotes"}
                            </span>
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
    </div>
  );
}

function FundHistoryCard({ fundId }: { fundId: string }) {
  const [rows, setRows] = useState<PHRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("performance_history")
        .select("*")
        .eq("fund_id", fundId)
        .order("year", { ascending: false })
        .order("month", { ascending: false });
      setRows((data as PHRow[]) ?? []);
      setLoading(false);
    })();
  }, [fundId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Histórico mensal — visão admin (com taxas)</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
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
            {!loading && rows.length === 0 && <TableRow><TableCell colSpan={10} className="py-6 text-center text-muted-foreground">Sem fechamentos.</TableCell></TableRow>}
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
    setSubmitting(true);
    const { error } = await supabase.from("holdings").insert({
      fund_id: fundId,
      coin_symbol: form.coin_symbol.toUpperCase(),
      coin_name: form.coin_name || null,
      quantity: Number(form.quantity),
      entry_price_usd: parseUsdInput(form.entry_price_usd),
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
    setSubmitting(true);
    const { error } = await supabase
      .from("holdings")
      .update({
        coin_symbol: form.coin_symbol.toUpperCase(),
        coin_name: form.coin_name || null,
        quantity: Number(form.quantity),
        entry_price_usd: parseUsdInput(form.entry_price_usd),
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
