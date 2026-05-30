import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Money, Pct } from "@/components/Money";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, FileText } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ClientHoldingsTable } from "@/components/client/ClientHoldingsTable";

export const Route = createFileRoute("/app/fundos_/$fundId")({
  component: ClientFundDetail,
});

interface FundRow {
  id: string;
  name: string;
  client_id: string;
  status: string;
  start_date: string;
}

async function fetchFundDetail(fundId: string, userId: string) {
  const { data: fund, error } = await supabase
    .from("client_funds")
    .select("id, name, client_id, status, start_date")
    .eq("id", fundId)
    .maybeSingle();
  if (error) throw error;
  if (!fund || fund.client_id !== userId) return null;

  const [{ data: holdings }, { data: prices }, { data: fixed }] = await Promise.all([
    supabase.from("holdings").select("id, coin_symbol, coin_name, quantity, entry_price_usd, status, purchase_date").eq("fund_id", fundId),
    supabase.from("coin_prices").select("symbol, price_usd"),
    supabase
      .from("fixed_income")
      .select("id, product_name, asset_symbol, valor_aplicado_usd, taxa_anual_pct, data_registro, data_saida, ultimo_preco_usd")
      .eq("fund_id", fundId)
      .order("data_registro", { ascending: false }),
  ]);
  const priceMap = new Map((prices ?? []).map((p) => [p.symbol.toUpperCase(), Number(p.price_usd)] as const));
  return {
    fund: fund as FundRow,
    holdings: (holdings ?? []) as any[],
    prices: priceMap,
    fixedIncome: (fixed ?? []) as any[],
  };
}

function ClientFundDetail() {
  const { fundId } = useParams({ from: "/app/fundos_/$fundId" });
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showClosed, setShowClosed] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["client", "fund-detail", fundId, user?.id],
    queryFn: () => fetchFundDetail(fundId, user!.id),
    enabled: !!user,
  });

  useEffect(() => {
    if (!isLoading && data === null) {
      // Fund não existe ou não pertence ao usuário
      navigate({ to: "/app/fundos" });
    }
  }, [isLoading, data, navigate]);

  const summary = useMemo(() => {
    const holdings = data?.holdings ?? [];
    const prices = data?.prices ?? new Map<string, number>();
    const active = holdings.filter((h) => h.status === "ativa");
    const cost = active.reduce((s, h) => s + Number(h.quantity) * Number(h.entry_price_usd), 0);
    const market = active.reduce((s, h) => {
      const cur = prices.get(h.coin_symbol.toUpperCase()) ?? Number(h.entry_price_usd);
      return s + Number(h.quantity) * cur;
    }, 0);
    return {
      cost,
      market,
      pnl: market - cost,
      pct: cost > 0 ? ((market - cost) / cost) * 100 : 0,
      count: active.length,
    };
  }, [data]);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Carregando...</div>;
  }

  if (!data) {
    return null;
  }

  const { fund, holdings, prices, fixedIncome } = data;
  const visibleHoldings = showClosed ? holdings : holdings.filter((h) => h.status === "ativa");

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="space-y-1">
          <Link to="/app/fundos" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center">
            <ChevronLeft className="h-3 w-3 mr-1" /> Meus fundos
          </Link>
          <h1 className="text-2xl font-semibold">{fund.name}</h1>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Início {formatDate(fund.start_date)}</span>
            <span>·</span>
            <span className={fund.status === "ativo" ? "text-success" : "text-muted-foreground"}>
              {fund.status}
            </span>
          </div>
        </div>
        <Link to="/app/fundos_/$fundId/extrato" params={{ fundId }}>
          <Button>
            <FileText className="h-4 w-4 mr-1" /> Ver extrato
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="Custo investido" value={<Money usd={summary.cost} className="text-lg" />} />
        <SummaryCard
          label="Valor de mercado"
          value={<Money usd={summary.market} className="text-lg text-primary text-glow" />}
        />
        <SummaryCard
          label="P&L não realizado"
          value={
            <Money
              usd={summary.pnl}
              className={cn("text-lg", summary.pnl >= 0 ? "text-success" : "text-destructive")}
            />
          }
          sub={<Pct value={summary.pct} className="text-xs" />}
        />
        <SummaryCard
          label="Posições ativas"
          value={<div className="text-lg font-mono">{summary.count}</div>}
        />
      </div>

      <Card className="border-primary/10">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Posições</CardTitle>
          <label className="text-xs text-muted-foreground inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showClosed}
              onChange={(e) => setShowClosed(e.target.checked)}
              className="accent-primary"
            />
            Mostrar encerradas
          </label>
        </CardHeader>
        <CardContent className="p-0">
          <ClientHoldingsTable holdings={visibleHoldings} prices={prices} fundId={fundId} />
        </CardContent>
      </Card>

      {fixedIncome.length > 0 && (
        <Card className="border-primary/10">
          <CardHeader>
            <CardTitle className="text-base">Rendimentos alternativos</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Registro</TableHead>
                  <TableHead className="text-right">Taxa a.a.</TableHead>
                  <TableHead className="text-right">Aplicado</TableHead>
                  <TableHead className="text-right">Valor atual</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fixedIncome.map((r) => {
                  const atual = Number(r.ultimo_preco_usd ?? r.valor_aplicado_usd);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">
                        <div className="font-medium">{r.product_name}</div>
                        {r.asset_symbol && (
                          <div className="text-[11px] font-mono text-muted-foreground">{r.asset_symbol}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs font-mono">{formatDate(r.data_registro)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {Number(r.taxa_anual_pct).toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-right"><Money usd={r.valor_aplicado_usd} /></TableCell>
                      <TableCell className="text-right"><Money usd={atual} /></TableCell>
                      <TableCell>
                        <Badge variant={r.data_saida ? "secondary" : "outline"} className="text-[10px]">
                          {r.data_saida ? `Encerrado ${formatDate(r.data_saida)}` : "Ativo"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <Card className="border-primary/10">
      <CardContent className="p-3">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</div>
        {value}
        {sub && <div className="mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}
