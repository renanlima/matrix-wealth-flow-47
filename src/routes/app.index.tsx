import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Money, Pct } from "@/components/Money";
import { Wallet, TrendingUp, Briefcase, RefreshCw } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

export const Route = createFileRoute("/app/")({
  component: ClientDashboard,
});

const COLORS = ["#00D4FF", "#5BE49B", "#A78BFA", "#FFD166", "#FF7AB6", "#7DD3FC", "#FB923C"];

interface ClientDashData {
  aum: number;
  cash: number;
  fundsBreakdown: { name: string; value: number }[];
  coinsBreakdown: { name: string; value: number; pct24: number | null }[];
  lastUpdate: string | null;
}

async function fetchClientDashboard(userId: string): Promise<ClientDashData> {
  const [{ data: funds }, { data: holdings }, { data: prices }, { data: dep }, { data: wd }, { data: real }] = await Promise.all([
    supabase.from("funds").select("id, name").eq("client_id", userId),
    supabase.from("holdings").select("id, coin_symbol, quantity, entry_price_usd, fund_id, status").eq("status", "ativa"),
    supabase.from("coin_prices").select("symbol, price_usd, percent_change_24h, updated_at"),
    supabase.from("deposits").select("amount_usd"),
    supabase.from("withdrawals").select("amount_usd"),
    supabase.from("realizations").select("total_usd"),
  ]);

  const priceMap = new Map((prices ?? []).map((p) => [p.symbol.toUpperCase(), p]));
  const fundMap = new Map((funds ?? []).map((f) => [f.id, f.name]));
  const fundTotals = new Map<string, number>();
  const coinTotals = new Map<string, { value: number; pct: number | null }>();

  let aumHoldings = 0;
  for (const h of holdings ?? []) {
    const p = priceMap.get(h.coin_symbol.toUpperCase());
    const cur = p ? Number(p.price_usd) : Number(h.entry_price_usd);
    const value = Number(h.quantity) * cur;
    aumHoldings += value;
    const fname = fundMap.get(h.fund_id) ?? "—";
    fundTotals.set(fname, (fundTotals.get(fname) ?? 0) + value);
    const cur2 = coinTotals.get(h.coin_symbol);
    coinTotals.set(h.coin_symbol, {
      value: (cur2?.value ?? 0) + value,
      pct: p?.percent_change_24h ?? null,
    });
  }

  const totalDep = (dep ?? []).reduce((s, x) => s + Number(x.amount_usd), 0);
  const totalWd = (wd ?? []).reduce((s, x) => s + Number(x.amount_usd), 0);
  const totalReal = (real ?? []).reduce((s, x) => s + Number(x.total_usd), 0);
  const cashUsd =
    totalDep -
    totalWd -
    (holdings ?? []).reduce((s, h) => s + Number(h.quantity) * Number(h.entry_price_usd), 0) +
    totalReal;

  return {
    aum: aumHoldings + cashUsd,
    cash: cashUsd,
    fundsBreakdown: [...fundTotals.entries()].map(([name, value]) => ({ name, value })),
    coinsBreakdown: [...coinTotals.entries()].map(([name, v]) => ({ name, value: v.value, pct24: v.pct })),
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

  const aum = data?.aum ?? 0;
  const cash = data?.cash ?? 0;
  const fundsBreakdown = data?.fundsBreakdown ?? [];
  const coinsBreakdown = data?.coinsBreakdown ?? [];
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Wallet} label="Patrimônio total" value={<Money usd={aum} className="text-2xl text-glow text-primary" />} />
        <StatCard icon={TrendingUp} label="Caixa USD" value={<Money usd={cash} className="text-xl" />} />
        <StatCard icon={Briefcase} label="Fundos ativos" value={<span className="text-2xl font-mono">{fundsBreakdown.length}</span>} />
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
                <span className="font-mono font-semibold">{c.name}</span>
                <div className="flex items-center gap-3">
                  <Money usd={c.value} className="text-sm" />
                  <Pct value={c.pct24} className="text-xs w-16 text-right" />
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

function StatCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode }) {
  return (
    <Card className="border-primary/10">
      <CardContent className="p-5 flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
          {value}
        </div>
        <div className="rounded-md p-2 bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>
      </CardContent>
    </Card>
  );
}
