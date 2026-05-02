import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Money, Pct } from "@/components/Money";
import { Button } from "@/components/ui/button";
import {
  Users,
  Wallet,
  Activity,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Plus,
  Megaphone,
  ArrowRight,
  DollarSign,
} from "lucide-react";
import { formatDateTime, formatDate } from "@/lib/format";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  CartesianGrid,
} from "recharts";
import { cn } from "@/lib/utils";
import { OnboardingGuide } from "@/components/admin/OnboardingGuide";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

const COLORS = ["#00D4FF", "#5BE49B", "#A78BFA", "#FFD166", "#FF7AB6", "#7DD3FC", "#FB923C", "#F472B6"];

interface Stats {
  clientCount: number;
  aumUsd: number;
  cashUsd: number;
  unrealizedPnl: number;
  unrealizedPct: number;
  realizedMtd: number;
  netFlow30d: number;
  activeHoldings: number;
  lastPriceUpdate: string | null;
  staleCoins: number;
  recentErrors: number;
  aumByClient: { name: string; value: number }[];
  coinDistribution: { name: string; value: number }[];
  cashFlow90d: { date: string; deposits: number; withdrawals: number }[];
  topMovers: { client: string; coin: string; pnl: number; pct: number }[];
  inactiveClients: number;
  firstClientId: string | null;
  firstFundId: string | null;
  hasDeposit: boolean;
  pricesFresh: boolean;
}

async function fetchAdminStats(): Promise<Stats> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const days30Ago = new Date(now.getTime() - 30 * 86400000).toISOString();
  const days90Ago = new Date(now.getTime() - 90 * 86400000);
  const days24Ago = new Date(now.getTime() - 24 * 3600000);

  const [
    { count: clientCount },
    { data: holdings },
    { data: prices },
    { data: deposits },
    { data: withdrawals },
    { data: realizations },
    { data: clients },
    { data: profiles },
    { data: funds },
    { count: errorCount },
  ] = await Promise.all([
    supabase.from("clients").select("id", { count: "exact", head: true }),
    supabase.from("holdings").select("coin_symbol, quantity, entry_price_usd, fund_id, status").eq("status", "ativa"),
    supabase.from("coin_prices").select("symbol, price_usd, updated_at, percent_change_24h"),
    supabase.from("deposits").select("amount_usd, deposit_date, client_id, created_at"),
    supabase.from("withdrawals").select("amount_usd, withdraw_date, client_id, created_at"),
    supabase.from("realizations").select("total_usd, profit_usd, created_at, exit_date"),
    supabase.from("clients").select("id"),
    supabase.from("profiles").select("id, full_name"),
    supabase.from("funds").select("id, client_id, name"),
    supabase.from("coin_price_errors").select("id", { count: "exact", head: true }).gte("occurred_at", days24Ago.toISOString()),
  ]);

  const priceMap = new Map((prices ?? []).map((p) => [p.symbol.toUpperCase(), p]));
  const fundClient = new Map((funds ?? []).map((f) => [f.id, f.client_id]));
  const profMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? "—"]));

  // Per-client AUM and per-coin distribution
  const clientHoldingsValue = new Map<string, number>();
  const coinValue = new Map<string, number>();
  let totalCost = 0;
  let totalMarket = 0;

  // P&L per (client, coin)
  const pnlMap = new Map<string, { client: string; coin: string; cost: number; market: number }>();

  for (const h of holdings ?? []) {
    const p = priceMap.get(h.coin_symbol.toUpperCase());
    const cur = p ? Number(p.price_usd) : Number(h.entry_price_usd);
    const market = Number(h.quantity) * cur;
    const cost = Number(h.quantity) * Number(h.entry_price_usd);
    const cId = fundClient.get(h.fund_id);
    if (cId) clientHoldingsValue.set(cId, (clientHoldingsValue.get(cId) ?? 0) + market);
    coinValue.set(h.coin_symbol, (coinValue.get(h.coin_symbol) ?? 0) + market);
    totalCost += cost;
    totalMarket += market;
    if (cId) {
      const key = `${cId}|${h.coin_symbol}`;
      const cur2 = pnlMap.get(key);
      if (cur2) {
        cur2.cost += cost;
        cur2.market += market;
      } else {
        pnlMap.set(key, {
          client: profMap.get(cId) ?? "—",
          coin: h.coin_symbol,
          cost,
          market,
        });
      }
    }
  }

  // Per-client cash
  const cashByClient = new Map<string, number>();
  for (const d of deposits ?? []) {
    cashByClient.set(d.client_id, (cashByClient.get(d.client_id) ?? 0) + Number(d.amount_usd));
  }
  for (const w of withdrawals ?? []) {
    cashByClient.set(w.client_id, (cashByClient.get(w.client_id) ?? 0) - Number(w.amount_usd));
  }
  // Subtract holdings cost per client and add realizations later (omitted for simplicity in per-client view)

  const totalDep = (deposits ?? []).reduce((s, x) => s + Number(x.amount_usd), 0);
  const totalWd = (withdrawals ?? []).reduce((s, x) => s + Number(x.amount_usd), 0);
  const totalReal = (realizations ?? []).reduce((s, x) => s + Number(x.total_usd), 0);
  const cashUsd = totalDep - totalWd - totalCost + totalReal;

  // AUM by client (top 8)
  const aumByClient: { name: string; value: number }[] = [];
  for (const c of clients ?? []) {
    const holdValue = clientHoldingsValue.get(c.id) ?? 0;
    const cashClient = cashByClient.get(c.id) ?? 0;
    const total = holdValue + cashClient;
    if (total > 0) {
      aumByClient.push({ name: profMap.get(c.id) ?? "—", value: total });
    }
  }
  aumByClient.sort((a, b) => b.value - a.value);

  // Coin distribution
  const coinDistribution = [...coinValue.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // Cashflow 90d (by day)
  const flowMap = new Map<string, { deposits: number; withdrawals: number }>();
  for (const d of deposits ?? []) {
    const dt = new Date(d.deposit_date);
    if (dt >= days90Ago) {
      const k = d.deposit_date;
      const cur = flowMap.get(k) ?? { deposits: 0, withdrawals: 0 };
      cur.deposits += Number(d.amount_usd);
      flowMap.set(k, cur);
    }
  }
  for (const w of withdrawals ?? []) {
    const dt = new Date(w.withdraw_date);
    if (dt >= days90Ago) {
      const k = w.withdraw_date;
      const cur = flowMap.get(k) ?? { deposits: 0, withdrawals: 0 };
      cur.withdrawals += Number(w.amount_usd);
      flowMap.set(k, cur);
    }
  }
  const cashFlow90d = [...flowMap.entries()]
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Top movers (top 5 by abs P&L)
  const movers = [...pnlMap.values()]
    .map((m) => ({
      client: m.client,
      coin: m.coin,
      pnl: m.market - m.cost,
      pct: m.cost > 0 ? ((m.market - m.cost) / m.cost) * 100 : 0,
    }))
    .filter((m) => Math.abs(m.pnl) > 1);
  movers.sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));
  const topMovers = movers.slice(0, 5);

  // Realized MTD
  const realizedMtd = (realizations ?? [])
    .filter((r) => r.exit_date >= startOfMonth.slice(0, 10))
    .reduce((s, r) => s + Number(r.profit_usd ?? 0), 0);

  // Net flow 30d
  const dep30 = (deposits ?? [])
    .filter((d) => d.deposit_date >= days30Ago.slice(0, 10))
    .reduce((s, d) => s + Number(d.amount_usd), 0);
  const wd30 = (withdrawals ?? [])
    .filter((w) => w.withdraw_date >= days30Ago.slice(0, 10))
    .reduce((s, w) => s + Number(w.amount_usd), 0);

  // Stale prices: not updated in last 24h
  const staleCoins = (prices ?? []).filter((p) => new Date(p.updated_at) < days24Ago).length;

  // Inactive clients: no deposit/withdrawal in 90d
  const activeClientIds = new Set<string>();
  for (const d of deposits ?? []) {
    if (new Date(d.deposit_date) >= days90Ago) activeClientIds.add(d.client_id);
  }
  for (const w of withdrawals ?? []) {
    if (new Date(w.withdraw_date) >= days90Ago) activeClientIds.add(w.client_id);
  }
  const inactiveClients = (clients ?? []).filter((c) => !activeClientIds.has(c.id)).length;

  const lastUpdate =
    (prices ?? []).reduce(
      (latest, p) => (!latest || p.updated_at > latest ? p.updated_at : latest),
      null as string | null,
    ) ?? null;

  return {
    clientCount: clientCount ?? 0,
    aumUsd: totalMarket + cashUsd,
    cashUsd,
    unrealizedPnl: totalMarket - totalCost,
    unrealizedPct: totalCost > 0 ? ((totalMarket - totalCost) / totalCost) * 100 : 0,
    realizedMtd,
    netFlow30d: dep30 - wd30,
    activeHoldings: holdings?.length ?? 0,
    lastPriceUpdate: lastUpdate,
    staleCoins,
    recentErrors: errorCount ?? 0,
    aumByClient: aumByClient.slice(0, 10),
    coinDistribution,
    cashFlow90d,
    topMovers,
    inactiveClients,
    firstClientId: (clients ?? [])[0]?.id ?? null,
    firstFundId:
      (funds ?? []).find((f) => f.client_id === (clients ?? [])[0]?.id)?.id ??
      (funds ?? [])[0]?.id ??
      null,
    hasDeposit: (deposits ?? []).length > 0,
    pricesFresh: (prices ?? []).length > 0 && staleCoins === 0,
  };
}

function AdminDashboard() {
  const navigate = useNavigate();
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin", "stats", "v2"],
    queryFn: fetchAdminStats,
    staleTime: 60_000,
  });

  const s = stats;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão consolidada da gestora.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to="/admin/cotacoes">
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Cotações
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/admin/mural">
              <Megaphone className="h-3.5 w-3.5 mr-1" /> Mural
            </Link>
          </Button>
          <Button size="sm" className="glow-cyan" onClick={() => navigate({ to: "/admin/clientes" })}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Novo cliente
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Wallet}
          label="AUM total"
          value={<Money usd={s?.aumUsd ?? 0} className="text-xl text-glow text-primary" />}
        />
        <StatCard
          icon={DollarSign}
          label="Caixa total USD"
          value={<Money usd={s?.cashUsd ?? 0} className="text-xl" />}
        />
        <StatCard
          icon={s && s.unrealizedPnl >= 0 ? TrendingUp : TrendingDown}
          label="P&L não realizado"
          value={
            <div className="flex items-baseline gap-2">
              <Money
                usd={s?.unrealizedPnl ?? 0}
                className={cn(
                  "text-xl",
                  (s?.unrealizedPnl ?? 0) >= 0 ? "text-success" : "text-destructive",
                )}
              />
              <Pct value={s?.unrealizedPct ?? 0} className="text-xs" />
            </div>
          }
        />
        <StatCard
          icon={Users}
          label="Clientes / Posições"
          value={
            <span className="text-xl font-mono">
              {s?.clientCount ?? 0} <span className="text-muted-foreground/60 text-sm">/ {s?.activeHoldings ?? 0}</span>
            </span>
          }
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={TrendingUp}
          label="Lucro realizado (mês)"
          value={
            <Money
              usd={s?.realizedMtd ?? 0}
              className={cn(
                "text-lg",
                (s?.realizedMtd ?? 0) >= 0 ? "text-success" : "text-destructive",
              )}
            />
          }
        />
        <StatCard
          icon={Activity}
          label="Net flow 30d"
          value={
            <Money
              usd={s?.netFlow30d ?? 0}
              className={cn(
                "text-lg",
                (s?.netFlow30d ?? 0) >= 0 ? "text-success" : "text-destructive",
              )}
            />
          }
        />
        <StatCard
          icon={RefreshCw}
          label="Última cotação"
          value={
            <span className="text-sm font-mono text-muted-foreground">
              {formatDateTime(s?.lastPriceUpdate)}
            </span>
          }
        />
      </div>

      {/* Alerts */}
      {s && (s.staleCoins > 0 || s.recentErrors > 0 || s.inactiveClients > 0) && (
        <Card className="border-warning/40 bg-warning/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" /> Alertas operacionais
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1.5">
            {s.staleCoins > 0 && (
              <div className="flex items-center justify-between">
                <span>
                  {s.staleCoins} cotação{s.staleCoins > 1 ? "ões" : ""} sem atualizar há mais de 24h
                </span>
                <Link to="/admin/cotacoes" className="text-primary text-xs hover:underline">
                  Atualizar →
                </Link>
              </div>
            )}
            {s.recentErrors > 0 && (
              <div>{s.recentErrors} erro(s) na captura de preços nas últimas 24h</div>
            )}
            {s.inactiveClients > 0 && (
              <div>{s.inactiveClients} cliente(s) sem movimentação há 90+ dias</div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">AUM por cliente (top 10)</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {!s || s.aumByClient.length === 0 ? (
              <EmptyChart loading={isLoading} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={s.aumByClient} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" tick={{ fill: "#94a3b8", fontSize: 11 }} width={110} />
                  <Tooltip
                    contentStyle={{ background: "#0A0E1A", border: "1px solid #00D4FF55" }}
                    formatter={(v: number) => `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
                  />
                  <Bar dataKey="value" fill="#00D4FF" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição por moeda</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {!s || s.coinDistribution.length === 0 ? (
              <EmptyChart loading={isLoading} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={s.coinDistribution}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={90}
                    stroke="none"
                    label={(entry) => entry.name}
                  >
                    {s.coinDistribution.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#0A0E1A", border: "1px solid #00D4FF55" }}
                    formatter={(v: number) => `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Movimentação de caixa (últimos 90 dias)</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          {!s || s.cashFlow90d.length === 0 ? (
            <EmptyChart loading={isLoading} />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={s.cashFlow90d}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                  tickFormatter={(d) => formatDate(d).slice(0, 5)}
                />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: "#0A0E1A", border: "1px solid #00D4FF55" }}
                  formatter={(v: number) => `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
                  labelFormatter={(l) => formatDate(l)}
                />
                <Area type="monotone" dataKey="deposits" stackId="1" stroke="#5BE49B" fill="#5BE49B40" name="Depósitos" />
                <Area type="monotone" dataKey="withdrawals" stackId="2" stroke="#FF7AB6" fill="#FF7AB640" name="Saques" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Top movers */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Maiores P&L não realizados</CardTitle>
          <Link to="/admin/clientes" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
            Ver clientes <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {!s || s.topMovers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Sem posições com P&L significativo.</p>
          ) : (
            <div className="space-y-2">
              {s.topMovers.map((m, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between border-b border-border/40 pb-2 last:border-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-xs uppercase text-muted-foreground w-6">#{i + 1}</span>
                    <div className="min-w-0">
                      <div className="text-sm truncate">{m.client}</div>
                      <div className="text-xs text-muted-foreground font-mono">{m.coin}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Money
                      usd={m.pnl}
                      className={cn("text-sm", m.pnl >= 0 ? "text-success" : "text-destructive")}
                    />
                    <Pct value={m.pct} className="text-xs w-16 text-right" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyChart({ loading }: { loading: boolean }) {
  return (
    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
      {loading ? "Carregando…" : "Sem dados"}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Card className="border-primary/10">
      <CardContent className="p-5 flex items-start justify-between gap-3 min-h-[88px]">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
          {value}
        </div>
        <div className="rounded-md p-2 bg-primary/10 text-primary shrink-0">
          <Icon className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  );
}
