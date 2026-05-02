import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Money, Pct } from "@/components/Money";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/app/rendimentos")({
  component: ClientFixedIncome,
});

interface FixedIncomeRow {
  id: string;
  fund_id: string;
  product_name: string;
  asset_symbol: string | null;
  valor_aplicado_usd: number;
  taxa_anual_pct: number;
  data_registro: string;
  data_saida: string | null;
  ultimo_preco_usd: number | null;
  notes: string | null;
}

function ClientFixedIncome() {
  const { user } = useAuth();
  const [rows, setRows] = useState<FixedIncomeRow[]>([]);
  const [funds, setFunds] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: fs } = await supabase
        .from("client_funds")
        .select("id, name")
        .eq("client_id", user.id);
      const validFunds = (fs ?? []).filter((f): f is { id: string; name: string } => !!f.id && !!f.name);
      const fMap = new Map(validFunds.map((f) => [f.id, f.name] as const));
      setFunds(fMap);
      if (validFunds.length === 0) { setRows([]); setLoading(false); return; }
      const { data } = await supabase
        .from("fixed_income")
        .select("id, fund_id, product_name, asset_symbol, valor_aplicado_usd, taxa_anual_pct, data_registro, data_saida, ultimo_preco_usd, notes")
        .in("fund_id", validFunds.map((f) => f.id))
        .order("data_registro", { ascending: false });
      setRows((data as FixedIncomeRow[]) ?? []);
      setLoading(false);
    })();
  }, [user]);

  const ativos = rows.filter((r) => !r.data_saida);
  const totalAplicado = ativos.reduce((s, r) => s + Number(r.valor_aplicado_usd), 0);
  const totalAtual = ativos.reduce((s, r) => s + Number(r.ultimo_preco_usd ?? r.valor_aplicado_usd), 0);
  const rendimento = totalAplicado > 0 ? ((totalAtual - totalAplicado) / totalAplicado) * 100 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Rendimentos alternativos</h1>
        <p className="text-sm text-muted-foreground">Renda fixa, treasury, yields e produtos similares.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground uppercase">Aplicado (ativo)</div>
          <Money usd={totalAplicado} className="text-xl" />
        </CardContent></Card>
        <Card className="border-primary/30"><CardContent className="p-4">
          <div className="text-xs text-muted-foreground uppercase">Valor atual</div>
          <Money usd={totalAtual} className="text-xl text-primary text-glow" />
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground uppercase">Rendimento</div>
          <Pct value={rendimento} className="text-xl" />
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Posições</CardTitle></CardHeader>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={7} className="py-6 text-center text-muted-foreground">Carregando...</TableCell></TableRow>}
              {!loading && rows.length === 0 && (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  Você ainda não tem rendimentos alternativos.
                </TableCell></TableRow>
              )}
              {rows.map((r) => {
                const aplicado = Number(r.valor_aplicado_usd);
                const atual = Number(r.ultimo_preco_usd ?? aplicado);
                const pct = aplicado > 0 ? ((atual - aplicado) / aplicado) * 100 : 0;
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.product_name}</div>
                      {r.asset_symbol && <div className="text-xs text-muted-foreground font-mono">{r.asset_symbol}</div>}
                    </TableCell>
                    <TableCell className="text-xs">{funds.get(r.fund_id) ?? "—"}</TableCell>
                    <TableCell className="text-right"><Money usd={aplicado} /></TableCell>
                    <TableCell className="text-right font-mono text-xs">{Number(r.taxa_anual_pct).toFixed(2)}%</TableCell>
                    <TableCell className="text-right">
                      <Money usd={atual} />
                      <div className="text-xs"><Pct value={pct} /></div>
                    </TableCell>
                    <TableCell className="text-xs">{formatDate(r.data_registro)}</TableCell>
                    <TableCell>
                      {r.data_saida
                        ? <span className="text-xs text-muted-foreground">Encerrado {formatDate(r.data_saida)}</span>
                        : <span className="text-xs font-mono uppercase text-success">Ativo</span>}
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
