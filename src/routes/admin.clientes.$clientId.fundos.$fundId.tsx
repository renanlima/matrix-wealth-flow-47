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
import { Plus, ChevronLeft, DollarSign, Lock } from "lucide-react";
import { Money, CryptoQty, Pct } from "@/components/Money";
import { toast } from "sonner";
import { formatDate, parseUsdInput } from "@/lib/format";

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
                    <TableHead className="text-right">Preço entrada</TableHead>
                    <TableHead className="text-right">Preço atual</TableHead>
                    <TableHead className="text-right">P&L</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holdings.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                        Sem posições.
                      </TableCell>
                    </TableRow>
                  )}
                  {holdings.map((h) => {
                    const cur = prices.get(h.coin_symbol.toUpperCase()) ?? 0;
                    const cost = Number(h.quantity) * Number(h.entry_price_usd);
                    const market = Number(h.quantity) * cur;
                    const pnlPct = cost > 0 ? ((market - cost) / cost) * 100 : 0;
                    return (
                      <TableRow key={h.id}>
                        <TableCell>
                          <div className="font-mono font-semibold">{h.coin_symbol}</div>
                          <div className="text-xs text-muted-foreground">{h.coin_name ?? "—"}</div>
                        </TableCell>
                        <TableCell className="text-right"><CryptoQty qty={h.quantity} /></TableCell>
                        <TableCell className="text-right"><Money usd={h.entry_price_usd} /></TableCell>
                        <TableCell className="text-right">
                          {cur > 0 ? <Money usd={cur} /> : <span className="text-muted-foreground text-xs">—</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          {h.status === "ativa" && cur > 0 ? <Pct value={pnlPct} /> : "—"}
                        </TableCell>
                        <TableCell>
                          <span className={`text-xs font-mono uppercase ${h.status === "ativa" ? "text-success" : "text-muted-foreground"}`}>
                            {h.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {h.status === "ativa" && (
                            <RealizeDialog holding={h} onDone={load} />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);

  const exitPriceNum = parseUsdInput(exitPrice);
  const total = exitPriceNum * Number(holding.quantity);
  const cost = Number(holding.entry_price_usd) * Number(holding.quantity);
  const profit = total - cost;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error: rErr } = await supabase.from("realizations").insert({
      holding_id: holding.id,
      exit_price_usd: exitPriceNum,
      exit_date: date,
      total_usd: total,
      profit_usd: profit,
    });
    if (rErr) {
      setSubmitting(false);
      toast.error(rErr.message);
      return;
    }
    const { error: uErr } = await supabase
      .from("holdings")
      .update({ status: "encerrada" })
      .eq("id", holding.id);
    setSubmitting(false);
    if (uErr) {
      toast.error(uErr.message);
      return;
    }
    toast.success("Posição realizada (venda total)");
    setOpen(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <DollarSign className="h-3.5 w-3.5 mr-1" /> Realizar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Realizar posição (venda total)</DialogTitle>
          <DialogDescription>
            A venda é sempre integral ({holding.quantity} {holding.coin_symbol}). Para manter parte,
            crie depois uma nova posição em outro fundo com a quantidade restante.
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
            <Label>Data *</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          {exitPrice && (
            <Card><CardContent className="p-3 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Total</span><Money usd={total} /></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Custo</span><Money usd={cost} /></div>
              <div className="flex justify-between font-semibold"><span>Lucro</span><span className={profit >= 0 ? "text-success" : "text-destructive"}><Money usd={profit} /></span></div>
            </CardContent></Card>
          )}
          <DialogFooter>
            <Button type="submit" disabled={submitting} className="glow-cyan">{submitting ? "Realizando..." : "Confirmar realização"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
