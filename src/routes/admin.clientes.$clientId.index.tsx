import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ClickableRow } from "@/components/ui/clickable-row";
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
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Money } from "@/components/Money";
import { Plus, ChevronLeft, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { formatDate, parseUsdInput } from "@/lib/format";
import { FixedIncomeTab } from "@/components/admin/FixedIncomeTab";
import { FuturesTab } from "@/components/admin/FuturesTab";
import { DocumentsTab } from "@/components/admin/DocumentsTab";
import { PerformanceTab } from "@/components/admin/PerformanceTab";

export const Route = createFileRoute("/admin/clientes/$clientId/")({
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
  const { clientId } = useParams({ from: "/admin/clientes/$clientId/" });
  const [info, setInfo] = useState<ClientInfo | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const loadInfo = useCallback(async () => {
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
  }, [clientId]);

  useEffect(() => {
    loadInfo();
  }, [loadInfo]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/admin/clientes">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">{info?.full_name ?? "—"}</h1>
          <p className="text-sm text-muted-foreground font-mono">{info?.email}</p>
          {info?.phone && (
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{info.phone}</p>
          )}
        </div>
        {info && (
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4 mr-1" /> Editar dados
          </Button>
        )}
      </div>

      {info && (
        <EditClientDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          info={info}
          onSaved={loadInfo}
        />
      )}

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
          <FixedIncomeTab clientId={clientId} />
        </TabsContent>
        <TabsContent value="futuros" className="mt-4">
          <FuturesTab clientId={clientId} />
        </TabsContent>
        <TabsContent value="docs" className="mt-4">
          <DocumentsTab clientId={clientId} />
        </TabsContent>
        <TabsContent value="performance" className="mt-4">
          <PerformanceTab clientId={clientId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EditClientDialog({
  open,
  onOpenChange,
  info,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  info: ClientInfo;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    full_name: info.full_name ?? "",
    email: info.email ?? "",
    phone: info.phone ?? "",
    notes: info.notes ?? "",
    password: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        full_name: info.full_name ?? "",
        email: info.email ?? "",
        phone: info.phone ?? "",
        notes: info.notes ?? "",
        password: "",
      });
    }
  }, [open, info]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const payload: Record<string, unknown> = {
      client_id: info.id,
      full_name: form.full_name,
      email: form.email,
      phone: form.phone || null,
      notes: form.notes || null,
    };
    if (form.password.trim().length > 0) payload.password = form.password;

    const { data, error } = await supabase.functions.invoke("update-client", { body: payload });
    setSubmitting(false);
    if (error || (data && (data as any).error)) {
      toast.error("Erro ao salvar", {
        description: error?.message ?? (data as any)?.error,
      });
      return;
    }
    toast.success("Cliente atualizado");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar cliente</DialogTitle>
          <DialogDescription>
            Atualize os dados de cadastro. Deixe a senha em branco para mantê-la.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome completo *</Label>
            <Input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Email *</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Telefone</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Nova senha</Label>
            <Input
              type="text"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Em branco = não alterar"
              minLength={6}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting} className="glow-cyan">
              {submitting ? "Salvando..." : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
  const navigate = useNavigate();
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
              <TableHead className="text-right w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-sm">Nenhum fundo cadastrado.</p>
                    <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Criar primeiro fundo
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {rows.map((f) => (
              <ClickableRow
                key={f.id}
                onActivate={() =>
                  navigate({
                    to: "/admin/clientes/$clientId/fundos/$fundId",
                    params: { clientId, fundId: f.id },
                  })
                }
              >
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
                  <span className="text-muted-foreground/60">›</span>
                </TableCell>
              </ClickableRow>
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
const CAIXA_GERAL_VALUE = "__caixa_geral__";

interface FundOption {
  id: string;
  name: string;
}

interface CashEntry {
  id: string;
  amount_usd: number;
  date: string;
  notes: string | null;
  type: "deposit" | "withdraw";
  fund_id: string | null;
}

function CashTab({ clientId }: { clientId: string }) {
  const [deposits, setDeposits] = useState<CashEntry[]>([]);
  const [funds, setFunds] = useState<FundOption[]>([]);
  const [holdingsCost, setHoldingsCost] = useState(0);
  const [realizationsTotal, setRealizationsTotal] = useState(0);

  const load = useCallback(async () => {
    const [d, w, holdings, real, fundsRes] = await Promise.all([
      supabase.from("deposits").select("*").eq("client_id", clientId).order("deposit_date", { ascending: false }),
      supabase.from("withdrawals").select("*").eq("client_id", clientId).order("withdraw_date", { ascending: false }),
      supabase.from("holdings").select("quantity, entry_price_usd, fund_id, status, funds!inner(client_id)").eq("status", "ativa").eq("funds.client_id", clientId),
      supabase.from("realizations").select("total_usd, holding_id, holdings!inner(fund_id, funds!inner(client_id))").eq("holdings.funds.client_id", clientId),
      supabase.from("funds").select("id, name").eq("client_id", clientId).order("name", { ascending: true }),
    ]);
    const merged: CashEntry[] = [
      ...((d.data ?? []).map((x: any) => ({
        id: x.id,
        amount_usd: Number(x.amount_usd),
        date: x.deposit_date,
        notes: x.notes,
        type: "deposit" as const,
        fund_id: x.fund_id ?? null,
      }))),
      ...((w.data ?? []).map((x: any) => ({
        id: x.id,
        amount_usd: Number(x.amount_usd),
        date: x.withdraw_date,
        notes: x.notes,
        type: "withdraw" as const,
        fund_id: x.fund_id ?? null,
      }))),
    ].sort((a, b) => (a.date < b.date ? 1 : -1));
    setDeposits(merged);
    setFunds((fundsRes.data ?? []) as FundOption[]);
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

  const [pendingDelete, setPendingDelete] = useState<CashEntry | null>(null);

  const confirmRemove = async () => {
    if (!pendingDelete) return;
    const entry = pendingDelete;
    const tbl = entry.type === "deposit" ? "deposits" : "withdrawals";
    const { error } = await supabase.from(tbl).delete().eq("id", entry.id);
    setPendingDelete(null);
    if (error) toast.error(error.message);
    else {
      toast.success("Lançamento removido");
      load();
    }
  };

  const reallocate = async (entry: CashEntry, value: string) => {
    const fund_id = value === CAIXA_GERAL_VALUE ? null : value;
    const tbl = entry.type === "deposit" ? "deposits" : "withdrawals";
    const { error } = await supabase.from(tbl).update({ fund_id } as any).eq("id", entry.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Fundo atualizado");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground uppercase">Depósitos</div><Money usd={totalDeposits} className="text-lg text-success" /></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground uppercase">Saques</div><Money usd={totalWithdraws} className="text-lg text-destructive" /></CardContent></Card>
        <Card className="border-primary/30"><CardContent className="p-4"><div className="text-xs text-muted-foreground uppercase">Caixa USD</div><Money usd={cashBalance} className="text-lg text-primary text-glow" /></CardContent></Card>
      </div>

      <div className="flex gap-2">
        <CashDialog type="deposit" clientId={clientId} funds={funds} onCreated={load} />
        <CashDialog type="withdraw" clientId={clientId} funds={funds} onCreated={load} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Fundo</TableHead>
                <TableHead>Observações</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deposits.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
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
                  <TableCell>
                    <Select
                      value={e.fund_id ?? CAIXA_GERAL_VALUE}
                      onValueChange={(v) => reallocate(e, v)}
                    >
                      <SelectTrigger className="h-8 text-xs w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={CAIXA_GERAL_VALUE}>— Caixa geral —</SelectItem>
                        {funds.map((f) => (
                          <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{e.notes ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remover lançamento"
                      onClick={() => setPendingDelete(e)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete && (
                <>
                  Esta ação remove o {pendingDelete.type === "deposit" ? "depósito" : "saque"} de{" "}
                  <span className="font-mono">${pendingDelete.amount_usd.toFixed(2)}</span> de{" "}
                  {formatDate(pendingDelete.date)}. Não pode ser desfeita.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove} className="bg-destructive hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CashDialog({
  type,
  clientId,
  funds,
  onCreated,
}: {
  type: "deposit" | "withdraw";
  clientId: string;
  funds: FundOption[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [fundId, setFundId] = useState<string>(CAIXA_GERAL_VALUE);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const tbl = type === "deposit" ? "deposits" : "withdrawals";
    const dateField = type === "deposit" ? "deposit_date" : "withdraw_date";
    const { error } = await supabase.from(tbl).insert({
      client_id: clientId,
      amount_usd: parseUsdInput(amount),
      [dateField]: date,
      notes: notes || null,
      fund_id: fundId === CAIXA_GERAL_VALUE ? null : fundId,
    } as any);
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(type === "deposit" ? "Depósito registrado" : "Saque registrado");
    setAmount("");
    setNotes("");
    setFundId(CAIXA_GERAL_VALUE);
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
            <MoneyInput
              decimals={2}
              value={amount}
              onValueChange={(display) => setAmount(display)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Data *</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Fundo (opcional)</Label>
            <Select value={fundId} onValueChange={setFundId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CAIXA_GERAL_VALUE}>— Caixa geral —</SelectItem>
                {funds.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Se deixar em branco, o lançamento fica no caixa geral do cliente e não entra no extrato de nenhum fundo.
            </p>
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
