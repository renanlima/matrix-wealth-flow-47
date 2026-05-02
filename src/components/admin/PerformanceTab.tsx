// Sub-tab admin: Performance Mensal — lista fechamentos e dispara nova rodada
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Play, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Money } from "@/components/Money";

interface Fund { id: string; name: string; carried_deficit_usd: number; }
interface PHRow {
  id: string; fund_id: string; year: number; month: number;
  patrimonio_inicio_usd: number; patrimonio_fim_usd: number;
  alocacoes_usd: number; desalocacoes_usd: number;
  lucro_bruto_usd: number; base_calculo_usd: number;
  taxa_aplicada_usd: number; novo_deficit_usd: number;
  fechado_em: string | null;
}

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function PerformanceTab({ clientId }: { clientId: string }) {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [history, setHistory] = useState<PHRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: fs } = await supabase
      .from("funds")
      .select("id, name, carried_deficit_usd")
      .eq("client_id", clientId)
      .order("name");
    const fundsList = (fs as Fund[]) ?? [];
    setFunds(fundsList);
    if (fundsList.length === 0) { setHistory([]); setLoading(false); return; }
    const { data: ph } = await supabase
      .from("performance_history")
      .select("*")
      .in("fund_id", fundsList.map((f) => f.id))
      .order("year", { ascending: false })
      .order("month", { ascending: false });
    setHistory((ph as PHRow[]) ?? []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Histórico de fechamentos mensais</CardTitle>
          <CloseDialog funds={funds} onDone={load} />
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Período</TableHead>
                <TableHead>Fundo</TableHead>
                <TableHead className="text-right">Início</TableHead>
                <TableHead className="text-right">Fim</TableHead>
                <TableHead className="text-right">Lucro bruto</TableHead>
                <TableHead className="text-right">Base cálc.</TableHead>
                <TableHead className="text-right">Taxa</TableHead>
                <TableHead className="text-right">Déficit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={8} className="py-6 text-center text-muted-foreground">Carregando...</TableCell></TableRow>}
              {!loading && history.length === 0 && <TableRow><TableCell colSpan={8} className="py-6 text-center text-muted-foreground">Nenhum fechamento ainda.</TableCell></TableRow>}
              {history.map((r) => {
                const fund = funds.find((f) => f.id === r.fund_id);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{MONTHS[r.month - 1]}/{r.year}</TableCell>
                    <TableCell className="text-xs">{fund?.name ?? "—"}</TableCell>
                    <TableCell className="text-right"><Money usd={Number(r.patrimonio_inicio_usd)} /></TableCell>
                    <TableCell className="text-right"><Money usd={Number(r.patrimonio_fim_usd)} /></TableCell>
                    <TableCell className={`text-right font-mono ${Number(r.lucro_bruto_usd) >= 0 ? "text-success" : "text-destructive"}`}>
                      <Money usd={Number(r.lucro_bruto_usd)} />
                    </TableCell>
                    <TableCell className="text-right"><Money usd={Number(r.base_calculo_usd)} /></TableCell>
                    <TableCell className="text-right text-primary"><Money usd={Number(r.taxa_aplicada_usd)} /></TableCell>
                    <TableCell className="text-right text-xs">
                      {Number(r.novo_deficit_usd) > 0
                        ? <span className="text-destructive"><Money usd={Number(r.novo_deficit_usd)} /></span>
                        : "—"}
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

function CloseDialog({ funds, onDone }: { funds: Fund[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const now = new Date();
  const lastMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const lastYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const [year, setYear] = useState(String(lastYear));
  const [month, setMonth] = useState(String(lastMonth));
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error, data } = await supabase.functions.invoke("close-monthly-performance", {
      body: { year: Number(year), month: Number(month) },
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Fechamento processado");
    console.log("close result", data);
    setOpen(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="glow-cyan" disabled={funds.length === 0}>
          <Play className="h-4 w-4 mr-1" /> Fechar mês
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fechar performance mensal</DialogTitle>
          <DialogDescription>
            Processa todos os fundos ativos para o mês selecionado. Calcula lucro bruto, aplica déficit anterior e taxa de performance.
            Idempotente — se já existir fechamento, é mantido.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Mês *</Label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Ano *</Label>
              <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} required />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting} className="glow-cyan">
              {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {submitting ? "Calculando..." : "Fechar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
