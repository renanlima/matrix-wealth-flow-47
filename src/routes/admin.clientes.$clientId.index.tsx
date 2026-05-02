import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Money } from "@/components/Money";
import { Plus, ChevronLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/admin/clientes/$clientId")({
  component: ClientDetail,
});

interface ClientInfo {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
}

function ClientDetail() {
  const { clientId } = useParams({ from: "/admin/clientes/$clientId" });
  const [info, setInfo] = useState<ClientInfo | null>(null);

  useEffect(() => {
    (async () => {
      const { data: c } = await supabase
        .from("clients")
        .select("id, phone, notes")
        .eq("id", clientId)
        .maybeSingle();
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", clientId)
        .maybeSingle();
      if (c) {
        setInfo({
          id: c.id,
          phone: c.phone,
          notes: c.notes,
          full_name: p?.full_name ?? null,
          email: p?.email ?? null,
        });
      }
    })();
  }, [clientId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/admin/clientes">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">{info?.full_name ?? "—"}</h1>
        <p className="text-sm text-muted-foreground font-mono">{info?.email}</p>
      </div>

      <Tabs defaultValue="fundos">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="fundos">Fundos</TabsTrigger>
          <TabsTrigger value="caixa">Caixa USD</TabsTrigger>
          <TabsTrigger value="rendimentos">Rendimentos</TabsTrigger>
          <TabsTrigger value="futuros">Futuros</TabsTrigger>
          <TabsTrigger value="docs">Documentos</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="fundos" className="mt-4">
          <FundsTab clientId={clientId} />
        </TabsContent>
        <TabsContent value="caixa" className="mt-4">
          <CashTab clientId={clientId} />
        </TabsContent>
        <TabsContent value="rendimentos" className="mt-4">
          <ComingSoon label="Rendimentos alternativos" />
        </TabsContent>
        <TabsContent value="futuros" className="mt-4">
          <ComingSoon label="Mercado futuro" />
        </TabsContent>
        <TabsContent value="docs" className="mt-4">
          <ComingSoon label="Documentos (NFs, Contratos, Recibos)" />
        </TabsContent>
        <TabsContent value="performance" className="mt-4">
          <ComingSoon label="Performance mensal" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ComingSoon({ label }: { label: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-12 text-center text-sm text-muted-foreground">
        <span className="font-mono uppercase text-xs tracking-wider text-primary/70">
          Em breve
        </span>
        <div className="mt-2">{label} — implementado na próxima fase.</div>
      </CardContent>
    </Card>
  );
}

// ============= FUNDS TAB =============
interface FundRow {
  id: string;
  name: string;
  status: "ativo" | "encerrado";
  start_date: string;
  end_date: string | null;
  performance_fee_pct: number;
}

function FundsTab({ clientId }: { clientId: string }) {
  const [rows, setRows] = useState<FundRow[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("funds")
      .select("id, name, status, start_date, end_date, performance_fee_pct")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    setRows((data as FundRow[]) ?? []);
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Fundos do cliente</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="glow-cyan">
              <Plus className="h-4 w-4 mr-1" /> Novo fundo
            </Button>
          </DialogTrigger>
          <NewFundDialog clientId={clientId} onCreated={() => { setOpen(false); load(); }} />
        </Dialog>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Início</TableHead>
              <TableHead>Fim</TableHead>
              <TableHead>Taxa perf.</TableHead>
              <TableHead className="text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                  Nenhum fundo cadastrado.
                </TableCell>
              </TableRow>
            )}
            {rows.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="font-medium">{f.name}</TableCell>
                <TableCell>
                  <span
                    className={`text-xs font-mono uppercase ${
                      f.status === "ativo" ? "text-success" : "text-muted-foreground"
                    }`}
                  >
                    {f.status}
                  </span>
                </TableCell>
                <TableCell className="text-xs">{formatDate(f.start_date)}</TableCell>
                <TableCell className="text-xs">{formatDate(f.end_date)}</TableCell>
                <TableCell className="font-mono text-xs">{f.performance_fee_pct}%</TableCell>
                <TableCell className="text-right">
                  <Link
                    to="/admin/clientes/$clientId/fundos/$fundId"
                    params={{ clientId, fundId: f.id }}
                  >
                    <Button variant="ghost" size="sm">
                      Abrir
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function NewFundDialog({
  clientId,
  onCreated,
}: {
  clientId: string;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [fee, setFee] = useState("20");
  const [start, setStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.from("funds").insert({
      client_id: clientId,
      name,
      performance_fee_pct: Number(fee),
      start_date: start,
      notes: notes || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Erro ao criar fundo", { description: error.message });
      return;
    }
    toast.success("Fundo criado");
    setName("");
    setNotes("");
    onCreated();
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Novo fundo</DialogTitle>
        <DialogDescription>Define o nome, data de início e taxa de performance (em %).</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1.5">
          <Label>Nome *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Início *</Label>
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Taxa perf. (%)</Label>
            <Input
              type="number"
              step="0.01"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Observações</Label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={submitting} className="glow-cyan">
            {submitting ? "Criando..." : "Criar fundo"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

// ============= CASH TAB =============
interface CashEntry {
  id: string;
  amount_usd: number;
  date: string;
  notes: string | null;
  type: "deposit" | "withdraw";
}

function CashTab({ clientId }: { clientId: string }) {
  const [deposits, setDeposits] = useState<CashEntry[]>([]);
  const [holdingsCost, setHoldingsCost] = useState(0);
  const [realizationsTotal, setRealizationsTotal] = useState(0);

  const load = useCallback(async () => {
    const [d, w, holdings, real] = await Promise.all([
      supabase.from("deposits").select("*").eq("client_id", clientId).order("deposit_date", { ascending: false }),
      supabase.from("withdrawals").select("*").eq("client_id", clientId).order("withdraw_date", { ascending: false }),
      supabase.from("holdings").select("quantity, entry_price_usd, fund_id, status, funds!inner(client_id)").eq("status", "ativa").eq("funds.client_id", clientId),
      supabase.from("realizations").select("total_usd, holding_id, holdings!inner(fund_id, funds!inner(client_id))").eq("holdings.funds.client_id", clientId),
    ]);
    const merged: CashEntry[] = [
      ...((d.data ?? []).map((x) => ({
        id: x.id,
        amount_usd: Number(x.amount_usd),
        date: x.deposit_date,
        notes: x.notes,
        type: "deposit" as const,
      }))),
      ...((w.data ?? []).map((x) => ({
        id: x.id,
        amount_usd: Number(x.amount_usd),
        date: x.withdraw_date,
        notes: x.notes,
        type: "withdraw" as const,
      }))),
    ].sort((a, b) => (a.date < b.date ? 1 : -1));
    setDeposits(merged);
    setHoldingsCost(
      (holdings.data ?? []).reduce(
        (s, h: any) => s + Number(h.quantity) * Number(h.entry_price_usd),
        0,
      ),
    );
    setRealizationsTotal(
      (real.data ?? []).reduce((s, r: any) => s + Number(r.total_usd), 0),
    );
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  const totalDeposits = deposits.filter((e) => e.type === "deposit").reduce((s, e) => s + e.amount_usd, 0);
  const totalWithdraws = deposits.filter((e) => e.type === "withdraw").reduce((s, e) => s + e.amount_usd, 0);
  const cashBalance = totalDeposits - totalWithdraws - holdingsCost + realizationsTotal;

  const remove = async (entry: CashEntry) => {
    if (!confirm("Remover este lançamento?")) return;
    const tbl = entry.type === "deposit" ? "deposits" : "withdrawals";
    const { error } = await supabase.from(tbl).delete().eq("id", entry.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Lançamento removido");
      load();
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground uppercase">Depósitos</div><Money usd={totalDeposits} className="text-lg text-success" /></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground uppercase">Saques</div><Money usd={totalWithdraws} className="text-lg text-destructive" /></CardContent></Card>
        <Card className="border-primary/30"><CardContent className="p-4"><div className="text-xs text-muted-foreground uppercase">Caixa USD</div><Money usd={cashBalance} className="text-lg text-primary text-glow" /></CardContent></Card>
      </div>

      <div className="flex gap-2">
        <CashDialog type="deposit" clientId={clientId} onCreated={load} />
        <CashDialog type="withdraw" clientId={clientId} onCreated={load} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Observações</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deposits.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                    Nenhuma movimentação.
                  </TableCell>
                </TableRow>
              )}
              {deposits.map((e) => (
                <TableRow key={`${e.type}-${e.id}`}>
                  <TableCell className="text-xs">{formatDate(e.date)}</TableCell>
                  <TableCell>
                    <span className={`text-xs font-mono uppercase ${e.type === "deposit" ? "text-success" : "text-destructive"}`}>
                      {e.type === "deposit" ? "Depósito" : "Saque"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Money usd={e.amount_usd} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{e.notes ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => remove(e)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
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

function CashDialog({
  type,
  clientId,
  onCreated,
}: {
  type: "deposit" | "withdraw";
  clientId: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const tbl = type === "deposit" ? "deposits" : "withdrawals";
    const dateField = type === "deposit" ? "deposit_date" : "withdraw_date";
    const { error } = await supabase.from(tbl).insert({
      client_id: clientId,
      amount_usd: Number(amount),
      [dateField]: date,
      notes: notes || null,
    } as any);
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(type === "deposit" ? "Depósito registrado" : "Saque registrado");
    setAmount("");
    setNotes("");
    setOpen(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={type === "deposit" ? "default" : "outline"} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          {type === "deposit" ? "Novo depósito" : "Novo saque"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{type === "deposit" ? "Novo depósito" : "Novo saque"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Valor (USD) *</Label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Data *</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>{submitting ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
