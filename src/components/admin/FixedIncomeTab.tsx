// Sub-tab admin: Rendimentos Alternativos (fixed_income) por fundo do cliente
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Money, Pct } from "@/components/Money";
import { Badge } from "@/components/ui/badge";
import { formatDate, parseUsdInput } from "@/lib/format";

interface Fund { id: string; name: string; status: string; }
interface FixedIncomeRow {
  id: string;
  fund_id: string;
  product_name: string;
  asset_symbol: string | null;
  valor_aplicado_usd: number;
  taxa_anual_pct: number;
  data_registro: string;
  data_saida: string | null;
  preco_entrada_usd: number | null;
  ultimo_preco_usd: number | null;
  last_price_update_at: string | null;
  notes: string | null;
}

export function FixedIncomeTab({ clientId }: { clientId: string }) {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [rows, setRows] = useState<FixedIncomeRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: fs } = await supabase
      .from("funds")
      .select("id, name, status")
      .eq("client_id", clientId)
      .order("name");
    const fundsList = (fs as Fund[]) ?? [];
    setFunds(fundsList);
    if (fundsList.length === 0) { setRows([]); setLoading(false); return; }
    const { data: fi } = await supabase
      .from("fixed_income")
      .select("*")
      .in("fund_id", fundsList.map((f) => f.id))
      .order("data_registro", { ascending: false });
    setRows((fi as FixedIncomeRow[]) ?? []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const remove = async (id: string) => {
    if (!confirm("Remover este rendimento?")) return;
    const { error } = await supabase.from("fixed_income").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Rendimento removido"); load(); }
  };

  const exit = async (row: FixedIncomeRow) => {
    const date = prompt("Data de saída (YYYY-MM-DD):", new Date().toISOString().slice(0, 10));
    if (!date) return;
    const { error } = await supabase.from("fixed_income").update({ data_saida: date }).eq("id", row.id);
    if (error) toast.error(error.message);
    else { toast.success("Saída registrada"); load(); }
  };

  const totalAplicado = rows.filter((r) => !r.data_saida).reduce((s, r) => s + Number(r.valor_aplicado_usd), 0);
  const totalAtual = rows.filter((r) => !r.data_saida).reduce(
    (s, r) => s + Number(r.ultimo_preco_usd ?? r.valor_aplicado_usd),
    0,
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground uppercase">Aplicado (ativo)</div>
          <Money usd={totalAplicado} className="text-lg" />
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground uppercase">Valor atual</div>
          <Money usd={totalAtual} className="text-lg text-primary text-glow" />
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground uppercase">Rendimento</div>
          <Pct value={totalAplicado > 0 ? ((totalAtual - totalAplicado) / totalAplicado) * 100 : 0} className="text-lg" />
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Rendimentos alternativos</CardTitle>
          <NewFixedIncomeDialog funds={funds} onCreated={load} />
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Fundo</TableHead>
                <TableHead className="text-right">Aplicado</TableHead>
                <TableHead className="text-right">Taxa a.a.</TableHead>
                <TableHead className="text-right">Atual</TableHead>
                <TableHead>Registro</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">Carregando...</TableCell></TableRow>
              )}
              {!loading && rows.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                  Nenhum rendimento alternativo cadastrado.
                </TableCell></TableRow>
              )}
              {rows.map((r) => {
                const fund = funds.find((f) => f.id === r.fund_id);
                const aplicado = Number(r.valor_aplicado_usd);
                const atual = Number(r.ultimo_preco_usd ?? aplicado);
                const pct = aplicado > 0 ? ((atual - aplicado) / aplicado) * 100 : 0;
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.product_name}</div>
                      {r.asset_symbol && <div className="text-xs text-muted-foreground font-mono">{r.asset_symbol}</div>}
                    </TableCell>
                    <TableCell className="text-xs">{fund?.name ?? "—"}</TableCell>
                    <TableCell className="text-right"><Money usd={aplicado} /></TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      <span className="inline-flex items-center gap-1 justify-end">
                        {Number(r.taxa_anual_pct).toFixed(2)}%
                        <Badge variant="outline" className="text-[10px] py-0 px-1 font-normal">variável</Badge>
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Money usd={atual} />
                      <div className="text-xs"><Pct value={pct} /></div>
                    </TableCell>
                    <TableCell className="text-xs">{formatDate(r.data_registro)}</TableCell>
                    <TableCell>
                      {r.data_saida ? (
                        <span className="text-xs text-muted-foreground">Encerrado {formatDate(r.data_saida)}</span>
                      ) : (
                        <span className="text-xs font-mono uppercase text-success">Ativo</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        {!r.data_saida && (
                          <Button variant="outline" size="sm" onClick={() => exit(r)}>Encerrar</Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => remove(r.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function NewFixedIncomeDialog({ funds, onCreated }: { funds: Fund[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    fund_id: "",
    product_name: "",
    asset_symbol: "",
    valor_aplicado_usd: "",
    taxa_anual_pct: "",
    preco_entrada_usd: "",
    data_registro: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fund_id) { toast.error("Selecione um fundo"); return; }
    setSubmitting(true);
    const { error } = await supabase.from("fixed_income").insert({
      fund_id: form.fund_id,
      product_name: form.product_name,
      asset_symbol: form.asset_symbol.trim().toUpperCase() || null,
      valor_aplicado_usd: parseUsdInput(form.valor_aplicado_usd),
      taxa_anual_pct: Number(form.taxa_anual_pct),
      preco_entrada_usd: form.preco_entrada_usd ? parseUsdInput(form.preco_entrada_usd) : null,
      data_registro: form.data_registro,
      notes: form.notes || null,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Rendimento registrado");
    setOpen(false);
    setForm({ ...form, product_name: "", asset_symbol: "", valor_aplicado_usd: "", taxa_anual_pct: "", preco_entrada_usd: "", notes: "" });
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="glow-cyan" disabled={funds.length === 0}>
          <Plus className="h-4 w-4 mr-1" /> Novo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo rendimento alternativo</DialogTitle>
          <DialogDescription>Renda fixa, treasury, stablecoin yield, etc.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Fundo *</Label>
            <Select value={form.fund_id} onValueChange={(v) => setForm({ ...form, fund_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {funds.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Produto *</Label>
              <Input value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>Ticker (opcional)</Label>
              <Input className="font-mono uppercase" value={form.asset_symbol} onChange={(e) => setForm({ ...form, asset_symbol: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valor aplicado USD *</Label>
              <MoneyInput decimals={2} value={form.valor_aplicado_usd} onValueChange={(d) => setForm({ ...form, valor_aplicado_usd: d })} required />
            </div>
            <div className="space-y-1.5">
              <Label>Taxa anual (%) *</Label>
              <Input type="number" step="0.01" value={form.taxa_anual_pct} onChange={(e) => setForm({ ...form, taxa_anual_pct: e.target.value })} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Preço entrada (opcional)</Label>
              <MoneyInput decimals={8} value={form.preco_entrada_usd} onValueChange={(d) => setForm({ ...form, preco_entrada_usd: d })} />
            </div>
            <div className="space-y-1.5">
              <Label>Data de registro *</Label>
              <Input type="date" value={form.data_registro} onChange={(e) => setForm({ ...form, data_registro: e.target.value })} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting} className="glow-cyan">{submitting ? "Salvando..." : "Registrar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
