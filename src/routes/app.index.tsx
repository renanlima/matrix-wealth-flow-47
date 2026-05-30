import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Money, Pct } from "@/components/Money";
import { Wallet, TrendingUp, Briefcase, RefreshCw, AlertTriangle } from "lucide-react";
import { formatDateTime, formatUSD, formatPct, pnlClass } from "@/lib/format";
import { fixedIncomeAccrued, isHoldingLiveOn } from "@/lib/patrimonio";
import { cn } from "@/lib/utils";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

export const Route = createFileRoute("/app/")({
  component: ClientDashboard,
});

const COLORS = ["#00D4FF", "#5BE49B", "#A78BFA", "#FFD166", "#FF7AB6", "#7DD3FC", "#FB923C"];

interface ClientDashData {
  patrimonio: number;
  custoInvestido: number;
  unrealizedPnl: number;
  unrealizedPct: number | null;
  activeFundsCount: number;
  fundsBreakdown: { name: string; value: number }[];
  coinsBreakdown: { name: string; value: number; pct24: number | null; priced: boolean }[];
  fixedIncomeTotal: number;
  unpricedCoins: string[]; // symbols sem cotação
  lastUpdate: string | null;
}

async function fetchClientDashboard(userId: string): Promise<ClientDashData> {
  // Lovable migrou para client_funds (view com RLS) em a052128 — preservar.
  // RLS filtra automaticamente por client_id em todas as queries abaixo.
  const todayISO = new Date().toISOString().slice(0, 10);

  const [
    { data: funds },
    { data: holdings },
    { data: prices },
    { data: fi },
  ] = await Promise.all([
    supabase.from("client_funds").select("id, name, status").eq("client_id", userId),
    // Holdings: todas (ativas + encerradas) pra alimentar isHoldingLiveOn corretamente.
    supabase.from("holdings").select("id, coin_symbol, quantity, entry_price_usd, fund_id, status"),
    supabase.from("coin_prices").select("symbol, price_usd, percent_change_24h, updated_at"),
    supabase
      .from("fixed_income")
      .select("id, fund_id, valor_aplicado_usd, taxa_anual_pct, data_registro, data_saida"),
  ]);

  // Realizations só pra alimentar isHoldingLiveOn.
  const holdingIds = (holdings ?? []).map((h) => h.id);
  let realizations: Array<{ holding_id: string; exit_date: string }> = [];
  if (holdingIds.length) {
    const { data: r } = await supabase
      .from("realizations")
      .select("holding_id, exit_date")
      .in("holding_id", holdingIds);
    realizations = r ?? [];
  }

  const priceMap = new Map((prices ?? []).map((p) => [p.symbol.toUpperCase(), p]));
  const fundMap = new Map((funds ?? []).map((f) => [f.id, f]));
  const fundTotals = new Map<string, number>();
  const coinTotals = new Map<string, { value: number; pct: number | null; priced: boolean }>();
  const unpricedSet = new Set<string>();

  // Patrimônio em holdings (apenas vivas, pelo critério unificado de patrimonio.ts).
  let holdingsMarket = 0;
  let holdingsCost = 0;
  for (const h of holdings ?? []) {
    if (!isHoldingLiveOn(h, realizations, todayISO)) continue;
    const sym = h.coin_symbol.toUpperCase();
    const priceEntry = priceMap.get(sym);
    const priced = priceEntry != null;
    const cur = priced ? Number(priceEntry!.price_usd) : Number(h.entry_price_usd);
    const value = Number(h.quantity) * cur;
    const cost = Number(h.quantity) * Number(h.entry_price_usd);
    holdingsMarket += value;
    holdingsCost += cost;
    if (!priced) unpricedSet.add(sym);

    const fundData = fundMap.get(h.fund_id);
    const fname = fundData?.name ?? "—";
    fundTotals.set(fname, (fundTotals.get(fname) ?? 0) + value);

    const cur2 = coinTotals.get(h.coin_symbol);
    coinTotals.set(h.coin_symbol, {
      value: (cur2?.value ?? 0) + value,
      pct: priceEntry?.percent_change_24h ?? null,
      priced: (cur2?.priced ?? true) && priced,
    });
  }

  // Fixed income (aplicações vivas, com accrual até hoje).
  let fixedIncomeTotal = 0;
  for (const f of fi ?? []) {
    const exited = f.data_saida && f.data_saida <= todayISO;
    if (exited) continue;
    const valor = Number(f.valor_aplicado_usd);
    const accrued = fixedIncomeAccrued(
      valor,
      Number(f.taxa_anual_pct),
      f.data_registro,
      todayISO,
    );
    fixedIncomeTotal += valor + accrued;

    const fundData = fundMap.get(f.fund_id);
    const fname = fundData?.name ?? "—";
    fundTotals.set(fname, (fundTotals.get(fname) ?? 0) + valor + accrued);
  }

  const patrimonio = holdingsMarket + fixedIncomeTotal;
  const unrealizedPnl = holdingsMarket - holdingsCost;
  const unrealizedPct = holdingsCost > 0 ? (unrealizedPnl / holdingsCost) * 100 : null;
  const activeFundsCount = (funds ?? []).filter((f) => f.status === "ativo").length;

  return {
    patrimonio,
    custoInvestido: holdingsCost,
    unrealizedPnl,
    unrealizedPct,
    activeFundsCount,
    fundsBreakdown: [...fundTotals.entries()].map(([name, value]) => ({ name, value })),
    coinsBreakdown: [...coinTotals.entries()].map(([name, v]) => ({
      name,
      value: v.value,
      pct24: v.pct,
      priced: v.priced,
    })),
    fixedIncomeTotal,
    unpricedCoins: [...unpricedSet],
    lastUpdate: (prices ?? []).reduce(
      (latest, p) => (!latest || p.updated_at > latest ? p.updated_at : latest),
      null as string | null,
    ),
  };
}

function ClientDashboard() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["client", "dashboard", user?.id],
    queryFn: () => fetchClientDashboard(user!.id),
    enabled: !!user,
  });

  const patrimonio = data?.patrimonio ?? 0;
  const unrealizedPnl = data?.unrealizedPnl ?? 0;
  const unrealizedPct = data?.unrealizedPct ?? null;
  const custoInvestido = data?.custoInvestido ?? 0;
  const activeFundsCount = data?.activeFundsCount ?? 0;
  const fundsBreakdown = data?.fundsBreakdown ?? [];
  const coinsBreakdown = data?.coinsBreakdown ?? [];
  const fixedIncomeTotal = data?.fixedIncomeTotal ?? 0;
  const unpricedCoins = data?.unpricedCoins ?? [];
  const lastUpdate = data?.lastUpdate ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão consolidada do seu patrimônio.</p>
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <RefreshCw className="h-3 w-3" /> Última atualização: {formatDateTime(lastUpdate)}
        </div>
      </div>

      {unpricedCoins.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="py-3 text-xs text-amber-500 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              Patrimônio calculado com cotação de entrada para {unpricedCoins.join(", ")} — cotação atual indisponível.
            </span>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={Wallet}
          label="Patrimônio total"
          value={<Money usd={patrimonio} className="text-2xl text-glow text-primary" />}
          sub={
            fixedIncomeTotal > 0
              ? <span className="text-[10px] text-muted-foreground">inclui <Money usd={fixedIncomeTotal} className="text-[10px]" /> em renda fixa</span>
              : undefined
          }
        />
        <StatCard
          icon={TrendingUp}
          label="P&L não realizado"
          value={
            <div className="leading-tight">
              <span className={cn("text-2xl font-mono tabular-nums", pnlClass(unrealizedPnl))}>
                {unrealizedPnl >= 0 ? "+" : ""}{formatUSD(unrealizedPnl)}
              </span>
              {unrealizedPct != null && (
                <div className={cn("text-xs", pnlClass(unrealizedPnl))}>
                  {formatPct(unrealizedPct)}
                </div>
              )}
            </div>
          }
          sub={<span className="text-[10px] text-muted-foreground">custo: <Money usd={custoInvestido} className="text-[10px]" /></span>}
        />
        <StatCard
          icon={Briefcase}
          label="Fundos ativos"
          value={<span className="text-2xl font-mono">{activeFundsCount}</span>}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Distribuição por fundo</CardTitle></CardHeader>
          <CardContent className="h-64">
            {fundsBreakdown.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Sem dados</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={fundsBreakdown} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} stroke="none">
                    {fundsBreakdown.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#0A0E1A", border: "1px solid #00D4FF55" }} formatter={(v: number) => `$${v.toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Distribuição por moeda</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {coinsBreakdown.length === 0 && <div className="text-sm text-muted-foreground py-8 text-center">Sem posições</div>}
            {coinsBreakdown.sort((a, b) => b.value - a.value).map((c) => (
              <div key={c.name} className="flex items-center justify-between border-b border-border/40 pb-2">
                <span className="font-mono font-semibold inline-flex items-center gap-1">
                  {c.name}
                  {!c.priced && (
                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                  )}
                </span>
                <div className="flex items-center gap-3">
                  <Money usd={c.value} className="text-sm" />
                  {c.priced ? (
                    <Pct value={c.pct24} className="text-xs w-16 text-right" />
                  ) : (
                    <span className="text-xs w-16 text-right text-muted-foreground">—</span>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="border-dashed">
        <CardContent className="py-6 text-center text-xs text-muted-foreground">
          <span className="font-mono uppercase tracking-wider text-primary/70">Em breve</span>
          <div className="mt-1">Gráfico de evolução dos últimos 12 meses (próxima fase).</div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <Card className="border-primary/10">
      <CardContent className="p-5 flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
          {value}
          {sub && <div className="mt-1.5">{sub}</div>}
        </div>
        <div className="rounded-md p-2 bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>
      </CardContent>
    </Card>
  );
}
